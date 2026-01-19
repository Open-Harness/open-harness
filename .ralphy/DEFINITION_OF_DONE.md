Yes, you definitely should update those. Carry on.# Definition of Done - PRD Workflow DX

> Reference: `docs/internal/MENTAL_MODEL.md`

---

## The Goal

**A developer can run the PRD workflow end-to-end with three modes:**

```bash
# LIVE - Runs against real Claude API
bun run prd:live examples/hello-world.prd.md

# RECORD - Runs live AND persists signals to SqliteSignalStore
bun run prd:record examples/hello-world.prd.md
# Output: "Recording saved: rec_xxxxx"

# REPLAY - Replays from recording, zero network calls
bun run prd:replay rec_xxxxx
# Output: Identical to original run, instant
```

---

## Done When

**Single sentence:** Record a PRD workflow, replay it, get identical results.

**Verification:**
```bash
# 1. Record
bun run prd:record examples/hello-world.prd.md > live.txt
# Note the recording ID

# 2. Replay
bun run prd:replay rec_xxxxx > replay.txt

# 3. Compare (should match, except timing)
diff live.txt replay.txt
```

---

## Acceptance Criteria

### AC1: CLI Works

- [ ] `package.json` has scripts: `prd:live`, `prd:record`, `prd:replay`
- [ ] CLI accepts a PRD file path
- [ ] CLI outputs progress
- [ ] CLI exits with success/failure status

### AC2: Uses Handler Pattern

- [ ] No `reducers/` folder - replaced with `handlers/`
- [ ] No `processes/` folder - handlers return signals
- [ ] Handlers mutate state directly (no spread operators)
- [ ] Handlers return `Signal[]` for follow-up emissions

Example of correct handler:
```typescript
const handlers = {
  "task:completed": (signal, state) => {
    state.tasks[signal.payload.taskId].status = "complete";
    return [{ name: "review:start", payload: { taskId: signal.payload.taskId } }];
  },
};
```

### AC3: Type Safety (No Casts)

- [ ] Signal payloads typed via generics
- [ ] No `as FooPayload` casts in handler code
- [ ] TypeScript catches payload mismatches at compile time

### AC4: SqliteSignalStore Works

- [ ] `SqliteSignalStore` class implements `SignalStore`
- [ ] Recordings persist to `.db` file
- [ ] Can query by ID, name, tags
- [ ] Works across process restarts

### AC5: Recording Works

- [ ] `mode: "record"` captures all signals
- [ ] Recording stored in SqliteSignalStore
- [ ] Returns `recordingId` for later replay

### AC6: Replay is Deterministic

- [ ] `mode: "replay"` uses stored signals
- [ ] NO Claude API calls during replay
- [ ] Final state identical to original run
- [ ] Signal history identical to original run
- [ ] Fast (< 1 second for simple PRD)

### AC7: Sandbox Isolation

- [ ] Generated code goes to gitignored directory
- [ ] Main repo never polluted
- [ ] Recordings ARE committed (they're fixtures)

---

## Example PRD for Testing

```markdown
# Hello World PRD

## Overview
Create a TypeScript function that returns "Hello, World!"

## Tasks

### Task 1: Create the function
- Create `src/hello.ts`
- Export function `hello()` that returns "Hello, World!"

### Task 2: Add tests
- Create `src/hello.test.ts`
- Test that `hello()` returns "Hello, World!"

## Milestones

### Milestone 1: Function works
- Tasks: 1, 2
- Test: `bun test src/hello.test.ts`
```

---

## Verification Steps

### Step 1: Run Live
```bash
bun run prd:live examples/hello-world.prd.md
```
- [ ] Claude is called
- [ ] Tasks execute
- [ ] Code appears in sandbox
- [ ] Workflow completes

### Step 2: Run Record
```bash
bun run prd:record examples/hello-world.prd.md
```
- [ ] Same as live mode
- [ ] Outputs: "Recording saved: rec_xxxxx"
- [ ] Recording in SQLite database

### Step 3: Run Replay
```bash
bun run prd:replay rec_xxxxx
```
- [ ] NO Claude API calls
- [ ] Same output as original
- [ ] Fast (< 1 second)

### Step 4: Compare
```bash
diff live.txt replay.txt
```
- [ ] Outputs match (except timing)

---

## Out of Scope

- Multiple agents (one "coder" agent is fine)
- Complex PRDs with task dependencies
- GitHub integration
- Parallel task execution
- Discovery/emergent tasks

---

## Summary Checklist

Before marking done:

- [ ] `bun run prd:live` works
- [ ] `bun run prd:record` saves to SQLite
- [ ] `bun run prd:replay` replays without network
- [ ] Replay output matches live output
- [ ] Handlers pattern used (no reducers/processes split)
- [ ] No type casts in handler code
- [ ] Generated code in gitignored sandbox
- [ ] Recordings committed as fixtures
