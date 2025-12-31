# Lesson 14: Flow ↔ Harness Bridge Tutorial Specification

**Lesson**: `packages/kernel-tutorial/lessons/14-bridge-flow-harness`  
**Last Updated**: 2025-12-31  
**Status**: Draft

## Goal

Demonstrate executing a flow from inside a harness (bridge behavior).

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
- Console prints `Lesson 14: Flow ↔ Harness Bridge`
- Output includes `Flow outputs:` with:
  - `facts.value === "Flow inside harness"`
  - `say.text === "Flow inside harness"`

## Assertions

- `outputs.facts.value === "Flow inside harness"`
- `outputs.say.text === "Flow inside harness"`

## Gate

Required for Phase 6 tutorial gate.

## Notes

This lesson may be revised when Harness is fully removed.
