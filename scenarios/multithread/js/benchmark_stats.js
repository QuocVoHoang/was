// benchmark_stats.js — Statistical utilities for benchmark results

/**
 * Compute descriptive statistics for an array of numeric values.
 * @param {number[]} values - Array of measurements
 * @returns {object|null} Statistics object or null if empty
 */
function computeStats(values) {
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;

    return {
        count: n,
        mean,
        median: sorted[Math.floor(n / 2)],
        min: sorted[0],
        max: sorted[n - 1],
        p95: sorted[Math.floor(n * 0.95)],
        p99: sorted[Math.min(Math.floor(n * 0.99), n - 1)],
        stdDev: Math.sqrt(variance)
    };
}

/**
 * Format a millisecond value for display.
 */
function formatMs(value) {
    if (value == null) return '—';
    return value.toFixed(2) + ' ms';
}

/**
 * Format an FPS value for display.
 */
function formatFps(value) {
    if (value == null) return '—';
    return value.toFixed(1);
}

/**
 * Compute percentage difference and determine color.
 * @param {number} jsVal - JavaScript measurement
 * @param {number} wasmVal - WASM measurement
 * @param {boolean} lowerIsBetter - True for latency, false for FPS
 * @returns {{ text: string, color: string }}
 */
function formatDiff(jsVal, wasmVal, lowerIsBetter) {
    if (!jsVal || jsVal === 0) return { text: '—', color: '#888' };

    const diff = ((wasmVal - jsVal) / Math.abs(jsVal)) * 100;
    const sign = diff > 0 ? '+' : '';
    const text = sign + diff.toFixed(1) + '%';

    let color;
    if (lowerIsBetter) {
        color = diff < 0 ? '#7ae582' : diff > 0 ? '#ff6b6b' : '#888';
    } else {
        color = diff > 0 ? '#7ae582' : diff < 0 ? '#ff6b6b' : '#888';
    }

    return { text, color };
}
