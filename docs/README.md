# 🚀 Benchmark: JavaScript vs WebAssembly - Motion Detection 4K

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Web-orange.svg)

## 📋 Mô tả dự án

Dự án này là một công cụ benchmark để so sánh hiệu năng giữa **JavaScript thuần (Vanilla JS)** và **WebAssembly (C++)** trong tác vụ **Motion Detection** (phát hiện chuyển động) trên video độ phân giải 4K.

### Mục tiêu

- So sánh tốc độ xử lý giữa JS và Wasm
- Đo lường các chỉ số hiệu năng: FPS, Latency, Memory, CPU
- Trực quan hóa kết quả bằng biểu đồ real-time
- Cung cấp tài liệu hướng dẫn chi tiết

---

## 🏗️ Cấu trúc Repository

```
WASM/
├── index.html              # Dashboard chính
├── css/
│   └── styles.css          # CSS styling cho dashboard
├── js/
│   ├── detector.js         # Motion detector (JS + Wasm wrapper)
│   ├── benchmark.js        # Module đo đạc metrics
│   └── app.js              # Logic điều phối chính
├── wasm/
│   ├── motion_detector.cpp # Mã nguồn C++ cho Wasm
│   ├── motion_detector.js  # Emscripten generated JS glue
│   └── motion_detector.wasm# Binary WebAssembly
├── docs/
│   ├── README.md           # File này
│   ├── RUN_GUIDE.md        # Hướng dẫn cài đặt & chạy
│   └── METRICS_GUIDE.md    # Giải thích các chỉ số
├── assets/                 # Video test files (optional)
└── compile.sh              # Script compile Wasm
```

---

## 🔧 Công nghệ sử dụng

### Frontend

| Công nghệ | Mô tả |
|-----------|-------|
| HTML5 | Cấu trúc trang web |
| CSS3 | Styling với CSS Variables, Flexbox, Grid |
| Vanilla JavaScript | Không sử dụng framework |
| Canvas 2D API | Xử lý và hiển thị video frames |
| Chart.js | Vẽ biểu đồ real-time (CDN) |

### WebAssembly

| Công nghệ | Mô tả |
|-----------|-------|
| C++ | Ngôn ngữ viết thuật toán |
| Emscripten | Compiler C++ sang Wasm |
| WASM | Binary format cho web |

### APIs sử dụng

- `performance.now()` - Đo thời gian chính xác
- `performance.memory` - Theo dõi memory (Chrome only)
- `requestAnimationFrame` - Animation loop
- `URL.createObjectURL` - Load video local

---

## 🎯 Tính năng chính

### 1. Motion Detection

Thuật toán phát hiện chuyển động sử dụng **pixel comparison**:

```
1. Lấy frame hiện tại từ video
2. So sánh với frame trước đó
3. Tính độ khác biệt (diff) cho mỗi pixel
4. Nếu diff > threshold => Motion detected
5. Highlight vùng chuyển động bằng màu đỏ
```

### 2. Dashboard Real-time

- **2 màn hình so sánh song song** (JS vs Wasm)
- **6 chỉ số theo dõi** cho mỗi phương pháp:
  - FPS (Frames Per Second)
  - Frame Processing Latency (ms)
  - Total Frames Processed
  - Average FPS
  - Average Latency
  - Memory Usage (MB)
  - CPU Estimate (%)
  - Motion Pixels Count

### 3. Biểu đồ Real-time

- **FPS Chart**: So sánh FPS theo thời gian
- **Latency Chart**: So sánh độ trễ xử lý
- **Memory Chart**: Theo dõi memory usage

### 4. Summary Report

Bảng tổng kết cuối benchmark với % cải thiện:

| Metric | JavaScript | WebAssembly | Improvement |
|--------|------------|-------------|-------------|
| Avg FPS | X | Y | +Z% |
| Avg Latency | X ms | Y ms | -Z% |
| Peak Memory | X MB | Y MB | -Z% |

---

## 🚀 Quick Start

### Yêu cầu

- Trình duyệt **Chrome** (để sử dụng `performance.memory` API)
- **Emscripten** (để compile C++ sang Wasm)
- Local web server

### Chạy nhanh

```bash
# 1. Clone hoặc download project
cd WASM

# 2. Compile Wasm (cần Emscripten)
./compile.sh

# 3. Chạy local server
npx serve .

# Hoặc dùng Python
python -m http.server 8080

# 4. Mở trình duyệt
# http://localhost:8080
```

> 📖 Xem chi tiết trong [RUN_GUIDE.md](./RUN_GUIDE.md)

---

## 📊 Kết quả mong đợi

Trên video 4K (3840x2160):

| Metric | JavaScript | WebAssembly | Cải thiện |
|--------|------------|-------------|-----------|
| FPS | ~5-10 | ~15-25 | 2-3x |
| Latency | ~100-200ms | ~40-70ms | 50-60% |
| Memory | Cao hơn | Thấp hơn | 10-20% |

> ⚠️ Kết quả thực tế phụ thuộc vào hardware và video content.

---

## 📚 Tài liệu

- [RUN_GUIDE.md](./RUN_GUIDE.md) - Hướng dẫn cài đặt chi tiết
- [METRICS_GUIDE.md](./METRICS_GUIDE.md) - Giải thích các chỉ số

---

## 🤝 Đóng góp

Mọi đóng góp đều được chào đón! Vui lòng:

1. Fork project
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Mở Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 📧 Liên hệ

Nếu có câu hỏi hoặc góp ý, vui lòng tạo issue trên repository.

---

**Made with ❤️ for performance enthusiasts**