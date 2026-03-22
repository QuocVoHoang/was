// detector.cpp
#include <cstdint>
#include <vector>
#include <cmath>
#include <emscripten.h>

// Biến toàn cục để lưu lại frame xám đã làm mờ của lần trước
std::vector<uint8_t> prevFrameGray;
bool isFirstFrame = true;

extern "C" {

// Sử dụng EMSCRIPTEN_KEEPALIVE để báo cho compiler biết hàm này sẽ được gọi từ JS
EMSCRIPTEN_KEEPALIVE
void processMotionWasm(uint8_t* data, int width, int height, int threshold, int radius) {
    int numPixels = width * height;
    
    // Khởi tạo kích thước prevFrameGray nếu là lần đầu chạy hoặc kích thước ảnh thay đổi
    if (prevFrameGray.size() != static_cast<size_t>(numPixels)) {
        prevFrameGray.assign(numPixels, 0);
        isFirstFrame = true;
    }

    std::vector<uint8_t> currentFrameGray(numPixels);
    
    // 1. Chuyển sang ảnh xám
    int pixelIndex = 0;
    for (int i = 0; i < numPixels * 4; i += 4) {
        currentFrameGray[pixelIndex++] = static_cast<uint8_t>(
            0.299f * data[i] + 0.587f * data[i + 1] + 0.114f * data[i + 2]
        );
    }

    // 2. Box Blur
    std::vector<uint8_t> blurredGray(numPixels, 0);
    int blurMatrixSide = radius * 2 + 1;
    int numBlurPixels = blurMatrixSide * blurMatrixSide;

    for (int y = radius; y < height - radius; y++) {
        for (int x = radius; x < width - radius; x++) {
            int sum = 0;
            for (int ky = -radius; ky <= radius; ky++) {
                for (int kx = -radius; kx <= radius; kx++) {
                    int neighborIndex = ((y + ky) * width) + (x + kx);
                    sum += currentFrameGray[neighborIndex];
                }
            }
            int centerIndex = y * width + x;
            blurredGray[centerIndex] = sum / numBlurPixels;
        }
    }

    // 3. So sánh và ghi đè thẳng kết quả lên mảng 'data' ban đầu
    pixelIndex = 0;
    for (int i = 0; i < numPixels * 4; i += 4) {
        if (!isFirstFrame) {
            int diff = std::abs(blurredGray[pixelIndex] - prevFrameGray[pixelIndex]);
            
            if (diff > threshold) {
                data[i] = 255;     // R
                data[i+1] = 255;   // G
                data[i+2] = 255;   // B
                data[i+3] = 255;   // A
            } else {
                data[i] = 0;
                data[i+1] = 0;
                data[i+2] = 0;
                data[i+3] = 255;
            }
        } else {
            // Lần đầu tiên chạy, xuất màn hình đen
            data[i] = 0;
            data[i+1] = 0;
            data[i+2] = 0;
            data[i+3] = 255;
        }
        pixelIndex++;
    }

    // Lưu lại khung hình cho lần lặp sau
    prevFrameGray = blurredGray;
    isFirstFrame = false;
}

} // end extern "C"