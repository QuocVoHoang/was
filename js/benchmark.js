/**
 * ============================================
 * Benchmark Module - Metrics & Charts
 * ============================================
 * 
 * Module đo đạc và hiển thị các chỉ số hiệu năng
 * Bao gồm: FPS, Latency, Memory, CPU Estimate
 */

class BenchmarkManager {
    constructor() {
        // Metrics storage
        this.metrics = {
            js: {
                fps: [],
                latency: [],
                memory: [],
                cpu: [],
                timestamps: [],
                totalFrames: 0,
                totalLatency: 0,
                peakMemory: 0,
                startTime: 0,
                endTime: 0
            },
            wasm: {
                fps: [],
                latency: [],
                memory: [],
                cpu: [],
                timestamps: [],
                totalFrames: 0,
                totalLatency: 0,
                peakMemory: 0,
                startTime: 0,
                endTime: 0
            }
        };
        
        // Chart instances
        this.charts = {
            fps: null,
            latency: null,
            memory: null
        };
        
        // Configuration
        this.config = {
            maxDataPoints: 100,        // Maximum points on chart
            updateInterval: 200,       // Chart update interval (ms)
            fpsCalculationWindow: 1000 // Window for FPS calculation (ms)
        };
        
        // State
        this.isRunning = false;
        this.lastFrameTime = {
            js: 0,
            wasm: 0
        };
        this.frameTimestamps = {
            js: [],
            wasm: []
        };
        
        // DOM Elements cache
        this.elements = {};
    }

    /**
     * Khởi tạo benchmark manager
     */
    init() {
        this._cacheElements();
        this._initCharts();
        this.reset();
    }

    /**
     * Cache DOM elements for faster access
     */
    _cacheElements() {
        // JS elements
        this.elements.js = {
            fps: document.getElementById('jsFPS'),
            latency: document.getElementById('jsLatency'),
            frames: document.getElementById('jsFrames'),
            avgFPS: document.getElementById('jsAvgFPS'),
            avgLatency: document.getElementById('jsAvgLatency'),
            memory: document.getElementById('jsMemory'),
            cpu: document.getElementById('jsCPU'),
            motionPixels: document.getElementById('jsMotionPixels'),
            status: document.getElementById('jsStatus')
        };
        
        // Wasm elements
        this.elements.wasm = {
            fps: document.getElementById('wasmFPS'),
            latency: document.getElementById('wasmLatency'),
            frames: document.getElementById('wasmFrames'),
            avgFPS: document.getElementById('wasmAvgFPS'),
            avgLatency: document.getElementById('wasmAvgLatency'),
            memory: document.getElementById('wasmMemory'),
            cpu: document.getElementById('wasmCPU'),
            motionPixels: document.getElementById('wasmMotionPixels'),
            status: document.getElementById('wasmStatus')
        };
    }

    /**
     * Khởi tạo biểu đồ Chart.js
     */
    _initCharts() {
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0 // Disable animation for performance
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Time (s)',
                        color: '#a0a0a0'
                    },
                    ticks: { color: '#a0a0a0' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    ticks: { color: '#a0a0a0' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#ffffff' }
                }
            }
        };

        // FPS Chart
        const fpsCtx = document.getElementById('fpsChart').getContext('2d');
        this.charts.fps = new Chart(fpsCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'JavaScript',
                        data: [],
                        borderColor: '#f7df1e',
                        backgroundColor: 'rgba(247, 223, 30, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'WebAssembly',
                        data: [],
                        borderColor: '#654ff0',
                        backgroundColor: 'rgba(101, 79, 240, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                ...chartOptions,
                scales: {
                    ...chartOptions.scales,
                    y: {
                        ...chartOptions.scales.y,
                        title: {
                            display: true,
                            text: 'FPS',
                            color: '#a0a0a0'
                        }
                    }
                }
            }
        });

        // Latency Chart
        const latencyCtx = document.getElementById('latencyChart').getContext('2d');
        this.charts.latency = new Chart(latencyCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'JavaScript',
                        data: [],
                        borderColor: '#f7df1e',
                        backgroundColor: 'rgba(247, 223, 30, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'WebAssembly',
                        data: [],
                        borderColor: '#654ff0',
                        backgroundColor: 'rgba(101, 79, 240, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                ...chartOptions,
                scales: {
                    ...chartOptions.scales,
                    y: {
                        ...chartOptions.scales.y,
                        title: {
                            display: true,
                            text: 'Latency (ms)',
                            color: '#a0a0a0'
                        }
                    }
                }
            }
        });

        // Memory Chart
        const memoryCtx = document.getElementById('memoryChart').getContext('2d');
        this.charts.memory = new Chart(memoryCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'JavaScript',
                        data: [],
                        borderColor: '#f7df1e',
                        backgroundColor: 'rgba(247, 223, 30, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'WebAssembly',
                        data: [],
                        borderColor: '#654ff0',
                        backgroundColor: 'rgba(101, 79, 240, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                ...chartOptions,
                scales: {
                    ...chartOptions.scales,
                    y: {
                        ...chartOptions.scales.y,
                        title: {
                            display: true,
                            text: 'Memory (MB)',
                            color: '#a0a0a0'
                        }
                    }
                }
            }
        });
    }

    /**
     * Reset tất cả metrics
     */
    reset() {
        this.metrics = {
            js: this._createEmptyMetrics(),
            wasm: this._createEmptyMetrics()
        };
        
        this.frameTimestamps = { js: [], wasm: [] };
        this.lastFrameTime = { js: 0, wasm: 0 };
        
        this._clearCharts();
        this._resetUI();
    }

    /**
     * Tạo object metrics rỗng
     */
    _createEmptyMetrics() {
        return {
            fps: [],
            latency: [],
            memory: [],
            cpu: [],
            timestamps: [],
            totalFrames: 0,
            totalLatency: 0,
            peakMemory: 0,
            startTime: 0,
            endTime: 0
        };
    }

    /**
     * Xóa dữ liệu biểu đồ
     */
    _clearCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.data.labels = [];
                chart.data.datasets.forEach(dataset => {
                    dataset.data = [];
                });
                chart.update('none');
            }
        });
    }

    /**
     * Reset UI về giá trị mặc định
     */
    _resetUI() {
        ['js', 'wasm'].forEach(type => {
            const el = this.elements[type];
            if (el) {
                el.fps.textContent = '0';
                el.latency.textContent = '0';
                el.frames.textContent = '0';
                el.avgFPS.textContent = '0';
                el.avgLatency.textContent = '0 ms';
                el.memory.textContent = '0 MB';
                el.cpu.textContent = '0%';
                el.motionPixels.textContent = '0';
                el.status.textContent = type === 'wasm' ? 'Loading...' : 'Ready';
                el.status.className = 'status-badge';
            }
        });
    }

    /**
     * Bắt đầu benchmark
     */
    start() {
        this.isRunning = true;
        const now = performance.now();
        
        this.metrics.js.startTime = now;
        this.metrics.wasm.startTime = now;
        
        this._updateStatus('js', 'running');
        this._updateStatus('wasm', 'running');
    }

    /**
     * Dừng benchmark
     */
    stop() {
        this.isRunning = false;
        const now = performance.now();
        
        this.metrics.js.endTime = now;
        this.metrics.wasm.endTime = now;
        
        this._updateStatus('js', 'ready');
        this._updateStatus('wasm', 'ready');
    }

    /**
     * Cập nhật status badge
     */
    _updateStatus(type, status) {
        const el = this.elements[type];
        if (el && el.status) {
            el.status.textContent = status === 'running' ? 'Running' : 'Ready';
            el.status.className = `status-badge ${status}`;
        }
    }

    /**
     * Record frame metrics
     * @param {string} type - 'js' or 'wasm'
     * @param {object} data - { latency, motionPixels }
     */
    recordFrame(type, data) {
        if (!this.isRunning) return;
        
        const now = performance.now();
        const metrics = this.metrics[type];
        
        // Calculate FPS
        this.frameTimestamps[type].push(now);
        
        // Remove old timestamps outside the window
        const windowStart = now - this.config.fpsCalculationWindow;
        this.frameTimestamps[type] = this.frameTimestamps[type].filter(t => t > windowStart);
        
        // FPS = frames in window / window size (in seconds)
        const fps = this.frameTimestamps[type].length / (this.config.fpsCalculationWindow / 1000);
        
        // Get memory usage
        const memory = this._getMemoryUsage();
        
        // Estimate CPU usage based on latency
        // CPU % = (processing time / frame time) * 100
        const frameTime = now - (this.lastFrameTime[type] || now);
        const cpuEstimate = frameTime > 0 ? (data.latency / frameTime) * 100 : 0;
        
        // Update metrics
        metrics.fps.push(fps);
        metrics.latency.push(data.latency);
        metrics.memory.push(memory);
        metrics.cpu.push(Math.min(cpuEstimate, 100));
        metrics.timestamps.push((now - metrics.startTime) / 1000);
        metrics.totalFrames++;
        metrics.totalLatency += data.latency;
        metrics.peakMemory = Math.max(metrics.peakMemory, memory);
        
        this.lastFrameTime[type] = now;
        
        // Update UI
        this._updateMetricsUI(type, {
            fps: fps,
            latency: data.latency,
            motionPixels: data.motionPixels,
            memory: memory,
            cpu: cpuEstimate
        });
    }

    /**
     * Lấy memory usage (Chrome only)
     */
    _getMemoryUsage() {
        if (performance.memory) {
            return performance.memory.usedJSHeapSize / (1024 * 1024); // MB
        }
        return 0;
    }

    /**
     * Cập nhật UI metrics
     */
    _updateMetricsUI(type, data) {
        const el = this.elements[type];
        const metrics = this.metrics[type];
        
        if (!el) return;
        
        // Current values
        el.fps.textContent = Math.round(data.fps);
        el.latency.textContent = data.latency.toFixed(2);
        el.motionPixels.textContent = data.motionPixels.toLocaleString();
        
        // Totals
        el.frames.textContent = metrics.totalFrames.toLocaleString();
        
        // Averages
        const avgFPS = metrics.totalLatency > 0 
            ? (metrics.totalFrames / (metrics.totalLatency / 1000)) 
            : 0;
        el.avgFPS.textContent = Math.round(avgFPS);
        
        const avgLatency = metrics.totalFrames > 0 
            ? metrics.totalLatency / metrics.totalFrames 
            : 0;
        el.avgLatency.textContent = avgLatency.toFixed(2) + ' ms';
        
        // Memory & CPU
        el.memory.textContent = data.memory.toFixed(1) + ' MB';
        el.cpu.textContent = Math.min(data.cpu, 100).toFixed(1) + '%';
    }

    /**
     * Cập nhật biểu đồ
     */
    updateCharts() {
        const maxPoints = this.config.maxDataPoints;
        
        ['js', 'wasm'].forEach(type => {
            const metrics = this.metrics[type];
            
            // Trim data to max points
            if (metrics.timestamps.length > maxPoints) {
                const startIdx = metrics.timestamps.length - maxPoints;
                metrics.timestamps = metrics.timestamps.slice(startIdx);
                metrics.fps = metrics.fps.slice(startIdx);
                metrics.latency = metrics.latency.slice(startIdx);
                metrics.memory = metrics.memory.slice(startIdx);
            }
        });
        
        // Update FPS chart
        this.charts.fps.data.labels = this.metrics.js.timestamps.map(t => t.toFixed(1));
        this.charts.fps.data.datasets[0].data = this.metrics.js.fps;
        this.charts.fps.data.datasets[1].data = this.metrics.wasm.fps;
        this.charts.fps.update('none');
        
        // Update Latency chart
        this.charts.latency.data.labels = this.metrics.js.timestamps.map(t => t.toFixed(1));
        this.charts.latency.data.datasets[0].data = this.metrics.js.latency;
        this.charts.latency.data.datasets[1].data = this.metrics.wasm.latency;
        this.charts.latency.update('none');
        
        // Update Memory chart
        this.charts.memory.data.labels = this.metrics.js.timestamps.map(t => t.toFixed(1));
        this.charts.memory.data.datasets[0].data = this.metrics.js.memory;
        this.charts.memory.data.datasets[1].data = this.metrics.wasm.memory;
        this.charts.memory.update('none');
    }

    /**
     * Tạo summary report
     */
    generateSummary() {
        const summary = {
            js: this._calculateSummaryStats('js'),
            wasm: this._calculateSummaryStats('wasm')
        };
        
        // Calculate improvements
        summary.improvements = {
            fps: this._calculateImprovement(summary.js.avgFPS, summary.wasm.avgFPS, 'higher'),
            latency: this._calculateImprovement(summary.js.avgLatency, summary.wasm.avgLatency, 'lower'),
            memory: this._calculateImprovement(summary.js.peakMemory, summary.wasm.peakMemory, 'lower'),
            time: this._calculateImprovement(summary.js.totalTime, summary.wasm.totalTime, 'lower')
        };
        
        return summary;
    }

    /**
     * Tính toán thống kê summary
     */
    _calculateSummaryStats(type) {
        const metrics = this.metrics[type];
        
        const totalTime = (metrics.endTime - metrics.startTime) / 1000; // seconds
        const avgFPS = totalTime > 0 ? metrics.totalFrames / totalTime : 0;
        const avgLatency = metrics.totalFrames > 0 
            ? metrics.totalLatency / metrics.totalFrames 
            : 0;
        
        return {
            totalFrames: metrics.totalFrames,
            avgFPS: avgFPS,
            avgLatency: avgLatency,
            peakMemory: metrics.peakMemory,
            totalTime: totalTime
        };
    }

    /**
     * Tính phần trăm cải thiện
     */
    _calculateImprovement(jsValue, wasmValue, direction) {
        if (jsValue === 0) return { value: 0, text: '-' };
        
        const diff = ((jsValue - wasmValue) / jsValue) * 100;
        const isPositive = direction === 'higher' ? diff > 0 : diff < 0;
        
        return {
            value: Math.abs(diff),
            text: `${isPositive ? '+' : '-'}${Math.abs(diff).toFixed(1)}%`,
            isPositive: isPositive
        };
    }

    /**
     * Hiển thị summary lên UI
     */
    displaySummary() {
        const summary = this.generateSummary();
        const summarySection = document.getElementById('summarySection');
        
        if (!summarySection) return;
        
        // Show summary section
        summarySection.style.display = 'block';
        
        // Update summary table
        document.getElementById('summaryJSFrames').textContent = summary.js.totalFrames.toLocaleString();
        document.getElementById('summaryWasmFrames').textContent = summary.wasm.totalFrames.toLocaleString();
        
        document.getElementById('summaryJSFPS').textContent = summary.js.avgFPS.toFixed(1);
        document.getElementById('summaryWasmFPS').textContent = summary.wasm.avgFPS.toFixed(1);
        
        document.getElementById('summaryJSLatency').textContent = summary.js.avgLatency.toFixed(2) + ' ms';
        document.getElementById('summaryWasmLatency').textContent = summary.wasm.avgLatency.toFixed(2) + ' ms';
        
        document.getElementById('summaryJSMemory').textContent = summary.js.peakMemory.toFixed(1) + ' MB';
        document.getElementById('summaryWasmMemory').textContent = summary.wasm.peakMemory.toFixed(1) + ' MB';
        
        document.getElementById('summaryJSTime').textContent = summary.js.totalTime.toFixed(2) + ' s';
        document.getElementById('summaryWasmTime').textContent = summary.wasm.totalTime.toFixed(2) + ' s';
        
        // Improvements
        this._setImprovementCell('summaryFPSImprovement', summary.improvements.fps);
        this._setImprovementCell('summaryLatencyImprovement', summary.improvements.latency);
        this._setImprovementCell('summaryMemoryImprovement', summary.improvements.memory);
        this._setImprovementCell('summaryTimeImprovement', summary.improvements.time);
    }

    /**
     * Set improvement cell với styling
     */
    _setImprovementCell(elementId, improvement) {
        const cell = document.getElementById(elementId);
        if (cell) {
            cell.textContent = improvement.text;
            cell.className = improvement.isPositive ? 'improvement-positive' : 'improvement-negative';
        }
    }

    /**
     * Lấy metrics hiện tại
     */
    getMetrics() {
        return this.metrics;
    }

    /**
     * Kiểm tra xem memory API có available không
     */
    isMemoryAPIAvailable() {
        return typeof performance.memory !== 'undefined';
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BenchmarkManager;
}