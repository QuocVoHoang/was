---
trigger: always_on
description: WASM build conventions and Emscripten configuration
---

# WASM Build Conventions

## Build Command

All WASM is built via `./build_wasm.sh`. Never call `emcc` directly.

## Required Emscripten Flags

```bash
emcc motion_wasm.cpp \
    -O3 \                              # Maximum optimization
    -s WASM=1 \                        # Output WebAssembly (not asm.js)
    -s ALLOW_MEMORY_GROWTH=1 \         # Dynamic memory for 4K video
    -s EXPORTED_FUNCTIONS='[...]' \    # Explicit function exports
    -s EXPORTED_RUNTIME_METHODS='[...]' \
    -o motion_wasm.js
```

## Exported Functions

Every C++ function called from JS must be listed in `EXPORTED_FUNCTIONS`:

| Export | Purpose |
|---|---|
| `_malloc` | Allocate WASM heap memory for input pixel data |
| `_free` | Free allocated memory after processing |
| `_processMotion` | Main motion detection entry point |
| `_resetMotionDetector` | Clear previous frame state |
| `_getChangedPixelCount` | Get motion pixel count after processing |

When adding new C++ functions:
1. Mark with `EMSCRIPTEN_KEEPALIVE` in C++
2. Add to `EXPORTED_FUNCTIONS` in `build_wasm.sh`
3. Add JS bridge method in `wasm_motion_bridge.js`

## Runtime Methods

`EXPORTED_RUNTIME_METHODS` must include:
- `HEAPU8` — for reading/writing pixel data to WASM memory

## Build Output

- `motion_wasm.js` — Emscripten glue code (loads .wasm, sets up runtime)
- `motion_wasm.wasm` — Compiled WebAssembly binary

Both files are generated. **DO NOT edit manually**.

## Emscripten Setup

The build script auto-detects `emcc` from:
1. System PATH (if already sourced)
2. `../emsdk/emsdk_env.sh` (sibling directory)
3. Custom `EMSDK_DIR` environment variable

Cache is stored locally in `.em_cache/` to avoid permission issues.
