#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔨 Building WASM (Scalar)..."
"$SCRIPT_DIR/scenarios/scalar/build_wasm.sh"
echo ""

echo "🚀 Starting Scalar benchmark at http://localhost:8080"
echo "   Press Ctrl+C to stop."
echo ""

python3 -m http.server 8080 --directory "$SCRIPT_DIR/scenarios/scalar"
