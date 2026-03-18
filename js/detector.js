/**
 * ============================================
 * Motion Detector - JavaScript Implementation
 * ============================================
 * 
 * Thuật toán phát hiện chuyển động bằng JavaScript thuần
 * So sánh giá trị pixel giữa các frame liên tiếp
 */

class MotionDetectorJS {
    constructor() {
        // Previous frame buffer (RGBA format)
        this.previousFrame = null;
        
        // Frame dimensions
        this.frameWidth = 0;
        this.frameHeight = 0;
        this.frameSize = 0;
        
        // Motion mask buffer
        this.motionMask = null;
        this.motionPixelsCount = 0;
        
        // Configuration
        this.motionThreshold = 30;
        this.sensitivityPercent = 5;
        
        // Performance tracking
        this.totalProcessingTime = 0;
        this.frameCount = 0;
    }

    /**
     * Khởi tạo detector với kích thước frame
     * @param {number} width - Chiều rộng frame
     * @param {number} height - Chiều cao frame
     * @returns {boolean} - true nếu khởi tạo thành công
     */
    init(width, height) {
        // Cleanup old buffers
        this.cleanup();
        
        this.frameWidth = width;
        this.frameHeight = height;
        this.frameSize = width * height * 4; // RGBA
        
        try {
            // Allocate buffers using Uint8ClampedArray for better performance
            this.previousFrame = new Uint8ClampedArray(this.frameSize);
            this.motionMask = new Uint8ClampedArray(this.frameSize);
            
            // Initialize with zeros (already done by default)
            this.motionPixelsCount = 0;
            this.totalProcessingTime = 0;
            this.frameCount = 0;
            
            return true;
        } catch (e) {
            console.error('MotionDetectorJS: Memory allocation failed', e);
            return false;
        }
    }

    /**
     * Giải phóng bộ nhớ
     */
    cleanup() {
        this.previousFrame = null;
        this.motionMask = null;
        this.frameWidth = 0;
        this.frameHeight = 0;
        this.frameSize = 0;
        this.motionPixelsCount = 0;
        this.totalProcessingTime = 0;
        this.frameCount = 0;
    }

    /**
     * Cấu hình threshold và sensitivity
     * @param {number} threshold - Ngưỡng so sánh pixel (0-255)
     * @param {number} sensitivity - Phần trăm vùng chuyển động tối thiểu (0-100)
     */
    configure(threshold, sensitivity) {
        this.motionThreshold = threshold;
        this.sensitivityPercent = sensitivity;
    }

    /**
     * Tính độ khác biệt tuyệt đối
     */
    _absDiff(a, b) {
        return a > b ? a - b : b - a;
    }

    /**
     * Kiểm tra xem pixel có chuyển động hay không
     * Sử dụng weighted difference (BT.601)
     */
    _isMotionPixel(current, previous, idx) {
        const diffR = this._absDiff(current[idx], previous[idx]);
        const diffG = this._absDiff(current[idx + 1], previous[idx + 1]);
        const diffB = this._absDiff(current[idx + 2], previous[idx + 2]);
        
        // BT.601 weights: R=0.299, G=0.587, B=0.114
        // Scaled by 256 for integer math
        const totalDiff = (diffR * 77 + diffG * 150 + diffB * 29) >> 8;
        
        return totalDiff > this.motionThreshold;
    }

    /**
     * Phát hiện chuyển động chính
     * 
     * @param {ImageData|Uint8ClampedArray} currentFrameData - Dữ liệu pixel hiện tại
     * @param {number} width - Chiều rộng frame
     * @param {number} height - Chiều cao frame
     * @returns {object} - Kết quả detection { motionPixels, motionMask, processingTime }
     */
    detectMotion(currentFrameData, width, height) {
        const startTime = performance.now();
        
        // Get pixel data
        const pixels = currentFrameData instanceof ImageData 
            ? currentFrameData.data 
            : currentFrameData;
        
        // Validate
        if (!pixels || !this.previousFrame || !this.motionMask) {
            return { motionPixels: -1, motionMask: null, processingTime: 0 };
        }
        
        // Check dimensions
        if (width !== this.frameWidth || height !== this.frameHeight) {
            this.init(width, height);
        }
        
        this.motionPixelsCount = 0;
        const threshold = this.motionThreshold;
        const prevFrame = this.previousFrame;
        const mask = this.motionMask;
        
        // Process each pixel
        // Optimized loop: cache length, use local variables
        const len = pixels.length;
        
        for (let i = 0; i < len; i += 4) {
            // Check motion
            const diffR = this._absDiff(pixels[i], prevFrame[i]);
            const diffG = this._absDiff(pixels[i + 1], prevFrame[i + 1]);
            const diffB = this._absDiff(pixels[i + 2], prevFrame[i + 2]);
            
            // Weighted difference
            const totalDiff = (diffR * 77 + diffG * 150 + diffB * 29) >> 8;
            
            if (totalDiff > threshold) {
                // Motion detected - highlight with red color
                mask[i] = 255;      // R
                mask[i + 1] = 50;   // G
                mask[i + 2] = 50;   // B
                mask[i + 3] = 180;  // A
                this.motionPixelsCount++;
            } else {
                // No motion - transparent
                mask[i] = 0;
                mask[i + 1] = 0;
                mask[i + 2] = 0;
                mask[i + 3] = 0;
            }
        }
        
        // Copy current frame to previous frame
        this.previousFrame.set(pixels);
        
        const processingTime = performance.now() - startTime;
        this.totalProcessingTime += processingTime;
        this.frameCount++;
        
        return {
            motionPixels: this.motionPixelsCount,
            motionMask: mask,
            processingTime: processingTime
        };
    }

    /**
     * Lấy motion mask
     * @returns {Uint8ClampedArray} - Motion mask data
     */
    getMotionMask() {
        return this.motionMask;
    }

    /**
     * Lấy số pixel chuyển động
     * @returns {number}
     */
    getMotionPixelsCount() {
        return this.motionPixelsCount;
    }

    /**
     * Kiểm tra có chuyển động đáng kể không
     * @returns {boolean}
     */
    hasSignificantMotion() {
        if (this.frameWidth === 0 || this.frameHeight === 0) return false;
        
        const totalPixels = this.frameWidth * this.frameHeight;
        const motionPercentage = (this.motionPixelsCount / totalPixels) * 100;
        
        return motionPercentage >= this.sensitivityPercent;
    }

    /**
     * Lấy thống kê performance
     * @returns {object}
     */
    getStats() {
        return {
            frameCount: this.frameCount,
            totalProcessingTime: this.totalProcessingTime,
            avgProcessingTime: this.frameCount > 0 
                ? this.totalProcessingTime / this.frameCount 
                : 0,
            avgFPS: this.frameCount > 0 && this.totalProcessingTime > 0
                ? (this.frameCount / this.totalProcessingTime) * 1000
                : 0
        };
    }

    /**
     * Version info
     * @returns {string}
     */
    getVersion() {
        return 'MotionDetector JS v1.0.0';
    }
}

// ============================================
// WebAssembly Detector Wrapper
// ============================================

class MotionDetectorWasm {
    constructor() {
        this.module = null;
        this.isReady = false;
        this.frameWidth = 0;
        this.frameHeight = 0;
        
        // Performance tracking
        this.totalProcessingTime = 0;
        this.frameCount = 0;
    }

    /**
     * Khởi tạo với Wasm module
     * @param {object} wasmModule - Emscripten generated module
     * @returns {Promise<boolean>}
     */
    async init(wasmModule) {
        return new Promise((resolve, reject) => {
            try {
                // If wasmModule is a factory function
                if (typeof wasmModule === 'function') {
                    wasmModule().then(module => {
                        this.module = module;
                        this.isReady = true;
                        resolve(true);
                    }).catch(err => {
                        console.error('Failed to initialize Wasm module:', err);
                        reject(err);
                    });
                } else {
                    this.module = wasmModule;
                    this.isReady = true;
                    resolve(true);
                }
            } catch (e) {
                console.error('MotionDetectorWasm init error:', e);
                reject(e);
            }
        });
    }

    /**
     * Khởi tạo detector với kích thước frame
     */
    initDetector(width, height) {
        if (!this.isReady) return false;
        
        this.frameWidth = width;
        this.frameHeight = height;
        this.totalProcessingTime = 0;
        this.frameCount = 0;
        
        return this.module._initDetector(width, height);
    }

    /**
     * Cấu hình threshold và sensitivity
     */
    configure(threshold, sensitivity) {
        if (!this.isReady) return;
        this.module._configureDetector(threshold, sensitivity);
    }

    /**
     * Phát hiện chuyển động
     */
    detectMotion(imageData, width, height) {
        if (!this.isReady) {
            return { motionPixels: -1, motionMask: null, processingTime: 0 };
        }
        
        const startTime = performance.now();
        
        const pixels = imageData instanceof ImageData 
            ? imageData.data 
            : imageData;
        
        // Allocate memory in Wasm heap
        const dataSize = pixels.length;
        const ptr = this.module._malloc(dataSize);
        
        // Copy pixel data to Wasm memory
        this.module.HEAPU8.set(pixels, ptr);
        
        // Call detectMotion
        const motionPixels = this.module._detectMotion(ptr, width, height);
        
        // Get motion mask
        const maskPtr = this.module._getMotionMask();
        const motionMask = new Uint8ClampedArray(
            this.module.HEAPU8.buffer,
            maskPtr,
            width * height * 4
        ).slice(); // Copy to avoid memory issues
        
        // Free allocated memory
        this.module._free(ptr);
        
        const processingTime = performance.now() - startTime;
        this.totalProcessingTime += processingTime;
        this.frameCount++;
        
        return {
            motionPixels: motionPixels,
            motionMask: motionMask,
            processingTime: processingTime
        };
    }

    /**
     * Lấy motion mask
     */
    getMotionMask() {
        if (!this.isReady) return null;
        const maskPtr = this.module._getMotionMask();
        return new Uint8ClampedArray(
            this.module.HEAPU8.buffer,
            maskPtr,
            this.frameWidth * this.frameHeight * 4
        );
    }

    /**
     * Kiểm tra có chuyển động đáng kể không
     */
    hasSignificantMotion() {
        if (!this.isReady) return false;
        return this.module._hasSignificantMotion();
    }

    /**
     * Giải phóng bộ nhớ
     */
    cleanup() {
        if (this.isReady) {
            this.module._cleanupDetector();
        }
        this.frameWidth = 0;
        this.frameHeight = 0;
        this.totalProcessingTime = 0;
        this.frameCount = 0;
    }

    /**
     * Lấy thống kê performance
     */
    getStats() {
        return {
            frameCount: this.frameCount,
            totalProcessingTime: this.totalProcessingTime,
            avgProcessingTime: this.frameCount > 0 
                ? this.totalProcessingTime / this.frameCount 
                : 0,
            avgFPS: this.frameCount > 0 && this.totalProcessingTime > 0
                ? (this.frameCount / this.totalProcessingTime) * 1000
                : 0
        };
    }

    /**
     * Version info
     */
    getVersion() {
        if (!this.isReady) return 'Wasm module not loaded';
        return this.module.UTF8ToString(this.module._getVersion());
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MotionDetectorJS, MotionDetectorWasm };
}