---
trigger: keyword
keywords: [performance, fps, latency, memory, benchmark, measure, metrics, performance.now, performance.memory, PerformanceObserver]
description: Browser Performance APIs for measuring FPS, latency, memory, and CPU estimation
---

# Browser Performance APIs Reference

## 1. High-Resolution Timing

### `performance.now()`
Most precise timing available in the browser (microsecond resolution).

```js
const start = performance.now();
// ... work ...
const end = performance.now();
const latencyMs = end - start; // milliseconds with decimal precision
```

**Usage in this project**: Measure per-frame processing latency in `app.js`.

### `performance.timeOrigin`
Absolute timestamp of when the page started. Combine with `performance.now()` for wall-clock time.

## 2. FPS Measurement Patterns

### Pattern A: Frame Interval (current approach)
```js
let lastTimestamp = null;

function onFrame() {
    const now = performance.now();
    if (lastTimestamp !== null) {
        const fps = 1000 / (now - lastTimestamp);
    }
    lastTimestamp = now;
    requestAnimationFrame(onFrame);
}
```

### Pattern B: Rolling Average (smoother readout)
```js
const WINDOW_SIZE = 30;
const frameTimes = [];

function onFrame() {
    const now = performance.now();
    frameTimes.push(now);
    if (frameTimes.length > WINDOW_SIZE) frameTimes.shift();

    if (frameTimes.length >= 2) {
        const elapsed = frameTimes[frameTimes.length - 1] - frameTimes[0];
        const avgFps = (frameTimes.length - 1) / (elapsed / 1000);
    }
    requestAnimationFrame(onFrame);
}
```

### Pattern C: Count-Based (per-second update)
```js
let frameCount = 0;
let lastSecond = performance.now();

function onFrame() {
    frameCount++;
    const now = performance.now();
    if (now - lastSecond >= 1000) {
        const fps = frameCount;
        frameCount = 0;
        lastSecond = now;
    }
    requestAnimationFrame(onFrame);
}
```

## 3. Memory Measurement

### JS Heap Memory (Chrome only)
```js
if (performance.memory) {
    const mem = performance.memory;
    console.log({
        usedHeap: (mem.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
        totalHeap: (mem.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
        heapLimit: (mem.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB'
    });
}
```

**Properties:**
| Property | Meaning |
|---|---|
| `usedJSHeapSize` | Memory actively used by JS objects |
| `totalJSHeapSize` | Total allocated heap (includes free space) |
| `jsHeapSizeLimit` | Maximum heap the browser will allocate |

> ⚠️ `performance.memory` is **Chrome-only** and **non-standard**. It requires the `--enable-precise-memory-info` flag for precise values. Without it, values are rounded.

### WASM Linear Memory
```js
if (window.wasmMotion && window.wasmMotion.isReady()) {
    const wasmMem = window.wasmMotion.module.HEAPU8.buffer.byteLength;
    console.log('WASM Memory:', (wasmMem / 1024 / 1024).toFixed(2) + ' MB');
}
```

### `performance.measureUserAgentSpecificMemory()` (Newer API)
```js
// Requires cross-origin isolation headers:
// Cross-Origin-Opener-Policy: same-origin
// Cross-Origin-Embedder-Policy: require-corp

if (performance.measureUserAgentSpecificMemory) {
    const result = await performance.measureUserAgentSpecificMemory();
    console.log('Total bytes:', result.bytes);
    result.breakdown.forEach(entry => {
        console.log(entry.types, entry.bytes);
    });
}
```

## 4. CPU Estimation (Indirect)

Browsers don't expose CPU usage. Use these proxies:

### Processing Load Ratio
```js
const frameStart = performance.now();
// ... processing ...
const processingTime = performance.now() - frameStart;

// If frame budget is 16.67ms (60fps):
const cpuLoadEstimate = (processingTime / 16.67) * 100;
// > 100% means can't keep up with 60fps
```

### Long Task Detection
```js
const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
        console.log('Long task:', entry.duration.toFixed(2) + 'ms');
    }
});
observer.observe({ type: 'longtask', buffered: true });
```

A "long task" is any task exceeding **50ms** — indicates the main thread is blocked.

## 5. Frame Timing API

```js
const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
        // entry.duration = time from start to
        // next paint (includes layout, paint)
        console.log('Frame duration:', entry.duration);
    }
});
observer.observe({ type: 'frame', buffered: true });
```

## 6. Aggregating Benchmark Results

### Statistics Helper
```js
function computeStats(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / sorted.length;

    return {
        mean: mean.toFixed(2),
        median: sorted[Math.floor(sorted.length / 2)].toFixed(2),
        min: sorted[0].toFixed(2),
        max: sorted[sorted.length - 1].toFixed(2),
        p95: sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
        p99: sorted[Math.floor(sorted.length * 0.99)].toFixed(2),
        stdDev: Math.sqrt(
            sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / sorted.length
        ).toFixed(2)
    };
}
```

### Usage
```js
const latencies = []; // collect per-frame latency

// After benchmark run:
const stats = computeStats(latencies);
console.table(stats);
```

## Browser Compatibility

| API | Chrome | Firefox | Safari | Edge |
|---|---|---|---|---|
| `performance.now()` | ✅ | ✅ | ✅ | ✅ |
| `performance.memory` | ✅ | ❌ | ❌ | ✅ |
| `PerformanceObserver` | ✅ | ✅ | ✅ | ✅ |
| `longtask` type | ✅ | ❌ | ❌ | ✅ |
| `measureUserAgentSpecificMemory` | ✅* | ❌ | ❌ | ✅* |

*Requires cross-origin isolation headers
