# Lesson 09: Claude Multi-Turn (V2 Session) Tutorial Specification

**Lesson**: `packages/kernel-tutorial/lessons/09-claude-multiturn`
**Last Updated**: 2026-01-01
**Status**: Ready

## Goal

Demonstrate multi-turn `claude.agent` using V2 SDK session pattern with Hub message subscription.

## Files

- `README.md`
- `run.ts`
- `flow.yaml` or FlowRuntime example

## Run

```bash
bun run lesson:09
```

## Expected Output

- Process exits with code `0`
- Console prints `Lesson 09: Claude Multi-Turn`
- Output shows:
  - at least 2 turns
  - `sendToRun` message is consumed via Hub subscription
  - Session terminates cleanly via V2 SDK

## Assertions

- `agent:tool:*` and/or `agent:text` events emitted
- `session:message` event is received by agent
- `sendToRun` message is reflected in output
- Session terminates cleanly (no hang)

## V2 SDK Pattern

Agents subscribe to Hub `session:message` events filtered by `runId`:

```typescript
const unsubscribe = ctx.hub.subscribe("session:message", (event) => {
  const payload = event.event as { runId?: string; content?: string };
  if (payload.runId === ctx.runId && payload.content) {
    // Handle injected message
  }
});
```

External callers inject messages via:

```typescript
hub.sendToRun(runId, "injected message");
// This emits: { type: "session:message", content: "...", runId: "..." }
```

## Gate

Required for Phase 4 tutorial gate.

## Notes

Uses V2 SDK session pattern (`unstable_v2_createSession`) for multi-turn interactions.
