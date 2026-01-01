# Lesson 13: Hub Message Routing (sendToRun) Tutorial Specification

**Lesson**: `packages/kernel-tutorial/lessons/13-hub-sendtorun`
**Last Updated**: 2026-01-01
**Status**: Ready

## Goal

Demonstrate run-scoped message injection using `sendToRun` and Hub `session:message` subscription.

## Files

- `README.md`
- `run.ts`

## Run

```bash
bun run lesson:13
```

## Expected Output

- Process exits with code `0`
- Console prints `Lesson 13: Hub Message Routing`
- Output includes `Runtime result:` with `received === "hello from sendToRun"`

## Assertions

- `result.received === "hello from sendToRun"`
- `session:message` event is emitted by Hub
- Message is routed only to the correct `runId`

## V2 SDK Pattern

The Hub provides run-scoped message routing via:

**Sender side (external orchestrator):**
```typescript
hub.sendToRun(runId, "hello from sendToRun");
// Internally emits: { type: "session:message", content: "...", runId: "..." }
```

**Receiver side (agent):**
```typescript
const unsubscribe = ctx.hub.subscribe("session:message", (event) => {
  const { runId, content } = event.event as { runId?: string; content?: string };
  if (runId === ctx.runId && content) {
    // Message was addressed to this agent run
    received = content;
    unsubscribe();
  }
});
```

## Key Concepts

1. **sendToRun**: Emits a `session:message` event tagged with `runId`
2. **Hub subscription**: Agents subscribe to `session:message` and filter by `runId`
3. **Run isolation**: Each agent run has a unique `runId`, ensuring message isolation

## Gate

Required for Phase 6 tutorial gate.
