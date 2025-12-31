# Lesson 02: Flow Edges

## Goal
Understand how edges define execution order in a DAG.

## Key Concepts
- Edges are required (even if empty).
- Dependencies are explicit, never inferred from order or bindings.

## Files
- `flow.yaml` — three nodes chained with edges
- `run.ts` — runs the flow

## Run
```bash
bun run flow-run --file lessons/02-flow-edges/flow.yaml
bun run lesson:02
```

## Next Lesson
Lesson 03 introduces flow inputs and overrides.
