#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔨 Building WASM (SIMD + Multi-thread)..."
"$SCRIPT_DIR/scenarios/simd_mt/build_wasm.sh"
echo ""

echo "🚀 Starting SIMD+MT benchmark at http://localhost:8083"
echo "   (with COOP/COEP headers for SharedArrayBuffer)"
echo "   Press Ctrl+C to stop."
echo ""

python3 "$SCRIPT_DIR/scenarios/simd_mt/server.py" 8083 "$SCRIPT_DIR/scenarios/simd_mt"
