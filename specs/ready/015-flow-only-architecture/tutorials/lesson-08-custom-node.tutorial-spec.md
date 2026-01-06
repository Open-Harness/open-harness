# Lesson 08: Custom Node Tutorial Specification

**Lesson**: `packages/kernel-tutorial/lessons/08-custom-node`  
**Last Updated**: 2025-12-31  
**Status**: Draft

## Goal

Demonstrate custom node pack registration.

## Files

- `README.md`
- `run.ts`
- `flow.yaml`

## Run

```bash
bun run lesson:08
```

## Expected Output

- Process exits with code `0`
- Console prints `Lesson 08: Custom Node`
- Output includes `upper.text === "CUSTOM NODE PACK"`

## Assertions

- `outputs.upper.text === "CUSTOM NODE PACK"`

## Gate

Required for Phase 1–2 tutorial gate.
