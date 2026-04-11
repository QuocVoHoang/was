#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔨 Building WASM..."
"$SCRIPT_DIR/build_wasm.sh"
echo ""

echo "🚀 Starting server at http://localhost:8080"
echo "   Press Ctrl+C to stop."
echo ""

python3 -m http.server 8080 --directory "$SCRIPT_DIR"
