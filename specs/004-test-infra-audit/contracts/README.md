# Contracts: Testing Infrastructure Audit

**Feature**: 004-test-infra-audit

## No API Contracts

This feature is an **audit and documentation** effort. It does not introduce new APIs.

### Deliverables

| Type | Description |
|------|-------------|
| Configuration | package.json script updates |
| Documentation | TESTING.md philosophy guide |
| Report | audit.md findings document |

### Existing APIs (No Changes)

The following helper APIs remain unchanged:

```typescript
// packages/sdk/tests/helpers/recording-wrapper.ts
function createRecordingContainer(
  category: string,
  recordingsDir?: string
): { container: Container; recorder: RecordingRunner }

// packages/sdk/tests/helpers/replay-runner.ts
function createReplayContainer(
  category: string,
  scenarioId: string,
  recordingsDir?: string
): Promise<{ container: Container; replayer: GoldenReplayRunner }>
```

These APIs already satisfy FR-006 and FR-007 (recording opt-in).
