// motion_wasm.cpp — Scenario 1: Scalar WASM (baseline)
//
// Algorithm: Grayscale (float) → Box Blur (naive 7×7) → Frame Differencing
// Identical algorithm to JavaScript baseline, only differs in language (C++/WASM vs JS)
// Purpose: compare same-algorithm performance between JS and WASM

#include <cmath>
#include <cstdint>
#include <vector>

#include <emscripten/emscripten.h>

namespace {

// Reusable buffers — allocated once, reused across frames (no GC overhead)
std::vector<uint8_t> prev_frame_gray;      // Previous frame (blurred) for comparison
std::vector<uint8_t> current_frame_gray;   // Current frame (grayscale)
std::vector<uint8_t> blurred_gray;         // Current frame after blur
std::vector<uint8_t> output_rgba;          // Output RGBA motion mask
int last_changed_pixel_count = 0;          // Number of changed pixels

void ensure_buffers(int num_pixels, int rgba_length) {
    current_frame_gray.resize(num_pixels);
    blurred_gray.assign(num_pixels, 0);
    output_rgba.resize(rgba_length);

    if (!prev_frame_gray.empty() && static_cast<int>(prev_frame_gray.size()) != num_pixels) {
        prev_frame_gray.clear();
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

    ensure_buffers(num_pixels, rgba_length);

    // === STEP 1: GRAYSCALE CONVERSION (float, FPU) ===
    // ITU-R BT.601: Y = 0.299R + 0.587G + 0.114B
    // Uses double (64-bit float) → processed by FPU
    // Single loop: each pixel is independent, no (x,y) needed
    int pixel_index = 0;
    for (int i = 0; i < rgba_length; i += 4) {
        const double gray_value =
            0.299 * rgba[i] +
            0.587 * rgba[i + 1] +
            0.114 * rgba[i + 2];
        current_frame_gray[pixel_index++] = static_cast<uint8_t>(gray_value);
    }

    // === STEP 2: BOX BLUR (naive 2D — 7×7 kernel) ===
    // Same naive algorithm as JS: 4 nested loops (y, x, ky, kx)
    // Each pixel sums all 49 neighbors → divide by 49
    // Complexity: O(n × 49) ≈ 407M ops for 4K
    const int radius = 3;
    const int side = radius * 2 + 1;
    const int matrix_area = side * side;

    for (int y = radius; y < height - radius; ++y) {
        for (int x = radius; x < width - radius; ++x) {
            int sum = 0;

            for (int ky = -radius; ky <= radius; ++ky) {
                for (int kx = -radius; kx <= radius; ++kx) {
                    const int neighbor_index = (y + ky) * width + (x + kx);
                    sum += current_frame_gray[neighbor_index];
                }
            }

            const int center_index = y * width + x;
            blurred_gray[center_index] = static_cast<uint8_t>(sum / matrix_area);
        }
    }

    // === STEP 3: FRAME DIFFERENCING ===
    // Compare current blurred frame vs previous blurred frame
    // |current - prev| > threshold → motion → white (255)
    // |current - prev| ≤ threshold → static → black (0)
    // Writes 4 bytes (RGBA) per pixel to output buffer
    last_changed_pixel_count = 0;
    pixel_index = 0;

    for (int i = 0; i < rgba_length; i += 4) {
        uint8_t output_value = 0;

        if (!prev_frame_gray.empty()) {
            const int diff = std::abs(
                static_cast<int>(blurred_gray[pixel_index]) -
                static_cast<int>(prev_frame_gray[pixel_index])
            );

            if (diff > threshold) {
                output_value = 255;
                ++last_changed_pixel_count;
            }
        }

        output_rgba[i] = output_value;
        output_rgba[i + 1] = output_value;
        output_rgba[i + 2] = output_value;
        output_rgba[i + 3] = 255;
        ++pixel_index;
    }

    // Save current blurred frame as reference for next frame
    // This is a vector copy (memcpy ~8.3MB for 4K)
    prev_frame_gray = blurred_gray;
    return output_rgba.data();
}

EMSCRIPTEN_KEEPALIVE
int getChangedPixelCount() {
    return last_changed_pixel_count;
}

}
