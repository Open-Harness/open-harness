# Lesson 10: Runtime Hello Tutorial Specification

**Lesson**: `packages/kernel-tutorial/lessons/10-runtime-hello`  
**Last Updated**: 2025-12-31  
**Status**: Draft

## Goal

Demonstrate a minimal FlowRuntime run with a single agent.

## Files

- `README.md`
- `run.ts`

## Run

```bash
bun run lesson:10
```

## Expected Output

- Process exits with code `0`
- Console prints `Lesson 10: Runtime Hello`
- Output includes `Runtime result:` with `text === "Hello from the runtime"`

## Assertions

- `result.text === "Hello from the runtime"`

## Gate

Required for Phase 6 tutorial gate.

## Notes

This lesson validates the minimal FlowRuntime path.
