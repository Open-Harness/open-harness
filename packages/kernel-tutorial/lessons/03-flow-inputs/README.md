# Lesson 03: Flow Inputs + Overrides

## Goal
Use `flow.input` and override values at runtime.

## Key Concepts
- `flow.input` provides default values.
- CLI `--input.*` overrides those values.

## Run
```bash
# Default input (World)
bun run flow-run --file lessons/03-flow-inputs/flow.yaml

# Override input at runtime
bun run flow-run --file lessons/03-flow-inputs/flow.yaml --input.name="Ada"

# Lesson script
bun run lesson:03
```

## Next Lesson
Lesson 04 shows bindings between node outputs.
