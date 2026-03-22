// js_motion.js
let prevFrameGray = null;

// Thêm tham số radius (mặc định là 1 để giữ nguyên bản gốc là ma trận 3x3)
function processMotionJS(imageData, width, height, threshold = 30, radius = 1) {
    const data = imageData.data;
    const numPixels = width * height;
    
    // 1. Chuyển sang ảnh xám (Grayscale)
    const currentFrameGray = new Uint8ClampedArray(numPixels);
    let pixelIndex = 0;
    for (let i = 0; i < data.length; i += 4) {
        currentFrameGray[pixelIndex++] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // 2. BƯỚC NẶNG: Box Blur với custom radius
    const blurredGray = new Uint8ClampedArray(numPixels);
    
    // Tính tổng số pixel trong ma trận blur dựa vào radius
    const blurMatrixSide = radius * 2 + 1;
    const numBlurPixels = blurMatrixSide * blurMatrixSide;
    
    // Bỏ qua viền ngoài cùng dựa trên kích thước radius để tránh lỗi out-of-bounds
    for (let y = radius; y < height - radius; y++) {
        for (let x = radius; x < width - radius; x++) {
            let sum = 0;
            
            // Duyệt ma trận xung quanh pixel hiện tại mở rộng theo radius
            for (let ky = -radius; ky <= radius; ky++) {
                for (let kx = -radius; kx <= radius; kx++) {
                    const neighborIndex = ((y + ky) * width) + (x + kx);
                    sum += currentFrameGray[neighborIndex];
                }
            }
            
            // Lấy trung bình cộng dựa trên tổng số pixel của ma trận
            const centerIndex = y * width + x;
            blurredGray[centerIndex] = sum / numBlurPixels;
        }
    }

    // 3. So sánh khung hình (Frame Differencing)
    const outputData = new Uint8ClampedArray(data.length);
    pixelIndex = 0;

    for (let i = 0; i < data.length; i += 4) {
        if (prevFrameGray) {
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