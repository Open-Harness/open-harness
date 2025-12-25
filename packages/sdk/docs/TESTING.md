# Testing Guide

This guide explains the testing philosophy, infrastructure, and patterns used in the SDK.

## Philosophy

The SDK testing strategy is designed around three principles:

1. **Safe by Default**: Running `bun run test` never makes network calls, never writes files, and completes quickly. Developers can run tests freely without worrying about side effects.

2. **Explicit Live Testing**: Live API tests require explicit commands (`bun run test:live`). Recording new fixtures requires explicit calls to `startCapture()` and `saveCapture()`.

3. **Golden Recording Pattern**: LLM behavior is captured in fixtures ("golden recordings") that enable deterministic replay tests. This provides fast, reliable tests without requiring API credentials.

## Test Categories

| Category | Directory | Purpose | Network | Speed |
|----------|-----------|---------|---------|-------|
| Unit | `tests/unit/` | Pure logic, no external deps | No | <1s |
| Replay | `tests/replay/` | Deterministic fixture playback | No | <5s |
| Integration | `tests/integration/` | Live API calls, fixture capture | Yes | 30-120s |

### Unit Tests (`tests/unit/`)

Test pure business logic without any external dependencies:
- Parser logic
- Validation functions
- Container configuration
- Event mapping
- Workflow builders

These tests use mock runners and never call external APIs.

### Replay Tests (`tests/replay/`)

Test agent behavior using pre-recorded API responses:
- Agent output parsing
- Callback event sequences
- Error handling paths
- Edge case scenarios

These tests load golden recordings and replay them deterministically.

### Integration Tests (`tests/integration/`)

Test live API behavior and capture new fixtures:
- End-to-end agent execution
- Golden recording capture
- OAuth authentication verification

These tests require Claude Code subscription authentication.

## Running Tests

```bash
# Default: Run safe tests only (unit + replay)
bun run test

# Run specific categories
bun run test:unit     # Unit tests only
bun run test:replay   # Replay tests only
bun run test:live     # Integration tests (requires auth)
bun run test:all      # All tests
```

## Adding New Tests

### Adding a Unit Test

1. Create a test file in `tests/unit/`:
   ```typescript
   // tests/unit/my-feature.test.ts
   import { describe, expect, test } from "bun:test";
   import { myFunction } from "../../src/my-feature.js";

   describe("myFunction", () => {
     test("handles valid input", () => {
       const result = myFunction("input");
       expect(result).toBe("expected");
     });
   });
   ```

2. Use mock runners for agent tests:
   ```typescript
   import { createContainer } from "../../src/core/container.js";

   const container = createContainer({ mode: "mock" });
   ```

3. Run to verify: `bun run test:unit`

### Adding a Replay Test

1. Ensure a golden recording exists in `recordings/golden/{agent}/`

2. Create a test file in `tests/replay/`:
   ```typescript
   // tests/replay/my-agent.replay.test.ts
   import { describe, expect, test } from "bun:test";
   import { createReplayContainer } from "../helpers/replay-runner.js";
   import { MyAgent } from "../../src/agents/my-agent.js";

   describe("MyAgent Replay", () => {
     test("replays scenario correctly", async () => {
       const { container, replayer } = await createReplayContainer(
         "golden/my-agent",
         "scenario-name"
       );
       const agent = container.get(MyAgent);

       const result = await agent.execute(input);

       expect(result).toBeDefined();
       console.log("[REPLAY] Messages:", replayer.getSession()?.messages.length);
     });
   });
   ```

3. Run to verify: `bun run test:replay`

### Adding an Integration Test

1. Create a test file in `tests/integration/`:
   ```typescript
   // tests/integration/my-agent-live.test.ts
   import { describe, expect, test } from "bun:test";
   import { createRecordingContainer } from "../helpers/recording-wrapper.js";
   import { MyAgent } from "../../src/agents/my-agent.js";

   describe("MyAgent Live", () => {
     test("executes and captures recording", async () => {
       const { container, recorder } = createRecordingContainer("golden/my-agent");
       const agent = container.get(MyAgent);

       recorder.startCapture("my-scenario");
       const result = await agent.execute(input);
       await recorder.saveCapture({ input });

       expect(result).toBeDefined();
     }, 60000); // Timeout for live API call
   });
   ```

2. Run to verify: `bun run test:live`

## Capturing New Fixtures

Golden recordings are captured during integration tests:

```typescript
const { container, recorder } = createRecordingContainer("golden/my-agent");
const agent = container.get(MyAgent);

// Start capture before agent execution
recorder.startCapture("scenario-name");

// Execute agent (makes live API call)
const result = await agent.execute(input);

// Save the recording
await recorder.saveCapture({ metadata: "optional" });
// Creates: recordings/golden/my-agent/scenario-name.json
```

### Recording Structure

```json
{
  "scenarioId": "scenario-name",
  "category": "golden/my-agent",
  "timestamp": 1234567890,
  "messages": [...],
  "metadata": { "input": "..." }
}
```

### When to Recapture

- API response format changes
- Agent behavior needs updating
- Test assertions need new data
- Fixture becomes stale (>30 days old)

## Anti-Patterns

### Do NOT Do This

**Unit tests with live API calls:**
```typescript
// BAD: Unit test making live API calls
// tests/unit/bad-example.test.ts
import { createRecordingContainer } from "../helpers/recording-wrapper.js";

test("bad test", async () => {
  const { container } = createRecordingContainer("..."); // WRONG!
});
```

**Shared state between tests:**
```typescript
// BAD: Global state that leaks between tests
let globalContainer;

beforeAll(() => {
  globalContainer = createContainer();
});

test("test1", () => { /* uses globalContainer */ });
test("test2", () => { /* sees test1's state */ });
```

**Hardcoded timeouts without reason:**
```typescript
// BAD: Magic number timeout
test("something", async () => { ... }, 30000);

// GOOD: Documented timeout
test("live API call with retries", async () => { ... }, 60000);
```

**Modifying fixtures during tests:**
```typescript
// BAD: Writing to recordings during replay
test("replay", async () => {
  await fs.writeFile("recordings/...", data); // WRONG!
});
```

### Do This Instead

- Use `createContainer({ mode: "mock" })` for unit tests
- Use `createReplayContainer()` for replay tests
- Use `createRecordingContainer()` only in integration tests
- Create fresh containers per test
- Document non-standard timeouts

## Extending the Infrastructure

### Adding a New Agent Category

1. Create the recording directory:
   ```bash
   mkdir -p recordings/golden/new-agent
   ```

2. Add integration test to capture recordings:
   ```typescript
   // tests/integration/new-agent-capture.test.ts
   ```

3. Add replay test to verify playback:
   ```typescript
   // tests/replay/new-agent.replay.test.ts
   ```

### Adding a Test Helper

1. Create helper in `tests/helpers/`:
   ```typescript
   // tests/helpers/my-helper.ts
   export function createMyHelper() { ... }
   ```

2. Export if needed for external use

### Custom Runner Implementation

To add a new runner type:

1. Implement `IAgentRunner` interface
2. Register with container tokens
3. Create factory function (e.g., `createMyContainer()`)

## Troubleshooting

### Tests are making network calls unexpectedly

**Symptom**: `bun run test` takes longer than expected or fails without auth.

**Cause**: A test file is using `createRecordingContainer()` instead of mocks/replays.

**Fix**: Check test file imports. Unit tests should use mocks, replay tests should use `createReplayContainer()`.

```bash
# Find tests using recording container
grep -r "createRecordingContainer" tests/unit tests/replay
```

### Replay test fails with "fixture not found"

**Symptom**: `Error: Fixture not found: recordings/golden/.../scenario.json`

**Cause**: The golden recording doesn't exist or path is wrong.

**Fix**:
1. Check the path matches exactly
2. Run integration test to capture the fixture: `bun run test:live`

### Live tests fail with auth error

**Symptom**: API authentication failure in integration tests.

**Cause**: Running outside Claude Code context or OAuth not configured.

**Fix**: Run tests within Claude Code which provides OAuth automatically.

### Test timeout

**Symptom**: Test times out after 5 seconds (default).

**Cause**: Integration tests need longer timeouts.

**Fix**: Add explicit timeout for live tests:
```typescript
test("live test", async () => { ... }, 60000);
```

### Recording was created during unit/replay test

**Symptom**: New files appear in `recordings/` after running safe tests.

**Cause**: Test is miscategorized - should be in `tests/integration/`.

**Fix**: Move the test file to the correct directory.
