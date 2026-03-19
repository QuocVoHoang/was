// app.js
const videoUpload = document.getElementById('videoUpload');
const videoPlayer = document.getElementById('videoPlayer');
const outputCanvas = document.getElementById('outputCanvas');
const btnRunJS = document.getElementById('btnRunJS');
const fpsCounter = document.getElementById('fpsCounter');
const btnStop = document.getElementById('btnStop');

// TẠO CANVAS ẨN (Không đưa vào DOM) để trích xuất pixel
const hiddenCanvas = document.createElement('canvas');
const ctxHidden = hiddenCanvas.getContext('2d', { willReadFrequently: true });

// Context của Canvas hiển thị
const ctxOutput = outputCanvas.getContext('2d');

let isProcessingJS = false;
let lastFpsTime = performance.now();
let frameCount = 0;

// Xử lý sự kiện Upload Video
videoUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        videoPlayer.src = url;
        
        videoPlayer.onloadedmetadata = () => {
            // Gán kích thước thật của video cho Canvas ẩn
            hiddenCanvas.width = videoPlayer.videoWidth;
            hiddenCanvas.height = videoPlayer.videoHeight;
            
            // Gán kích thước cho Canvas đầu ra
            outputCanvas.width = videoPlayer.videoWidth;
            outputCanvas.height = videoPlayer.videoHeight;
            
            fpsCounter.innerText = `Video sẵn sàng: ${videoPlayer.videoWidth}x${videoPlayer.videoHeight}`;
        };
    }
});

btnRunJS.addEventListener('click', () => {
    if (!videoPlayer.src) {
        alert("Vui lòng tải video lên trước!");
        return;
    }
    
    isProcessingJS = true;
    videoPlayer.play();
    lastFpsTime = performance.now();
    frameCount = 0;
    processVideo();
});

// Cập nhật lại sự kiện nút CHẠY để bật/tắt trạng thái nút
btnRunJS.addEventListener('click', () => {
    if (!videoPlayer.src) {
        alert("Vui lòng tải video lên trước!");
        return;
    }
    
    isProcessingJS = true;
    btnRunJS.disabled = true;  // Khóa nút chạy
    btnStop.disabled = false;  // Mở khóa nút dừng
    
    videoPlayer.play();
    lastFpsTime = performance.now();
    frameCount = 0;
    processVideo();
});

// Thêm sự kiện cho nút DỪNG
btnStop.addEventListener('click', () => {
    isProcessingJS = false;     // Dừng vòng lặp requestAnimationFrame
    videoPlayer.pause();        // Tạm dừng video
    
    btnRunJS.disabled = false;  // Mở khóa lại nút chạy
    btnStop.disabled = true;    // Khóa nút dừng
    
    fpsCounter.innerText = "Đã dừng xử lý.";
});cod

// Vòng lặp chính
function processVideo() {
    if (videoPlayer.paused || videoPlayer.ended || !isProcessingJS) return;

    // 1. Vẽ frame hiện tại lên Canvas ẩn (Người dùng không thấy bước này)
    ctxHidden.drawImage(videoPlayer, 0, 0, hiddenCanvas.width, hiddenCanvas.height);

    // 2. Lấy mảng dữ liệu pixel (bước tốn chi phí đọc bộ nhớ)
    const imageData = ctxHidden.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height);

    // Bắt đầu đo thời gian thuật toán chạy
    const startProcessTime = performance.now();
    
    // 3. Gọi hàm xử lý (từ motion.js)
    const processedData = processMotionJS(imageData, hiddenCanvas.width, hiddenCanvas.height);
    
    // Kết thúc đo thời gian thuật toán
    const endProcessTime = performance.now();
    const processDuration = endProcessTime - startProcessTime;

    // 4. In mảng kết quả ra Canvas hiển thị
    ctxOutput.putImageData(processedData, 0, 0);

    // 5. Tính toán và hiển thị FPS
    frameCount++;
    const currentTime = performance.now();
    
    // Cập nhật text mỗi giây (1000ms)
    if (currentTime - lastFpsTime >= 1000) {
        fpsCounter.innerText = `FPS: ${frameCount} | Tốc độ xử lý: ${processDuration.toFixed(1)} ms/frame`;
        frameCount = 0;
        lastFpsTime = currentTime;
    }

    // Lặp lại liên tục theo tốc độ quét của màn hình
    requestAnimationFrame(processVideo);
}