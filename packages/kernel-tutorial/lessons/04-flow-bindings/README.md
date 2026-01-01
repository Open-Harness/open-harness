# Lesson 04: Flow Bindings

## Goal
Use node outputs in downstream node inputs.

## Key Concepts
- Bindings are string interpolation only: `{{path}}`.
- Paths resolve against `flow.input` and prior node outputs.

## Run
```bash
bun run flow-run --file lessons/04-flow-bindings/flow.yaml
bun run lesson:04
```

## Next Lesson
Lesson 05 introduces conditional execution and policies.
