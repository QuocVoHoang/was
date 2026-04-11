#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔨 Building WASM (Multi-thread)..."
"$SCRIPT_DIR/scenarios/multithread/build_wasm.sh"
echo ""

echo "🚀 Starting Multi-thread benchmark at http://localhost:8082"
echo "   (with COOP/COEP headers for SharedArrayBuffer)"
echo "   Press Ctrl+C to stop."
echo ""

python3 "$SCRIPT_DIR/scenarios/multithread/server.py" 8082 "$SCRIPT_DIR/scenarios/multithread"
