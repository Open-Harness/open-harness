---
lastUpdated: "2026-01-21T21:38:20.789Z"
lastCommit: "1c311f5d8da4cb98e2bce5a385dbe52c32dead79"
lastCommitDate: "2026-01-21T21:33:58Z"
---
# Core V2 Test Fixtures

## Overview

This directory contains fixture files recorded from REAL Claude SDK sessions. These fixtures enable deterministic testing without hitting the live API.

**CRITICAL**: Do NOT manually create or edit fixture files. All fixtures MUST be recorded from live SDK interactions to ensure they reflect actual SDK behavior.

## Recording Information

| Property | Value |
|----------|-------|
| **Recorded Date** | 2026-01-21 |
| **Model** | claude-sonnet-4-20250514 |
| **SDK Version** | @anthropic-ai/claude-agent-sdk 0.2.5 |
| **Recording Script** | `scripts/record-fixtures.ts` |

## Fixture Files

### golden/

Authoritative fixtures for replay-based testing:

| File | Description | Message Count |
|------|-------------|---------------|
| `text-simple.json` | Simple text response without streaming | ~30 |
| `text-streaming.json` | Text response with streaming deltas | ~30 |
| `text-multiline.json` | Multi-line text response with formatting | ~30 |
| `tool-use-roundtrip.json` | Tool call (Bash) with result | ~29 |
| `structured-output.json` | Response with JSON output schema | ~31 |
| `multi-turn.json` | Multi-turn conversation context | ~30 |

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
