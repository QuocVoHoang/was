/**
 * ============================================
 * Motion Detector - WebAssembly (C++)
 * ============================================
 * 
 * Thuật toán phát hiện chuyển động cho video 4K
 * Sử dụng pixel comparison giữa các frame liên tiếp
 * 
 * Compile với Emscripten:
 * emcc motion_detector.cpp -o motion_detector.js \
 *   -s WASM=1 \
 *   -s EXPORTED_FUNCTIONS="['_malloc', '_free', '_detectMotion', '_initDetector', '_cleanupDetector', '_getMotionMask']" \
 *   -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap', 'HEAPU8']" \
 *   -s ALLOW_MEMORY_GROWTH=1 \
 *   -s ENVIRONMENT='web' \
 *   -O3
 */

#include <cstdint>
#include <cstring>
#include <cmath>
#include <emscripten/emscripten.h>

// ============================================
// Constants & Global Variables
// ============================================

// Previous frame buffer (RGBA format)
static uint8_t* previousFrame = nullptr;
static int frameWidth = 0;
static int frameHeight = 0;
static int frameSize = 0;

// Motion mask buffer
static uint8_t* motionMask = nullptr;
static int motionPixelsCount = 0;

// Configuration
static int motionThreshold = 30;
static int sensitivityPercent = 5;

// ============================================
// Helper Functions
// ============================================

/**
 * Tính độ khác biệt tuyệt đối giữa 2 giá trị
 */
inline uint8_t absDiff(uint8_t a, uint8_t b) {
    return a > b ? a - b : b - a;
}

/**
 * Kiểm tra xem pixel có chuyển động hay không
 * So sánh giá trị RGB của pixel hiện tại với pixel trước đó
 */
inline bool isMotionPixel(const uint8_t* current, const uint8_t* previous, int threshold) {
    // Tính tổng độ khác biệt của 3 kênh RGB
    uint8_t diffR = absDiff(current[0], previous[0]);
    uint8_t diffG = absDiff(current[1], previous[1]);
    uint8_t diffB = absDiff(current[2], previous[2]);
    
    // Sử dụng weighted difference (mắt người nhạy cảm hơn với Green)
    uint16_t totalDiff = diffR * 77 + diffG * 150 + diffB * 29; // BT.601 weights
    totalDiff /= 256; // Normalize
    
    return totalDiff > threshold;
}

// ============================================
// Exported Functions (callable from JS)
// ============================================

/**
 * Khởi tạo detector với kích thước frame
 * Phải gọi trước khi detectMotion
 */
extern "C" {

EMSCRIPTEN_KEEPALIVE
bool initDetector(int width, int height) {
    // Cleanup old buffers if exists
    if (previousFrame != nullptr) {
        delete[] previousFrame;
        previousFrame = nullptr;
    }
    if (motionMask != nullptr) {
        delete[] motionMask;
        motionMask = nullptr;
    }
    
    frameWidth = width;
    frameHeight = height;
    frameSize = width * height * 4; // RGBA
    
    // Allocate buffers
    previousFrame = new (std::nothrow) uint8_t[frameSize];
    motionMask = new (std::nothrow) uint8_t[frameSize];
    
    if (previousFrame == nullptr || motionMask == nullptr) {
        // Memory allocation failed
        if (previousFrame) delete[] previousFrame;
        if (motionMask) delete[] motionMask;
        return false;
    }
    
    // Initialize with zeros
    memset(previousFrame, 0, frameSize);
    memset(motionMask, 0, frameSize);
    
    motionPixelsCount = 0;
    
    return true;
}

/**
 * Giải phóng bộ nhớ
 */
EMSCRIPTEN_KEEPALIVE
void cleanupDetector() {
    if (previousFrame != nullptr) {
        delete[] previousFrame;
        previousFrame = nullptr;
    }
    if (motionMask != nullptr) {
        delete[] motionMask;
        motionMask = nullptr;
    }
    frameWidth = 0;
    frameHeight = 0;
    frameSize = 0;
    motionPixelsCount = 0;
}

/**
 * Cấu hình threshold và sensitivity
 * @param threshold Ngưỡng so sánh pixel (0-255)
 * @param sensitivity Phần trăm vùng chuyển động tối thiểu để coi là có motion (0-100)
 */
EMSCRIPTEN_KEEPALIVE
void configureDetector(int threshold, int sensitivity) {
    motionThreshold = threshold;
    sensitivityPercent = sensitivity;
}

/**
 * Phát hiện chuyển động chính
 * 
 * @param currentFrameData Pointer đến dữ liệu pixel hiện tại (RGBA)
 * @param width Chiều rộng frame
 * @param height Chiều cao frame
 * @return Số pixel có chuyển động
 */
EMSCRIPTEN_KEEPALIVE
int detectMotion(uint8_t* currentFrameData, int width, int height) {
    // Validate input
    if (currentFrameData == nullptr || previousFrame == nullptr || motionMask == nullptr) {
        return -1;
    }
    
    // Check if dimensions changed
    if (width != frameWidth || height != frameHeight) {
        initDetector(width, height);
    }
    
    motionPixelsCount = 0;
    int totalPixels = width * height;
    
    // Process each pixel
    // Sử dụng SIMD-like processing: process 4 pixels at a time when possible
    int pixelIndex = 0;
    
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            int idx = pixelIndex * 4; // RGBA = 4 bytes per pixel
            
            // Check if this pixel has motion
            bool hasMotion = isMotionPixel(
                &currentFrameData[idx],
                &previousFrame[idx],
                motionThreshold
            );
            
            if (hasMotion) {
                // Highlight motion pixel (red color with some transparency)
                motionMask[idx] = 255;     // R
                motionMask[idx + 1] = 50;  // G
                motionMask[idx + 2] = 50;  // B
                motionMask[idx + 3] = 180; // A (semi-transparent)
                motionPixelsCount++;
            } else {
                // No motion - transparent
                motionMask[idx] = 0;
                motionMask[idx + 1] = 0;
                motionMask[idx + 2] = 0;
                motionMask[idx + 3] = 0;
            }
            
            pixelIndex++;
        }
    }
    
    // Copy current frame to previous frame for next comparison
    memcpy(previousFrame, currentFrameData, frameSize);
    
    return motionPixelsCount;
}

/**
 * Lấy motion mask buffer
 * @return Pointer đến motion mask data (RGBA)
 */
EMSCRIPTEN_KEEPALIVE
uint8_t* getMotionMask() {
    return motionMask;
}

/**
 * Lấy số pixel chuyển động từ lần detect cuối
 */
EMSCRIPTEN_KEEPALIVE
int getMotionPixelsCount() {
    return motionPixelsCount;
}

/**
 * Kiểm tra xem có chuyển động đáng kể hay không
 * Dựa trên sensitivity percentage
 */
EMSCRIPTEN_KEEPALIVE
bool hasSignificantMotion() {
    if (frameWidth == 0 || frameHeight == 0) return false;
    
    int totalPixels = frameWidth * frameHeight;
    double motionPercentage = (double)motionPixelsCount / totalPixels * 100.0;
    
    return motionPercentage >= sensitivityPercent;
}

/**
 * Version info
 */
EMSCRIPTEN_KEEPALIVE
const char* getVersion() {
    return "MotionDetector C++ v1.0.0";
}

} // extern "C"

// ============================================
// Main function (required by Emscripten)
// ============================================

int main() {
    // This is called when the WASM module is loaded
    // We don't need to do anything here for our use case
    return 0;
}