// wasm_motion_bridge.js — Scenario 5: SIMD + MT + Zero-Copy WASM Bridge
//
// Key difference from Scenario 4 bridge:
// - Input: No per-frame _malloc/_free — uses persistent input buffer via _getInputBufferPtr()
// - Output: Pre-allocates ImageData once per resolution; uses .set() each frame instead of
//   .slice(). This avoids per-frame ArrayBuffer allocations (.slice() creates a new
//   ArrayBuffer each frame, which GC must collect). .set() copies into pre-existing
//   Uint8ClampedArray — same copy volume, zero allocation.
//
// With -pthread, HEAPU8.buffer is a SharedArrayBuffer. ImageData constructor rejects
// SharedArrayBuffer-backed views, so we cannot skip the copy entirely. But .set() is
// the next best thing: allocation-free per frame.
//
// Net savings vs Scenario 4 for 4K:
//   - Eliminates 1 _malloc + 1 _free per frame
//   - Eliminates 1 new ArrayBuffer allocation (~8.3MB) per frame from .slice()
//   - Result: same processing speed, dramatically reduced GC pressure

window.wasmMotion = {
    module: null,
    readyPromise: null,
    status: 'idle',
    error: null,

    // Zero-copy state: cached pointers and dimensions
    inputPtr: 0,
    outputPtr: 0,
    cachedWidth: 0,
    cachedHeight: 0,
    cachedBuffer: null,      // track HEAPU8.buffer for detach detection

    // Pre-allocated output ImageData (created once per resolution, reused per frame)
    outputImageData: null,

    init() {
        if (this.readyPromise) {
            return this.readyPromise;
        }

        this.status = 'loading';
        this.readyPromise = new Promise((resolve, reject) => {
            window.Module = {
                onRuntimeInitialized: () => {
                    this.module = window.Module;
                    this.status = 'ready';
                    resolve(this);
                }
            };

            const script = document.createElement('script');
            script.src = 'build/motion_wasm.js';
            script.async = true;
            script.onerror = () => {
                this.status = 'error';
                this.error = new Error(
                    'Khong tim thay motion_wasm.js. Hay build WASM truoc khi chay che do WASM.'
                );
                this.readyPromise = null;
                reject(this.error);
            };

            document.head.appendChild(script);
        });

        return this.readyPromise;
    },

    isReady() {
        return this.status === 'ready' && !!this.module;
    },

    reset() {
        if (!this.isReady()) {
            return;
        }

        this.module._resetMotionDetector();

        // Invalidate cached pointers — buffers were freed
        this.inputPtr = 0;
        this.outputPtr = 0;
        this.cachedWidth = 0;
        this.cachedHeight = 0;
        this.cachedBuffer = null;
        this.outputImageData = null;
    },

    /**
     * Ensure all zero-copy resources are initialized for current resolution.
     * - WASM-side: persistent input + output buffers via malloc (done once)
     * - JS-side: pre-allocated ImageData for output (done once)
     * Re-acquires if: first call, resolution changed, or WASM memory grew (buffer detached).
     */
    ensureBuffers(width, height) {
        const bufferChanged = this.module.HEAPU8.buffer !== this.cachedBuffer;
        const resChanged = width !== this.cachedWidth || height !== this.cachedHeight;

        if (!bufferChanged && !resChanged && this.inputPtr !== 0) {
            return;
        }

        // Allocate persistent input buffer on WASM side (C++ _malloc once)
        this.inputPtr = this.module._getInputBufferPtr(width, height);

        // Get persistent output buffer pointer
        this.outputPtr = this.module._getOutputBufferPtr();

        // Pre-allocate JS-side output ImageData — reused every frame via .set()
        if (this.outputImageData === null ||
            this.outputImageData.width !== width ||
            this.outputImageData.height !== height) {
            this.outputImageData = new ImageData(width, height);
        }

        this.cachedWidth = width;
        this.cachedHeight = height;
        this.cachedBuffer = this.module.HEAPU8.buffer;
    },

    process(imageData, width, height, threshold = 30) {
        if (!this.isReady()) {
            throw new Error('WASM runtime chua san sang.');
        }

        const input = imageData.data;

        // Step 1: Ensure persistent buffers (no malloc/free per frame)
        this.ensureBuffers(width, height);

        // Step 2: Copy JS canvas data → WASM input buffer (unavoidable)
        this.module.HEAPU8.set(input, this.inputPtr);

        // Step 3: Process in WASM (reads from input_rgba, writes to output_rgba)
        this.module._processMotion(width, height, threshold);

        // Step 4: Check if memory grew during processMotion (buffer may have detached)
        if (this.module.HEAPU8.buffer !== this.cachedBuffer) {
            this.outputPtr = this.module._getOutputBufferPtr();
            this.cachedBuffer = this.module.HEAPU8.buffer;
        }

        // Step 5: Copy WASM output → pre-allocated ImageData via .set()
        // .set() is V8-optimized and does NOT allocate a new ArrayBuffer.
        // This replaces .slice() (which allocates ~8.3MB/4K-frame) with a
        // zero-allocation typed array copy.
        const outputLength = width * height * 4;
        const wasmOutputView = new Uint8ClampedArray(
            this.module.HEAPU8.buffer,
            this.outputPtr,
            outputLength
        );
        this.outputImageData.data.set(wasmOutputView);

        const changedPixels = this.module._getChangedPixelCount();

        return {
            processedData: this.outputImageData,
            changedPixels
        };
    }
};