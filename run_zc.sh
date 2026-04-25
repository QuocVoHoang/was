#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔨 Building WASM (SIMD + Multi-thread + Zero-Copy)..."
"$SCRIPT_DIR/scenarios/zero_copy/build_wasm.sh"
echo ""

echo "🚀 Starting SIMD+MT+Zero-Copy benchmark at http://localhost:8084"
echo "   (with COOP/COEP headers for SharedArrayBuffer)"
echo "   Press Ctrl+C to stop."
echo ""

python3 "$SCRIPT_DIR/scenarios/zero_copy/server.py" 8084 "$SCRIPT_DIR/scenarios/zero_copy"
