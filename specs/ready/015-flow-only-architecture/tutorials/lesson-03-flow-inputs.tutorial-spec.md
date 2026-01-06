# Lesson 03: Flow Inputs Tutorial Specification

**Lesson**: `packages/kernel-tutorial/lessons/03-flow-inputs`  
**Last Updated**: 2025-12-31  
**Status**: Draft

## Goal

Demonstrate flow inputs and input overrides.

## Files

- `README.md`
- `run.ts`
- `flow.yaml`

## Run

```bash
bun run lesson:03
```

## Expected Output

- Process exits with code `0`
- Console prints `Lesson 03: Flow Inputs`
- Output includes `Flow outputs:` with `greet.text === "Hello, Ada!"`

## Assertions

- `outputs.greet.text === "Hello, Ada!"`

## Gate

Required for Phase 1–2 tutorial gate.

## Notes

Overrides `flow.input.name` with `Ada`.
