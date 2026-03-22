1.
- Install git and python3

2.
- git clone https://github.com/emscripten-core/emsdk.git
- cd emsdk

3.
./emsdk update
./emsdk install latest
./emsdk activate latest
source ~/emsdk/emsdk_env.sh

4.  Check
emcc -v -> kiểm tra đã hoạt động chưa

5. Run
./build_wasm.sh (đảm bảo phải chạy source ~/emsdk/emsdk_env.sh trước)
python3 -m http.server 8080
http://localhost:8080