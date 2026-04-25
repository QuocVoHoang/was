// js_motion.js — Baseline JavaScript motion detection
// Algorithm: Grayscale → Box Blur (naive 7×7) → Frame Differencing
// Used as the baseline comparison against WASM in all 4 scenarios
let prevFrameGray = null;

function processMotionJS(imageData, width, height, threshold = 30) {
    const data = imageData.data;
    const numPixels = width * height;
    
    // === STEP 1: GRAYSCALE CONVERSION (float, FPU) ===
    // Convert RGBA (4 channels) to grayscale (1 channel)
    // ITU-R BT.601 formula: Y = 0.299R + 0.587G + 0.114B
    // Uses floating-point arithmetic → processed by FPU (slower than integer)
    // Single flat loop: each pixel is independent, no (x,y) coordinates needed
    const currentFrameGray = new Uint8ClampedArray(numPixels);
    let pixelIndex = 0;
    for (let i = 0; i < data.length; i += 4) {
        currentFrameGray[pixelIndex++] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // === STEP 2: BOX BLUR (naive 2D convolution) ===
    // Smooth the image to reduce noise and prevent false motion detection
    // Naive approach: for each pixel, sum all 7×7=49 neighbors
    // Complexity: O(width × height × 49) ≈ 407M ops for 4K
    // Requires 4 nested loops (y → x → ky → kx) because neighbor
    // positions depend on (x,y) coordinates
    const blurredGray = new Uint8ClampedArray(numPixels);
    const radius = 3; // Radius 3 = 7x7 kernel (49 ops/pixel). Try increasing to 10 if still smooth!
    const side = radius * 2 + 1;
    const matrixArea = side * side;
    
    for (let y = radius; y < height - radius; y++) {
        for (let x = radius; x < width - radius; x++) {
            let sum = 0;
            
            // Iterate kernel matrix around current pixel
            for (let ky = -radius; ky <= radius; ky++) {
                for (let kx = -radius; kx <= radius; kx++) {
                    const neighborIndex = ((y + ky) * width) + (x + kx);
                    sum += currentFrameGray[neighborIndex];
                }
            }
            
            // Compute mean average
            const centerIndex = y * width + x;
            blurredGray[centerIndex] = sum / matrixArea;
        }
    }

    // === STEP 3: FRAME DIFFERENCING ===
    // Compare current blurred frame against previous to detect motion
    // |current - previous| > threshold → motion detected → white pixel (255)
    // |current - previous| ≤ threshold → no motion → black pixel (0)
    // Single flat loop: each pixel is independent, no (x,y) needed
    const outputData = new Uint8ClampedArray(data.length);
    pixelIndex = 0;

    for (let i = 0; i < data.length; i += 4) {
        if (prevFrameGray) {
            const diff = Math.abs(blurredGray[pixelIndex] - prevFrameGray[pixelIndex]);
            
            if (diff > threshold) {
                outputData[i] = 255; outputData[i+1] = 255; outputData[i+2] = 255; outputData[i+3] = 255;
            } else {
                outputData[i] = 0; outputData[i+1] = 0; outputData[i+2] = 0; outputData[i+3] = 255;
            }
        } else {
            outputData[i] = 0; outputData[i+1] = 0; outputData[i+2] = 0; outputData[i+3] = 255;
        }
        pixelIndex++;
    }

    // Save current blurred frame as reference for next frame comparison
    prevFrameGray = blurredGray;

    return new ImageData(outputData, width, height);
}