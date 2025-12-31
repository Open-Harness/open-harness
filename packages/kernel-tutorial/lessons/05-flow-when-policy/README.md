# Lesson 05: Flow When + Policy

## Goal
Gate node execution with `when` and see how policies are declared.

## Key Concepts
- `when` is evaluated before a node runs.
- `policy.retry` retries a failing node.
- `policy.timeoutMs` aborts a slow node.
- `policy.continueOnError` records an error marker and allows the flow to continue.

## Run
```bash
bun run flow-run --file lessons/05-flow-when-policy/flow.yaml
bun run lesson:05
```

## Next Lesson
Lesson 07 introduces node packs and the CLI allowlist.
