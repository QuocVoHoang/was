// app.js

// --- DOM REFERENCES ---
const videoUpload = document.getElementById('videoUpload');
const videoPlayer = document.getElementById('videoPlayer');
const outputCanvas = document.getElementById('outputCanvas');
const btnBenchmark = document.getElementById('btnBenchmark');
const fpsCounter = document.getElementById('fpsCounter');
fpsCounter.style.margin = '10px';
const btnStop = document.getElementById('btnStop');
const comparisonContainer = document.getElementById('comparisonContainer');

// Dynamic UI elements
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

// --- STATE ---
let isProcessing = false;
let currentProcessor = 'js';
let lastFrameTimestamp = null;
let latestLatency = 0;
const MOTION_PIXEL_RATIO_THRESHOLD = 0.003;

// --- BENCHMARK CONFIG ---
const BENCHMARK_DURATION_MS = 10000; // 10 giây mỗi thuật toán

// --- BENCHMARK STATE ---
let benchmarkMode = false;
let benchmarkPhase = null;       // 'js' | 'wasm'
let benchmarkResults = { js: null, wasm: null };
let frameLatencies = [];
let frameFpsSamples = [];
let benchmarkStartTime = 0;
let totalBenchmarkFrames = 0;
let benchmarkTimer = null;

// --- THIẾT LẬP UI ---

motionStatus.id = 'motionStatus';
motionStatus.className = 'stats';
motionStatus.style.fontSize = '1.1em';
motionStatus.style.color = '#ffd166';
motionStatus.innerText = 'Trạng thái chuyển động: Chưa xử lý';
motionStatus.style.margin = '10px';
fpsCounter.insertAdjacentElement('afterend', motionStatus);

runtimeStatus.id = 'runtimeStatus';
runtimeStatus.className = 'stats';
runtimeStatus.style.fontSize = '1em';
runtimeStatus.style.color = '#9ad1ff';
runtimeStatus.innerText = 'Runtime: JavaScript sẵn sàng | WASM: đang chờ build';
runtimeStatus.style.margin = '10px';
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

// --- HELPER FUNCTIONS ---
function resetBenchmarkCollectors() {
    frameLatencies = [];
    frameFpsSamples = [];
    totalBenchmarkFrames = 0;
    benchmarkStartTime = performance.now();
}

function resetMotionState() {
    if (typeof prevFrameGray !== 'undefined') {
        prevFrameGray = null;
    }

    if (window.wasmMotion) {
        window.wasmMotion.reset();
    }
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

function setProcessingButtons(isRunning) {
    btnBenchmark.disabled = isRunning;
    btnStop.disabled = !isRunning;
}

/**
 * Seek video về đầu rồi gọi callback.
 * Fix: nếu currentTime đã là 0, seeked event không fire → gọi trực tiếp.
 */
function seekToStartAndRun(callback) {
    if (videoPlayer.currentTime < 0.01) {
        callback();
    } else {
        videoPlayer.currentTime = 0;
        videoPlayer.addEventListener('seeked', callback, { once: true });
    }
}

// --- BENCHMARK MODE ---

async function startBenchmark() {
    if (!videoPlayer.src) {
        alert("Vui lòng tải video lên trước!");
        return;
    }

    // Init WASM trước để không ảnh hưởng benchmark
    try {
        updateRuntimeStatus();
        await window.wasmMotion.init();
        updateRuntimeStatus();
    } catch (error) {
        updateRuntimeStatus();
        alert("Không thể khởi tạo WASM: " + error.message);
        return;
    }

    // Ẩn kết quả cũ
    comparisonContainer.style.display = 'none';
    comparisonContainer.innerHTML = '';

    benchmarkMode = true;
    benchmarkPhase = 'js';
    benchmarkResults = { js: null, wasm: null };
    currentProcessor = 'js';
    isProcessing = true;

    setProcessingButtons(true);

    // Đảm bảo video loop (sẽ dừng bằng timer, không cần video kết thúc)
    videoPlayer.setAttribute('loop', '');

    resetMotionState();
    resetBenchmarkCollectors();

    fpsCounter.innerText = '⚡ Phase 1/2: JavaScript — Đang khởi động...';
    fpsCounter.style.color = '#007bff';
    motionStatus.innerText = 'Trạng thái: Đang benchmark JavaScript (10s)...';
    motionStatus.style.color = '#ffd166';

    // Seek về đầu rồi bắt đầu
    seekToStartAndRun(() => {
        videoPlayer.play();
        processVideo();

        benchmarkTimer = setTimeout(() => {
            isProcessing = false;
            handleBenchmarkPhaseComplete();
        }, BENCHMARK_DURATION_MS);
    });
}

function handleBenchmarkPhaseComplete() {
    benchmarkTimer = null;

    const elapsedTime = (performance.now() - benchmarkStartTime) / 1000;
    const latencyStats = computeStats(frameLatencies);
    const fpsStats = computeStats(frameFpsSamples);

    const phaseResult = {
        latencyStats,
        fpsStats,
        totalFrames: totalBenchmarkFrames,
        totalTime: elapsedTime
    };

    if (benchmarkPhase === 'js') {
        benchmarkResults.js = phaseResult;

        // Chuyển sang phase WASM
        benchmarkPhase = 'wasm';
        currentProcessor = 'wasm';
        isProcessing = true;

        resetMotionState();
        resetBenchmarkCollectors();

        fpsCounter.innerText = '⚡ Phase 2/2: WASM — Đang khởi động...';
        fpsCounter.style.color = '#17a2b8';
        motionStatus.innerText = 'Trạng thái: Đang benchmark WASM (10s)...';
        motionStatus.style.color = '#ffd166';

        seekToStartAndRun(() => {
            videoPlayer.play();
            processVideo();

            benchmarkTimer = setTimeout(() => {
                isProcessing = false;
                handleBenchmarkPhaseComplete();
            }, BENCHMARK_DURATION_MS);
        });

        return;
    }

    // Phase WASM hoàn tất → hiển thị kết quả
    benchmarkResults.wasm = phaseResult;
    benchmarkMode = false;
    benchmarkPhase = null;
    isProcessing = false;

    videoPlayer.pause();
    setProcessingButtons(false);
    renderComparisonTable();

    fpsCounter.innerText = '✅ Benchmark hoàn tất! Xem kết quả bên dưới.';
    fpsCounter.style.color = '#00ffcc';
    motionStatus.innerText = 'Trạng thái: Benchmark đã xong';
    motionStatus.style.color = '#7ae582';
}

// --- EVENT LISTENERS ---

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

            fpsCounter.innerText = `Video sẵn sàng: ${videoPlayer.videoWidth}×${videoPlayer.videoHeight}`;
            fpsCounter.style.color = '#00ffcc';
            motionStatus.innerText = 'Trạng thái chuyển động: Chưa xử lý';
            motionStatus.style.color = '#ffd166';
            updateRuntimeStatus();
        };

        resetMotionState();
    }
});

btnBenchmark.addEventListener('click', () => startBenchmark());

btnStop.addEventListener('click', () => {
    // Hủy timer benchmark nếu đang chạy
    if (benchmarkTimer) {
        clearTimeout(benchmarkTimer);
        benchmarkTimer = null;
    }

    isProcessing = false;
    videoPlayer.pause();
    setProcessingButtons(false);
    fpsCounter.innerText = "Đã dừng xử lý.";
    fpsCounter.style.color = '#00ffcc';
    motionStatus.innerText = 'Trạng thái chuyển động: Đã dừng';
    motionStatus.style.color = '#ffd166';

    if (benchmarkMode) {
        benchmarkMode = false;
        benchmarkPhase = null;
    }
});

// --- VÒNG LẶP XỬ LÝ CHÍNH ---

function processVideo() {
    if (videoPlayer.paused || videoPlayer.ended || !isProcessing) return;

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

        processedFrame = { processedData, changedPixels };
    }

    const endProcessTime = performance.now();
    latestLatency = endProcessTime - startProcessTime;

    // Vẽ kết quả lên canvas
    ctxOutput.putImageData(processedFrame.processedData, 0, 0);

    // Thu thập dữ liệu benchmark
    frameLatencies.push(latestLatency);
    totalBenchmarkFrames++;

    if (lastFrameTimestamp !== null) {
        const frameInterval = endProcessTime - lastFrameTimestamp;
        if (frameInterval > 0) {
            frameFpsSamples.push(1000 / frameInterval);
        }
    }
    lastFrameTimestamp = endProcessTime;

    // Cập nhật hiển thị tiến độ
    const elapsed = (endProcessTime - benchmarkStartTime) / 1000;
    const remaining = Math.max(0, (BENCHMARK_DURATION_MS / 1000) - elapsed);
    const phaseLabel = benchmarkPhase === 'js' ? '1/2: JavaScript' : '2/2: WASM';
    const currentFps = frameFpsSamples.length > 0
        ? frameFpsSamples[frameFpsSamples.length - 1].toFixed(1)
        : '--';

    fpsCounter.innerText = `⚡ Phase ${phaseLabel} — Frame ${totalBenchmarkFrames} | còn ${remaining.toFixed(1)}s | ${latestLatency.toFixed(2)} ms | ${currentFps} FPS`;

    requestAnimationFrame(processVideo);
}

// --- BẢNG SO SÁNH KẾT QUẢ ---

function renderComparisonTable() {
    const js = benchmarkResults.js;
    const wasm = benchmarkResults.wasm;

    if (!js || !wasm) return;

    const rows = [
        { section: 'Tổng quan' },
        {
            label: 'Tổng số frame',
            jsVal: js.totalFrames,
            wasmVal: wasm.totalFrames,
            format: (v) => v.toString(),
            diff: false
        },
        {
            label: 'Thời gian chạy',
            jsVal: js.totalTime,
            wasmVal: wasm.totalTime,
            format: (v) => v.toFixed(2) + ' s',
            diff: false
        },
        { section: 'FPS (Frames Per Second)' },
        {
            label: 'FPS trung bình',
            jsVal: js.fpsStats?.mean,
            wasmVal: wasm.fpsStats?.mean,
            format: formatFps,
            diff: true,
            lowerIsBetter: false
        },
        {
            label: 'FPS thấp nhất',
            jsVal: js.fpsStats?.min,
            wasmVal: wasm.fpsStats?.min,
            format: formatFps,
            diff: true,
            lowerIsBetter: false
        },
        {
            label: 'FPS cao nhất',
            jsVal: js.fpsStats?.max,
            wasmVal: wasm.fpsStats?.max,
            format: formatFps,
            diff: true,
            lowerIsBetter: false
        },
        { section: 'Latency (Thời gian xử lý mỗi frame)' },
        {
            label: 'Trung bình',
            jsVal: js.latencyStats?.mean,
            wasmVal: wasm.latencyStats?.mean,
            format: formatMs,
            diff: true,
            lowerIsBetter: true
        },
        {
            label: 'Trung vị (Median)',
            jsVal: js.latencyStats?.median,
            wasmVal: wasm.latencyStats?.median,
            format: formatMs,
            diff: true,
            lowerIsBetter: true
        },
        {
            label: 'P95',
            jsVal: js.latencyStats?.p95,
            wasmVal: wasm.latencyStats?.p95,
            format: formatMs,
            diff: true,
            lowerIsBetter: true
        },
        {
            label: 'P99',
            jsVal: js.latencyStats?.p99,
            wasmVal: wasm.latencyStats?.p99,
            format: formatMs,
            diff: true,
            lowerIsBetter: true
        },
        {
            label: 'Min',
            jsVal: js.latencyStats?.min,
            wasmVal: wasm.latencyStats?.min,
            format: formatMs,
            diff: true,
            lowerIsBetter: true
        },
        {
            label: 'Max',
            jsVal: js.latencyStats?.max,
            wasmVal: wasm.latencyStats?.max,
            format: formatMs,
            diff: true,
            lowerIsBetter: true
        },
        {
            label: 'Độ lệch chuẩn (Std Dev)',
            jsVal: js.latencyStats?.stdDev,
            wasmVal: wasm.latencyStats?.stdDev,
            format: formatMs,
            diff: true,
            lowerIsBetter: true
        }
    ];

    let html = `
        <h2 style="color: #ffd166; text-align: center; margin-bottom: 5px;">
            📊 Kết quả Benchmark: JS vs WASM
        </h2>
        <p style="color: #888; text-align: center; margin-top: 0; font-size: 0.9em;">
            Video: ${videoPlayer.videoWidth}×${videoPlayer.videoHeight} | ${BENCHMARK_DURATION_MS / 1000}s mỗi thuật toán
        </p>
        <table class="comparison-table">
            <thead>
                <tr>
                    <th>Metric</th>
                    <th>JavaScript</th>
                    <th>WASM</th>
                    <th>Chênh lệch</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const row of rows) {
        if (row.section) {
            html += `<tr class="section-header"><td colspan="4">${row.section}</td></tr>`;
            continue;
        }

        const jsFormatted = row.jsVal != null ? row.format(row.jsVal) : '—';
        const wasmFormatted = row.wasmVal != null ? row.format(row.wasmVal) : '—';

        let diffCell = '—';
        let diffColor = '#888';
        if (row.diff && row.jsVal != null && row.wasmVal != null) {
            const result = formatDiff(row.jsVal, row.wasmVal, row.lowerIsBetter);
            diffCell = result.text;
            diffColor = result.color;
        }

        html += `
            <tr>
                <td>${row.label}</td>
                <td>${jsFormatted}</td>
                <td>${wasmFormatted}</td>
                <td style="color: ${diffColor}; font-weight: bold;">${diffCell}</td>
            </tr>
        `;
    }

    html += '</tbody></table>';

    comparisonContainer.innerHTML = html;
    comparisonContainer.style.display = 'block';
    comparisonContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --- INIT ---
updateRuntimeStatus();