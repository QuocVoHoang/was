/**
 * ============================================
 * Main Application - Benchmark Controller
 * ============================================
 * 
 * Điều phối toàn bộ hoạt động benchmark
 * Quản lý video playback, detection, và UI updates
 */

class BenchmarkApp {
    constructor() {
        // Detectors
        this.detectorJS = null;
        this.detectorWasm = null;
        
        // Benchmark manager
        this.benchmark = null;
        
        // Video elements
        this.videoJS = null;
        this.videoWasm = null;
        this.canvasJS = null;
        this.canvasWasm = null;
        this.ctxJS = null;
        this.ctxWasm = null;
        
        // Hidden canvases for processing
        this.processCanvasJS = null;
        this.processCanvasWasm = null;
        this.processCtxJS = null;
        this.processCtxWasm = null;
        
        // State
        this.isRunning = false;
        this.isPaused = false;
        this.videoLoaded = false;
        this.wasmReady = false;
        
        // Animation frame IDs
        this.animationFrameId = null;
        this.chartUpdateInterval = null;
        
        // Settings
        this.settings = {
            threshold: 30,
            sensitivity: 5
        };
        
        // Video file
        this.videoFile = null;
        this.videoURL = null;
    }

    /**
     * Khởi tạo ứng dụng
     */
    async init() {
        console.log('🚀 Initializing Benchmark App...');
        
        // Initialize benchmark manager
        this.benchmark = new BenchmarkManager();
        this.benchmark.init();
        
        // Initialize JS detector
        this.detectorJS = new MotionDetectorJS();
        
        // Initialize Wasm detector
        await this._initWasm();
        
        // Cache DOM elements
        this._cacheElements();
        
        // Setup event listeners
        this._setupEventListeners();
        
        // Setup processing canvases
        this._setupProcessingCanvases();
        
        console.log('✅ App initialized');
    }

    /**
     * Khởi tạo WebAssembly module
     */
    async _initWasm() {
        try {
            // Check if Module is available (from Emscripten generated JS)
            if (typeof Module !== 'undefined') {
                this.detectorWasm = new MotionDetectorWasm();
                await this.detectorWasm.init(Module);
                this.wasmReady = true;
                console.log('✅ WebAssembly module loaded');
                this._updateWasmStatus('Ready');
            } else {
                console.warn('⚠️ WebAssembly module not found. Running JS-only mode.');
                this._updateWasmStatus('Not Loaded');
            }
        } catch (error) {
            console.error('❌ Failed to load WebAssembly:', error);
            this._updateWasmStatus('Error');
        }
    }

    /**
     * Cập nhật Wasm status badge
     */
    _updateWasmStatus(status) {
        const statusEl = document.getElementById('wasmStatus');
        if (statusEl) {
            statusEl.textContent = status;
            statusEl.className = 'status-badge ' + (status === 'Ready' ? 'ready' : status === 'Error' ? 'error' : '');
        }
    }

    /**
     * Cache DOM elements
     */
    _cacheElements() {
        // Video elements
        this.videoJS = document.getElementById('videoJS');
        this.videoWasm = document.getElementById('videoWasm');
        
        // Canvas elements
        this.canvasJS = document.getElementById('canvasJS');
        this.canvasWasm = document.getElementById('canvasWasm');
        
        // Get contexts
        this.ctxJS = this.canvasJS.getContext('2d', { willReadFrequently: true });
        this.ctxWasm = this.canvasWasm.getContext('2d', { willReadFrequently: true });
        
        // Buttons
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.resetBtn = document.getElementById('resetBtn');
        
        // Sliders
        this.thresholdSlider = document.getElementById('thresholdSlider');
        this.sensitivitySlider = document.getElementById('sensitivitySlider');
        
        // File input
        this.videoInput = document.getElementById('videoInput');
        this.fileNameDisplay = document.getElementById('fileName');
    }

    /**
     * Setup processing canvases (hidden, for pixel manipulation)
     */
    _setupProcessingCanvases() {
        this.processCanvasJS = document.createElement('canvas');
        this.processCtxJS = this.processCanvasJS.getContext('2d', { willReadFrequently: true });
        
        this.processCanvasWasm = document.createElement('canvas');
        this.processCtxWasm = this.processCanvasWasm.getContext('2d', { willReadFrequently: true });
    }

    /**
     * Setup event listeners
     */
    _setupEventListeners() {
        // File input
        this.videoInput.addEventListener('change', (e) => this._handleVideoUpload(e));
        
        // Buttons
        this.startBtn.addEventListener('click', () => this.startBenchmark());
        this.stopBtn.addEventListener('click', () => this.stopBenchmark());
        this.resetBtn.addEventListener('click', () => this.resetBenchmark());
        
        // Sliders
        this.thresholdSlider.addEventListener('input', (e) => {
            this.settings.threshold = parseInt(e.target.value);
            document.getElementById('thresholdValue').textContent = this.settings.threshold;
            this._updateDetectorSettings();
        });
        
        this.sensitivitySlider.addEventListener('input', (e) => {
            this.settings.sensitivity = parseInt(e.target.value);
            document.getElementById('sensitivityValue').textContent = this.settings.sensitivity + '%';
            this._updateDetectorSettings();
        });
        
        // Video events
        this.videoJS.addEventListener('loadedmetadata', () => this._onVideoLoaded());
        this.videoJS.addEventListener('ended', () => this._onVideoEnded());
        this.videoJS.addEventListener('error', (e) => this._onVideoError(e));
    }

    /**
     * Xử lý upload video
     */
    _handleVideoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file type
        if (!file.type.startsWith('video/')) {
            alert('Vui lòng chọn file video hợp lệ!');
            return;
        }
        
        // Cleanup previous video
        if (this.videoURL) {
            URL.revokeObjectURL(this.videoURL);
        }
        
        this.videoFile = file;
        this.videoURL = URL.createObjectURL(file);
        
        // Set video sources
        this.videoJS.src = this.videoURL;
        this.videoWasm.src = this.videoURL;
        
        // Update UI
        this.fileNameDisplay.textContent = file.name;
        
        console.log('📁 Video loaded:', file.name);
    }

    /**
     * Khi video metadata đã load
     */
    _onVideoLoaded() {
        const width = this.videoJS.videoWidth;
        const height = this.videoJS.videoHeight;
        
        console.log(`📐 Video resolution: ${width}x${height}`);
        
        // Set canvas dimensions
        this.canvasJS.width = width;
        this.canvasJS.height = height;
        this.canvasWasm.width = width;
        this.canvasWasm.height = height;
        
        // Set processing canvas dimensions
        this.processCanvasJS.width = width;
        this.processCanvasJS.height = height;
        this.processCanvasWasm.width = width;
        this.processCanvasWasm.height = height;
        
        // Initialize detectors
        this.detectorJS.init(width, height);
        
        if (this.wasmReady) {
            this.detectorWasm.initDetector(width, height);
        }
        
        // Update detector settings
        this._updateDetectorSettings();
        
        // Enable start button
        this.videoLoaded = true;
        this.startBtn.disabled = false;
        
        // Show first frame
        this._drawInitialFrame();
    }

    /**
     * Vẽ frame ban đầu
     */
    _drawInitialFrame() {
        this.videoJS.currentTime = 0;
        this.videoWasm.currentTime = 0;
        
        const drawFrame = () => {
            this.ctxJS.drawImage(this.videoJS, 0, 0);
            this.ctxWasm.drawImage(this.videoWasm, 0, 0);
        };
        
        this.videoJS.addEventListener('seeked', drawFrame, { once: true });
    }

    /**
     * Cập nhật settings cho detectors
     */
    _updateDetectorSettings() {
        this.detectorJS.configure(this.settings.threshold, this.settings.sensitivity);
        
        if (this.wasmReady) {
            this.detectorWasm.configure(this.settings.threshold, this.settings.sensitivity);
        }
    }

    /**
     * Bắt đầu benchmark
     */
    startBenchmark() {
        if (!this.videoLoaded) {
            alert('Vui lòng chọn video trước!');
            return;
        }
        
        console.log('▶️ Starting benchmark...');
        
        this.isRunning = true;
        this.isPaused = false;
        
        // Reset benchmark
        this.benchmark.reset();
        this.benchmark.start();
        
        // Reset detectors
        this.detectorJS.init(this.canvasJS.width, this.canvasJS.height);
        if (this.wasmReady) {
            this.detectorWasm.initDetector(this.canvasWasm.width, this.canvasWasm.height);
        }
        this._updateDetectorSettings();
        
        // Update UI
        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;
        this.resetBtn.disabled = true;
        
        // Hide summary
        document.getElementById('summarySection').style.display = 'none';
        
        // Start videos
        this.videoJS.currentTime = 0;
        this.videoWasm.currentTime = 0;
        
        Promise.all([
            this.videoJS.play(),
            this.videoWasm.play()
        ]).then(() => {
            // Start processing loop
            this._processLoop();
            
            // Start chart update interval
            this.chartUpdateInterval = setInterval(() => {
                this.benchmark.updateCharts();
            }, 200);
        }).catch(err => {
            console.error('Failed to play video:', err);
            this.stopBenchmark();
        });
    }

    /**
     * Main processing loop
     */
    _processLoop() {
        if (!this.isRunning) return;
        
        const width = this.canvasJS.width;
        const height = this.canvasJS.height;
        
        // Process JS frame
        this._processJSFrame(width, height);
        
        // Process Wasm frame
        if (this.wasmReady) {
            this._processWasmFrame(width, height);
        }
        
        // Continue loop
        this.animationFrameId = requestAnimationFrame(() => this._processLoop());
    }

    /**
     * Xử lý frame bằng JavaScript
     */
    _processJSFrame(width, height) {
        // Draw video frame to processing canvas
        this.processCtxJS.drawImage(this.videoJS, 0, 0, width, height);
        
        // Get image data
        const imageData = this.processCtxJS.getImageData(0, 0, width, height);
        
        // Detect motion
        const result = this.detectorJS.detectMotion(imageData, width, height);
        
        if (result.motionPixels >= 0) {
            // Draw original frame
            this.ctxJS.drawImage(this.videoJS, 0, 0, width, height);
            
            // Draw motion mask overlay
            if (result.motionMask) {
                const motionImageData = new ImageData(result.motionMask, width, height);
                this.ctxJS.putImageData(motionImageData, 0, 0);
            }
            
            // Record metrics
            this.benchmark.recordFrame('js', {
                latency: result.processingTime,
                motionPixels: result.motionPixels
            });
        }
    }

    /**
     * Xử lý frame bằng WebAssembly
     */
    _processWasmFrame(width, height) {
        // Draw video frame to processing canvas
        this.processCtxWasm.drawImage(this.videoWasm, 0, 0, width, height);
        
        // Get image data
        const imageData = this.processCtxWasm.getImageData(0, 0, width, height);
        
        // Detect motion
        const result = this.detectorWasm.detectMotion(imageData, width, height);
        
        if (result.motionPixels >= 0) {
            // Draw original frame
            this.ctxWasm.drawImage(this.videoWasm, 0, 0, width, height);
            
            // Draw motion mask overlay
            if (result.motionMask) {
                const motionImageData = new ImageData(result.motionMask, width, height);
                this.ctxWasm.putImageData(motionImageData, 0, 0);
            }
            
            // Record metrics
            this.benchmark.recordFrame('wasm', {
                latency: result.processingTime,
                motionPixels: result.motionPixels
            });
        }
    }

    /**
     * Dừng benchmark
     */
    stopBenchmark() {
        console.log('⏹️ Stopping benchmark...');
        
        this.isRunning = false;
        
        // Cancel animation frame
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Clear chart update interval
        if (this.chartUpdateInterval) {
            clearInterval(this.chartUpdateInterval);
            this.chartUpdateInterval = null;
        }
        
        // Stop videos
        this.videoJS.pause();
        this.videoWasm.pause();
        
        // Stop benchmark
        this.benchmark.stop();
        
        // Final chart update
        this.benchmark.updateCharts();
        
        // Display summary
        this.benchmark.displaySummary();
        
        // Update UI
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.resetBtn.disabled = false;
    }

    /**
     * Reset benchmark
     */
    resetBenchmark() {
        console.log('🔄 Resetting benchmark...');
        
        this.isRunning = false;
        this.isPaused = false;
        
        // Reset videos
        this.videoJS.currentTime = 0;
        this.videoWasm.currentTime = 0;
        
        // Reset benchmark
        this.benchmark.reset();
        
        // Clear canvases
        this.ctxJS.clearRect(0, 0, this.canvasJS.width, this.canvasJS.height);
        this.ctxWasm.clearRect(0, 0, this.canvasWasm.width, this.canvasWasm.height);
        
        // Reset detectors
        this.detectorJS.cleanup();
        if (this.wasmReady) {
            this.detectorWasm.cleanup();
        }
        
        // Hide summary
        document.getElementById('summarySection').style.display = 'none';
        
        // Update UI
        this.startBtn.disabled = !this.videoLoaded;
        this.stopBtn.disabled = true;
        this.resetBtn.disabled = true;
        
        // Draw initial frame
        if (this.videoLoaded) {
            this._drawInitialFrame();
        }
    }

    /**
     * Khi video kết thúc
     */
    _onVideoEnded() {
        if (this.isRunning) {
            console.log('📺 Video ended');
            this.stopBenchmark();
        }
    }

    /**
     * Xử lý lỗi video
     */
    _onVideoError(error) {
        console.error('Video error:', error);
        alert('Lỗi khi load video. Vui lòng thử file khác.');
        this.stopBenchmark();
    }

    /**
     * Cleanup
     */
    destroy() {
        this.stopBenchmark();
        
        if (this.videoURL) {
            URL.revokeObjectURL(this.videoURL);
        }
        
        this.detectorJS.cleanup();
        if (this.wasmReady) {
            this.detectorWasm.cleanup();
        }
    }
}

// ============================================
// Initialize App on DOM Ready
// ============================================

let app = null;

document.addEventListener('DOMContentLoaded', async () => {
    app = new BenchmarkApp();
    await app.init();
    
    // Check for memory API
    if (!app.benchmark.isMemoryAPIAvailable()) {
        console.warn('⚠️ performance.memory API not available. Memory metrics will show 0.');
        console.warn('   Use Chrome browser for full memory tracking.');
    }
});

// Export for debugging
if (typeof window !== 'undefined') {
    window.BenchmarkApp = BenchmarkApp;
    window.getApp = () => app;
}