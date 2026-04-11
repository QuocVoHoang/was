#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔨 Building WASM (SIMD)..."
"$SCRIPT_DIR/scenarios/simd/build_wasm.sh"
echo ""

echo "🚀 Starting SIMD benchmark at http://localhost:8081"
echo "   Press Ctrl+C to stop."
echo ""

python3 -m http.server 8081 --directory "$SCRIPT_DIR/scenarios/simd"
