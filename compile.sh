#!/bin/bash

# ============================================
# Compile Script for WebAssembly
# ============================================
# 
# Script này compile file C++ sang WebAssembly
# sử dụng Emscripten.
#
# Yêu cầu: Emscripten phải được cài đặt và activate
# 
# Usage: ./compile.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SOURCE_FILE="wasm/motion_detector.cpp"
OUTPUT_JS="wasm/motion_detector.js"
OUTPUT_WASM="wasm/motion_detector.wasm"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  WebAssembly Compile Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if emcc is available
echo -e "${YELLOW}Checking for Emscripten...${NC}"
if ! command -v emcc &> /dev/null; then
    echo -e "${RED}Error: emcc not found!${NC}"
    echo ""
    echo "Please install and activate Emscripten:"
    echo "  git clone https://github.com/emscripten-core/emsdk.git"
    echo "  cd emsdk"
    echo "  ./emsdk install latest"
    echo "  ./emsdk activate latest"
    echo "  source ./emsdk_env.sh"
    exit 1
fi

EMCC_VERSION=$(emcc --version | head -n 1)
echo -e "${GREEN}Found: ${EMCC_VERSION}${NC}"
echo ""

# Check if source file exists
echo -e "${YELLOW}Checking source file...${NC}"
if [ ! -f "$SOURCE_FILE" ]; then
    echo -e "${RED}Error: Source file not found: ${SOURCE_FILE}${NC}"
    exit 1
fi
echo -e "${GREEN}Source file found: ${SOURCE_FILE}${NC}"
echo ""

# Compile
echo -e "${YELLOW}Compiling C++ to WebAssembly...${NC}"
echo ""

emcc "$SOURCE_FILE" \
    -o "$OUTPUT_JS" \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS="[
        '_malloc', 
        '_free', 
        '_detectMotion', 
        '_initDetector', 
        '_cleanupDetector', 
        '_getMotionMask', 
        '_configureDetector', 
        '_hasSignificantMotion', 
        '_getMotionPixelsCount', 
        '_getVersion'
    ]" \
    -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap', 'HEAPU8', 'UTF8ToString']" \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s ENVIRONMENT='web' \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='Module' \
    -O3 \
    -Wall \
    -Wno-unused-function

# Check if compilation succeeded
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Compilation Successful!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "Output files:"
    echo -e "  ${BLUE}JavaScript:${NC}  ${OUTPUT_JS}"
    echo -e "  ${BLUE}WebAssembly:${NC} ${OUTPUT_WASM}"
    echo ""
    
    # Show file sizes
    if [ -f "$OUTPUT_JS" ]; then
        JS_SIZE=$(ls -lh "$OUTPUT_JS" | awk '{print $5}')
        echo -e "  JS size:   ${JS_SIZE}"
    fi
    if [ -f "$OUTPUT_WASM" ]; then
        WASM_SIZE=$(ls -lh "$OUTPUT_WASM" | awk '{print $5}')
        echo -e "  WASM size: ${WASM_SIZE}"
    fi
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Start a local server: python -m http.server 8080"
    echo "  2. Open browser: http://localhost:8080"
    echo ""
else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  Compilation Failed!${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo "Please check the error messages above."
    exit 1
fi