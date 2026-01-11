# v0.3.0 DX Audit - Pre-Release Quality Gate

Execute a comprehensive Developer Experience audit across all examples, documentation, and test infrastructure. This is a blocking quality gate before PR/release.

## Scope

| Category | Items |
|----------|-------|
| Examples | `simple-reactive`, `multi-provider`, `recording-replay`, `testing-signals`, `trading-agent`, `speckit` (all levels) |
| Package READMEs | `packages/README.md`, `packages/*/README.md`, `examples/*/README.md` |
| Test Fixtures | `packages/adapters/harnesses/*/tests/fixtures/`, `examples/speckit/fixtures/` |
| Core Features | Workflows, signals, recording/replay, multi-agent, structured output |

---

## Phase 1: Example Verification

**For EVERY example in `examples/`:**

```bash
cd examples/{name}
bun install
bun run build 2>&1  # Must succeed
bun run dev 2>&1    # Or equivalent entry point
```

### Required Checks

1. **Compiles without errors** - `bun run build` exits 0
2. **Runs without crashes** - Main entry point executes
3. **Uses v0.3.0 API** - `createWorkflow`, `ClaudeHarness`, `runReactive`
4. **No deprecated patterns** - No `Provider`, old `createHarness`

### Output Format

```yaml
example: {name}
status: pass|fail|skip
build: pass|fail
runs: pass|fail|untested
api_version: v0.3.0|legacy|mixed
issues:
  - "{description}"
```

---

## Phase 2: README Code Verification

**Every code block in every README must compile.**

### Files to Audit

- `packages/README.md`
- `packages/open-harness/*/README.md`
- `packages/internal/*/README.md`
- `packages/adapters/harnesses/*/README.md`
- `examples/*/README.md`

### Verification Process

1. Extract all TypeScript/JavaScript code blocks
2. Create temp file with necessary imports
3. Run `bun x tsc --noEmit` or execute
4. Report any compilation errors

### Check For

- [ ] Imports exist in actual packages
- [ ] API signatures match implementation
- [ ] No references to removed/renamed exports
- [ ] Signal names use `harness:*` not `provider:*`

---

## Phase 3: Recording Infrastructure Audit

### Fixture Freshness

```bash
# List all fixtures with modification times
find . -name "*.fixture.json" -o -name "recording-*.json" | xargs ls -la
```

### Required Analysis

1. **Last recording date** - When were fixtures last updated?
2. **Coverage** - Does every example have recordings?
3. **Schema compatibility** - Do fixtures match current Signal schema?

### Fixture Locations

| Location | Purpose |
|----------|---------|
| `packages/adapters/harnesses/claude/tests/fixtures/` | Claude SDK recordings |
| `packages/adapters/harnesses/openai/tests/fixtures/` | OpenAI SDK recordings |
| `examples/speckit/fixtures/` | Speckit level recordings |
| `packages/open-harness/core/tests/fixtures/` | Core API recordings |

### Verify Recording Replay

```bash
# Each fixture should replay without network
LIVE_SDK=0 bun test --grep "replay"
```

---

## Phase 4: Feature Coverage Matrix

### Killer Features Checklist

| Feature | Documented | Example | Test | Recording |
|---------|------------|---------|------|-----------|
| `createWorkflow()` | | | | |
| `agent()` with `activateOn` | | | | |
| `runReactive()` | | | | |
| Signal chaining | | | | |
| State updates | | | | |
| Multi-agent workflows | | | | |
| Recording mode | | | | |
| Replay mode | | | | |
| `ClaudeHarness` | | | | |
| `CodexHarness` | | | | |
| Structured output | | | | |
| Tool use signals | | | | |
| Error handling | | | | |
| Abort/cancellation | | | | |

### Fill Matrix

For each feature:
- **Documented**: Link to README section
- **Example**: Link to example file
- **Test**: Link to test file
- **Recording**: Link to fixture file

---

## Phase 5: Signal Naming Audit

### Required Signal Names (v0.3.0)

```typescript
// Workflow signals
"workflow:start"
"workflow:end"

// Harness signals (NOT provider:*)
"harness:start"
"harness:end"
"harness:error"

// Agent signals
"agent:activated"
"agent:complete"

// Content signals
"text:delta"
"text:complete"
"thinking:delta"
"thinking:complete"
"tool:call"
"tool:result"
```

### Grep for Legacy Names

```bash
# These should return ZERO results
grep -r "provider:start" packages/ examples/
grep -r "provider:end" packages/ examples/
grep -r "provider:error" packages/ examples/
```

---

## Phase 6: API Surface Audit

### Verify Public Exports

```typescript
// @open-harness/core must export:
import {
  createWorkflow,
  ClaudeHarness,
  CodexHarness,
  MemorySignalStore,
  runReactive,
  // ... check all exports compile
} from "@open-harness/core";
```

### Check for Accidental Exports

- No `@internal/*` types in public surface
- No test utilities in production exports

---

## Output: DX Audit Report

```yaml
audit_date: "{ISO-8601}"
version: "v0.3.0"

summary:
  examples_passing: X/6
  readmes_valid: X/Y
  fixtures_current: true|false
  feature_coverage: X%
  signal_naming: pass|fail

examples:
  - name: "simple-reactive"
    status: pass
  # ... all examples

readme_issues:
  - file: "path/to/README.md"
    line: N
    issue: "Code block fails to compile"

fixture_status:
  last_updated: "{date}"
  missing_recordings: []
  stale_recordings: []

blocking_issues: []
warnings: []
recommendations: []
```

---

## Success Criteria

**MUST pass before PR:**

- [ ] All 6 examples build and run
- [ ] All README code blocks compile
- [ ] Zero `provider:*` signal references
- [ ] All harness fixtures < 30 days old OR manually verified
- [ ] Feature matrix > 80% coverage

**SHOULD fix:**

- [ ] All examples have recordings
- [ ] API docs match implementation
- [ ] No console warnings during example runs

---

## Execution

Launch parallel agents:

1. **Example Runner** - Build/run each example
2. **README Validator** - Extract and compile code blocks
3. **Fixture Auditor** - Check recording dates and coverage
4. **Signal Grep** - Search for legacy naming
5. **Export Checker** - Verify public API surface

Collect results and produce final audit report.
