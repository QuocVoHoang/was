---
trigger: keyword
keywords: [malloc, free, memory, heap, HEAPU8, buffer, wasm memory, memory leak, linear memory]
description: WASM memory management patterns - allocation, deallocation, and avoiding leaks
---

# WASM Memory Management

## How WASM Memory Works

WASM uses a **linear memory** model — a single contiguous `ArrayBuffer` shared between JS and WASM.

```
┌─────────────────────────────────────────┐
│              WASM Linear Memory          │
│                                         │
│  ┌──────┐  ┌──────────┐  ┌───────────┐ │
│  │Stack │  │  Heap     │  │  Free     │ │
│  │(auto)│  │(malloc'd) │  │  Space    │ │
│  └──────┘  └──────────┘  └───────────┘ │
│                                         │
│  Accessed via: Module.HEAPU8.buffer     │
└─────────────────────────────────────────┘
```

- **Stack**: Automatic local variables (managed by WASM runtime)
- **Heap**: Dynamic allocations via `malloc`/`free`
- **Growth**: When `ALLOW_MEMORY_GROWTH=1`, the buffer can grow (but existing `ArrayBuffer` references become invalidated!)

## The malloc/free Pattern (Current Project)

This is how `wasm_motion_bridge.js` transfers pixel data:

```js
process(imageData, width, height, threshold = 30) {
    const input = imageData.data;          // JS Uint8ClampedArray

    // 1. ALLOCATE: Reserve space on WASM heap
    const inputPtr = this.module._malloc(input.length);

    // 2. COPY IN: Write JS data into WASM memory
    this.module.HEAPU8.set(input, inputPtr);

    // 3. CALL: Process data in WASM
    const outputPtr = this.module._processMotion(inputPtr, width, height, threshold);

    // 4. COPY OUT: Read result from WASM memory
    const output = new Uint8ClampedArray(
        this.module.HEAPU8.buffer,
        outputPtr,
        width * height * 4
    ).slice();  // .slice() creates a COPY (important!)

    // 5. FREE: Release WASM heap memory
    this.module._free(inputPtr);

    return { processedData: new ImageData(output, width, height) };
}
```

## Critical Rules

### Rule 1: Always free what you malloc
```js
// ✅ CORRECT
const ptr = module._malloc(size);
try {
    // use ptr...
} finally {
    module._free(ptr);  // Always free, even on error
}

// ❌ WRONG — memory leak
const ptr = module._malloc(size);
// use ptr...
// forgot to free!
```

### Rule 2: Always `.slice()` when reading WASM output
```js
// ✅ CORRECT — creates independent copy
const output = new Uint8ClampedArray(module.HEAPU8.buffer, ptr, len).slice();

// ❌ WRONG — this is a VIEW into WASM memory, becomes invalid if memory grows
const output = new Uint8ClampedArray(module.HEAPU8.buffer, ptr, len);
```

### Rule 3: Re-read HEAPU8 after memory growth
```js
// ❌ WRONG — stale reference after malloc may grow memory
const heap = module.HEAPU8;
const ptr = module._malloc(hugeSize);  // This might grow memory!
heap.set(data, ptr);  // BUG: heap.buffer may be detached

// ✅ CORRECT — always use module.HEAPU8 directly
const ptr = module._malloc(hugeSize);
module.HEAPU8.set(data, ptr);  // Uses current buffer
```

### Rule 4: Don't free WASM-owned memory
```js
// ❌ WRONG — outputPtr points to a C++ static buffer (std::vector)
module._free(outputPtr);

// ✅ CORRECT — only free memory YOU allocated with _malloc
module._free(inputPtr);  // This was allocated by JS via _malloc
// outputPtr is managed by C++ (static vector), don't free it
```

## Memory Size Estimation

For a 4K video (3840 × 2160):

| Buffer | Size | Calculation |
|---|---|---|
| Input RGBA | 33.18 MB | 3840 × 2160 × 4 bytes |
| Grayscale | 8.29 MB | 3840 × 2160 × 1 byte |
| Blurred gray | 8.29 MB | 3840 × 2160 × 1 byte |
| Output RGBA | 33.18 MB | 3840 × 2160 × 4 bytes |
| Previous frame | 8.29 MB | 3840 × 2160 × 1 byte |
| **Total WASM heap** | **~91 MB** | All buffers combined |

Plus the JS side holds a copy of input (`getImageData`) and output (`.slice()`), so total browser memory usage is roughly **~160 MB** for 4K.

## Monitoring WASM Memory

```js
function getWasmMemoryInfo() {
    if (!window.wasmMotion || !window.wasmMotion.isReady()) {
        return null;
    }

    const buffer = window.wasmMotion.module.HEAPU8.buffer;
    return {
        totalBytes: buffer.byteLength,
        totalMB: (buffer.byteLength / 1024 / 1024).toFixed(2)
    };
}
```

## Common Memory Bugs

| Symptom | Likely Cause | Fix |
|---|---|---|
| Memory keeps growing | Missing `_free()` call | Add `_free(ptr)` after use |
| Garbled output data | Reading stale buffer view | Use `.slice()` or re-read `HEAPU8` |
| `RuntimeError: memory access out of bounds` | Wrong pointer arithmetic | Check `width * height * 4` calculations |
| Browser tab crashes | Unbounded memory growth | Set `MAXIMUM_MEMORY` in build flags |
| `TypeError: detached ArrayBuffer` | Memory grew, old view invalidated | Don't cache `HEAPU8.buffer` references |
