---
trigger: always_on
description: Performance constraints and benchmarking rules for fair JS vs WASM comparison
---

# Performance Constraints

## Benchmark Fairness

- Both JS and WASM implementations MUST execute the **exact same algorithm** with the **same parameters**
- Same input data (identical video frames via Canvas `getImageData`)
- Same threshold value (default: 30)
- Same blur radius (default: 3, kernel 7×7)
- Measurement method must be identical for both paths

## Metrics

### Currently Measured
- **FPS**: Frames per second (via `requestAnimationFrame` interval)
- **Latency**: Per-frame processing time in ms (via `performance.now()`)

### Can Be Added
- **JS Heap Memory**: via `performance.memory` (Chrome only)
- **WASM Linear Memory**: via `WebAssembly.Memory.buffer.byteLength`
- **CPU estimate**: Processing time / frame interval ratio as proxy

### Cannot Be Measured (Browser Limitation)
- Actual CPU % usage (no Web API exists)
- GPU usage
- OS-level memory (sandboxed)

## Performance Rules

- **No heavy libraries** in the processing pipeline (no OpenCV.js, no TensorFlow.js)
- **No Web Workers** unless explicitly testing parallelism (keep single-threaded for fair comparison)
- **No OffscreenCanvas** unless explicitly testing it as a separate benchmark mode
- **Minimize GC pressure**: Reuse TypedArrays, avoid allocating in hot loops
- WASM build MUST use `-O3` optimization level for production benchmarks
- Use `willReadFrequently: true` on hidden canvas context (already done)

## Video Requirements

- Target resolution: **3840×2160 (4K)** for stress-testing
- Format: MP4 (H.264)
- The heavier the processing load, the more visible the JS vs WASM performance gap
