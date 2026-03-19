// js_motion.js
let prevFrameGray = null;

function processMotionJS(imageData, width, height, threshold = 30) {
    const data = imageData.data;
    const numPixels = width * height;
    
    // 1. Chuyển sang ảnh xám (Grayscale)
    const currentFrameGray = new Uint8ClampedArray(numPixels);
    let pixelIndex = 0;
    for (let i = 0; i < data.length; i += 4) {
        currentFrameGray[pixelIndex++] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // 2. BƯỚC NẶNG: Box Blur 3x3 (Làm mờ để khử nhiễu)
    const blurredGray = new Uint8ClampedArray(numPixels);
    
    // Bỏ qua viền ngoài cùng để tránh lỗi out-of-bounds
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let sum = 0;
            
            // Duyệt ma trận 3x3 xung quanh pixel hiện tại
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    // Tính chỉ số (index) của pixel lân cận trong mảng 1 chiều
                    const neighborIndex = ((y + ky) * width) + (x + kx);
                    sum += currentFrameGray[neighborIndex];
                }
            }
            
            // Lấy trung bình cộng của 9 pixel
            const centerIndex = y * width + x;
            blurredGray[centerIndex] = sum / 9;
        }
    }

    // 3. So sánh khung hình (Frame Differencing)
    const outputData = new Uint8ClampedArray(data.length);
    pixelIndex = 0;

    for (let i = 0; i < data.length; i += 4) {
        if (prevFrameGray) {
            // So sánh dựa trên ảnh đã làm mờ
            const diff = Math.abs(blurredGray[pixelIndex] - prevFrameGray[pixelIndex]);
            
            if (diff > threshold) {
                outputData[i] = 255;     // R
                outputData[i+1] = 255;   // G
                outputData[i+2] = 255;   // B
                outputData[i+3] = 255;   // A
            } else {
                outputData[i] = 0;
                outputData[i+1] = 0;
                outputData[i+2] = 0;
                outputData[i+3] = 255;
            }
        } else {
            outputData[i] = 0; outputData[i+1] = 0; outputData[i+2] = 0; outputData[i+3] = 255;
        }
        pixelIndex++;
    }

    // Lưu lại khung hình (đã làm mờ) cho lần lặp sau
    prevFrameGray = blurredGray;

    return new ImageData(outputData, width, height);
}