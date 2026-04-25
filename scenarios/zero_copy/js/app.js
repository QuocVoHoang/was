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

// Create hidden canvas for pixel extraction
const hiddenCanvas = document.createElement('canvas');
const ctxHidden = hiddenCanvas.getContext('2d', { willReadFrequently: true });

// Output canvas context
const ctxOutput = outputCanvas.getContext('2d');

// --- STATE ---
let isProcessing = false;
let currentProcessor = 'js';
let lastFrameTimestamp = null;
let latestLatency = 0;
const MOTION_PIXEL_RATIO_THRESHOLD = 0.003;

// --- BENCHMARK CONFIG ---
const BENCHMARK_DURATION_MS = 10000; // 10 seconds per algorithm

// --- BENCHMARK STATE ---
let benchmarkMode = false;
let benchmarkPhase = null;       // 'js' | 'wasm'
let benchmarkResults = { js: null, wasm: null };
let frameLatencies = [];
let frameFpsSamples = [];
let benchmarkStartTime = 0;
let totalBenchmarkFrames = 0;
let benchmarkTimer = null;

// --- UI SETUP ---

motionStatus.id = 'motionStatus';
motionStatus.className = 'stats';
motionStatus.style.fontSize = '1.1em';
motionStatus.style.color = '#ffd166';
motionStatus.innerText = 'Motion status: Not processed';
motionStatus.style.margin = '10px';
fpsCounter.insertAdjacentElement('afterend', motionStatus);

runtimeStatus.id = 'runtimeStatus';
runtimeStatus.className = 'stats';
runtimeStatus.style.fontSize = '1em';
runtimeStatus.style.color = '#9ad1ff';
runtimeStatus.innerText = 'Runtime: JavaScript ready | WASM: waiting for build';
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
        runtimeStatus.innerText = 'Runtime: JavaScript ready | WASM: bridge not loaded';
        runtimeStatus.style.color = '#ff9f1c';
        return;
    }

    if (window.wasmMotion.status === 'ready') {
        runtimeStatus.innerText = 'Runtime: JavaScript ready | WASM: ready';
        runtimeStatus.style.color = '#9ad1ff';
        return;
    }

    if (window.wasmMotion.status === 'loading') {
        runtimeStatus.innerText = 'Runtime: JavaScript ready | WASM: loading runtime';
        runtimeStatus.style.color = '#ffd166';
        return;
    }

    if (window.wasmMotion.status === 'error') {
        runtimeStatus.innerText = 'Runtime: JavaScript ready | WASM: not built or failed to load';
        runtimeStatus.style.color = '#ff6b6b';
        return;
    }

    runtimeStatus.innerText = 'Runtime: JavaScript ready | WASM: waiting for build';
    runtimeStatus.style.color = '#ff9f1c';
}

function setProcessingButtons(isRunning) {
    btnBenchmark.disabled = isRunning;
    btnStop.disabled = !isRunning;
}

/**
 * Seek video to the beginning then invoke callback.
 * Fix: if currentTime is already 0, seeked event won't fire → call directly.
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
        alert("Please upload a video first!");
        return;
    }

    // Init WASM first to avoid affecting benchmark
    try {
        updateRuntimeStatus();
        await window.wasmMotion.init();
        updateRuntimeStatus();
    } catch (error) {
        updateRuntimeStatus();
        alert("Failed to initialize WASM: " + error.message);
        return;
    }

    // Hide previous results
    comparisonContainer.style.display = 'none';
    comparisonContainer.innerHTML = '';

    benchmarkMode = true;
    benchmarkPhase = 'js';
    benchmarkResults = { js: null, wasm: null };
    currentProcessor = 'js';
    isProcessing = true;

    setProcessingButtons(true);

    // Ensure video loops (will stop via timer, no need for video to end)
    videoPlayer.setAttribute('loop', '');

    resetMotionState();
    resetBenchmarkCollectors();

    fpsCounter.innerText = '⚡ Phase 1/2: JavaScript — Starting...';
    fpsCounter.style.color = '#007bff';
    motionStatus.innerText = 'Status: Benchmarking JavaScript (10s)...';
    motionStatus.style.color = '#ffd166';

    // Seek to beginning then start
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

        // Switch to WASM phase
        benchmarkPhase = 'wasm';
        currentProcessor = 'wasm';
        isProcessing = true;

        resetMotionState();
        resetBenchmarkCollectors();

        fpsCounter.innerText = '⚡ Phase 2/2: WASM — Starting...';
        fpsCounter.style.color = '#17a2b8';
        motionStatus.innerText = 'Status: Benchmarking WASM (10s)...';
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

    // WASM phase complete → show results
    benchmarkResults.wasm = phaseResult;
    benchmarkMode = false;
    benchmarkPhase = null;
    isProcessing = false;

    videoPlayer.pause();
    setProcessingButtons(false);
    renderComparisonTable();

    fpsCounter.innerText = '✅ Benchmark complete! See results below.';
    fpsCounter.style.color = '#00ffcc';
    motionStatus.innerText = 'Status: Benchmark finished';
    motionStatus.style.color = '#7ae582';
}

// --- EVENT LISTENERS ---

// Handle video upload event
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

            fpsCounter.innerText = `Video ready: ${videoPlayer.videoWidth}×${videoPlayer.videoHeight}`;
            fpsCounter.style.color = '#00ffcc';
            motionStatus.innerText = 'Motion status: Not processed';
            motionStatus.style.color = '#ffd166';
            updateRuntimeStatus();
        };

        resetMotionState();
    }
});

btnBenchmark.addEventListener('click', () => startBenchmark());

btnStop.addEventListener('click', () => {
    // Cancel benchmark timer if running
    if (benchmarkTimer) {
        clearTimeout(benchmarkTimer);
        benchmarkTimer = null;
    }

    isProcessing = false;
    videoPlayer.pause();
    setProcessingButtons(false);
    fpsCounter.innerText = "Processing stopped.";
    fpsCounter.style.color = '#00ffcc';
    motionStatus.innerText = 'Motion status: Stopped';
    motionStatus.style.color = '#ffd166';

    if (benchmarkMode) {
        benchmarkMode = false;
        benchmarkPhase = null;
    }
});

// --- MAIN PROCESSING LOOP ---

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

    // Draw result to canvas
    ctxOutput.putImageData(processedFrame.processedData, 0, 0);

    // Collect benchmark data
    frameLatencies.push(latestLatency);
    totalBenchmarkFrames++;

    if (lastFrameTimestamp !== null) {
        const frameInterval = endProcessTime - lastFrameTimestamp;
        if (frameInterval > 0) {
            frameFpsSamples.push(1000 / frameInterval);
        }
    }
    lastFrameTimestamp = endProcessTime;

    // Update progress display
    const elapsed = (endProcessTime - benchmarkStartTime) / 1000;
    const remaining = Math.max(0, (BENCHMARK_DURATION_MS / 1000) - elapsed);
    const phaseLabel = benchmarkPhase === 'js' ? '1/2: JavaScript' : '2/2: WASM';
    const currentFps = frameFpsSamples.length > 0
        ? frameFpsSamples[frameFpsSamples.length - 1].toFixed(1)
        : '--';

    fpsCounter.innerText = `⚡ Phase ${phaseLabel} — Frame ${totalBenchmarkFrames} | ${remaining.toFixed(1)}s left | ${latestLatency.toFixed(2)} ms | ${currentFps} FPS`;

    requestAnimationFrame(processVideo);
}

// --- COMPARISON RESULTS TABLE ---

function renderComparisonTable() {
    const js = benchmarkResults.js;
    const wasm = benchmarkResults.wasm;

    if (!js || !wasm) return;

    const rows = [
        { section: 'Overview' },
        {
            label: 'Total Frames',
            jsVal: js.totalFrames,
            wasmVal: wasm.totalFrames,
            format: (v) => v.toString(),
            diff: false
        },
        {
            label: 'Run Time',
            jsVal: js.totalTime,
            wasmVal: wasm.totalTime,
            format: (v) => v.toFixed(2) + ' s',
            diff: false
        },
        { section: 'FPS (Frames Per Second)' },
        {
            label: 'Average FPS',
            jsVal: js.fpsStats?.mean,
            wasmVal: wasm.fpsStats?.mean,
            format: formatFps,
            diff: true,
            lowerIsBetter: false
        },
        {
            label: 'Min FPS',
            jsVal: js.fpsStats?.min,
            wasmVal: wasm.fpsStats?.min,
            format: formatFps,
            diff: true,
            lowerIsBetter: false
        },
        {
            label: 'Max FPS',
            jsVal: js.fpsStats?.max,
            wasmVal: wasm.fpsStats?.max,
            format: formatFps,
            diff: true,
            lowerIsBetter: false
        },
        { section: 'Latency (Per-frame Processing Time)' },
        {
            label: 'Mean',
            jsVal: js.latencyStats?.mean,
            wasmVal: wasm.latencyStats?.mean,
            format: formatMs,
            diff: true,
            lowerIsBetter: true
        },
        {
            label: 'Median',
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
            label: 'Std Dev',
            jsVal: js.latencyStats?.stdDev,
            wasmVal: wasm.latencyStats?.stdDev,
            format: formatMs,
            diff: true,
            lowerIsBetter: true
        }
    ];

    let html = `
        <h2 style="color: #ffd166; text-align: center; margin-bottom: 5px;">
            📊 Benchmark Results: JS vs WASM
        </h2>
        <p style="color: #888; text-align: center; margin-top: 0; font-size: 0.9em;">
            Video: ${videoPlayer.videoWidth}×${videoPlayer.videoHeight} | ${BENCHMARK_DURATION_MS / 1000}s per algorithm
        </p>
        <table class="comparison-table">
            <thead>
                <tr>
                    <th>Metric</th>
                    <th>JavaScript</th>
                    <th>WASM</th>
                    <th>Difference</th>
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