window.wasmMotion = {
    module: null,
    readyPromise: null,
    status: 'idle',
    error: null,

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
    },

    process(imageData, width, height, threshold = 30) {
        if (!this.isReady()) {
            throw new Error('WASM runtime chua san sang.');
        }

        const input = imageData.data;
        const inputPtr = this.module._malloc(input.length);
        this.module.HEAPU8.set(input, inputPtr);

        const outputPtr = this.module._processMotion(inputPtr, width, height, threshold);
        const outputLength = width * height * 4;
        const output = new Uint8ClampedArray(
            this.module.HEAPU8.buffer,
            outputPtr,
            outputLength
        ).slice();
        const changedPixels = this.module._getChangedPixelCount();

        this.module._free(inputPtr);

        return {
            processedData: new ImageData(output, width, height),
            changedPixels
        };
    }
};
