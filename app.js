// app.js
const videoUpload = document.getElementById('videoUpload');
const videoPlayer = document.getElementById('videoPlayer');
const outputCanvas = document.getElementById('outputCanvas');
const btnRunJS = document.getElementById('btnRunJS');
const btnRunWASM = document.getElementById('btnRunWASM');
const fpsCounter = document.getElementById('fpsCounter');
const btnStop = document.getElementById('btnStop');
const motionStatus = document.createElement('div');
const runtimeStatus = document.createElement('div');
const metricsContainer = document.createElement('div');
const latencyMetric = document.createElement('div');
const fpsMetric = document.createElement('div');
const cpuMetric = document.createElement('div');
const chartContainer = document.createElement('div');
const maxChartPoints = 180;

// TẠO CANVAS ẨN (Không đưa vào DOM) để trích xuất pixel
const hiddenCanvas = document.createElement('canvas');
const ctxHidden = hiddenCanvas.getContext('2d', { willReadFrequently: true });

// Context của Canvas hiển thị
const ctxOutput = outputCanvas.getContext('2d');

function createChart(title, color, unit, fixedMax = null) {
    const wrapper = document.createElement('div');
    const label = document.createElement('div');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    wrapper.style.width = 'min(100%, 800px)';
    wrapper.style.background = '#2b2b2b';
    wrapper.style.border = '1px solid #444';
    wrapper.style.borderRadius = '10px';
    wrapper.style.padding = '12px';
    wrapper.style.boxSizing = 'border-box';

    label.innerText = title;
    label.style.fontFamily = 'monospace';
    label.style.fontSize = '0.95em';
    label.style.fontWeight = 'bold';
    label.style.color = color;
    label.style.marginBottom = '8px';

    canvas.width = 800;
    canvas.height = 160;
    canvas.style.width = '100%';
    canvas.style.height = '160px';
    canvas.style.display = 'block';
    canvas.style.background = '#181818';
    canvas.style.border = '1px solid #333';
    canvas.style.borderRadius = '8px';

    wrapper.append(label, canvas);

    return {
        title,
        color,
        unit,
        fixedMax,
        wrapper,
        canvas,
        context,
        history: []
    };
}

let isProcessingJS = false;
let lastFpsTime = performance.now();
let frameCount = 0;
const motionPixelRatioThreshold = 0.003;
let currentProcessor = 'js';
let lastFrameTimestamp = null;
let latestLatency = 0;
let latestFps = 0;
let latestCpuUsage = 0;
const latencyChart = createChart('Frame Processing Latency', '#ff9f1c', 'ms');
const fpsChart = createChart('FPS', '#00d1ff', 'fps');
const cpuChart = createChart('CPU usage (estimated)', '#7ae582', '%', 100);

motionStatus.id = 'motionStatus';
motionStatus.className = 'stats';
motionStatus.style.fontSize = '1.1em';
motionStatus.style.color = '#ffd166';
motionStatus.innerText = 'Trạng thái chuyển động: Chưa xử lý';
fpsCounter.insertAdjacentElement('afterend', motionStatus);

runtimeStatus.id = 'runtimeStatus';
runtimeStatus.className = 'stats';
runtimeStatus.style.fontSize = '1em';
runtimeStatus.style.color = '#9ad1ff';
runtimeStatus.innerText = 'Runtime: JavaScript sẵn sàng | WASM: đang chờ build';
motionStatus.insertAdjacentElement('afterend', runtimeStatus);

metricsContainer.id = 'metricsContainer';
metricsContainer.style.display = 'grid';
metricsContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))';
metricsContainer.style.gap = '12px';
metricsContainer.style.width = 'min(100%, 800px)';
metricsContainer.style.margin = '10px 0 18px';

[latencyMetric, fpsMetric, cpuMetric].forEach((metric) => {
    metric.className = 'stats';
    metric.style.fontSize = '1em';
    metric.style.margin = '0';
    metric.style.padding = '12px 14px';
    metric.style.background = '#2b2b2b';
    metric.style.border = '1px solid #444';
    metric.style.borderRadius = '8px';
});

metricsContainer.append(latencyMetric, fpsMetric, cpuMetric);
runtimeStatus.insertAdjacentElement('afterend', metricsContainer);

chartContainer.id = 'chartContainer';
chartContainer.style.display = 'grid';
chartContainer.style.gap = '12px';
chartContainer.style.width = '100%';
chartContainer.style.marginTop = '18px';
chartContainer.append(latencyChart.wrapper, fpsChart.wrapper, cpuChart.wrapper);
outputCanvas.insertAdjacentElement('afterend', chartContainer);

function trimHistory(history) {
    if (history.length > maxChartPoints) {
        history.splice(0, history.length - maxChartPoints);
    }
}

function getChartMaxValue(chart) {
    if (chart.fixedMax !== null) {
        return chart.fixedMax;
    }

    const observedMax = Math.max(...chart.history, 1);
    return observedMax * 1.15;
}

function drawChart(chart) {
    const { context, canvas, color, title, unit, history } = chart;
    const width = canvas.width;
    const height = canvas.height;
    const padding = 28;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;
    const maxValue = getChartMaxValue(chart);

    context.clearRect(0, 0, width, height);
    context.fillStyle = '#181818';
    context.fillRect(0, 0, width, height);

    context.strokeStyle = '#2f2f2f';
    context.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding + (plotHeight / 4) * i;
        context.beginPath();
        context.moveTo(padding, y);
        context.lineTo(width - padding, y);
        context.stroke();
    }

    context.strokeStyle = '#555';
    context.beginPath();
    context.moveTo(padding, padding);
    context.lineTo(padding, height - padding);
    context.lineTo(width - padding, height - padding);
    context.stroke();

    context.fillStyle = '#cfcfcf';
    context.font = '12px monospace';
    context.fillText(`max ${maxValue.toFixed(1)} ${unit}`, padding, 16);

    if (history.length > 0) {
        const currentValue = history[history.length - 1];
        const label = `${title}: ${currentValue.toFixed(1)} ${unit}`;
        const textWidth = context.measureText(label).width;
        context.fillText(label, width - padding - textWidth, 16);

        context.strokeStyle = color;
        context.lineWidth = 2;
        context.beginPath();

        history.forEach((value, index) => {
            const x = padding + (plotWidth * index) / Math.max(history.length - 1, 1);
            const y = height - padding - (Math.min(value, maxValue) / maxValue) * plotHeight;

            if (index === 0) {
                context.moveTo(x, y);
            } else {
                context.lineTo(x, y);
            }
        });

        context.stroke();
        return;
    }

    context.fillStyle = '#888';
    context.font = '13px monospace';
    context.fillText('Dang cho du lieu...', padding, height / 2);
}

function resetCharts() {
    [latencyChart, fpsChart, cpuChart].forEach((chart) => {
        chart.history.length = 0;
        drawChart(chart);
    });
}

function updateCharts() {
    latencyChart.history.push(latestLatency);
    fpsChart.history.push(latestFps);
    cpuChart.history.push(latestCpuUsage);

    [latencyChart, fpsChart, cpuChart].forEach((chart) => {
        trimHistory(chart.history);
        drawChart(chart);
    });
}

function resetMetrics() {
    lastFrameTimestamp = null;
    latestLatency = 0;
    latestFps = 0;
    latestCpuUsage = 0;
    latencyMetric.innerText = 'Frame Processing Latency: -- ms';
    fpsMetric.innerText = 'FPS: --';
    cpuMetric.innerText = 'CPU usage (estimated): -- %';
    resetCharts();
}

function updateMetricsDisplay() {
    latencyMetric.innerText = `Frame Processing Latency: ${latestLatency.toFixed(2)} ms`;
    fpsMetric.innerText = `FPS: ${latestFps.toFixed(1)}`;
    cpuMetric.innerText = `CPU usage (estimated): ${latestCpuUsage.toFixed(1)} %`;
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
            // Gán kích thước thật của video cho Canvas ẩn
            hiddenCanvas.width = videoPlayer.videoWidth;
            hiddenCanvas.height = videoPlayer.videoHeight;
            
            // Gán kích thước cho Canvas đầu ra
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

btnRunJS.addEventListener('click', () => {
    startProcessing('js');
});

btnRunWASM.addEventListener('click', () => {
    startProcessing('wasm');
});

// Thêm sự kiện cho nút DỪNG
btnStop.addEventListener('click', () => {
    isProcessingJS = false;     // Dừng vòng lặp requestAnimationFrame
    videoPlayer.pause();        // Tạm dừng video
    
    setProcessingButtons(false);
    
    fpsCounter.innerText = "Đã dừng xử lý.";
    motionStatus.innerText = 'Trạng thái chuyển động: Đã dừng';
    motionStatus.style.color = '#ffd166';
    resetMetrics();
});

// Vòng lặp chính
function processVideo() {
    if (videoPlayer.paused || videoPlayer.ended || !isProcessingJS) return;

    // 1. Vẽ frame hiện tại lên Canvas ẩn (Người dùng không thấy bước này)
    ctxHidden.drawImage(videoPlayer, 0, 0, hiddenCanvas.width, hiddenCanvas.height);

    // 2. Lấy mảng dữ liệu pixel (bước tốn chi phí đọc bộ nhớ)
    const imageData = ctxHidden.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height);

    // Bắt đầu đo thời gian thuật toán chạy
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
    
    // Kết thúc đo thời gian thuật toán
    const endProcessTime = performance.now();
    const processDuration = endProcessTime - startProcessTime;
    latestLatency = processDuration;

    const totalPixels = hiddenCanvas.width * hiddenCanvas.height;
    const hasMotion = processedFrame.changedPixels > totalPixels * motionPixelRatioThreshold;
    updateMotionStatus(hasMotion, processedFrame.changedPixels, totalPixels);

    // 4. In mảng kết quả ra Canvas hiển thị
    ctxOutput.putImageData(processedFrame.processedData, 0, 0);

    // 5. Tính toán và hiển thị FPS
    frameCount++;
    const currentTime = performance.now();
    const frameInterval = lastFrameTimestamp === null ? 0 : currentTime - lastFrameTimestamp;
    lastFrameTimestamp = currentTime;

    if (frameInterval > 0) {
        latestFps = 1000 / frameInterval;
        latestCpuUsage = Math.min(100, (processDuration / frameInterval) * 100);
    }

    updateMetricsDisplay();
    updateCharts();
    
    // Cập nhật text mỗi giây (1000ms)
    if (currentTime - lastFpsTime >= 1000) {
        fpsCounter.innerText = `Mode: ${getProcessorLabel()} | FPS trung bình: ${frameCount}`;
        frameCount = 0;
        lastFpsTime = currentTime;
    }

    // Lặp lại liên tục theo tốc độ quét của màn hình
    requestAnimationFrame(processVideo);
}

resetMetrics();
updateRuntimeStatus();
