// motion_wasm_simd.cpp — SIMD-optimized motion detection
//
// Optimizations vs scalar version:
// 1. Integer grayscale (avoid float: (77*R + 150*G + 29*B) >> 8)
// 2. Separable box blur with sliding window (O(1)/pixel instead of O(k²))
// 3. SIMD 128-bit for frame differencing (16 pixels per instruction)
// 4. SIMD 128-bit for RGBA output generation (swizzle + OR)

#include <cstdint>
#include <vector>

#include <wasm_simd128.h>
#include <emscripten/emscripten.h>

namespace {

// Reusable buffers (avoid re-allocation each frame)
std::vector<uint8_t> prev_frame_gray;
std::vector<uint8_t> current_frame_gray;
std::vector<uint8_t> blurred_gray;
std::vector<uint16_t> blur_temp;  // intermediate for separable blur
std::vector<uint8_t> output_rgba;
int last_changed_pixel_count = 0;

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

// ===== STEP 1: GRAYSCALE (Integer approximation via ALU) =====
// gray = (77*R + 150*G + 29*B) >> 8 ≈ 0.300R + 0.586G + 0.113B
// Optimization vs Scenario 1: uses integer multiply + bit-shift instead of float
// ALU (integer) is faster than FPU (float) on WASM
// Error: ±1 per pixel (acceptable for 8-bit grayscale)
void convert_grayscale(const uint8_t* rgba, uint8_t* gray, int num_pixels) {
    for (int i = 0; i < num_pixels; i++) {
        const int off = i * 4;
        gray[i] = static_cast<uint8_t>(
            (77 * rgba[off] + 150 * rgba[off + 1] + 29 * rgba[off + 2]) >> 8
        );
    }
}

// ===== STEP 2: SEPARABLE BOX BLUR (Sliding Window — algorithmic optimization) =====
// Scenario 1 (naive): 4 nested loops, 49 additions per pixel
// This version: separable 2-pass + sliding window, ~4-5 ops per pixel
// Separable: blur2D(x,y) = blurV(blurH(x,y)) — mathematically equivalent
// Sliding window: reuse previous sum, only add 1 new + remove 1 old = O(1)/pixel
// Combined result: ~10x fewer operations than naive

// Horizontal pass: sliding window along each row
// Horizontal pass: slide a window of 7 pixels along each row (left to right)
// Output: row sum of 7 neighbors in uint16 (max = 7×255 = 1785, overflows uint8)
void blur_horizontal(
    const uint8_t* gray, uint16_t* temp, int width, int height, int radius
) {
    const int side = radius * 2 + 1;

    for (int y = 0; y < height; y++) {
        const uint8_t* row = &gray[y * width];
        uint16_t* out = &temp[y * width];

        if (width <= radius * 2) continue;

        // Initialize window sum for position x = radius
        uint16_t sum = 0;
        for (int k = 0; k < side; k++) {
            sum += row[k];
        }
        out[radius] = sum;

        // Slide window: add right edge, remove left edge
        for (int x = radius + 1; x < width - radius; x++) {
            sum += row[x + radius];
            sum -= row[x - radius - 1];
            out[x] = sum;
        }
    }
}

// Vertical pass: slide a window of 7 values along each column (top to bottom)
// Input: horizontal sums from pass 1 (uint16)
// Output: final blurred value = sum of 7 horizontal sums / 49 (uint8)
void blur_vertical(
    const uint16_t* temp, uint8_t* blurred, int width, int height, int radius
) {
    const int area = (radius * 2 + 1) * (radius * 2 + 1);

    for (int x = radius; x < width - radius; x++) {
        if (height <= radius * 2) continue;

        // Initialize window sum for position y = radius
        uint32_t sum = 0;
        for (int k = 0; k < radius * 2 + 1; k++) {
            sum += temp[k * width + x];
        }
        blurred[radius * width + x] = static_cast<uint8_t>(sum / area);

        // Slide window: add bottom edge, remove top edge
        for (int y = radius + 1; y < height - radius; y++) {
            sum += temp[(y + radius) * width + x];
            sum -= temp[(y - radius - 1) * width + x];
            blurred[y * width + x] = static_cast<uint8_t>(sum / area);
        }
    }
}

// ===== STEP 3: FRAME DIFF + OUTPUT (SIMD 128-bit — 16 pixels/instruction) =====
// This is where SIMD acceleration happens:
//   - v128 register holds 16 uint8 grayscale pixels (128 bits / 8 bits = 16)
//   - wasm_u8x16_max/min → unsigned-safe absolute difference for 16 pixels at once
//   - wasm_u8x16_gt      → threshold comparison: 1 instruction replaces 16 if-else
//   - wasm_i8x16_bitmask → extract 1 bit per lane into uint16 for fast popcount
//   - wasm_i8x16_swizzle → expand 16 grayscale bytes → 64 RGBA bytes via shuffle
// Scalar equivalent needs 16 iterations; SIMD does it in 1 iteration
void diff_output_simd(
    const uint8_t* current, const uint8_t* previous,
    uint8_t* out_rgba, int num_pixels, int threshold, int& changed_count
) {
    const v128_t thresh_vec = wasm_u8x16_splat(static_cast<uint8_t>(threshold));

    // Alpha mask: sets byte 3,7,11,15 to 0xFF (alpha = 255)
    const v128_t alpha_mask = wasm_i8x16_const(
        0, 0, 0, -1,  0, 0, 0, -1,  0, 0, 0, -1,  0, 0, 0, -1
    );

    // Shuffle masks: expand 16 motion bytes → 4 groups of 4 RGBA pixels
    // Each group takes 4 bytes and duplicates each to R,G,B positions
    // Alpha position gets any value (will be overridden by alpha_mask OR)
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
    int i = 0;

    // Main SIMD loop: 16 pixels per iteration
    for (; i + 15 < num_pixels; i += 16) {
        // Load 16 current and 16 previous grayscale values
        v128_t cur = wasm_v128_load(&current[i]);
        v128_t prev = wasm_v128_load(&previous[i]);

        // Absolute difference (unsigned safe): max(a,b) - min(a,b)
        v128_t abs_diff = wasm_i8x16_sub(
            wasm_u8x16_max(cur, prev),
            wasm_u8x16_min(cur, prev)
        );

        // Threshold: abs_diff > threshold → 0xFF, else → 0x00
        v128_t motion = wasm_u8x16_gt(abs_diff, thresh_vec);

        // Count changed pixels: extract 1 bit per lane → popcount
        count += __builtin_popcount(wasm_i8x16_bitmask(motion));

        // Expand 16 motion bytes → 64 RGBA bytes (4 stores of 16 bytes)
        // swizzle duplicates each byte to RGB, OR sets alpha to 255
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

    // Scalar remainder (handles last 0-15 pixels)
    for (; i < num_pixels; i++) {
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

    changed_count = count;
}

// Generate black frame (first frame, no previous to compare)
void generate_black_frame(uint8_t* out_rgba, int rgba_length) {
    const v128_t black = wasm_i8x16_const(
        0, 0, 0, -1,  0, 0, 0, -1,  0, 0, 0, -1,  0, 0, 0, -1
    );

    int i = 0;
    for (; i + 15 < rgba_length; i += 16) {
        wasm_v128_store(&out_rgba[i], black);
    }
    for (; i < rgba_length; i += 4) {
        out_rgba[i]     = 0;
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

    // Step 1: RGBA → Grayscale (integer approximation, no float)
    convert_grayscale(rgba, current_frame_gray.data(), num_pixels);

    // Step 2: Separable box blur (sliding window, ~25x fewer ops)
    blur_horizontal(current_frame_gray.data(), blur_temp.data(), width, height, radius);
    blur_vertical(blur_temp.data(), blurred_gray.data(), width, height, radius);

    // Step 3: Frame diff + RGBA output (SIMD 128-bit, 16 pixels/instruction)
    if (!prev_frame_gray.empty()) {
        diff_output_simd(
            blurred_gray.data(), prev_frame_gray.data(),
            output_rgba.data(), num_pixels, threshold, last_changed_pixel_count
        );
    } else {
        last_changed_pixel_count = 0;
        generate_black_frame(output_rgba.data(), rgba_length);
    }

    // Save current blurred frame as reference for next frame (vector copy ~8.3MB)
    prev_frame_gray = blurred_gray;
    return output_rgba.data();
}

EMSCRIPTEN_KEEPALIVE
int getChangedPixelCount() {
    return last_changed_pixel_count;
}

}
