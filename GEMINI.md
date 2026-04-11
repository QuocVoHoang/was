---
name: wasm-benchmark
description: JS vs WASM Motion Detection Benchmark project rules
---

# Project: JS vs WASM Motion Detection Benchmark

In this project, please don't use global rules. Use only the project-specific rules and skills defined in `.agents/`.

## Rules (always-on)
- `.agents/rules/project-overview.md` — Project context, file structure, tech stack
- `.agents/rules/coding-standards.md` — Vanilla JS conventions, naming, performance-first coding
- `.agents/rules/performance-constraints.md` — Benchmark fairness, metrics, video requirements
- `.agents/rules/wasm-build.md` — Emscripten flags, exported functions, build process

## Skills (on-demand)
- `.agents/skills/emscripten-build.md` — Emscripten compilation, optimization levels, debugging
- `.agents/skills/browser-performance-api.md` — FPS, latency, memory, CPU estimation APIs
- `.agents/skills/wasm-memory-management.md` — malloc/free patterns, memory growth, leak prevention