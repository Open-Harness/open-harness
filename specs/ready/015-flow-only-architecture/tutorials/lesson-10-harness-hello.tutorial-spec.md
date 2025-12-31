# Lesson 10: Harness Hello Tutorial Specification

**Lesson**: `packages/kernel-tutorial/lessons/10-harness-hello`  
**Last Updated**: 2025-12-31  
**Status**: Draft

## Goal

Demonstrate a minimal harness run with a single agent.

## Files

- `README.md`
- `run.ts`

## Run

```bash
bun run lesson:10
```

## Expected Output

- Process exits with code `0`
- Console prints `Lesson 10: Harness Hello`
- Output includes `Harness result:` with `text === "Hello from the harness"`

## Assertions

- `result.text === "Hello from the harness"`

## Gate

Required for Phase 6 tutorial gate.

## Notes

This lesson remains until harness is fully removed or bridged.
