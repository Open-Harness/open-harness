# Lesson 04: Flow Bindings Tutorial Specification

**Lesson**: `packages/kernel-tutorial/lessons/04-flow-bindings`  
**Last Updated**: 2025-12-31  
**Status**: Draft

## Goal

Demonstrate A3 bindings between node outputs and downstream inputs.

## Files

- `README.md`
- `run.ts`
- `flow.yaml`

## Run

```bash
bun run lesson:04
```

## Expected Output

- Process exits with code `0`
- Console prints `Lesson 04: Flow Bindings`
- Output includes:
  - `facts.value.city === "Lisbon"`
  - `facts.value.country === "Portugal"`
  - `say.text === "City: Lisbon, Country: Portugal"`

## Assertions

- `outputs.facts.value.city === "Lisbon"`
- `outputs.facts.value.country === "Portugal"`
- `outputs.say.text === "City: Lisbon, Country: Portugal"`

## Gate

Required for Phase 1–2 tutorial gate.
