// app.js
const videoUpload = document.getElementById('videoUpload');
const videoPlayer = document.getElementById('videoPlayer');
const outputCanvas = document.getElementById('outputCanvas');
const btnRunJS = document.getElementById('btnRunJS');
const btnRunWASM = document.getElementById('btnRunWASM');
const fpsCounter = document.getElementById('fpsCounter');
fpsCounter.style.margin = '10px'
const btnStop = document.getElementById('btnStop');
const motionStatus = document.createElement('div');
const runtimeStatus = document.createElement('div');
const metricsContainer = document.createElement('div');
const latencyMetric = document.createElement('div');
const fpsMetric = document.createElement('div');

// TẠO CANVAS ẨN để trích xuất pixel
const hiddenCanvas = document.createElement('canvas');
const ctxHidden = hiddenCanvas.getContext('2d', { willReadFrequently: true });

// Context của Canvas hiển thị
const ctxOutput = outputCanvas.getContext('2d');

let isProcessingJS = false;
let lastFpsTime = performance.now();
let frameCount = 0;
const motionPixelRatioThreshold = 0.003;
let currentProcessor = 'js';
let lastFrameTimestamp = null;
let latestLatency = 0;
let latestFps = 0;

// Thiết lập UI cho các trạng thái và chỉ số (Text only)
motionStatus.id = 'motionStatus';
motionStatus.className = 'stats';
motionStatus.style.fontSize = '1.1em';
motionStatus.style.color = '#ffd166';
motionStatus.innerText = 'Trạng thái chuyển động: Chưa xử lý';
motionStatus.style.margin = '10px'
fpsCounter.insertAdjacentElement('afterend', motionStatus);

runtimeStatus.id = 'runtimeStatus';
runtimeStatus.className = 'stats';
runtimeStatus.style.fontSize = '1em';
runtimeStatus.style.color = '#9ad1ff';
runtimeStatus.innerText = 'Runtime: JavaScript sẵn sàng | WASM: đang chờ build';
runtimeStatus.style.margin = '10px'
motionStatus.insertAdjacentElement('afterend', runtimeStatus);

metricsContainer.id = 'metricsContainer';
metricsContainer.style.display = 'grid';
metricsContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))';
metricsContainer.style.gap = '12px';
metricsContainer.style.width = 'min(100%, 800px)';
metricsContainer.style.margin = '10px';

[latencyMetric, fpsMetric].forEach((metric) => {
    metric.className = 'stats';
    metric.style.fontSize = '1em';
    metric.style.margin = '0';
    metric.style.padding = '12px 14px';
    metric.style.background = '#2b2b2b';
    metric.style.border = '1px solid #444';
    metric.style.borderRadius = '8px';
});

metricsContainer.append(latencyMetric, fpsMetric);
runtimeStatus.insertAdjacentElement('afterend', metricsContainer);

// --- CÁC HÀM LOGIC ĐÃ LOẠI BỎ CHART ---

function resetMetrics() {
    lastFrameTimestamp = null;
    latestLatency = 0;
    latestFps = 0;
    latencyMetric.innerText = 'Frame Processing Latency: -- ms';
    fpsMetric.innerText = 'FPS: --';
}

function updateMetricsDisplay() {
    latencyMetric.innerText = `Frame Processing Latency: ${latestLatency.toFixed(2)} ms`;
    fpsMetric.innerText = `FPS: ${latestFps.toFixed(1)}`;
}

function resetMotionState() {
    if (typeof prevFrameGray !== 'undefined') {
        prevFrameGray = null;
    }

    if (window.wasmMotion) {
        window.wasmMotion.reset();
    }

    resetMetrics();
}

function updateMotionStatus(hasMotion, changedPixels, totalPixels) {
    const motionPercent = totalPixels === 0 ? 0 : (changedPixels / totalPixels) * 100;

    if (hasMotion) {
        motionStatus.innerText = `Trạng thái chuyển động: Có chuyển động (${motionPercent.toFixed(2)}% pixel thay đổi)`;
        motionStatus.style.color = '#ff6b6b';
        return;
    }

    motionStatus.innerText = `Trạng thái chuyển động: Không có chuyển động (${motionPercent.toFixed(2)}% pixel thay đổi)`;
    motionStatus.style.color = '#7ae582';
}

function updateRuntimeStatus() {
    if (!window.wasmMotion) {
        runtimeStatus.innerText = 'Runtime: JavaScript sẵn sàng | WASM: bridge chưa được nạp';
        runtimeStatus.style.color = '#ff9f1c';
        return;
    }

    if (window.wasmMotion.status === 'ready') {
        runtimeStatus.innerText = 'Runtime: JavaScript sẵn sàng | WASM: sẵn sàng';
        runtimeStatus.style.color = '#9ad1ff';
        return;
    }

    if (window.wasmMotion.status === 'loading') {
        runtimeStatus.innerText = 'Runtime: JavaScript sẵn sàng | WASM: đang nạp runtime';
        runtimeStatus.style.color = '#ffd166';
        return;
    }

    if (window.wasmMotion.status === 'error') {
        runtimeStatus.innerText = 'Runtime: JavaScript sẵn sàng | WASM: chưa build hoặc không tải được';
        runtimeStatus.style.color = '#ff6b6b';
        return;
    }

    runtimeStatus.innerText = 'Runtime: JavaScript sẵn sàng | WASM: đang chờ build';
    runtimeStatus.style.color = '#ff9f1c';
}

function getProcessorLabel() {
    return currentProcessor === 'wasm' ? 'WASM' : 'JavaScript';
}

function setProcessingButtons(isRunning) {
    btnRunJS.disabled = isRunning;
    btnRunWASM.disabled = isRunning;
    btnStop.disabled = !isRunning;
}

async function startProcessing(processorType) {
    if (!videoPlayer.src) {
        alert("Vui lòng tải video lên trước!");
        return;
    }

    if (processorType === 'wasm') {
        try {
            updateRuntimeStatus();
            await window.wasmMotion.init();
            updateRuntimeStatus();
        } catch (error) {
            updateRuntimeStatus();
            alert(error.message);
            return;
        }
    }

    currentProcessor = processorType;
    isProcessingJS = true;
    setProcessingButtons(true);
    resetMotionState();
    videoPlayer.play();
    lastFpsTime = performance.now();
    frameCount = 0;
    motionStatus.innerText = `Trạng thái chuyển động: Đang phân tích bằng ${getProcessorLabel()}...`;
    motionStatus.style.color = '#ffd166';
    fpsCounter.innerText = `Mode: ${getProcessorLabel()} | Video đang chạy`;
    processVideo();
}

// Xử lý sự kiện Upload Video
videoUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        videoPlayer.src = url;
        
        videoPlayer.onloadedmetadata = () => {
            hiddenCanvas.width = videoPlayer.videoWidth;
            hiddenCanvas.height = videoPlayer.videoHeight;
            outputCanvas.width = videoPlayer.videoWidth;
            outputCanvas.height = videoPlayer.videoHeight;
            
            fpsCounter.innerText = `Video sẵn sàng: ${videoPlayer.videoWidth}x${videoPlayer.videoHeight}`;
            motionStatus.innerText = 'Trạng thái chuyển động: Chưa xử lý';
            motionStatus.style.color = '#ffd166';
            updateRuntimeStatus();
            resetMetrics();
        };

        resetMotionState();
    }
});

btnRunJS.addEventListener('click', () => startProcessing('js'));
btnRunWASM.addEventListener('click', () => startProcessing('wasm'));

btnStop.addEventListener('click', () => {
    isProcessingJS = false;
    videoPlayer.pause();
    setProcessingButtons(false);
    fpsCounter.innerText = "Đã dừng xử lý.";
    motionStatus.innerText = 'Trạng thái chuyển động: Đã dừng';
    motionStatus.style.color = '#ffd166';
    resetMetrics();
});

// Vòng lặp chính
function processVideo() {
    if (videoPlayer.paused || videoPlayer.ended || !isProcessingJS) return;

    ctxHidden.drawImage(videoPlayer, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
    const imageData = ctxHidden.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height);

    const startProcessTime = performance.now();
    
    let processedFrame;
    if (currentProcessor === 'wasm') {
        processedFrame = window.wasmMotion.process(imageData, hiddenCanvas.width, hiddenCanvas.height);
    } else {
        const processedData = processMotionJS(imageData, hiddenCanvas.width, hiddenCanvas.height);
        let changedPixels = 0;

        for (let i = 0; i < processedData.data.length; i += 4) {
            if (processedData.data[i] === 255) {
                changedPixels++;
            }
        }

        processedFrame = {
            processedData,
            changedPixels
        };
    }
    
    const endProcessTime = performance.now();
    latestLatency = endProcessTime - startProcessTime;

    const totalPixels = hiddenCanvas.width * hiddenCanvas.height;
    const hasMotion = processedFrame.changedPixels > totalPixels * motionPixelRatioThreshold;
    updateMotionStatus(hasMotion, processedFrame.changedPixels, totalPixels);

    ctxOutput.putImageData(processedFrame.processedData, 0, 0);

    frameCount++;
    const currentTime = performance.now();
    const frameInterval = lastFrameTimestamp === null ? 0 : currentTime - lastFrameTimestamp;
    lastFrameTimestamp = currentTime;

    if (frameInterval > 0) {
        latestFps = 1000 / frameInterval;
    }

    updateMetricsDisplay();
    
    if (currentTime - lastFpsTime >= 1000) {
        frameCount = 0;
        lastFpsTime = currentTime;
    }

    requestAnimationFrame(processVideo);
}

resetMetrics();
updateRuntimeStatus();