# Lesson 05: Flow When + Policy Tutorial Specification

**Lesson**: `packages/kernel-tutorial/lessons/05-flow-when-policy`  
**Last Updated**: 2025-12-31  
**Status**: Draft

## Goal

Demonstrate WhenExpr gating and retry policy on a node.

## Files

- `README.md`
- `run.ts`
- `flow.yaml`

## Run

```bash
bun run lesson:05
```

## Expected Output

- Process exits with code `0`
- Console prints `Lesson 05: Flow When + Policy`
- Output includes:
  - `isYes.value === true`
  - `sayYes.text === "Condition matched: yes"`
  - `flaky.label === "retry-ok"`
  - `report.text === "timeout failed=true"`

## Assertions

- `outputs.isYes.value === true`
- `outputs.sayYes.text === "Condition matched: yes"`
- `outputs.flaky.label === "retry-ok"`
- `outputs.report.text === "timeout failed=true"`

## Gate

Required for Phase 1–2 tutorial gate.

## Notes

Retry policy is configured with `maxAttempts: 2`.
Timeout is demonstrated with `timeoutMs: 5` and `continueOnError: true`.
