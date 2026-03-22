# JS vs WASM Motion Detection

Repo nay duoc to chuc de benchmark cung mot thuat toan motion detection o 2 che do:

- `JavaScript`: dung `js_motion.js`
- `WebAssembly`: build tu `motion_wasm.cpp`

## 1. Cai Emscripten

Neu may chua co `emcc`, cai `emsdk`:

```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

Kiem tra:

```bash
emcc --version
```

## 2. Build WASM

Tu thu muc repo nay:

```bash
./build_wasm.sh
```

Lenh tren se sinh ra:

- `motion_wasm.js`
- `motion_wasm.wasm`

Script nay se uu tien:

- dung `emcc` neu da co trong `PATH`
- tu nap `../emsdk/emsdk_env.sh` neu repo `emsdk` nam canh thu muc du an
- dung cache cuc bo trong `.em_cache/` de tranh loi quyen ghi

## 3. Chay local server

WASM can duoc mo qua HTTP, khong nen mo bang `file://`.

Trong thu muc repo:

```bash
python3 -m http.server 8000
```

Mo trinh duyet tai `http://localhost:8000`.

## 4. Benchmark

1. Upload cung mot video.
2. Bam `Chay thuat toan (Vanilla JS)` de do JS.
3. Bam `Dung`.
4. Bam `Chay thuat toan (WASM)` de do WASM.
5. So sanh `FPS` va `ms/frame`.

## 5. Neu nut WASM khong chay

Neu giao dien bao WASM chua san sang, thu kiem tra:

- Da chay `./build_wasm.sh` chua.
- Trong repo co `motion_wasm.js` va `motion_wasm.wasm` chua.
- Ban co dang mo qua `http://localhost:8000` thay vi `file://` khong.
