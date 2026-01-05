# Lesson 07: Node Packs + Allowlist

## Goal
Understand how YAML `nodePacks` maps to `oh.config.ts` allowlisted packs.

## Key Concepts
- YAML declares *what it needs*.
- `oh.config.ts` declares *what’s allowed*.
- Unknown packs fail fast with a clear error.

## Run
```bash
bun run flow-run --file lessons/07-flow-node-packs/flow.yaml
bun run lesson:07
```

## Next Lesson
Lesson 08 builds a custom node and pack.
