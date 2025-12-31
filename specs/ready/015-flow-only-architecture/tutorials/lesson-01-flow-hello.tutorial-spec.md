# Lesson 01: Flow Hello Tutorial Specification

**Lesson**: `packages/kernel-tutorial/lessons/01-flow-hello`  
**Last Updated**: 2025-12-31  
**Status**: Draft

## Goal

Run the simplest possible flow using YAML + the CLI runner.

## Files

- `README.md`
- `run.ts`
- `flow.yaml`

## Run

```bash
bun run lesson:01
```

## Expected Output

- Process exits with code `0`
- Console prints `Lesson 01: Flow Hello`
- Output includes `Flow outputs:` with `greet.text = "Hello, Flow!"`

## Assertions

- `outputs.greet.text === "Hello, Flow!"`
- No errors printed

## Gate

Required for Phase 1–2 tutorial gate.

## Notes

Uses `echo` node from `core` pack.
