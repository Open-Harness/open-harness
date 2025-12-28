# Data Model: Testing Infrastructure Audit

**Feature**: 004-test-infra-audit
**Date**: 2025-12-26

## Entities

### Test Category

Classification of tests by execution characteristics.

| Field | Type | Description |
|-------|------|-------------|
| name | `"unit" \| "replay" \| "integration"` | Category identifier |
| directory | string | Relative path from tests/ |
| requiresNetwork | boolean | Whether tests need network access |
| requiresAuth | boolean | Whether tests need OAuth token |
| defaultIncluded | boolean | Included in `bun test` by default |
| executionTime | `"fast" \| "medium" \| "slow"` | Expected duration category |

**Instances**:
```yaml
unit:
  directory: "tests/unit/"
  requiresNetwork: false
  requiresAuth: false
  defaultIncluded: true
  executionTime: "fast"

replay:
  directory: "tests/replay/"
  requiresNetwork: false
  requiresAuth: false
  defaultIncluded: true
  executionTime: "fast"

integration:
  directory: "tests/integration/"
  requiresNetwork: true
  requiresAuth: true  # OAuth token, not API key
  defaultIncluded: false
  executionTime: "slow"
```

---

### Recording Session

Captured API interaction for replay testing.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| scenarioId | string | Yes | Unique identifier for the scenario |
| category | string | Yes | Recording category (e.g., "golden/parser-agent") |
| timestamp | number | Yes | Unix timestamp of capture |
| messages | SDKMessage[] | Yes | Array of captured SDK messages |
| metadata | Record<string, unknown> | No | Additional context (fixture path, etc.) |

**Storage Location**: `packages/sdk/recordings/golden/{category}/{scenarioId}.json`

**Example**:
```json
{
  "scenarioId": "sample-tasks-basic",
  "category": "golden/parser-agent",
  "timestamp": 1735228800000,
  "messages": [
    { "type": "system", "subtype": "init", "session_id": "..." },
    { "type": "assistant", "content": "..." }
  ],
  "metadata": {
    "fixture": "sample-tasks.md"
  }
}
```

---

### Test Configuration

Settings controlling test execution behavior.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| isReplayMode | boolean | false | Whether to use recorded fixtures |
| recordingsDir | string | "./recordings" | Base directory for recordings |
| category | string | - | Recording category for capture/replay |
| scenarioId | string | - | Specific scenario to replay |

**Container Factories**:

| Factory | Mode | Purpose |
|---------|------|---------|
| `createContainer()` | Normal | Production container, real API calls |
| `createRecordingContainer()` | Record | Wraps real runner to capture responses |
| `createReplayContainer()` | Replay | Uses recorded session, no API calls |

---

### Audit Finding

An identified issue or improvement opportunity.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Unique identifier (e.g., "AF-001") |
| category | string | Yes | Finding category |
| severity | `"critical" \| "high" \| "medium" \| "low"` | Yes | Impact level |
| title | string | Yes | Brief description |
| description | string | Yes | Detailed explanation |
| impact | string | Yes | Why this matters |
| recommendation | string | Yes | Suggested resolution |
| effort | `"trivial" \| "small" \| "medium" \| "large"` | Yes | Implementation effort |
| relatedRequirements | string[] | No | Linked FR-XXX or SC-XXX |

**Example**:
```yaml
id: "AF-001"
category: "test-separation"
severity: "high"
title: "Default test command runs live tests"
description: |
  Running `bun test` executes all tests including integration tests
  that make live API calls, consuming resources and requiring auth.
impact: |
  Developers may accidentally trigger API calls, slowing down the
  development loop and consuming OAuth token quota.
recommendation: |
  Update package.json to run only unit + replay tests by default.
  Add separate `test:live` command for integration tests.
effort: "trivial"
relatedRequirements: ["FR-001", "FR-004", "SC-001"]
```

---

## State Transitions

### Recording State Machine

```
                    createRecordingContainer()
                              │
                              ▼
                    ┌─────────────────┐
                    │     IDLE        │
                    │ isCapturing=false│
                    └────────┬────────┘
                             │ startCapture(scenarioId)
                             ▼
                    ┌─────────────────┐
                    │   CAPTURING     │
                    │ isCapturing=true │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
     saveCapture()    cancelCapture()   run()
         │                  │          (accumulates)
         │                  │              │
         ▼                  ▼              │
  ┌────────────┐    ┌─────────────┐       │
  │  SAVED     │    │  CANCELLED  │       │
  │ File written│    │ Data discarded│    │
  └────────────┘    └─────────────┘       │
         │                  │              │
         └──────────────────┴──────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │     IDLE        │
                    │ Ready for next  │
                    └─────────────────┘
```

---

## Validation Rules

### Recording Session Validation

```typescript
const RecordingSessionSchema = z.object({
  scenarioId: z.string().min(1),
  category: z.string().min(1),
  timestamp: z.number().positive(),
  messages: z.array(z.unknown()).min(1),  // At least one message
  metadata: z.record(z.unknown()).optional(),
});
```

### Test Category Constraints

- Unit tests MUST NOT import from `tests/helpers/recording-wrapper.ts`
- Replay tests MUST load fixtures before running
- Integration tests MUST be in `tests/integration/` directory
- File pattern: `*.test.ts` or `*_test.ts` (Bun convention)
