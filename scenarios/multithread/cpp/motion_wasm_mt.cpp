// motion_wasm_mt.cpp — Multi-threaded motion detection (pthreads)
//
// Same algorithm as scalar version, parallelized across 4 threads.
// Each step (grayscale, blur, diff) is split into pixel/row chunks.
// Uses std::thread backed by Emscripten Web Workers.

#include <cstdint>
#include <cmath>
#include <vector>
#include <thread>

#include <emscripten/emscripten.h>

namespace {

constexpr int NUM_THREADS = 4;

// Reusable buffers (same as scalar)
std::vector<uint8_t> prev_frame_gray;
std::vector<uint8_t> current_frame_gray;
std::vector<uint8_t> blurred_gray;
std::vector<uint8_t> output_rgba;
int last_changed_pixel_count = 0;

// Per-thread pixel counts (avoid atomic contention)
int thread_pixel_counts[NUM_THREADS] = {};

void ensure_buffers(int num_pixels, int rgba_length) {
    current_frame_gray.resize(num_pixels);
    blurred_gray.assign(num_pixels, 0);
    output_rgba.resize(rgba_length);

    if (!prev_frame_gray.empty() &&
        static_cast<int>(prev_frame_gray.size()) != num_pixels) {
        prev_frame_gray.clear();
    }
}

// ===== WORKER FUNCTIONS =====
// Each operates on a [start, end) range, safe for concurrent execution.

// Grayscale: same float formula as scalar
// Each thread converts a chunk of pixels independently.
void grayscale_worker(
    const uint8_t* rgba, uint8_t* gray, int start, int end
) {
    for (int i = start; i < end; i++) {
        const int off = i * 4;
        gray[i] = static_cast<uint8_t>(
            0.299 * rgba[off] + 0.587 * rgba[off + 1] + 0.114 * rgba[off + 2]
        );
    }
}

// Box blur: same 7×7 naive algorithm as scalar
// Each thread handles a horizontal stripe of rows.
// Reads overlap at stripe boundaries (radius=3) but writes don't → safe.
void blur_worker(
    const uint8_t* input, uint8_t* output,
    int width, int height, int radius,
    int start_row, int end_row
) {
    const int side = radius * 2 + 1;
    const int area = side * side;

    // Clamp to valid blur range
    const int y_begin = (start_row < radius) ? radius : start_row;
    const int y_end = (end_row > height - radius) ? height - radius : end_row;

    for (int y = y_begin; y < y_end; y++) {
        for (int x = radius; x < width - radius; x++) {
            int sum = 0;
            for (int ky = -radius; ky <= radius; ky++) {
                for (int kx = -radius; kx <= radius; kx++) {
                    sum += input[(y + ky) * width + (x + kx)];
                }
            }
            output[y * width + x] = static_cast<uint8_t>(sum / area);
        }
    }
}

// Frame diff + output: same logic as scalar
// Each thread handles a pixel range and counts changes independently.
void diff_worker(
    const uint8_t* current, const uint8_t* previous,
    uint8_t* out_rgba, int threshold,
    int start, int end, int thread_id
) {
    int count = 0;
    for (int i = start; i < end; i++) {
        int diff = static_cast<int>(current[i]) - static_cast<int>(previous[i]);
        if (diff < 0) diff = -diff;
        uint8_t val = diff > threshold ? 255 : 0;
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
        const int start = t * chunk;
        const int end = (t == NUM_THREADS - 1) ? num_pixels : start + chunk;
        threads.emplace_back(grayscale_worker, rgba, gray, start, end);
    }
    for (auto& th : threads) th.join();
}

void parallel_blur(
    const uint8_t* input, uint8_t* output,
    int width, int height, int radius
) {
    std::vector<std::thread> threads;
    threads.reserve(NUM_THREADS);
    const int rows_per_thread = height / NUM_THREADS;

    for (int t = 0; t < NUM_THREADS; t++) {
        const int start_row = t * rows_per_thread;
        const int end_row = (t == NUM_THREADS - 1) ? height : start_row + rows_per_thread;
        threads.emplace_back(blur_worker,
            input, output, width, height, radius,
            start_row, end_row);
    }
    for (auto& th : threads) th.join();
}

void parallel_diff(
    const uint8_t* current, const uint8_t* previous,
    uint8_t* out_rgba, int num_pixels, int threshold
) {
    std::vector<std::thread> threads;
    threads.reserve(NUM_THREADS);
    const int chunk = num_pixels / NUM_THREADS;

    for (int t = 0; t < NUM_THREADS; t++) {
        const int start = t * chunk;
        const int end = (t == NUM_THREADS - 1) ? num_pixels : start + chunk;
        threads.emplace_back(diff_worker,
            current, previous, out_rgba, threshold,
            start, end, t);
    }
    for (auto& th : threads) th.join();

    // Sum per-thread counts
    last_changed_pixel_count = 0;
    for (int t = 0; t < NUM_THREADS; t++) {
        last_changed_pixel_count += thread_pixel_counts[t];
    }
}

}  // namespace

extern "C" {

EMSCRIPTEN_KEEPALIVE
void resetMotionDetector() {
    prev_frame_gray.clear();
    current_frame_gray.clear();
    blurred_gray.clear();
    output_rgba.clear();
    last_changed_pixel_count = 0;
}

EMSCRIPTEN_KEEPALIVE
uint8_t* processMotion(const uint8_t* rgba, int width, int height, int threshold) {
    const int num_pixels = width * height;
    const int rgba_length = num_pixels * 4;
    const int radius = 3;

    ensure_buffers(num_pixels, rgba_length);

    // Step 1: Parallel grayscale (same float formula, 4 threads)
    parallel_grayscale(rgba, current_frame_gray.data(), num_pixels);

    // Step 2: Parallel box blur (same 7×7 naive algo, split by row stripes)
    parallel_blur(
        current_frame_gray.data(), blurred_gray.data(),
        width, height, radius
    );

    // Step 3: Parallel frame diff + output
    if (!prev_frame_gray.empty()) {
        parallel_diff(
            blurred_gray.data(), prev_frame_gray.data(),
            output_rgba.data(), num_pixels, threshold
        );
    } else {
        last_changed_pixel_count = 0;
        for (int i = 0; i < rgba_length; i += 4) {
            output_rgba[i] = 0;
            output_rgba[i + 1] = 0;
            output_rgba[i + 2] = 0;
            output_rgba[i + 3] = 255;
        }
    }

    prev_frame_gray = blurred_gray;
    return output_rgba.data();
}

EMSCRIPTEN_KEEPALIVE
int getChangedPixelCount() {
    return last_changed_pixel_count;
}

}
