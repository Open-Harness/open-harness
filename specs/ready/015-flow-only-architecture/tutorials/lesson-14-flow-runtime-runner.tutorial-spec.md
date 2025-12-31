# Lesson 14: Flow Runtime Runner Tutorial Specification

**Lesson**: `packages/kernel-tutorial/lessons/14-flow-runtime-runner`  
**Last Updated**: 2025-12-31  
**Status**: Draft

## Goal

Demonstrate executing a flow via FlowRuntime end-to-end.

## Files

- `README.md`
- `run.ts`
- `flow.yaml`

## Run

```bash
bun run lesson:14
```

## Expected Output

- Process exits with code `0`
- Console prints `Lesson 14: Flow Runtime Runner`
- Output includes `Flow outputs:` with:
  - `facts.value === "Flow via runtime"`
  - `say.text === "Flow via runtime"`

## Assertions

- `outputs.facts.value === "Flow via runtime"`
- `outputs.say.text === "Flow via runtime"`

## Gate

Required for Phase 6 tutorial gate.

## Notes

This lesson validates the FlowRuntime execution path.
