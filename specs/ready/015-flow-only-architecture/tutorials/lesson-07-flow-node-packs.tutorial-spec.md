# Lesson 07: Flow Node Packs Tutorial Specification

**Lesson**: `packages/kernel-tutorial/lessons/07-flow-node-packs`  
**Last Updated**: 2025-12-31  
**Status**: Draft

## Goal

Demonstrate nodePacks allowlist via `oh.config.ts`.

## Files

- `README.md`
- `run.ts`
- `flow.yaml`

## Run

```bash
bun run lesson:07
```

## Expected Output

- Process exits with code `0`
- Console prints `Lesson 07: Node Packs`
- Output includes `explain.text === "Node packs are allowlisted in oh.config.ts"`

## Assertions

- `outputs.explain.text === "Node packs are allowlisted in oh.config.ts"`

## Gate

Required for Phase 1–2 tutorial gate and Phase 5 loader gate.
