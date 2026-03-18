# 📖 Hướng dẫn Cài đặt và Chạy Benchmark

Hướng dẫn chi tiết cách cài đặt Emscripten, compile C++ sang WebAssembly, và chạy benchmark.

---

## 📋 Mục lục

1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Cài đặt Emscripten](#2-cài-đặt-emscripten)
3. [Compile C++ sang WebAssembly](#3-compile-c-sang-webassembly)
4. [Chạy Local Server](#4-chạy-local-server)
5. [Sử dụng Benchmark](#5-sử-dụng-benchmark)
6. [Xử lý sự cố](#6-xử-lý-sự-cố)

---

## 1. Yêu cầu hệ thống

### Hệ điều hành
- **macOS** 10.15+
- **Windows** 10+ (với WSL hoặc Git Bash)
- **Linux** (Ubuntu 18.04+, Debian, Fedora...)

### Phần mềm cần có

| Phần mềm | Mục đích | Cài đặt |
|----------|----------|---------|
| **Git** | Clone repository | `brew install git` (macOS) |
| **Python 3** | Chạy local server | Có sẵn trên macOS/Linux |
| **Node.js** (optional) | Chạy server với npx | `brew install node` |
| **Chrome** | Benchmark (memory API) | Download từ Google |

### Hardware khuyến nghị
- **CPU**: Multi-core processor
- **RAM**: 8GB+ (để xử lý video 4K)
- **GPU**: Không bắt buộc (Canvas 2D không dùng GPU)

---

## 2. Cài đặt Emscripten

Emscripten là compiler để chuyển đổi C/C++ sang WebAssembly.

### macOS / Linux

```bash
# Bước 1: Clone Emscripten SDK
git clone https://github.com/emscripten-core/emsdk.git

# Bước 2: Di chuyển vào thư mục
cd emsdk

# Bước 3: Cài đặt phiên bản mới nhất
./emsdk install latest

# Bước 4: Kích hoạt phiên bản
./emsdk activate latest

# Bước 5: Thiết lập biến môi trường
source ./emsdk_env.sh
```

### Windows (PowerShell)

```powershell
# Bước 1: Clone Emscripten SDK
git clone https://github.com/emscripten-core/emsdk.git

# Bước 2: Di chuyển vào thư mục
cd emsdk

# Bước 3: Cài đặt phiên bản mới nhất
emsdk install latest

# Bước 4: Kích hoạt phiên bản
emsdk activate latest

# Bước 5: Thiết lập biến môi trường
emsdk_env.bat
```

### Kiểm tra cài đặt

```bash
# Kiểm tra version
emcc --version

# Kết quả mong đợi:
# emcc 3.x.x (Emscripten wasm32 clang 17.x.x)
```

> ⚠️ **Lưu ý**: Bạn cần chạy `source ./emsdk_env.sh` mỗi khi mở terminal mới, hoặc thêm vào `.bashrc`/`.zshrc`:
>
> ```bash
> echo 'source /path/to/emsdk/emsdk_env.sh' >> ~/.zshrc
> ```

---

## 3. Compile C++ sang WebAssembly

### Cấu trúc file

```
wasm/
├── motion_detector.cpp  # Source code C++
├── motion_detector.js   # Generated JS glue (sau compile)
└── motion_detector.wasm # Generated WASM binary (sau compile)
```

### Compile command

```bash
# Di chuyển vào thư mục project
cd WASM

# Compile với Emscripten
emcc wasm/motion_detector.cpp \
    -o wasm/motion_detector.js \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS="['_malloc', '_free', '_detectMotion', '_initDetector', '_cleanupDetector', '_getMotionMask', '_configureDetector', '_hasSignificantMotion', '_getMotionPixelsCount', '_getVersion']" \
    -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap', 'HEAPU8', 'UTF8ToString']" \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s ENVIRONMENT='web' \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='Module' \
    -O3 \
    -Wall
```

### Giải thích các flags

| Flag | Mô tả |
|------|-------|
| `-s WASM=1` | Xuất ra WebAssembly (không phải asm.js) |
| `-s EXPORTED_FUNCTIONS` | Danh sách functions export ra JS |
| `-s EXPORTED_RUNTIME_METHODS` | Runtime methods cần dùng |
| `-s ALLOW_MEMORY_GROWTH=1` | Cho phép mở rộng memory heap |
| `-s ENVIRONMENT='web'` | Target môi trường web browser |
| `-s MODULARIZE=1` | Xuất dưới dạng module function |
| `-O3` | Optimization level 3 (max performance) |
| `-Wall` | Hiển thị tất cả warnings |

### Sử dụng script compile.sh

Chúng tôi cung cấp script tự động:

```bash
# Cấp quyền thực thi
chmod +x compile.sh

# Chạy compile
./compile.sh
```

### Kết quả sau compile

```
wasm/
├── motion_detector.cpp
├── motion_detector.js   ✅ Generated
└── motion_detector.wasm ✅ Generated
```

---

## 4. Chạy Local Server

### ⚠️ Tại sao cần Local Server?

WebAssembly yêu cầu file `.wasm` phải được serve qua HTTP/HTTPS, không thể mở trực tiếp file HTML.

### Option 1: Python (Recommended)

```bash
# Python 3
cd WASM
python -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080
```

### Option 2: Node.js (npx)

```bash
# Cài đặt serve (chỉ lần đầu)
npm install -g serve

# Hoặc dùng npx (không cần cài)
cd WASM
npx serve . -p 8080
```

### Option 3: VS Code Live Server

1. Cài extension "Live Server" trong VS Code
2. Right-click vào `index.html`
3. Chọn "Open with Live Server"

### Truy cập ứng dụng

```
http://localhost:8080
```

---

## 5. Sử dụng Benchmark

### Bước 1: Chuẩn bị Video

- **Định dạng**: MP4, WebM, MOV
- **Độ phân giải**: Khuyến nghị 4K (3840x2160) để thấy rõ khác biệt
- **Thời lượng**: 10-30 giây (đủ để đo)

> 💡 **Tip**: Video có nhiều chuyển động sẽ cho kết quả rõ ràng hơn.

### Bước 2: Upload Video

1. Click nút **"📁 Chọn Video 4K"**
2. Chọn file video từ máy
3. Đợi video load (xem tên file hiển thị)

### Bước 3: Cấu hình (Optional)

- **Motion Threshold** (5-100): Ngưỡng nhạy cảm
  - Giá trị thấp = nhạy hơn (detect nhiều motion hơn)
  - Giá trị cao = ít nhạy (chỉ detect motion lớn)
  - Default: 30

- **Sensitivity** (1-100%): % vùng chuyển động tối thiểu
  - Default: 5%

### Bước 4: Chạy Benchmark

1. Click **"▶️ Bắt đầu Benchmark"**
2. Quan sát 2 màn hình:
   - **Bên trái**: JavaScript processing
   - **Bên phải**: WebAssembly processing
3. Xem các chỉ số real-time

### Bước 5: Xem kết quả

- **Biểu đồ**: FPS, Latency, Memory theo thời gian
- **Summary Table**: Hiển thị sau khi benchmark kết thúc
  - So sánh JS vs Wasm
  - % Cải thiện

### Bước 6: Reset (Optional)

Click **"🔄 Reset"** để chạy lại benchmark.

---

## 6. Xử lý sự cố

### Lỗi: "WebAssembly module not found"

**Nguyên nhân**: Chưa compile C++ sang Wasm

**Giải pháp**:
```bash
cd WASM
./compile.sh
```

### Lỗi: "Failed to load wasm file"

**Nguyên nhân**: Chưa chạy local server

**Giải pháp**:
```bash
# Đảm bảo đang chạy server
python -m http.server 8080

# Truy cập qua http://localhost:8080
# KHÔNG mở file:// trực tiếp
```

### Lỗi: "Memory metrics show 0"

**Nguyên nhân**: `performance.memory` chỉ có trên Chrome

**Giải pháp**: Sử dụng Chrome browser

### Lỗi: "Video không load"

**Nguyên nhân**: Format video không được hỗ trợ

**Giải pháp**:
- Thử format khác (MP4 H.264 là phổ biến nhất)
- Kiểm tra console browser để xem lỗi cụ thể

### Lỗi: "emcc: command not found"

**Nguyên nhân**: Emscripten chưa được activate

**Giải pháp**:
```bash
cd /path/to/emsdk
source ./emsdk_env.sh
```

### Performance thấp

**Nguyên nhân**: Video 4K rất nặng

**Giải pháp**:
- Giảm độ phân giải video
- Đóng các tab/browser khác
- Sử dụng máy có RAM > 8GB

---

## 📞 Hỗ trợ

Nếu gặp vấn đề khác:

1. Kiểm tra **Browser Console** (F12 > Console)
2. Tạo issue trên repository với:
   - Mô tả lỗi
   - Browser & version
   - OS
   - Console log

---

**Happy Benchmarking! 🚀**