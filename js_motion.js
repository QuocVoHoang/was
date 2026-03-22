// js_motion.js
let prevFrameGray = null;

function processMotionJS(imageData, width, height, threshold = 30) {
    const data = imageData.data;
    const numPixels = width * height;
    
    // 1. Chuyển sang ảnh xám
    const currentFrameGray = new Uint8ClampedArray(numPixels);
    let pixelIndex = 0;
    for (let i = 0; i < data.length; i += 4) {
        currentFrameGray[pixelIndex++] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // 2. Blur với bán kính lớn (Thay đổi radius để test giới hạn)
    const blurredGray = new Uint8ClampedArray(numPixels);
    const radius = 3; // Bán kính 5 = Ma trận 11x11 (121 phép tính/pixel). Hãy thử tăng lên 10 nếu máy vẫn mượt!
    const side = radius * 2 + 1;
    const matrixArea = side * side;
    
    for (let y = radius; y < height - radius; y++) {
        for (let x = radius; x < width - radius; x++) {
            let sum = 0;
            
            // Duyệt ma trận xung quanh pixel hiện tại
            for (let ky = -radius; ky <= radius; ky++) {
                for (let kx = -radius; kx <= radius; kx++) {
                    const neighborIndex = ((y + ky) * width) + (x + kx);
                    sum += currentFrameGray[neighborIndex];
                }
            }
            
            // Tính trung bình cộng
            const centerIndex = y * width + x;
            blurredGray[centerIndex] = sum / matrixArea;
        }
    }

    // 3. So sánh khung hình (Frame Differencing)
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

    prevFrameGray = blurredGray;

    return new ImageData(outputData, width, height);
}