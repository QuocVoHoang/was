# 📊 Hướng dẫn Các Chỉ số Hiệu năng (Metrics Guide)

Tài liệu này giải thích chi tiết các chỉ số được đo trong benchmark, cách tính toán và ý nghĩa của chúng.

---

## 📋 Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [FPS (Frames Per Second)](#2-fps-frames-per-second)
3. [Frame Processing Latency](#3-frame-processing-latency)
4. [Memory Usage](#4-memory-usage)
5. [CPU Estimate](#5-cpu-estimate)
6. [Motion Pixels](#6-motion-pixels)
7. [Công thức tính chi tiết](#7-công-thức-tính-chi-tiết)

---

## 1. Tổng quan

Benchmark đo lường **6 chỉ số chính** cho cả JavaScript và WebAssembly:

| Chỉ số | Đơn vị | Mục tiêu |
|--------|--------|----------|
| FPS | frames/s | Càng cao càng tốt |
| Latency | ms | Càng thấp càng tốt |
| Memory | MB | Càng thấp càng tốt |
| CPU | % | Càng thấp càng tốt |
| Motion Pixels | count | Thông tin |

---

## 2. FPS (Frames Per Second)

### Định nghĩa

**FPS** là số lượng frame video có thể xử lý trong một giây.

### Ý nghĩa

- **FPS cao** = Xử lý nhanh, video mượt
- **FPS thấp** = Xử lý chậm, có thể gây lag

### Cách tính trong code

```javascript
// Sliding window approach - tính FPS trong 1 giây gần nhất
const FPS_CALCULATION_WINDOW = 1000; // 1 giây

// Lưu timestamps của các frame
frameTimestamps.push(currentTime);

// Loại bỏ timestamps cũ (ngoài window)
const windowStart = currentTime - FPS_CALCULATION_WINDOW;
frameTimestamps = frameTimestamps.filter(t => t > windowStart);

// FPS = số frame trong window / window size (giây)
const fps = frameTimestamps.length / (FPS_CALCULATION_WINDOW / 1000);
```

### Ví dụ

```
Trong 1000ms gần nhất:
- Đã xử lý 15 frame
- FPS = 15 / 1 = 15 FPS
```

### Giá trị tham khảo

| FPS | Đánh giá |
|-----|----------|
| > 30 | Xuất sắc - Real-time processing |
| 15-30 | Tốt - Smooth playback |
| 10-15 | Trung bình - Có thể chấp nhận |
| < 10 | Chậm - Cần tối ưu |

---

## 3. Frame Processing Latency

### Định nghĩa

**Latency** là thời gian (ms) để xử lý **một frame đơn lẻ**, từ lúc bắt đầu detect đến khi hoàn thành.

### Ý nghĩa

- **Latency thấp** = Mỗi frame xử lý nhanh
- **Latency cao** = Mỗi frame mất nhiều thời gian

### Cách tính trong code

```javascript
// JavaScript
detectMotion(imageData, width, height) {
    const startTime = performance.now();
    
    // ... thuật toán xử lý ...
    
    const processingTime = performance.now() - startTime;
    return {
        motionPixels: count,
        processingTime: processingTime  // Latency
    };
}

// WebAssembly (tương tự, bao gồm cả overhead)
detectMotion(imageData, width, height) {
    const startTime = performance.now();
    
    // Copy data to Wasm heap
    // Call Wasm function
    // Copy result back
    
    const processingTime = performance.now() - startTime;
    return { processingTime };
}
```

### Components của Latency

**JavaScript:**
```
Total Latency = Thời gian thuật toán JS
```

**WebAssembly:**
```
Total Latency = Copy to Wasm heap 
              + Wasm execution 
              + Copy from Wasm heap
```

### Giá trị tham khảo (Video 4K)

| Latency | Đánh giá |
|---------|----------|
| < 30ms | Xuất sắc |
| 30-60ms | Tốt |
| 60-100ms | Trung bình |
| > 100ms | Chậm |

### Mối quan hệ với FPS

```
Max FPS = 1000 / Latency

Ví dụ: Latency = 50ms
Max FPS = 1000 / 50 = 20 FPS
```

---

## 4. Memory Usage

### Định nghĩa

**Memory Usage** là lượng RAM (MB) đang được JavaScript heap sử dụng.

### Ý nghĩa

- **Memory thấp** = Tiết kiệm tài nguyên
- **Memory cao** = Có thể gây chậm hoặc crash

### Cách tính trong code

```javascript
_getMemoryUsage() {
    // Chỉ hoạt động trên Chrome
    if (performance.memory) {
        // usedJSHeapSize = Memory đang dùng (bytes)
        return performance.memory.usedJSHeapSize / (1024 * 1024); // MB
    }
    return 0;
}
```

### performance.memory API

```javascript
performance.memory = {
    totalJSHeapSize:   // Tổng memory được cấp (bytes)
    usedJSHeapSize:    // Memory đang dùng (bytes)
    jsHeapSizeLimit:   // Giới hạn max (bytes)
}
```

> ⚠️ **Lưu ý**: API này chỉ có trên **Chrome**. Firefox/Safari không hỗ trợ.

### Memory Components

**JavaScript:**
```
Total Memory = ImageData buffers 
             + Previous frame buffer 
             + Motion mask buffer
             + JS runtime overhead
```

**WebAssembly:**
```
Total Memory = Wasm linear memory 
             + Buffers trong Wasm
             + JS glue code overhead
```

### Ước tính cho Video 4K (3840x2160)

```
Frame size = 3840 × 2160 × 4 bytes (RGBA) = 33,177,600 bytes ≈ 32 MB

Buffers cần thiết:
- Previous frame: 32 MB
- Motion mask: 32 MB
- Working buffers: ~32 MB
Total: ~96 MB minimum
```

### Giá trị tham khảo

| Memory (4K video) | Đánh giá |
|-------------------|----------|
| < 200 MB | Tốt |
| 200-500 MB | Trung bình |
| > 500 MB | Cao - Cần kiểm tra memory leak |

---

## 5. CPU Estimate

### Định nghĩa

**CPU Estimate** là phần trăm thời gian CPU dành cho việc xử lý motion detection.

### Ý nghĩa

- **CPU thấp** = Thuật toán hiệu quả, để lại tài nguyên cho tác vụ khác
- **CPU cao** = Thuật toán nặng, chiếm nhiều tài nguyên

### Cách tính trong code

```javascript
// CPU % = (Processing time / Frame time) × 100
const frameTime = currentTime - lastFrameTime;
const cpuEstimate = (processingLatency / frameTime) * 100;
```

### Ví dụ

```
Frame time (thời gian giữa 2 frame) = 33ms (30fps video)
Processing latency = 20ms

CPU Estimate = (20 / 33) × 100 = 60.6%
```

### Ý nghĩa kết quả

| CPU % | Ý nghĩa |
|-------|---------|
| < 50% | Còn nhiều idle time |
| 50-80% | Sử dụng hợp lý |
| 80-100% | Gần full load |

> ⚠️ **Lưu ý**: Đây là **ước tính**, không phải CPU usage thực tế của hệ thống.

### Hạn chế

- Không đo được multi-threading
- Không bao gồm GPU usage
- Chỉ là approximation dựa trên execution time

---

## 6. Motion Pixels

### Định nghĩa

**Motion Pixels** là số lượng pixel được phát hiện có chuyển động trong frame hiện tại.

### Ý nghĩa

- Cho biết **lượng chuyển động** trong video
- Không phải metric hiệu năng, mà là **kết quả thuật toán**

### Cách tính trong code

```javascript
// C++ / JavaScript
for (each pixel) {
    diff = |currentPixel - previousPixel|
    if (diff > threshold) {
        motionPixelsCount++
    }
}
return motionPixelsCount
```

### Ví dụ

```
Video 4K: 3840 × 2160 = 8,294,400 pixels total
Motion pixels detected: 500,000

Motion percentage = 500,000 / 8,294,400 × 100 = 6%
```

### Ứng dụng

- **Security cameras**: Phát hiện xâm nhập
- **Video compression**: Chỉ encode vùng chuyển động
- **Gesture recognition**: Input cho AI models

---

## 7. Công thức tính chi tiết

### Average FPS

```javascript
avgFPS = totalFrames / totalTime (seconds)

// Trong code
const totalTime = (endTime - startTime) / 1000; // seconds
const avgFPS = totalFrames / totalTime;
```

### Average Latency

```javascript
avgLatency = totalLatency / totalFrames

// Trong code
const avgLatency = metrics.totalLatency / metrics.totalFrames;
```

### Improvement Percentage

```javascript
// Với metrics mà "higher is better" (FPS)
improvement = ((wasmValue - jsValue) / jsValue) × 100

// Với metrics mà "lower is better" (Latency, Memory)
improvement = ((jsValue - wasmValue) / jsValue) × 100

// Ví dụ:
// JS FPS: 10, Wasm FPS: 25
// Improvement = ((25 - 10) / 10) × 100 = +150%
```

### Summary Statistics

```javascript
// Trong benchmark.js
_calculateSummaryStats(type) {
    const metrics = this.metrics[type];
    
    const totalTime = (metrics.endTime - metrics.startTime) / 1000;
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
```

---

## 📈 Đọc kết quả Benchmark

### Dashboard Real-time

```
┌─────────────────────────────────────────────┐
│  JavaScript          │  WebAssembly         │
│  FPS: 12             │  FPS: 28             │
│  Latency: 85ms       │  Latency: 35ms       │
│  Memory: 256 MB      │  Memory: 180 MB      │
│  CPU: 75%            │  CPU: 45%            │
└─────────────────────────────────────────────┘
```

### Summary Table

| Metric | JS | Wasm | Improvement |
|--------|-----|------|-------------|
| Avg FPS | 12 | 28 | **+133%** ✅ |
| Avg Latency | 85ms | 35ms | **-59%** ✅ |
| Peak Memory | 256 MB | 180 MB | **-30%** ✅ |

- 🟢 **Green (+)** = Wasm tốt hơn
- 🔴 **Red (-)** = JS tốt hơn

---

## 🔬 Factors ảnh hưởng kết quả

### Hardware

- **CPU speed**: Ảnh hưởng trực tiếp đến processing speed
- **RAM**: Ảnh hưởng đến memory capacity
- **Browser**: V8 engine vs SpiderMonkey

### Video

- **Resolution**: 4K nặng hơn 1080p ~4x
- **Content**: Video tĩnh xử lý nhanh hơn video động
- **Codec**: Decode time khác nhau

### Implementation

- **Algorithm**: Complexity ảnh hưởng processing time
- **Memory management**: Buffer reuse vs new allocation
- **Wasm overhead**: Copy data to/from Wasm heap

---

**Hiểu rõ các metrics giúp bạn tối ưu hiệu năng tốt hơn! 🚀**