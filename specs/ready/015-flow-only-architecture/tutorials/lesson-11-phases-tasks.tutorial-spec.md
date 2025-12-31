# Lesson 11: Phases + Tasks Tutorial Specification

**Lesson**: `packages/kernel-tutorial/lessons/11-phases-tasks`  
**Last Updated**: 2025-12-31  
**Status**: Draft

## Goal

Demonstrate phase/task lifecycle grouping.

## Files

- `README.md`
- `run.ts`

## Run

```bash
bun run lesson:11
```

## Expected Output

- Process exits with code `0`
- Console prints `Lesson 11: Phases + Tasks`
- Output includes `Runtime result:` with:
  - `plan === "Define milestones"`
  - `build === "Ship it"`

## Assertions

- `result.plan === "Define milestones"`
- `result.build === "Ship it"`

## Gate

Required for Phase 6 tutorial gate.
