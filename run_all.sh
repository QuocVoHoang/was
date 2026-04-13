#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "============================================"
echo "  🚀 WASM Benchmark — All Scenarios"
echo "============================================"
echo ""

# --- 1. Build all WASM modules first ---
echo "🔨 [1/4] Building WASM (Scalar)..."
"$SCRIPT_DIR/scenarios/scalar/build_wasm.sh"

echo "🔨 [2/4] Building WASM (SIMD)..."
"$SCRIPT_DIR/scenarios/simd/build_wasm.sh"

echo "🔨 [3/4] Building WASM (Multi-thread)..."
"$SCRIPT_DIR/scenarios/multithread/build_wasm.sh"

echo "🔨 [4/4] Building WASM (SIMD + Multi-thread)..."
"$SCRIPT_DIR/scenarios/simd_mt/build_wasm.sh"

echo ""
echo "✅ All WASM modules built successfully!"
echo ""

# --- 2. Start all servers in background ---
PIDS=()

cleanup() {
    echo ""
    echo "🛑 Shutting down all servers..."
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null
    echo "✅ All servers stopped."
}
trap cleanup EXIT INT TERM

echo "🌐 Starting all benchmark servers..."
echo ""

# Scalar — port 8080
python3 -m http.server 8080 --directory "$SCRIPT_DIR/scenarios/scalar" &>/dev/null &
PIDS+=($!)
echo "   ✦ Scalar:          http://localhost:8080"

# SIMD — port 8081
python3 -m http.server 8081 --directory "$SCRIPT_DIR/scenarios/simd" &>/dev/null &
PIDS+=($!)
echo "   ✦ SIMD:            http://localhost:8081"

# Multi-thread — port 8082 (needs COOP/COEP headers)
python3 "$SCRIPT_DIR/scenarios/multithread/server.py" 8082 "$SCRIPT_DIR/scenarios/multithread" &>/dev/null &
PIDS+=($!)
echo "   ✦ Multi-thread:    http://localhost:8082"

# SIMD+MT — port 8083 (needs COOP/COEP headers)
python3 "$SCRIPT_DIR/scenarios/simd_mt/server.py" 8083 "$SCRIPT_DIR/scenarios/simd_mt" &>/dev/null &
PIDS+=($!)
echo "   ✦ SIMD+MT:         http://localhost:8083"

echo ""
echo "============================================"
echo "  All 4 servers are running!"
echo "  Press Ctrl+C to stop all."
echo "============================================"

# Wait briefly for servers to be ready, then open in browser
sleep 1
open http://localhost:8080
open http://localhost:8081
open http://localhost:8082
open http://localhost:8083

# Wait for all background processes
wait
