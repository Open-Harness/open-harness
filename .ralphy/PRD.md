# PRD: Golden Recording Capture

> Complete the Definition of Done by capturing a REAL Claude API recording and creating deterministic replay tests.

---

## Problem Statement

The Handler pattern + CLI implementation (feat/handler-pattern-dx-cli) built all the infrastructure but **failed to meet the Definition of Done**:

- AC5 (Recording Works): NOT MET - no real recording captured
- AC6 (Replay Deterministic): NOT MET - no recording to replay

**Root cause:** The task list contained rationalization language that permitted mock harnesses. All 41 tests pass but prove nothing about real SDK behavior.

**What exists:**
- CLI with `prd:live`, `prd:record`, `prd:replay` modes
- SqliteSignalStore for persistent recordings
- Handler pattern fully implemented
- Example PRD at `examples/hello-world.prd.md`

**What's missing:**
- A real recording captured from Claude API
- Golden recording committed to fixtures
- Tests that replay the real recording

---

## Goal

**Single sentence:** Record a real PRD workflow run, replay it anytime to re-watch the exact same execution without network calls.

**The Value of Recording/Replay:**
- **Record once** - Run live against Claude API, capture all signals and renderer output
- **Replay forever** - Re-watch the exact same execution, same renderer output, zero API calls
- **Deterministic demos** - Show others exactly what happened without rate limits or API costs
- **CI fixtures** - Use recordings as deterministic test inputs

**Success criteria:**
```bash
# 1. Record (calls REAL Claude API, shows live renderers)
bun run prd:record examples/hello-world.prd.md
# Output: Real-time rendering of workflow execution
# Saves: rec_XXXXXXXX to database

# 2. Replay (ZERO network calls, SAME renderer output)
bun run prd:replay --recording rec_XXXXXXXX
# Output: Identical renderer output as the original run
# Network: Zero API calls
```

---

## Scope

### In Scope

1. **Run real recording** - Execute `prd:record` against Claude API
2. **Commit golden recording** - Save recording to `packages/prd-workflow/tests/fixtures/golden/`
3. **Create replay test** - Test that loads golden recording and verifies deterministic replay
4. **Remove mock-only tests** - Delete tests that only use mock harnesses (they prove nothing)
5. **Document the workflow** - Update README with recording/replay instructions

### Out of Scope

- Multiple PRD examples (one golden recording is sufficient)
- Complex PRDs with task dependencies
- Performance optimization
- GitHub integration

---

## Tasks

### Task 1: Verify CLI works end-to-end

**Description:** Run the CLI in live mode to verify it can call Claude API and execute a workflow.

**Acceptance:**
- `bun run prd:live examples/hello-world.prd.md` completes without error
- Claude API is actually called (check network activity or logs)
- Generated code appears in `.sandbox/`

**Verification command:**
```bash
cd packages/prd-workflow && bun run prd:live ../../examples/hello-world.prd.md
```

---

### Task 2: Capture golden recording

**Description:** Run `prd:record` to capture a real Claude API recording and save it persistently.

**Acceptance:**
- Recording ID returned (format: `rec_XXXXXXXX`)
- Recording saved to SQLite database
- Recording contains actual Claude responses (not mocks)

**Verification commands:**
```bash
cd packages/prd-workflow
bun run prd:record ../../examples/hello-world.prd.md --name "hello-world-golden" --tags "golden,ci"
# Note the recording ID
```

---

### Task 3: Verify recording persistence

**Description:** Verify the recording persists in SQLite and can be listed/queried.

**Acceptance:**
- Recording persists in `.sandbox/recordings.db` (or configured database path)
- Recording can be queried by ID, name, or tags
- Recording survives process restarts

**Verification commands:**
```bash
cd packages/prd-workflow
# List all recordings
bun run src/cli.ts list-recordings
# Or query the SQLite database directly
sqlite3 ../../.sandbox/recordings.db "SELECT id, name, signal_count FROM recordings"
```

**Note:** Recordings stay in SQLite. For CI, recordings can be committed as SQLite snapshots or exported to JSON if needed - but the primary use case is local replay.

---

### Task 4: Verify replay shows identical renderer output

**Description:** Run replay and verify it produces the same visual output as the original recording - without making API calls.

**Acceptance:**
- `prd:replay --recording rec_XXXXXXXX` runs successfully
- Renderer output matches the original recording (same progress, same state changes)
- ZERO Claude API calls during replay (inject signals from recording)
- Replay is fast (signals replayed at realistic pace or faster)

**Verification commands:**
```bash
cd packages/prd-workflow
# Run replay - should show same renderer output as original
bun run prd:replay --recording rec_XXXXXXXX
# Visually verify: same steps, same output, no "calling Claude" indicators
```

---

### Task 5: Replace all fabricated mocks with real fixture factory

**Description:** Remove ALL hand-written mock harnesses. All test fixtures MUST come from a factory that uses REAL recorded data.

**The Rule:**
- NO `createSimpleMockHarness()` with hand-written fake responses
- NO `createDeterministicMockHarness()` with fabricated payloads
- ALL fixtures loaded from real recordings via factory

**Pattern:**
```typescript
// ❌ WRONG - fabricated data
const harness = createMockHarness({ fakeResponse: "made up" });

// ✅ RIGHT - factory loads real recorded fixture
const harness = loadFixtureHarness("hello-world-golden");
```

**Acceptance:**
- Delete `createSimpleMockHarness` and `createDeterministicMockHarness`
- Create `loadFixtureHarness(recordingName)` factory
- Factory loads from real recordings captured via `prd:record`
- All tests updated to use factory

**Verification commands:**
```bash
# Must return ZERO matches
grep -r "createSimpleMockHarness\|createDeterministicMockHarness" packages/prd-workflow/

# Factory must exist
grep -r "loadFixtureHarness" packages/prd-workflow/src/
```

---

### Task 6: Final verification against DOD

**Description:** Run the full Definition of Done verification.

**Acceptance (from DEFINITION_OF_DONE.md):**
- [ ] `bun run prd:live` works
- [ ] `bun run prd:record` saves to SQLite
- [ ] `bun run prd:replay` replays without network
- [ ] Replay output matches live output
- [ ] Handlers pattern used (no reducers/processes split)
- [ ] No type casts in handler code
- [ ] Generated code in gitignored sandbox
- [ ] Recordings committed as fixtures

**Verification commands:**
```bash
bun run typecheck
bun run lint
bun run test
# All must pass with ZERO errors/warnings
```

---

## Milestones

### Milestone 1: Recording Captured

**Tasks:** 1, 2
**Test:** Recording exists in SQLite with real Claude signals

### Milestone 2: Golden Recording Committed

**Tasks:** 3, 4
**Test:** `bun test golden-replay.test.ts` passes

### Milestone 3: Definition of Done Met

**Tasks:** 5, 6
**Test:** All DOD criteria checked and passing

---

## Non-Goals (CRITICAL)

**DO NOT:**
- Create mock harnesses or fake signals
- Use "for now", "temporarily", or other rationalization language
- Skip running against real Claude API
- Mark tasks complete without running verification commands
- Fabricate fixtures or test data

**From CLAUDE.md:**
> "All test fixtures MUST be recorded from REAL SDK interactions"
> "Never manually create fixtures with made-up data"

---

## Definition of Done

This PRD is complete when:

1. Golden recording captured from REAL Claude API call
2. `prd:replay` shows identical renderer output to original run
3. **ZERO fabricated mocks** - all fixtures from factory using real recordings
4. All quality gates pass (typecheck, lint, test)
5. `grep -r "createSimpleMockHarness\|createDeterministicMockHarness"` returns ZERO matches
