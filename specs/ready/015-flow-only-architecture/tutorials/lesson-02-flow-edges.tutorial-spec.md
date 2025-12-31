# Lesson 02: Flow Edges Tutorial Specification

**Lesson**: `packages/kernel-tutorial/lessons/02-flow-edges`  
**Last Updated**: 2025-12-31  
**Status**: Draft

## Goal

Understand how edges define execution order in a DAG.

## Files

- `README.md`
- `run.ts`
- `flow.yaml`

## Run

```bash
bun run lesson:02
```

## Expected Output

- Process exits with code `0`
- Console prints `Lesson 02: Flow Edges`
- Output includes `Flow outputs:` with:
  - `start.text === "Start"`
  - `middle.text === "Middle"`
  - `end.text === "End"`

## Assertions

- `outputs.start.text === "Start"`
- `outputs.middle.text === "Middle"`
- `outputs.end.text === "End"`

## Gate

Required for Phase 1–2 tutorial gate.

## Notes

Edges are explicit and required.
