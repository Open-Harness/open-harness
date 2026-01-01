# Lesson 01: Flow Hello

## Goal
Run the simplest possible flow using YAML + the CLI runner.

## Key Concepts
- Flows are declarative (YAML) and run inside the kernel runtime.
- `nodePacks` declares which node implementations the flow needs.

## Files
- `flow.yaml` — single-node flow using the `echo` node
- `run.ts` — minimal runner using the shared flow helper

## Run
```bash
# CLI
bun run flow-run --file lessons/01-flow-hello/flow.yaml

# Lesson script
bun run lesson:01
```

## Next Lesson
Lesson 02 adds edges and multiple nodes.
