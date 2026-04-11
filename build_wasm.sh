#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EMSDK_DIR="${EMSDK_DIR:-$SCRIPT_DIR/../emsdk}"
EM_CACHE_DIR="${EM_CACHE:-$SCRIPT_DIR/.em_cache}"
EM_CONFIG_FILE="${EM_CONFIG:-$SCRIPT_DIR/.emscripten_local}"

mkdir -p "$EM_CACHE_DIR"

if ! command -v emcc >/dev/null 2>&1; then
    if [[ -f "$EMSDK_DIR/emsdk_env.sh" ]]; then
        # shellcheck disable=SC1090
        EMSDK_QUIET=1 source "$EMSDK_DIR/emsdk_env.sh" >/dev/null
    fi
fi

if command -v emcc >/dev/null 2>&1; then
    EMCC_BIN="$(command -v emcc)"
elif [[ -x "$EMSDK_DIR/upstream/emscripten/emcc" ]]; then
    EMCC_BIN="$EMSDK_DIR/upstream/emscripten/emcc"
else
    echo "Khong tim thay emcc. Hay cai/nạp Emscripten truoc khi build." >&2
    echo "Goi y: source ../emsdk/emsdk_env.sh" >&2
    exit 1
fi

export EM_CACHE="$EM_CACHE_DIR"
export EM_CONFIG="$EM_CONFIG_FILE"

cat > "$EM_CONFIG_FILE" <<EOF
import os
NODE_JS = os.path.realpath('$EMSDK_DIR/node/22.16.0_64bit/bin/node').replace('\\\\', '/')
PYTHON = os.path.realpath('$EMSDK_DIR/python/3.13.3_64bit/bin/python3').replace('\\\\', '/')
LLVM_ROOT = os.path.realpath('$EMSDK_DIR/upstream/bin').replace('\\\\', '/')
BINARYEN_ROOT = os.path.realpath('$EMSDK_DIR/upstream').replace('\\\\', '/')
EMSCRIPTEN_ROOT = os.path.realpath('$EMSDK_DIR/upstream/emscripten').replace('\\\\', '/')
CACHE = os.path.realpath('$EM_CACHE_DIR').replace('\\\\', '/')
EOF

"$EMCC_BIN" cpp/motion_wasm.cpp \
    -O3 \
    -s WASM=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXPORTED_FUNCTIONS='["_malloc","_free","_processMotion","_resetMotionDetector","_getChangedPixelCount"]' \
    -s EXPORTED_RUNTIME_METHODS='["HEAPU8"]' \
    -o build/motion_wasm.js

echo "Build done: build/motion_wasm.js and build/motion_wasm.wasm"
