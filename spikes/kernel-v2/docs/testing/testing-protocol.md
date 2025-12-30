# Testing Protocol

This document defines the **testing infrastructure protocol** for the kernel + flow system. It parallels the kernel and flow protocol specifications in scope and importance.

## Purpose

The testing protocol defines:
- **Test categories**: unit, replay, live
- **Fixture format**: JSONL structure, golden vs scratch directories
- **Recording protocol**: explicit opt-in, scratch → golden promotion
- **Test spec format**: Bullock-style requirement documentation
- **Validation requirements**: static, behavioral, completeness

## Test Categories

### Unit Tests (`tests/unit/`)

**Purpose**: Test pure logic without external dependencies.

**Characteristics**:
- No network calls
- No fixtures
- No file I/O (except temp files)
- Fast execution (<100ms per test)
- Pure functions, data structures, algorithms

**Example**: Testing filter matching logic, context merging, type guards.

### Replay Tests (`tests/replay/`)

**Purpose**: Fast, deterministic tests using recorded fixtures.

**Characteristics**:
- Uses fixtures from `fixtures/golden/`
- No network calls (validated)
- No file writes (validated)
- Fast execution (<1s total)
- Deterministic (same fixture = same result)

**Example**: Testing Hub subscription with recorded event sequences.

### Live Tests (`scripts/live/`)

**Purpose**: Authoritative verification with real SDK.

**Characteristics**:
- Uses real SDK (no mocks)
- May make network calls
- Proves production behavior
- Run before marking feature complete
- Timeout: 30s (or component-specific)

**Example**: Running all replay scenarios against real Hub implementation.

## Fixture Format

### Directory Structure

```
fixtures/
├── golden/           # Committed to repo, used in CI
│   └── <component>/
│       └── <fixture-name>.jsonl
└── scratch/          # Gitignored, local experiments
    └── <component>/
        └── <fixture-name>.jsonl
```

### JSONL Format

Each fixture file contains one or more scenarios (one JSON object per line):

```json
{
  "sessionId": "record-1234567890",
  "scenario": "subscribe-basic",
  "events": [
    {
      "event": { "type": "harness:start", "name": "test" },
      "contextOverride": null
    }
  ],
  "metadata": {
    "recordedAt": "2025-12-28T10:00:00Z",
    "component": "hub",
    "description": "Basic subscription scenario"
  }
}
```

**Fields**:
- `sessionId`: Unique session identifier
- `scenario`: Scenario name (matches fixture filename)
- `events`: Array of event data (event payload + optional context override)
- `metadata`: Recording metadata (optional but recommended)

### Golden vs Scratch

- **Golden fixtures** (`fixtures/golden/`): Committed to repo, used in CI, stable
- **Scratch fixtures** (`fixtures/scratch/`): Gitignored, local experiments, temporary

**Promotion workflow**: Record → scratch → review → promote to golden → commit

## Recording Protocol

### Explicit Opt-In

Recording is **always explicit** via script:

```bash
bun scripts/record-fixture.ts <component> <fixture-name>
```

**Rules**:
- Never auto-record during test runs
- Always write to `scratch/` first
- Manual promotion to `golden/` after review
- Validation scripts check `golden/` fixtures are unchanged

### Recording Script Behavior

1. Creates fixture directory if needed
2. Runs the scenario (component-specific)
3. Captures events/state
4. Writes to `fixtures/scratch/<component>/<fixture-name>.jsonl`
5. Prints confirmation message

### Promotion Workflow

1. Review `fixtures/scratch/<component>/<fixture-name>.jsonl`
2. Verify fixture matches scenario
3. Move to `fixtures/golden/<component>/`
4. Commit with descriptive message

## Test Spec Format

Test specs use **Bullock-style requirement documentation**:

- **Component header**: Component path, status, last updated
- **Overview**: Brief description
- **Test Requirements**: R1, R2, R3, ... (each with fixture, test file, scenario, assertions)
- **Live Test**: Authoritative test script reference
- **Coverage Checklist**: Track completion

See [Test Spec Template](test-spec-template.md) for exact format.

## Validation Requirements

### Multi-Layer Validation

1. **Static Validation** (Structure)
   - Test spec exists and follows template
   - All fixtures referenced exist
   - All test files referenced exist
   - Spec format is valid

2. **Behavioral Validation** (Execution)
   - Replay tests run without network
   - Replay tests complete in <1s
   - No file writes during replay tests
   - Live tests actually use real SDK

3. **Completeness Validation** (Coverage)
   - Every spec requirement has a test
   - Every component has a live test script
   - Fixtures match recorded scenarios

### Validation Checklist (Per Component)

```markdown
## Validation Checklist

### Static Structure
- [ ] Test spec file exists: `tests/specs/<component>.test-spec.md`
- [ ] Spec follows template format
- [ ] All fixtures referenced exist in `fixtures/golden/`
- [ ] All test files referenced exist
- [ ] Live test script exists: `scripts/live/<component>-live.ts`

### Behavioral Verification
- [ ] Run: `bun test tests/replay/<component>*.test.ts`
  - [ ] Completes in <1s
  - [ ] No network calls (verify with network monitor)
  - [ ] No file writes (verify fixtures unchanged)
  - [ ] All tests pass

- [ ] Run: `bun scripts/live/<component>-live.ts`
  - [ ] Uses real SDK (verify in code)
  - [ ] Completes successfully
  - [ ] Results match replay test expectations

### Completeness
- [ ] Every R[N] requirement has corresponding replay test
- [ ] Every replay test has corresponding fixture
- [ ] Live test covers all replay scenarios
- [ ] Unit tests exist for pure logic (if applicable)
```

## Key Invariants

1. **Fixtures are real** - Never hand-craft JSONL files, always record from real scenarios
2. **Recording is explicit** - No accidental recording, always via script
3. **Replay is fast** - Replay tests must complete in <1s, no network, no file writes
4. **Live proves completion** - Every feature must pass live test before marking complete
5. **Specs are canonical** - Test specs define requirements, code implements them
