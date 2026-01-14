---
"@open-harness/core": minor
---

Redesign signal console logging levels from `info/debug/trace` to `quiet/normal/verbose`

**New Levels:**
- `quiet`: Minimal output - only `workflow:start`, `workflow:end`, and errors (for CI/CD)
- `normal`: All signals with truncated content (default for development)
- `verbose`: Full content including streaming deltas (for debugging)

**Key Changes:**
- Smart truncation at normal level (60 chars for tool inputs, 80 chars for results)
- Line count hints for multiline content: `"First line..." (6 lines)`
- Full content with indentation at verbose level
- Backward compatible: old level names (`info/debug/trace`) still work

**Migration:**
- `info` → `normal` (automatically mapped)
- `debug` → `verbose` (automatically mapped)
- `trace` → `verbose` (automatically mapped)
