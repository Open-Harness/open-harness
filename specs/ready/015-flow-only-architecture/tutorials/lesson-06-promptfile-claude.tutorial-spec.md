# Lesson 06: PromptFile + Claude Tutorial Specification

**Lesson**: `packages/kernel-tutorial/lessons/06-promptfile-claude`  
**Last Updated**: 2025-12-31  
**Status**: Blocked (auth issues)

## Goal

Demonstrate `promptFile` + `claude.agent` in one-shot mode.

## Files

- `README.md`
- `run.ts`
- `flow.yaml`
- `prompts/*`

## Run

```bash
bun run lesson:06
```

## Expected Output

- Process exits with code `0`
- Console prints `Lesson 06: PromptFile + Claude`
- Output includes `claude.agent` result text (non-empty)

## Assertions

- `outputs.<nodeId>.text` is non-empty
- No permission errors when resolving `promptFile`

## Gate

Required for Phase 4 tutorial gate.

## Notes

Blocked until Claude auth issues are resolved; do not unblock even if wiring is restored.
