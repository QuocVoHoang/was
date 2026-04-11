---
trigger: always_on
description: Coding standards for the WASM benchmark project
---

# Coding Standards

## General Rules

- **NO frameworks**: No React, Vue, Vite, Webpack, Tailwind. This is a vanilla HTML/CSS/JS project.
- **NO npm/node_modules**: No package.json. All JS is loaded via `<script>` tags.
- **ES6+ syntax**: Use `const`/`let`, arrow functions, template literals, async/await.
- **Strict separation**: Each file has ONE responsibility (see project-overview rule).

## JavaScript

### Naming
- Variables/functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- DOM element references: prefix with element type hint (e.g., `btnRunJS`, `fpsCounter`, `outputCanvas`)

### File Size
- Target: **200–400 lines** per file
- Maximum: **800 lines** per file
- If a file exceeds 400 lines, consider extracting utilities

### Performance-Critical Code
- Avoid object allocation inside hot loops (`processVideo`, `processMotionJS`)
- Use `TypedArrays` (`Uint8ClampedArray`, `Float32Array`) for pixel data, never plain arrays
- Prefer `for` loops over `.forEach`/`.map` in performance-critical paths
- Cache DOM queries outside loops (already done with top-level `const` refs)

### Error Handling
- Always validate video/WASM state before processing
- Show user-friendly Vietnamese messages via `alert()` or status elements
- Never silently swallow errors

## C++ (WASM Source)

### Naming
- Functions: `camelCase` (must match JS bridge expectations)
- Variables: `snake_case`
- All exported functions must use `EMSCRIPTEN_KEEPALIVE`

### Memory
- Use `std::vector` for dynamic buffers (auto cleanup)
- Always pair `_malloc` with `_free` on the JS side
- Reuse buffers across frames via `ensure_buffers()` pattern

## CSS

- Inline styles in `index.html` `<style>` block (project is small enough)
- Dark theme: background `#222`, text `#fff`, accent colors for status
- All interactive elements must have unique IDs
