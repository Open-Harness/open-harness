# Testing Workflow Guide

Step-by-step guide for writing and running tests in the kernel + flow system.

## Overview

The testing workflow follows this pattern:

```
1. Write test spec → 2. Record fixture → 3. Write test → 4. TDD loop → 5. Live test
```

Each step is explicit and validated before moving to the next.

## Step 1: Write Test Spec

Create `tests/specs/<component>.test-spec.md` using the [test spec template](test-spec-template.md).

**What to include**:
- Component path and status
- Overview of what needs testing
- Test requirements (R1, R2, R3, ...)
- Each requirement with: fixture path, test file, scenario, assertions
- Live test script reference
- Coverage checklist

**Example**:
```markdown
# Hub Test Specification

**Component**: `src/protocol/hub.ts`  
**Status**: Draft

## Test Requirements

### R1: Event Subscription (Basic)

**Fixture**: `fixtures/golden/hub/subscribe-basic.jsonl`  
**Test File**: `tests/replay/hub.subscribe.test.ts`  
**Test Name**: `"subscribes and receives events"`

**Scenario**:
1. Create a hub instance
2. Subscribe to all events (`"*"`)
3. Emit a runtime lifecycle event (`harness:start`)
4. Verify subscriber receives the event

**Assertions**:
- Event has correct envelope structure
- Event type matches emitted type
- Context is present
```

**Validation**:
- [ ] Spec follows template format
- [ ] All requirements documented
- [ ] Fixture paths are valid
- [ ] Test file paths are valid

## Step 2: Record Fixture

Use the explicit recording script:

```bash
bun scripts/record-fixture.ts <component> <fixture-name>
```

**What happens**:
1. Script runs the scenario (component-specific)
2. Captures events/state
3. Writes to `fixtures/scratch/<component>/<fixture-name>.jsonl`

**Example**:
```bash
bun scripts/record-fixture.ts hub subscribe-basic
# Writes: fixtures/scratch/hub/subscribe-basic.jsonl
```

**Review the fixture**:
```bash
cat fixtures/scratch/hub/subscribe-basic.jsonl
# Verify it matches the scenario
```

**Promote to golden**:
```bash
# After review, move to golden
mv fixtures/scratch/hub/subscribe-basic.jsonl fixtures/golden/hub/
git add fixtures/golden/hub/subscribe-basic.jsonl
```

**Validation**:
- [ ] Fixture exists in scratch/
- [ ] Fixture matches scenario
- [ ] After review, promoted to golden/
- [ ] Golden fixture committed

## Step 3: Write Replay Test

Create `tests/replay/<component>.<feature>.test.ts`:

```typescript
import { describe, test, expect } from "bun:test";
import { loadFixture } from "../helpers/fixture-loader.js";
import { runHubFixture } from "../helpers/hub-fixture-runner.js";

describe("Hub Subscription (replay)", () => {
  test("subscribes and receives events", async () => {
    // Load the recorded scenario
    const fixture = await loadFixture("hub/subscribe-basic");
    
    // Run the fixture scenario
    const result = await runHubFixture(fixture);
    
    // Assertions match spec R1 and fixture expectations
    expect(result.events).toHaveLength(fixture.expect.events.length);
    expect(result.events[0].event.type).toBe("harness:start");
    expect(result.events[0].context.sessionId).toBe(fixture.sessionId);
    expect(result.events[0].id).toBeDefined();
    expect(result.events[0].timestamp).toBeInstanceOf(Date);
  });
});
```

**Validation**:
- [ ] Test file exists
- [ ] Test matches spec requirement
- [ ] Test references correct fixture
- [ ] Assertions match spec

## Step 4: TDD Loop

Run replay tests in fast TDD loop:

```bash
# Run all replay tests
bun test tests/replay/

# Run specific component
bun test tests/replay/hub*.test.ts

# Watch mode (if supported)
bun test --watch tests/replay/
```

**What to verify**:
- Tests complete in <1s
- No network calls (timeout guard)
- No file writes (git status unchanged)
- All tests pass

**Validation**:
```bash
# Set timeout guard
timeout 30 bun test tests/replay/<component>*.test.ts

# Check git status
git status --porcelain
# Should show no changes (or only expected temp files)
```

**Iterate**:
- Red: Write failing test
- Green: Make it pass
- Refactor: Improve code
- Repeat

## Step 5: Live Test (Authoritative)

Create `scripts/live/<component>-live.ts`:

```typescript
/**
 * Authoritative live test for Hub implementation.
 * MUST pass before marking Hub feature complete.
 */

import { createHub } from "../../src/engine/hub.js";
import { loadFixture } from "../../tests/helpers/fixture-loader.js";

async function runLiveTest() {
  console.log("🧪 Running Hub live test...");
  
  const scenarios = [
    "hub/subscribe-basic",
    "hub/subscribe-filter",
    // ... all scenarios
  ];
  
  // Run all scenarios against real implementation
  for (const scenarioPath of scenarios) {
    const scenario = await loadFixture(scenarioPath);
    const hub = createHub({ sessionId: scenario.sessionId });
    // ... run scenario (same logic as replay test)
  }
  
  console.log("✅ All live tests passed");
}

runLiveTest().catch(console.error);
```

**Run live test**:
```bash
bun scripts/live/<component>-live.ts
```

**Validation**:
- [ ] Script exists
- [ ] Uses real SDK (no mocks)
- [ ] Completes successfully
- [ ] Results match replay test expectations

## When to Use Each Test Type

### Unit Tests

Use for:
- Pure logic (filter matching, context merging)
- Data structures (event envelope construction)
- Algorithms (topological sort, binding resolution)
- Type guards and validators

**Example**: Testing `matchesFilter("agent:*", "agent:start")` returns `true`.

### Replay Tests

Use for:
- Interface contracts (Hub subscription, runtime lifecycle)
- Event sequences (multiple events in order)
- State transitions (status changes, context propagation)
- Integration scenarios (multiple components working together)

**Example**: Testing Hub subscription receives events in correct order.

### Live Tests

Use for:
- Final verification before marking complete
- Proving production behavior
- Validating real SDK integration
- End-to-end scenarios

**Example**: Running all Hub replay scenarios against real implementation.

## Fixture Recording Workflow

### Recording a New Fixture

1. **Write spec requirement** with fixture path
2. **Run recording script**:
   ```bash
   bun scripts/record-fixture.ts hub subscribe-basic
   ```
3. **Review fixture**:
   ```bash
   cat fixtures/scratch/hub/subscribe-basic.jsonl
   ```
4. **Verify scenario** matches requirement
5. **Promote to golden**:
   ```bash
   mv fixtures/scratch/hub/subscribe-basic.jsonl fixtures/golden/hub/
   ```
6. **Commit**:
   ```bash
   git add fixtures/golden/hub/subscribe-basic.jsonl
   git commit -m "Add hub subscribe-basic fixture"
   ```

### Updating an Existing Fixture

1. **Identify outdated fixture**
2. **Record new version** to scratch:
   ```bash
   bun scripts/record-fixture.ts hub subscribe-basic
   ```
3. **Compare** old vs new:
   ```bash
   diff fixtures/golden/hub/subscribe-basic.jsonl \
          fixtures/scratch/hub/subscribe-basic.jsonl
   ```
4. **Review changes** - are they expected?
5. **Replace golden** if changes are correct:
   ```bash
   cp fixtures/scratch/hub/subscribe-basic.jsonl \
      fixtures/golden/hub/subscribe-basic.jsonl
   ```
6. **Update tests** if fixture structure changed
7. **Commit**:
   ```bash
   git add fixtures/golden/hub/subscribe-basic.jsonl
   git commit -m "Update hub subscribe-basic fixture"
   ```

## Complete Example Workflow

### Example: Testing Hub Subscription

1. **Write spec**: `tests/specs/hub.test-spec.md`
   - Define R1: Event Subscription (Basic)
   - Specify fixture: `fixtures/golden/hub/subscribe-basic.jsonl`
   - Define scenario and assertions

2. **Record fixture**:
   ```bash
   bun scripts/record-fixture.ts hub subscribe-basic
   # Creates: fixtures/scratch/hub/subscribe-basic.jsonl
   ```

3. **Review and promote**:
   ```bash
   cat fixtures/scratch/hub/subscribe-basic.jsonl
   mv fixtures/scratch/hub/subscribe-basic.jsonl fixtures/golden/hub/
   git add fixtures/golden/hub/subscribe-basic.jsonl
   ```

4. **Write test**: `tests/replay/hub.subscribe.test.ts`
   - Load fixture
   - Create hub
   - Replay scenario
   - Assert results

5. **TDD loop**:
   ```bash
   bun test tests/replay/hub.subscribe.test.ts
   # Iterate: red → green → refactor
   ```

6. **Write live test**: `scripts/live/hub-live.ts`
   - Run all scenarios
   - Use real SDK
   - Verify completion

7. **Final validation**:
   ```bash
   bun test tests/replay/hub*.test.ts  # <1s, no network
   bun scripts/live/hub-live.ts        # Real SDK, passes
   git status                          # No unexpected changes
   ```

## Key Rules

1. **Spec first** - Always write test spec before implementation
2. **Explicit recording** - Never auto-record, always via script
3. **Scratch → golden** - Always review before promoting
4. **Fast replay** - Replay tests must be <1s, no network, no file writes
5. **Live proves completion** - Every feature must pass live test
6. **Validate at each step** - Don't skip validation checks
