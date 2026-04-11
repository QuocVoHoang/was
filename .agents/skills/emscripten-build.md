---
trigger: keyword
keywords: [emscripten, emcc, build, compile, wasm build, emsdk]
description: Emscripten compilation guide - flags, optimization, debugging
---

# Emscripten Build Reference

## Installation

```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

Verify: `emcc --version`

## Optimization Levels

| Flag | Use Case | Speed | Size | Debug |
|---|---|---|---|---|
| `-O0` | Development/debugging | — | Large | Full |
| `-O1` | Light optimization | + | Medium | Partial |
| `-O2` | Balanced | ++ | Small | Limited |
| `-O3` | Maximum speed (**use for benchmarks**) | +++ | Small | None |
| `-Os` | Minimum size | ++ | Smallest | None |
| `-Oz` | Aggressive size reduction | + | Tiny | None |

## Debug Build

For debugging WASM issues, use a debug build:

```bash
emcc motion_wasm.cpp \
    -O0 \
    -g \
    -s WASM=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s ASSERTIONS=2 \
    -s SAFE_HEAP=1 \
    -s STACK_OVERFLOW_CHECK=2 \
    -s EXPORTED_FUNCTIONS='[...]' \
    -s EXPORTED_RUNTIME_METHODS='["HEAPU8"]' \
    -o motion_wasm.js
```

Key debug flags:
- `-g`: Include debug symbols (enables DWARF debugging in Chrome)
- `-s ASSERTIONS=2`: Detailed runtime checks
- `-s SAFE_HEAP=1`: Detect out-of-bounds heap access
- `-s STACK_OVERFLOW_CHECK=2`: Detect stack overflows

## Common Flags Reference

### Memory
| Flag | Purpose |
|---|---|
| `ALLOW_MEMORY_GROWTH=1` | Allow heap to grow dynamically (required for 4K video) |
| `INITIAL_MEMORY=67108864` | Set initial memory to 64MB |
| `MAXIMUM_MEMORY=536870912` | Cap memory at 512MB |
| `STACK_SIZE=1048576` | Set stack size to 1MB |

### Exports
| Flag | Purpose |
|---|---|
| `EXPORTED_FUNCTIONS` | List C functions accessible from JS (prefix with `_`) |
| `EXPORTED_RUNTIME_METHODS` | Runtime helpers (e.g., `HEAPU8`, `ccall`, `cwrap`) |
| `MODULARIZE=1` | Wrap output in a module factory function |

### Performance
| Flag | Purpose |
|---|---|
| `-O3` | Maximum optimization |
| `--closure 1` | Run Closure Compiler on glue JS |
| `-flto` | Link-time optimization |
| `-fno-exceptions` | Disable C++ exceptions (smaller/faster) |
| `-fno-rtti` | Disable RTTI (smaller binary) |

## Adding New C++ Functions

1. Write function in `motion_wasm.cpp`:
```cpp
extern "C" {
EMSCRIPTEN_KEEPALIVE
int myNewFunction(int param) {
    // implementation
    return result;
}
}
```

2. Add to `build_wasm.sh` `EXPORTED_FUNCTIONS`:
```bash
-s EXPORTED_FUNCTIONS='[..., "_myNewFunction"]'
```

3. Add JS bridge in `wasm_motion_bridge.js`:
```js
myNewFunction(param) {
    if (!this.isReady()) throw new Error('WASM not ready');
    return this.module._myNewFunction(param);
}
```

4. Rebuild: `./build_wasm.sh`

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `emcc: not found` | Emscripten not in PATH | `source emsdk_env.sh` |
| `undefined symbol: _func` | Function not exported | Add to `EXPORTED_FUNCTIONS` |
| `out of memory` | Heap too small for 4K | Add `ALLOW_MEMORY_GROWTH=1` |
| `RuntimeError: unreachable` | Bug in C++ code | Build with `-g -s ASSERTIONS=2` |
| `TypeError: Module._func is not a function` | Missing `EMSCRIPTEN_KEEPALIVE` | Add macro to C++ function |
