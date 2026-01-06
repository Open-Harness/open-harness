# Quickstart: Testing Infrastructure

**Feature**: 004-test-infra-audit
**Package**: `packages/sdk/`

## Running Tests

### Default (Safe) Tests

```bash
cd packages/sdk
bun test
```

Runs **unit + replay** tests only. No network calls, no auth required, completes in <30 seconds.

### Live Integration Tests

```bash
cd packages/sdk
bun test:live
```

Runs integration tests that make real API calls. Requires OAuth token (already configured in Claude Code context).

### All Tests

```bash
cd packages/sdk
bun test:all
```

Runs all test categories including live tests.

---

## Test Categories

| Command | Category | Network | Auth | Speed |
|---------|----------|---------|------|-------|
| `bun test` | unit + replay | No | No | Fast |
| `bun test:unit` | unit only | No | No | Fast |
| `bun test:replay` | replay only | No | No | Fast |
| `bun test:live` | integration | Yes | OAuth | Slow |
| `bun test:all` | all | Yes | OAuth | Slow |

---

## Adding New Tests

### Unit Test (Pure Logic)

Create in `tests/unit/`:

```typescript
// tests/unit/my-feature.test.ts
import { describe, expect, test } from "bun:test";
import { myFunction } from "../../src/my-feature.js";

describe("myFunction", () => {
  test("handles valid input", () => {
    expect(myFunction("input")).toBe("expected");
  });
});
```

**Rules**:
- No external dependencies (API, filesystem, network)
- No imports from `tests/helpers/recording-wrapper.ts`
- Pure input → output testing

### Replay Test (Recorded Fixtures)

Create in `tests/replay/`:

```typescript
// tests/replay/my-agent.replay.test.ts
import { describe, expect, test } from "bun:test";
import { MyAgent } from "../../src/agents/my-agent.js";
import { createReplayContainer } from "../helpers/replay-runner.js";

describe("MyAgent Replay", () => {
  test("replays recorded scenario", async () => {
    const { container } = await createReplayContainer(
      "golden/my-agent",
      "my-scenario"
    );
    const agent = container.get(MyAgent);

    const result = await agent.execute("input");

    expect(result).toBeDefined();
  });
});
```

**Rules**:
- Uses `createReplayContainer()` for deterministic replay
- Fixture must exist in `recordings/golden/{category}/{scenarioId}.json`
- No live API calls

### Integration Test (Live API)

Create in `tests/integration/`:

```typescript
// tests/integration/my-agent.test.ts
import { describe, expect, test } from "bun:test";
import { MyAgent } from "../../src/agents/my-agent.js";
import { createRecordingContainer } from "../helpers/recording-wrapper.js";

describe("MyAgent Live", () => {
  test("executes with real API", async () => {
    const { container, recorder } = createRecordingContainer("golden/my-agent");
    const agent = container.get(MyAgent);

    // Optionally capture for new fixture
    // recorder.startCapture("my-scenario");

    const result = await agent.execute("input");

    // Optionally save recording
    // await recorder.saveCapture({ note: "initial capture" });

    expect(result).toBeDefined();
  }, { timeout: 60000 });
});
```

**Rules**:
- Uses real API calls via OAuth token
- Recording is opt-in (explicit `startCapture()`)
- Longer timeout for API latency

---

## Capturing New Fixtures

1. **Write integration test** with recording hooks:

```typescript
recorder.startCapture("my-scenario");
const result = await agent.execute("input");
await recorder.saveCapture({ fixture: "input-file.md" });
```

2. **Run the integration test**:

```bash
bun test:live tests/integration/my-agent.test.ts
```

3. **Verify fixture created**:

```bash
ls recordings/golden/my-agent/
# Should show: my-scenario.json
```

4. **Create replay test** that uses the fixture

5. **Remove recording code** from integration test (one-time capture)

---

## CI/CD Configuration

| Pipeline Stage | Command | Purpose |
|----------------|---------|---------|
| PR Check | `bun test` | Fast validation, no credentials needed |
| Pre-Merge | `bun test:all` | Full validation with live tests |
| Scheduled | `bun test:live` | Refresh fixtures periodically |

---

## Anti-Patterns to Avoid

These are common mistakes that break the testing philosophy. **Don't do these.**

### 1. Mixing Test Categories

**Wrong**: Live API calls in unit tests
```typescript
// tests/unit/agent.test.ts - WRONG!
import { createRecordingContainer } from "../helpers/recording-wrapper.js";

test("agent works", async () => {
  const { container } = createRecordingContainer("golden/agent");  // WRONG!
  // This makes live API calls in a unit test directory
});
```

**Right**: Keep unit tests pure
```typescript
// tests/unit/agent.test.ts - CORRECT
test("agent validates input", () => {
  // No external dependencies, pure logic only
  expect(validateInput("test")).toBe(true);
});
```

### 2. Importing Recording Wrapper in Unit Tests

**Wrong**: Breaking the offline requirement
```typescript
// tests/unit/parser.test.ts - WRONG!
import { createRecordingContainer } from "../helpers/recording-wrapper.js";
// This import means unit tests can't run offline
```

**Right**: Unit tests should only import from `src/`
```typescript
// tests/unit/parser.test.ts - CORRECT
import { Parser } from "../../src/parser.js";
// No helper imports in unit tests
```

### 3. Forgetting saveCapture()

**Wrong**: Recording not persisted
```typescript
recorder.startCapture("my-scenario");
await agent.execute("input");
// Missing saveCapture() - recording lost!
```

**Right**: Always pair start with save
```typescript
recorder.startCapture("my-scenario");
await agent.execute("input");
await recorder.saveCapture();  // Required!
```

### 4. Auto-Recording in Tests

**Wrong**: Recording without explicit flag
```typescript
// This would violate FR-006/FR-007
const { recorder } = createRecordingContainer("agent");
recorder.startCapture("scenario");  // Auto-starts on every test run
await agent.execute("input");
await recorder.saveCapture();       // Creates new files every run
```

**Right**: Recording only for fixture capture (one-time)
```typescript
// Comment out after capturing fixture
// recorder.startCapture("scenario");
await agent.execute("input");
// await recorder.saveCapture();
```

### 5. Hardcoding Fixture Paths

**Wrong**: Brittle paths that break when files move
```typescript
const fixture = await fs.readFile("/Users/dev/project/recordings/golden/test.json");
```

**Right**: Use relative paths from test location
```typescript
import path from "node:path";
const fixturesDir = path.resolve(__dirname, "../fixtures");
const fixture = await fs.readFile(path.join(fixturesDir, "test.json"));
```

### 6. Skipping Container Factories

**Wrong**: Direct instantiation loses DI benefits
```typescript
// tests/unit/agent.test.ts - WRONG!
import { MyAgent } from "../../src/agents/my-agent.js";
const agent = new MyAgent();  // Loses DI, mocking becomes harder
```

**Right**: Use container factories
```typescript
// tests/replay/agent.test.ts - CORRECT
const { container } = await createReplayContainer("golden/my-agent", "scenario");
const agent = container.get(MyAgent);  // Proper DI injection
```

### 7. Checking for ANTHROPIC_API_KEY

**Wrong**: This project uses OAuth, not API keys
```typescript
if (!process.env.ANTHROPIC_API_KEY) {
  console.log("No API key configured");  // WRONG - we don't use API keys
}
```

**Right**: Just run the test - OAuth is already configured
```typescript
// OAuth token is automatically available in Claude Code context
const result = await agent.execute("input");  // Just works
```

### 8. Shared State Between Tests

**Wrong**: Tests depend on execution order
```typescript
let sharedCounter = 0;

test("first test", () => {
  sharedCounter++;
  expect(sharedCounter).toBe(1);
});

test("second test", () => {
  expect(sharedCounter).toBe(1);  // Depends on first test running first
});
```

**Right**: Each test is independent
```typescript
test("first test", () => {
  const counter = 0;
  expect(counter + 1).toBe(1);
});

test("second test", () => {
  const counter = 0;
  expect(counter).toBe(0);  // Doesn't depend on other tests
});
```

---

## Troubleshooting

### Missing Fixture Error

```
Error: Fixture not found: recordings/golden/my-agent/my-scenario.json
```

**Solution**: Run the integration test to capture the fixture:
```bash
bun test:live tests/integration/my-agent.test.ts
```

### Timeout on Live Tests

```
Error: Test timeout exceeded (60000ms)
```

**Solution**: Increase timeout in test options:
```typescript
test("my test", async () => { ... }, { timeout: 120000 });
```

### Recording Not Saved

Check that you called both `startCapture()` AND `saveCapture()`:
```typescript
recorder.startCapture("scenario-name");  // Start
// ... run agent ...
await recorder.saveCapture();            // Save (required!)
```
