#include <cmath>
#include <cstdint>
#include <vector>

#include <emscripten/emscripten.h>

namespace {

std::vector<uint8_t> prev_frame_gray;
std::vector<uint8_t> current_frame_gray;
std::vector<uint8_t> blurred_gray;
std::vector<uint8_t> output_rgba;
int last_changed_pixel_count = 0;

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

    int pixel_index = 0;
    for (int i = 0; i < rgba_length; i += 4) {
        const double gray_value =
            0.299 * rgba[i] +
            0.587 * rgba[i + 1] +
            0.114 * rgba[i + 2];
        current_frame_gray[pixel_index++] = static_cast<uint8_t>(gray_value);
    }

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

    prev_frame_gray = blurred_gray;
    return output_rgba.data();
}

EMSCRIPTEN_KEEPALIVE
int getChangedPixelCount() {
    return last_changed_pixel_count;
}

}
