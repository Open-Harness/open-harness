# Lesson 13: Inbox + sendToRun Tutorial Specification

**Lesson**: `packages/kernel-tutorial/lessons/13-inbox-sendtorun`  
**Last Updated**: 2025-12-31  
**Status**: Draft

## Goal

Demonstrate run-scoped inbox injection using `sendToRun`.

## Files

- `README.md`
- `run.ts`

## Run

```bash
bun run lesson:13
```

## Expected Output

- Process exits with code `0`
- Console prints `Lesson 13: Inbox + sendToRun`
- Output includes `Harness result:` with `received === "hello from sendToRun"`

## Assertions

- `result.received === "hello from sendToRun"`

## Gate

Required for Phase 6 tutorial gate.
