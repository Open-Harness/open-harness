# Lesson 09: Claude Multi-Turn (Inbox) Tutorial Specification

**Lesson**: `packages/kernel-tutorial/lessons/09-claude-multiturn`  
**Last Updated**: 2025-12-31  
**Status**: Blocked (auth issues)

## Goal

Demonstrate multi-turn `claude.agent` using async iterable prompts and inbox injection.

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
  - `sendToRun` injection is consumed
  - prompt stream ends via `inbox.close()` or `maxTurns`

## Assertions

- `agent:tool:*` and/or `agent:text` events emitted
- `sendToRun` message is reflected in output
- Session terminates cleanly (no hang)

## Gate

Required for Phase 4 tutorial gate.

## Notes

Blocked until Claude auth issues are resolved; do not unblock even if wiring is complete.
