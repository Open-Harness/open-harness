# Examples Fixture Refactor - Handoff

## Context

We just fixed a schema flow bug (Issue #137) where `output: { schema }` wasn't reaching the provider. The fix is in place:
- `packages/internal/core/src/api/run.ts` - `buildProviderInput()` now extracts schema via `z.toJSONSchema()`

During verification, we ran the examples tests and discovered architectural issues with the example structure.

---

## Problem Statement

### Issue 1: Examples Run Live by Default (Expensive)

Running `bun test` in `examples/speckit/` triggers **live LLM calls** costing ~$0.14 and taking ~10 minutes.

**Current behavior:**
```typescript
// examples/speckit/level-4/speckit.test.ts
const result = await run(specAgent, { prompt: "..." });
// No fixture options → defaults to live mode → calls LLM every time
```

**Expected behavior:**
```typescript
const result = await run(specAgent, { prompt: "..." }, {
  fixture: "spec-agent-test",
  mode: process.env.FIXTURE_MODE || "replay",  // Default to replay
  store: fixtureStore,
});
// Uses recording if available, only calls LLM when FIXTURE_MODE=record
```

### Issue 2: Recording Feature Introduced Too Late

Current example structure:
- Level 1-5: No fixtures, always live
- Level 6-7: Finally introduces fixtures

**User feedback:** Recording/fixtures should be introduced much earlier (Level 2 or 3) because:
1. It's a core feature, not an advanced one
2. Essential for benchmarking and evaluation
3. Makes tests fast and free after first run
4. Demonstrates the primary value prop of the harness

---

## Current Example Structure

```
examples/speckit/
├── level-1/  # Basic agent (no state, no fixtures)
├── level-2/  # Agent with state (no fixtures)
├── level-3/  # Agent with retry logic (no fixtures)
├── level-4/  # Multi-agent harness (no fixtures)
├── level-5/  # Three-agent workflow (no fixtures)
├── level-6/  # Finally introduces fixtures
└── level-7/  # Full system with fixtures
```

**Problem:** Levels 1-5 all run live, costing money on every test run.

---

## Investigation Tasks

1. **Check current fixture infrastructure:**
   - Does `getDefaultMode()` exist and what does it return?
   - Is there a `FIXTURE_MODE` env var check?
   - What's in `packages/internal/core/src/api/defaults.ts`?

2. **Check if fixtures exist for examples:**
   ```bash
   find examples/speckit -name "*.json" -o -name "recordings" -type d
   ```

3. **Understand the run() default behavior:**
   - What happens when no `mode` is passed?
   - Should it default to "replay" and fall back to "live" if no fixture?

---

## Proposed Solutions

### Option A: Change Default Mode Logic

Update `run()` to be smarter about defaults:

```typescript
// In run.ts getFixtureMode()
function getFixtureMode(options?: RunOptions): FixtureMode {
  // Explicit option takes precedence
  if (options?.mode) return options.mode;

  // Env var next
  const envMode = getEnvVar("FIXTURE_MODE");
  if (envMode) return envMode as FixtureMode;

  // If fixture specified but no mode, try replay first
  if (options?.fixture && options?.store) {
    return "replay";  // Will fail gracefully if no recording exists
  }

  return "live";
}
```

### Option B: Restructure Examples (User's Preference)

Move fixture/recording pattern earlier:

```
examples/speckit/
├── level-1/  # Basic agent (simplest possible)
├── level-2/  # Agent WITH FIXTURES (introduce recording early!)
├── level-3/  # Agent with state + fixtures
├── level-4/  # Multi-agent harness + fixtures
├── level-5/  # Full workflow + fixtures
```

This makes recording a "default" pattern, not an "advanced" feature.

### Option C: Add Test Configuration

Create a shared test setup that handles fixtures:

```typescript
// examples/speckit/test-utils.ts
import { FileRecordingStore } from "@open-harness/recording-store-file";

export const fixtureStore = new FileRecordingStore("./fixtures");

export function testRun<T>(target: Agent<T>, input: unknown, fixtureName: string) {
  return run(target, input, {
    fixture: fixtureName,
    mode: (process.env.FIXTURE_MODE as FixtureMode) || "replay",
    store: fixtureStore,
  });
}
```

Then all tests use:
```typescript
const result = await testRun(specAgent, { prompt: "..." }, "spec-agent-prd");
```

---

## Acceptance Criteria

1. Running `bun test` in examples should NOT call LLMs by default
2. Tests should use fixtures/recordings when available
3. `FIXTURE_MODE=record` should create new recordings
4. `FIXTURE_MODE=live` should force live calls
5. Recording pattern should be demonstrated early (Level 2 or 3)
6. Examples should have pre-recorded fixtures checked into git

---

## Files to Investigate

```
packages/internal/core/src/api/run.ts          # getFixtureMode() logic
packages/internal/core/src/api/defaults.ts     # Default mode settings
examples/speckit/level-*/                      # All example tests
examples/speckit/package.json                  # Test scripts
```

---

## Test Commands

```bash
# Current (expensive - calls LLM)
cd examples/speckit && bun test

# Should work (uses fixtures)
cd examples/speckit && FIXTURE_MODE=replay bun test

# Record new fixtures
cd examples/speckit && FIXTURE_MODE=record bun test
```

---

## Related Work

- Schema flow fix completed in `run.ts` (z.toJSONSchema integration)
- Reactive state audit completed in `.claude/handoffs/reactive-state-audit-results.md`
- Examples don't currently use `output: { schema }` - all use string parsing
