---
lastUpdated: "2026-01-22T01:44:32.244Z"
lastCommit: "bf7ff154f169935003c0e457aac735fb31d715f1"
lastCommitDate: "2026-01-22T01:39:27Z"
---
# Core V2 Test Fixtures

## Overview

This directory contains fixture files recorded from REAL Claude SDK sessions. These fixtures enable deterministic testing without hitting the live API.

**CRITICAL**: Do NOT manually create or edit fixture files. All fixtures MUST be recorded from live SDK interactions to ensure they reflect actual SDK behavior.

## Recording Information

| Property | Value |
|----------|-------|
| **Recorded Date** | 2026-01-22 |
| **Model** | claude-sonnet-4-20250514 |
| **SDK Version** | @anthropic-ai/claude-agent-sdk 0.2.5 |
| **Recording Script** | `scripts/record-fixtures.ts` |

### Exact Command Used

```bash
bun run packages/core-v2/scripts/record-fixtures.ts --all
```

## Fixture Files

### golden/

Authoritative fixtures for replay-based testing:

| File | Description | Duration | Message Count |
|------|-------------|----------|---------------|
| `text-simple.json` | Simple text response ("2+2") | 5,264ms | 9 |
| `text-streaming.json` | Text response with streaming deltas | 5,938ms | ~15 |
| `text-multiline.json` | Multi-line text response with formatting | 7,989ms | ~25 |
| `tool-use-roundtrip.json` | Tool call (Bash) with result | 8,930ms | ~12 |
| `structured-output.json` | Response with JSON output schema | 6,964ms | ~12 |
| `multi-turn.json` | Multi-turn conversation context | 7,131ms | 9 |

## File Checksums (SHA-256)

```
d1ebf9398d1407b7cfe98868b9b285f3fd91e43475c3d49bce11a0aa4782a0c1  golden/multi-turn.json
c044fcbb27757f840a5da4a4d175febac6da54b82cdcc07a4ef407164a89cbb2  golden/structured-output.json
56114782a15318770d9a7368a2f30cc8a73805e9d0f26ba9fb90757cd9c25614  golden/text-multiline.json
1b9df4cef5f8bda646943fd3c81a77abf209e4069aa49890c4736aa6d71c2a7a  golden/text-simple.json
d95b79e9cef94964213bcbfabdd9cae754d0edfb98d8d19bf6038ae162fecb5e  golden/text-streaming.json
cce13e90fcf1937f26c3f5c3e3fd78a28b731ca79fe0acde2eefd8bbcff668a2  golden/tool-use-roundtrip.json
```

To verify checksums:
```bash
cd packages/core-v2/tests/fixtures
shasum -a 256 -c <<< "d1ebf9398d1407b7cfe98868b9b285f3fd91e43475c3d49bce11a0aa4782a0c1  golden/multi-turn.json
c044fcbb27757f840a5da4a4d175febac6da54b82cdcc07a4ef407164a89cbb2  golden/structured-output.json
56114782a15318770d9a7368a2f30cc8a73805e9d0f26ba9fb90757cd9c25614  golden/text-multiline.json
1b9df4cef5f8bda646943fd3c81a77abf209e4069aa49890c4736aa6d71c2a7a  golden/text-simple.json
d95b79e9cef94964213bcbfabdd9cae754d0edfb98d8d19bf6038ae162fecb5e  golden/text-streaming.json
cce13e90fcf1937f26c3f5c3e3fd78a28b731ca79fe0acde2eefd8bbcff668a2  golden/tool-use-roundtrip.json"
```

## Fixture Structure

Each fixture file contains:

```typescript
interface Fixture {
  metadata: {
    scenario: string;      // Fixture identifier
    recordedAt: string;    // ISO-8601 timestamp
    model: string;         // Model used for recording
    durationMs: number;    // Recording duration
    messageCount: number;  // Number of SDK messages
    sdkVersion: string;    // SDK version
    description: string;   // Human-readable description
  };
  prompt: string;          // The prompt sent to the SDK
  messages: RecordedMessage[];  // All SDK messages in order
  result: {
    text?: string;         // Final text response
    sessionId?: string;    // SDK session ID
    hasStructuredOutput: boolean;
    toolCallsMade: string[];
  };
}

interface RecordedMessage {
  message: SDKMessage;     // Raw SDK message
  relativeTimestamp: number;  // ms since recording start
  index: number;           // Message sequence number
}
```

## How to Re-record Fixtures

If SDK behavior changes or new scenarios are needed:

```bash
# From packages/core-v2/
cd packages/core-v2

# Record all scenarios
bun run scripts/record-fixtures.ts --all

# Record a specific scenario
bun run scripts/record-fixtures.ts --scenario text-streaming
```

The script:
1. Runs against the LIVE Claude SDK (requires auth)
2. Captures all SDK messages with timing
3. Saves to `tests/fixtures/golden/`

## Usage in Tests

```typescript
import textStreamingFixture from "./fixtures/golden/text-streaming.json";

// Use fixture.messages to replay SDK behavior
for (const recorded of textStreamingFixture.messages) {
  // Process recorded.message as if from live SDK
}
```

## Maintenance

When updating fixtures:

1. Update this README with new recording date
2. Update SDK version if changed
3. Verify all tests pass with new fixtures
4. Commit fixture changes with descriptive message
