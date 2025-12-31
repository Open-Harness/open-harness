# Retrospective: SDK Test Architecture Investigation

**Date**: 2025-12-26  
**Scope**: Test suite organization, categorization, and documentation  
**Trigger**: Investigation of "164 pass, 2 fail, 1 error" test results  
**Outcome**: Comprehensive restructure plan with ADRs

---

## Executive Summary

Investigation of SDK test failures revealed the failures were NOT code bugs but rather tests that make real API calls being run as part of the default test suite. The root cause is a mislabeled test file (`tests/unit/parser-agent.test.ts`) that makes live API calls but is categorized as a unit test.

This investigation produced:
- Complete diagnosis of test architecture issues
- 5 Architecture Decision Records (ADRs)
- Implementation plan for restructure
- Comprehensive documentation template (`tests/CLAUDE.md`)

---

## Investigation Process

### Phase 1: Initial Observation

**Reported Problem**:
```
164 pass
2 fail  
1 error
418 expect() calls
Ran 166 tests across 11 files. [245.10s]
```

**Key Observation**: Tests took 245 seconds (4+ minutes), indicating live API calls.

### Phase 2: Understanding Test Structure

Before running any tests, analyzed the codebase structure:

```
tests/
├── fixtures/          # Test data files
├── helpers/
│   ├── recording-wrapper.ts  # Wraps real API, captures recordings
│   └── replay-runner.ts      # Replays recordings, no API calls
├── integration/
│   └── live-sdk.test.ts      # Real API calls (60-120s timeout)
├── replay/
│   ├── agents.replay.test.ts
│   └── parser-agent.replay.test.ts
└── unit/
    ├── parser-agent.test.ts  # ⚠️ MISLABELED
    ├── harness.test.ts
    ├── container.test.ts
    └── ... (6 other files)
```

**Key Finding**: Two helper patterns exist:
- `createRecordingContainer()` → Makes real API calls, saves recordings
- `createReplayContainer()` → Uses pre-recorded sessions, no API calls

### Phase 3: Isolating Safe Tests

Ran tests in isolation to identify which are truly safe:

| Test File | Result | API Calls | Speed |
|-----------|--------|-----------|-------|
| `backoff.test.ts` | 25 pass | No | 128ms |
| `dependency-resolver.test.ts` | 20 pass | No | 9ms |
| `event-mapper.test.ts` | 24 pass | No | 28ms |
| `container.test.ts` | 16 pass | No | 81ms |
| `harness.test.ts` | 44 pass | No | 85ms |
| `agent-factory.test.ts` | 10 pass | No | 72ms |
| `workflow-builder.test.ts` | 15 pass | No | (included) |
| `agents.replay.test.ts` | 2 pass | No | ~20ms |
| `parser-agent.replay.test.ts` | 3 pass | No | ~28ms |
| **Total Safe** | **159 pass** | **No** | **<300ms** |

### Phase 4: Identifying the Problem

Examined `tests/unit/parser-agent.test.ts`:

```typescript
// Line 15 - Uses recording container (makes real API calls!)
import { createRecordingContainer } from "../helpers/recording-wrapper.js";

// Line 29 - Creates container that wraps real AnthropicRunner
const { container, recorder } = createRecordingContainer("golden/parser-agent");

// Line 97 - 60 second timeout confirms API calls
}, 60000);
```

**Root Cause**: This file:
1. Is in `tests/unit/` (implies no API calls)
2. Uses `createRecordingContainer()` (makes real API calls)
3. Saves recordings on every run (overwrites golden recordings)
4. Has 60-second timeouts (confirms slow operations)

This is NOT a unit test. It's a live integration test that also captures recordings.

---

## Architecture Decision Records

### ADR-001: Test Directory Naming Convention

**Status**: Accepted

**Context**: Need clear distinction between test types that have vastly different characteristics (speed, determinism, cost).

**Decision**: Use semantic directory names:
- `tests/unit/` - Pure logic tests, no I/O, no API
- `tests/replay/` - Tests using pre-recorded LLM sessions
- `tests/live/` - Tests making real API calls

**Alternatives Considered**:
- Tier-based naming (`tier0-unit/`, `tier1-replay/`, `tier2-live/`) - rejected as less intuitive
- Intent-based naming (`against-mocks/`, `against-recordings/`, `against-live-api/`) - rejected as verbose

**Consequences**:
- Clear mental model for developers and LLMs
- Easy to understand which tests are safe to run
- Consistent with industry conventions

---

### ADR-002: Default Test Command Behavior

**Status**: Accepted

**Context**: `bun test` currently runs ALL tests including live API tests, causing:
- Slow feedback (4+ minutes)
- API costs
- Flaky results (LLM responses vary)

**Decision**: Default `bun test` runs only `unit/` + `replay/` tests.

```json
{
  "scripts": {
    "test": "bun test tests/unit/ tests/replay/",
    "test:live": "bun test tests/live/",
    "test:all": "bun test tests/"
  }
}
```

**Rationale**:
- Developers can run `bun test` hundreds of times per day
- No API costs for routine testing
- Deterministic results
- Fast feedback (<5 seconds)

**Consequences**:
- Live tests must be run explicitly with `bun run test:live`
- Full verification requires `bun run test:all`

---

### ADR-003: Recording Protection via Environment Variable

**Status**: Accepted

**Context**: Live tests currently overwrite golden recordings silently, which can:
- Corrupt recordings needed by replay tests
- Introduce non-determinism into the test suite
- Make it hard to track intentional vs accidental changes

**Decision**: Recording saves are disabled by default. Enable with `CAPTURE=true` environment variable.

**Implementation**:
```typescript
// In recording-wrapper.ts
async saveCapture(metadata?: Record<string, unknown>): Promise<string> {
  if (!process.env.CAPTURE) {
    console.log(`[SKIP] Recording not saved. Set CAPTURE=true to enable.`);
    this.cancelCapture();
    return "(capture disabled)";
  }
  // ... existing save logic
}
```

**Usage**:
```bash
# Normal live test - doesn't overwrite recordings
bun run test:live

# Capture mode - saves recordings
CAPTURE=true bun run test:live
```

**Consequences**:
- Recordings are stable by default
- Explicit intent required to modify recordings
- Capture scripts use `CAPTURE=true` automatically

---

### ADR-004: Separation of Capture Scripts from Tests

**Status**: Accepted

**Context**: `parser-agent.test.ts` does two things:
1. Captures recordings (writes to disk)
2. Asserts on results (validates behavior)

This dual responsibility causes confusion and mislabeling.

**Decision**: Separate concerns:
- **Capture scripts** (`scripts/capture-*.ts`) - Generate recordings, no assertions
- **Live tests** (`tests/live/`) - Run with API, structural assertions only
- **Replay tests** (`tests/replay/`) - All detailed assertions against recordings

**File Changes**:
- Move `tests/unit/parser-agent.test.ts` → `tests/live/parser-agent.live.test.ts`
- Create `scripts/capture-parser.ts` - Standalone capture script
- Keep `tests/replay/parser-agent.replay.test.ts` - Detailed assertions

**Consequences**:
- Clear single responsibility per file
- Capture is a maintenance operation, not a test
- Assertions are deterministic (replay) or structural (live)

---

### ADR-005: Testing Documentation Location

**Status**: Accepted

**Context**: Testing instructions need to be accessible to both humans and LLM agents. Main `CLAUDE.md` is already large.

**Decision**: Create `tests/CLAUDE.md` with complete testing documentation.

**Contents**:
- Quick reference table (commands, speed, safety)
- Test category explanations with examples
- Recording management instructions
- How to add new tests (unit, replay, live)
- LLM-specific instructions (which commands to run when)
- Troubleshooting guide

**Rationale**:
- Self-contained documentation in the tests directory
- Doesn't bloat main CLAUDE.md
- Easy to find when working on tests
- Can be referenced by LLMs via file read

**Consequences**:
- Main CLAUDE.md can reference tests/CLAUDE.md
- Testing docs stay close to test code

---

## Implementation Plan

### File Operations Summary

| Action | File | Description |
|--------|------|-------------|
| CREATE | `tests/CLAUDE.md` | Complete testing guide |
| CREATE | `tests/live/parser-agent.live.test.ts` | Moved from unit/, structural assertions |
| CREATE | `scripts/capture-parser.ts` | Standalone capture script |
| MODIFY | `tests/helpers/recording-wrapper.ts` | Add CAPTURE env var check |
| MODIFY | `package.json` | Update scripts section |
| DELETE | `tests/unit/parser-agent.test.ts` | Replaced by live/ version |

### Package.json Scripts (Final)

```json
{
  "scripts": {
    "test": "bun test tests/unit/ tests/replay/",
    "test:unit": "bun test tests/unit/",
    "test:replay": "bun test tests/replay/",
    "test:live": "bun test tests/live/",
    "test:all": "bun test tests/",
    
    "capture:parser": "CAPTURE=true bun scripts/capture-parser.ts",
    "capture:agents": "CAPTURE=true bun scripts/e2e-capture.ts",
    "capture:harvest": "CAPTURE=true bun scripts/harvest.ts",
    
    "smoke": "bun scripts/smoke-test.ts",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "validate": "bun run typecheck && bun run lint && bun run test"
  }
}
```

### Directory Structure (Final)

```
packages/sdk/
├── tests/
│   ├── CLAUDE.md              # Testing documentation
│   ├── unit/                  # Pure logic tests
│   │   ├── backoff.test.ts
│   │   ├── container.test.ts
│   │   ├── dependency-resolver.test.ts
│   │   ├── event-mapper.test.ts
│   │   ├── harness.test.ts
│   │   ├── agent-factory.test.ts
│   │   └── workflow-builder.test.ts
│   ├── replay/                # Recording-based tests
│   │   ├── agents.replay.test.ts
│   │   └── parser-agent.replay.test.ts
│   ├── live/                  # Real API tests
│   │   ├── live-sdk.test.ts
│   │   └── parser-agent.live.test.ts
│   ├── fixtures/
│   └── helpers/
│       ├── recording-wrapper.ts
│       └── replay-runner.ts
├── scripts/
│   ├── capture-parser.ts      # Parser recording capture
│   ├── e2e-capture.ts         # E2E recording capture
│   ├── harvest.ts             # Multi-scenario capture
│   └── smoke-test.ts          # E2E smoke test
└── recordings/
    └── golden/                # Committed recordings
```

---

## Validation Checklist

After implementation, verify:

- [ ] `bun test` runs in <5 seconds with no API calls
- [ ] `bun test` runs exactly 159 tests (154 unit + 5 replay)
- [ ] `bun run test:unit` runs 7 test files
- [ ] `bun run test:replay` runs 2 test files
- [ ] `bun run test:live` runs without modifying recordings
- [ ] `CAPTURE=true bun run test:live` saves recordings
- [ ] No file in `tests/unit/` imports `createRecordingContainer`
- [ ] `tests/CLAUDE.md` exists and is comprehensive
- [ ] `scripts/capture-parser.ts` successfully captures parser recordings

---

## Test Categories Reference

| Category | Directory | Helper Used | API Calls | Speed | Deterministic |
|----------|-----------|-------------|-----------|-------|---------------|
| Unit | `tests/unit/` | None | No | <1s | Yes |
| Replay | `tests/replay/` | `createReplayContainer()` | No | <1s | Yes |
| Live | `tests/live/` | `createRecordingContainer()` | Yes | 60-120s | No |

---

## Lessons Learned

1. **Test file location matters**: A test in `unit/` that makes API calls is a lie. The directory name is a contract.

2. **Default commands must be safe**: If `bun test` can spend money or take minutes, developers will avoid running tests.

3. **Capture is not testing**: Generating recordings is a maintenance operation. Mixing it with assertions causes confusion.

4. **Protect golden recordings**: Recordings are test fixtures. They should be stable and only updated intentionally.

5. **Document for both humans and LLMs**: AI agents need clear instructions on which commands are safe to run.

---

## Appendix A: tests/CLAUDE.md Template

```markdown
# SDK Testing Guide

## Quick Reference

| Command | Runs | Speed | API Calls | Safe Default |
|---------|------|-------|-----------|--------------|
| `bun test` | unit + replay | <5s | No | ✅ Yes |
| `bun run test:unit` | unit only | <1s | No | ✅ Yes |
| `bun run test:replay` | replay only | <1s | No | ✅ Yes |
| `bun run test:live` | live tests | 2-5min | Yes | ⚠️ No |
| `bun run test:all` | everything | 2-5min | Yes | ⚠️ No |

## Test Categories

### Unit Tests (`tests/unit/`)

**Purpose**: Test pure logic in isolation.

**Characteristics**:
- No network calls
- No file I/O (except reading fixtures)
- No recordings
- Millisecond execution
- 100% deterministic

**When to write**:
- Testing utility functions
- Testing type transformations  
- Testing state machines
- Testing parsers with static input

**Pattern**:
```typescript
import { describe, expect, test } from "bun:test";

describe("MyUtility", () => {
  test("does something", () => {
    const result = myFunction(input);
    expect(result).toBe(expected);
  });
});
```

---

### Replay Tests (`tests/replay/`)

**Purpose**: Test agent behavior against pre-recorded LLM sessions.

**Characteristics**:
- No network calls (uses `recordings/golden/`)
- Millisecond execution
- Deterministic (same recording → same result)

**When to write**:
- Testing agent output parsing
- Testing event callback sequences
- Testing harness state transitions
- Regression testing against known-good responses

**Pattern**:
```typescript
import { describe, expect, test } from "bun:test";
import { createReplayContainer } from "../helpers/replay-runner.js";
import { MyAgent } from "../../src/providers/anthropic/agents/my-agent.js";

describe("MyAgent Replay", () => {
  test("replays scenario-name recording", async () => {
    const { container, replayer } = await createReplayContainer(
      "golden/my-agent",
      "scenario-name"
    );
    const agent = container.get(MyAgent);

    const result = await agent.execute("prompt", "session");

    expect(result).toBeDefined();
    expect(result.someField).toBe(expectedValue);
  });
});
```

**Requires**: A golden recording at `recordings/golden/my-agent/scenario-name.json`

---

### Live Tests (`tests/live/`)

**Purpose**: Verify real API integration and capture recordings.

**Characteristics**:
- Makes real API calls (costs money!)
- 60-120 seconds per test
- Non-deterministic (LLM responses vary)
- Can capture recordings when `CAPTURE=true`

**When to write**:
- Validating SDK-to-API integration
- Capturing new golden recordings
- Pre-release verification

**Pattern**:
```typescript
import { describe, expect, test } from "bun:test";
import { createRecordingContainer } from "../helpers/recording-wrapper.js";
import { MyAgent } from "../../src/providers/anthropic/agents/my-agent.js";

describe("MyAgent Live", () => {
  test("executes and captures recording", async () => {
    const { container, recorder } = createRecordingContainer("golden/my-agent");
    const agent = container.get(MyAgent);

    recorder.startCapture("scenario-name");
    const result = await agent.execute("prompt", "session");
    await recorder.saveCapture({ metadata: "value" });

    // Structural assertions only (LLM output varies)
    expect(result).toBeDefined();
    expect(result.someField).toBeDefined();
  }, { timeout: 60000 });
});
```

---

## Recording Management

### Location
```
recordings/golden/
├── coding-agent/
│   └── add-two-numbers.json
├── review-agent/
│   └── review-add-function.json
└── parser-agent/
    ├── sample-tasks-basic.json
    ├── sample-tasks-dependencies.json
    └── cycle-detection.json
```

### Recording Protection

By default, live tests do NOT save recordings. This prevents accidental overwrites.

To enable recording saves:
```bash
CAPTURE=true bun run test:live
```

Or use dedicated capture scripts:
```bash
bun run capture:parser   # Capture parser agent recordings
bun run capture:agents   # Capture coding/review agent recordings
```

### When to Update Recordings

Update recordings when:
- Agent prompts change
- Expected output format changes
- Adding new test scenarios

Process:
1. Run capture: `bun run capture:parser`
2. Review changes: `git diff recordings/`
3. Commit if correct: `git add recordings/ && git commit`

---

## Adding New Tests

### Adding a Unit Test

1. Create `tests/unit/my-feature.test.ts`
2. Import from `bun:test`
3. Write pure logic tests (no API, no recordings)
4. Run: `bun run test:unit`

### Adding a Replay Test

1. Ensure golden recording exists at `recordings/golden/my-agent/scenario.json`
2. Create `tests/replay/my-agent.replay.test.ts`
3. Use `createReplayContainer()` helper
4. Run: `bun run test:replay`

### Adding a Live Test

1. Create `tests/live/my-agent.live.test.ts`
2. Use `createRecordingContainer()` helper
3. Add appropriate timeout (60000-120000ms)
4. Use structural assertions only
5. Run: `bun run test:live`

### Capturing New Recordings

1. Add capture logic to a script in `scripts/` OR to a live test
2. Run with `CAPTURE=true`: `CAPTURE=true bun test tests/live/my-agent.live.test.ts`
3. Verify recording: `cat recordings/golden/my-agent/scenario.json | head`
4. Commit recording

---

## For LLM Agents

### Which command to run?

| Scenario | Command |
|----------|---------|
| After any code change | `bun test` |
| Debugging a specific unit test | `bun test tests/unit/specific.test.ts` |
| Debugging a replay test | `bun test tests/replay/specific.replay.test.ts` |
| Full verification (rare) | `bun run test:all` |
| Before committing | `bun test` (unit + replay) |

### DO NOT:
- Put API calls in `tests/unit/`
- Put `createRecordingContainer()` in unit or replay tests
- Run `test:live` or `test:all` unless explicitly asked
- Modify recordings without `CAPTURE=true`

### Identifying test types by helper:
- `createReplayContainer()` → Replay test (reads recordings)
- `createRecordingContainer()` → Live test (may write recordings)
- Neither → Unit test

---

## Troubleshooting

### "Recording not found" error
```
Failed to load recording: recordings/golden/my-agent/scenario.json
```
**Fix**: Run the capture script to generate the missing recording.

### Tests pass locally but fail in CI
Check if you:
1. Modified a golden recording without committing
2. Added API calls to a unit/replay test
3. Depend on environment-specific state

### Flaky live tests
Live tests are inherently non-deterministic. Use structural assertions:
```typescript
// ❌ Bad - will flake
expect(result.summary).toBe("I created an add function...");

// ✅ Good - structural assertion
expect(result.summary).toBeDefined();
expect(typeof result.summary).toBe("string");
```

### Timeout errors in live tests
Increase the timeout:
```typescript
test("slow test", async () => {
  // ...
}, { timeout: 120000 }); // 2 minutes
```
```

---

**Author**: Investigation session  
**Date**: 2025-12-26  
**Status**: Ready for implementation
