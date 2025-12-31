# Lesson 05: Flow When + Policy

## Goal
Gate node execution with `when` and see how policies are declared.

## Key Concepts
- `when` is evaluated before a node runs.
- `policy` is validated in YAML but not yet enforced by the sequential executor (MVP limitation).

## Run
```bash
bun run flow-run --file lessons/05-flow-when-policy/flow.yaml
bun run lesson:05
```

## Next Lesson
Lesson 07 introduces node packs and the CLI allowlist.
