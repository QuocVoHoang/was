// motion_wasm_simd_mt.cpp — SIMD + Multi-threaded motion detection
//
// Combines best of both worlds:
// - From SIMD scenario: integer grayscale, separable blur, SIMD 128-bit diff
// - From MT scenario:   4 threads parallelize each step
//
// Each thread processes a stripe/chunk using optimized algorithms + SIMD.

#include <cstdint>
#include <vector>
#include <thread>

#include <wasm_simd128.h>
#include <emscripten/emscripten.h>

namespace {

constexpr int NUM_THREADS = 4;

// Reusable buffers
std::vector<uint8_t> prev_frame_gray;
std::vector<uint8_t> current_frame_gray;
std::vector<uint8_t> blurred_gray;
std::vector<uint16_t> blur_temp;  // intermediate for separable blur
std::vector<uint8_t> output_rgba;
int last_changed_pixel_count = 0;

// Per-thread pixel counts (avoid atomic contention)
int thread_pixel_counts[NUM_THREADS] = {};

void ensure_buffers(int num_pixels, int rgba_length) {
    current_frame_gray.resize(num_pixels);
    blurred_gray.assign(num_pixels, 0);
    blur_temp.assign(num_pixels, 0);
    output_rgba.resize(rgba_length);

    if (!prev_frame_gray.empty() &&
        static_cast<int>(prev_frame_gray.size()) != num_pixels) {
        prev_frame_gray.clear();
    }
}

// ===== STEP 1: PARALLEL INTEGER GRAYSCALE =====
// gray = (77*R + 150*G + 29*B) >> 8 (no float, from SIMD scenario)
// Each thread converts a pixel chunk independently.
void grayscale_worker(
    const uint8_t* rgba, uint8_t* gray, int start, int end
) {
    for (int i = start; i < end; i++) {
        const int off = i * 4;
        gray[i] = static_cast<uint8_t>(
            (77 * rgba[off] + 150 * rgba[off + 1] + 29 * rgba[off + 2]) >> 8
        );
    }
}

// ===== STEP 2: PARALLEL SEPARABLE BLUR =====
// From SIMD scenario: sliding window O(1)/pixel instead of naive O(49)/pixel.
// Parallelized: horizontal pass splits rows, vertical pass splits columns.

// Horizontal pass: each thread processes a stripe of rows
void blur_h_worker(
    const uint8_t* gray, uint16_t* temp, int width,
    int start_row, int end_row, int radius
) {
    const int side = radius * 2 + 1;

    for (int y = start_row; y < end_row; y++) {
        const uint8_t* row = &gray[y * width];
        uint16_t* out = &temp[y * width];

        if (width <= radius * 2) continue;

        // Initialize window for x = radius
        uint16_t sum = 0;
        for (int k = 0; k < side; k++) {
            sum += row[k];
        }
        out[radius] = sum;

        // Slide: add right, remove left
        for (int x = radius + 1; x < width - radius; x++) {
            sum += row[x + radius];
            sum -= row[x - radius - 1];
            out[x] = sum;
        }
    }
}

// Vertical pass: each thread processes a range of columns
void blur_v_worker(
    const uint16_t* temp, uint8_t* blurred, int width, int height,
    int start_col, int end_col, int radius
) {
    const int area = (radius * 2 + 1) * (radius * 2 + 1);
    const int side = radius * 2 + 1;

    for (int x = start_col; x < end_col; x++) {
        if (height <= radius * 2) continue;

        // Initialize window for y = radius
        uint32_t sum = 0;
        for (int k = 0; k < side; k++) {
            sum += temp[k * width + x];
        }
        blurred[radius * width + x] = static_cast<uint8_t>(sum / area);

        // Slide: add bottom, remove top
        for (int y = radius + 1; y < height - radius; y++) {
            sum += temp[(y + radius) * width + x];
            sum -= temp[(y - radius - 1) * width + x];
            blurred[y * width + x] = static_cast<uint8_t>(sum / area);
        }
    }
}

// ===== STEP 3: PARALLEL SIMD FRAME DIFF + OUTPUT =====
// Each thread handles a pixel chunk using SIMD 128-bit (16 pixels/instruction).
void diff_simd_worker(
    const uint8_t* current, const uint8_t* previous,
    uint8_t* out_rgba, int threshold,
    int start, int end, int thread_id
) {
    const v128_t thresh_vec = wasm_u8x16_splat(static_cast<uint8_t>(threshold));

    const v128_t alpha_mask = wasm_i8x16_const(
        0, 0, 0, -1,  0, 0, 0, -1,  0, 0, 0, -1,  0, 0, 0, -1
    );

    const v128_t expand_0 = wasm_i8x16_const(
         0, 0, 0, 0,   1, 1, 1, 0,   2, 2, 2, 0,   3, 3, 3, 0
    );
    const v128_t expand_1 = wasm_i8x16_const(
         4, 4, 4, 0,   5, 5, 5, 0,   6, 6, 6, 0,   7, 7, 7, 0
    );
    const v128_t expand_2 = wasm_i8x16_const(
         8, 8, 8, 0,   9, 9, 9, 0,  10,10,10, 0,  11,11,11, 0
    );
    const v128_t expand_3 = wasm_i8x16_const(
        12,12,12, 0,  13,13,13, 0,  14,14,14, 0,  15,15,15, 0
    );

    int count = 0;
    int i = start;

    // SIMD loop: 16 pixels per iteration
    for (; i + 15 < end; i += 16) {
        v128_t cur = wasm_v128_load(&current[i]);
        v128_t prev = wasm_v128_load(&previous[i]);

        // Absolute difference (unsigned safe)
        v128_t abs_diff = wasm_i8x16_sub(
            wasm_u8x16_max(cur, prev),
            wasm_u8x16_min(cur, prev)
        );

        // Threshold comparison: 16 pixels at once
        v128_t motion = wasm_u8x16_gt(abs_diff, thresh_vec);

        // Count changed pixels via bitmask
        count += __builtin_popcount(wasm_i8x16_bitmask(motion));

        // Expand 16 motion bytes → 64 RGBA bytes (4 stores)
        uint8_t* dst = &out_rgba[i * 4];
        wasm_v128_store(dst,
            wasm_v128_or(wasm_i8x16_swizzle(motion, expand_0), alpha_mask));
        wasm_v128_store(dst + 16,
            wasm_v128_or(wasm_i8x16_swizzle(motion, expand_1), alpha_mask));
        wasm_v128_store(dst + 32,
            wasm_v128_or(wasm_i8x16_swizzle(motion, expand_2), alpha_mask));
        wasm_v128_store(dst + 48,
            wasm_v128_or(wasm_i8x16_swizzle(motion, expand_3), alpha_mask));
    }

    // Scalar remainder (0-15 pixels)
    for (; i < end; i++) {
        const int diff = static_cast<int>(current[i]) > static_cast<int>(previous[i])
            ? current[i] - previous[i]
            : previous[i] - current[i];
        const uint8_t val = diff > threshold ? 255 : 0;
        if (val) count++;

        const int off = i * 4;
        out_rgba[off]     = val;
        out_rgba[off + 1] = val;
        out_rgba[off + 2] = val;
        out_rgba[off + 3] = 255;
    }

    thread_pixel_counts[thread_id] = count;
}

// ===== PARALLEL DISPATCH =====

void parallel_grayscale(const uint8_t* rgba, uint8_t* gray, int num_pixels) {
    std::vector<std::thread> threads;
    threads.reserve(NUM_THREADS);
    const int chunk = num_pixels / NUM_THREADS;

    for (int t = 0; t < NUM_THREADS; t++) {
        const int s = t * chunk;
        const int e = (t == NUM_THREADS - 1) ? num_pixels : s + chunk;
        threads.emplace_back(grayscale_worker, rgba, gray, s, e);
    }
    for (auto& th : threads) th.join();
}

void parallel_blur_h(
    const uint8_t* gray, uint16_t* temp, int width, int height, int radius
) {
    std::vector<std::thread> threads;
    threads.reserve(NUM_THREADS);
    const int rows_per = height / NUM_THREADS;

    for (int t = 0; t < NUM_THREADS; t++) {
        const int sr = t * rows_per;
        const int er = (t == NUM_THREADS - 1) ? height : sr + rows_per;
        threads.emplace_back(blur_h_worker, gray, temp, width, sr, er, radius);
    }
    for (auto& th : threads) th.join();
}

void parallel_blur_v(
    const uint16_t* temp, uint8_t* blurred, int width, int height, int radius
) {
    std::vector<std::thread> threads;
    threads.reserve(NUM_THREADS);
    const int usable = width - 2 * radius;
    const int cols_per = usable / NUM_THREADS;

    for (int t = 0; t < NUM_THREADS; t++) {
        const int sc = radius + t * cols_per;
        const int ec = (t == NUM_THREADS - 1) ? width - radius : sc + cols_per;
        threads.emplace_back(blur_v_worker, temp, blurred, width, height, sc, ec, radius);
    }
    for (auto& th : threads) th.join();
}

void parallel_diff_simd(
    const uint8_t* current, const uint8_t* previous,
    uint8_t* out_rgba, int num_pixels, int threshold
) {
    std::vector<std::thread> threads;
    threads.reserve(NUM_THREADS);

    // Align chunks to 16-byte boundaries for optimal SIMD
    const int chunk = (num_pixels / NUM_THREADS / 16) * 16;

    for (int t = 0; t < NUM_THREADS; t++) {
        const int s = t * chunk;
        const int e = (t == NUM_THREADS - 1) ? num_pixels : s + chunk;
        threads.emplace_back(diff_simd_worker,
            current, previous, out_rgba, threshold, s, e, t);
    }
    for (auto& th : threads) th.join();

    last_changed_pixel_count = 0;
    for (int t = 0; t < NUM_THREADS; t++) {
        last_changed_pixel_count += thread_pixel_counts[t];
    }
}

// Black frame using SIMD
void generate_black_frame(uint8_t* out_rgba, int rgba_length) {
    const v128_t black = wasm_i8x16_const(
        0, 0, 0, -1,  0, 0, 0, -1,  0, 0, 0, -1,  0, 0, 0, -1
    );
    int i = 0;
    for (; i + 15 < rgba_length; i += 16) {
        wasm_v128_store(&out_rgba[i], black);
    }
    for (; i < rgba_length; i += 4) {
        out_rgba[i] = 0;
        out_rgba[i + 1] = 0;
        out_rgba[i + 2] = 0;
        out_rgba[i + 3] = 255;
    }
}

}  // namespace

extern "C" {

EMSCRIPTEN_KEEPALIVE
void resetMotionDetector() {
    prev_frame_gray.clear();
    current_frame_gray.clear();
    blurred_gray.clear();
    blur_temp.clear();
    output_rgba.clear();
    last_changed_pixel_count = 0;
}

EMSCRIPTEN_KEEPALIVE
uint8_t* processMotion(const uint8_t* rgba, int width, int height, int threshold) {
    const int num_pixels = width * height;
    const int rgba_length = num_pixels * 4;
    const int radius = 3;

    ensure_buffers(num_pixels, rgba_length);

    // Step 1: Parallel integer grayscale (4 threads, no float)
    parallel_grayscale(rgba, current_frame_gray.data(), num_pixels);

    // Step 2: Parallel separable blur (4 threads × 2 passes, O(1)/pixel)
    parallel_blur_h(current_frame_gray.data(), blur_temp.data(), width, height, radius);
    parallel_blur_v(blur_temp.data(), blurred_gray.data(), width, height, radius);

    // Step 3: Parallel SIMD diff + output (4 threads × 16 pixels/instruction)
    if (!prev_frame_gray.empty()) {
        parallel_diff_simd(
            blurred_gray.data(), prev_frame_gray.data(),
            output_rgba.data(), num_pixels, threshold
        );
    } else {
        last_changed_pixel_count = 0;
        generate_black_frame(output_rgba.data(), rgba_length);
    }

    prev_frame_gray = blurred_gray;
    return output_rgba.data();
}

EMSCRIPTEN_KEEPALIVE
int getChangedPixelCount() {
    return last_changed_pixel_count;
}

}
