# Problems & Misunderstandings - Immer + Handlers Feature

> Reference: `docs/internal/MENTAL_MODEL.md`

---

## Critical Misunderstandings

### 1. DX Test Was Misunderstood

**What we built:** Unit tests with mocks in `tests/dx-integration.test.ts`

**What was intended:** A real CLI experience that runs the PRD workflow end-to-end

The DX should be:
- A runnable CLI, not a vitest file
- Uses real Claude API (or replays real recordings)
- Actually writes code to a sandbox directory
- Demonstrates the full developer experience of using the SDK

```bash
bun run prd:live examples/hello-world.prd.md
bun run prd:record examples/hello-world.prd.md
bun run prd:replay rec_xxxxx
```

### 2. Recording/Replay Purpose Misunderstood

**What we built:** Mock harnesses that fake signals

**What was intended:** Real signal capture from live Claude calls, then replay those real signals

Recording should:
- Capture REAL signals from REAL Claude API calls
- Persist to SqliteSignalStore (not just memory)
- Enable deterministic replay without network
- Be the actual workflow for developers ("record once, replay in CI")

### 3. Reducer + ProcessManager Split Was Wrong

**What we built:** Two separate concepts:
- Reducers (update state)
- ProcessManagers (emit signals)

**What it should be:** One concept - **Handlers**

A handler:
1. Receives a signal and state
2. Mutates state directly (Immer handles immutability)
3. Returns new signals to emit

```typescript
// What we want - ONE thing
const handlers = {
  "task:completed": (signal, state) => {
    state.tasks[signal.payload.taskId].status = "complete";
    return [{ name: "review:start" }];
  },
};
```

See `docs/internal/MENTAL_MODEL.md` for the full pattern.

---

## Technical Problems

### 4. Type Casts Everywhere (No Real Type Safety)

**Location:** `packages/prd-workflow/src/reducers/*.ts`

Every reducer does this:
```typescript
const draft = state as DraftState;
const payload = signal.payload as PlanCreatedPayload;  // UNSAFE
```

The signal payload is `unknown` and cast instead of flowing through generics.

**Fix:** Define typed signals and have handlers receive typed payloads automatically.

### 5. No Persistent Store (SqliteSignalStore Missing)

**Current state:** Only `MemorySignalStore` exists (ephemeral)

**Needed:** `SqliteSignalStore` for:
- Persisting recordings across runs
- Committing fixtures to repo
- Production-grade durability

### 6. No CLI for PRD Workflow

There's no way to actually RUN the PRD workflow. Need:
- `bun run prd:live <prd-file>`
- `bun run prd:record <prd-file>`
- `bun run prd:replay <recording-id>`

### 7. No Sandbox for Generated Code

When the PRD workflow runs, where does the generated code go? Need:
- A gitignored sandbox directory
- Proper setup/teardown
- Isolation from main repo

### 8. Tests Violate Project Rules

**Rule from CLAUDE.md:** "You are NOT allowed to fabricate fixtures"

**What happened:** Created `createSimpleMockHarness()` and `createDeterministicMockHarness()`

The tests prove nothing about real SDK behavior.

---

## Structural Problems

### 9. Wrong Abstraction in prd-workflow

The current structure has:
```
packages/prd-workflow/src/
├── reducers/          ← Should not exist
│   ├── planning.ts
│   ├── execution.ts
│   └── review.ts
├── processes/         ← Should not exist
│   └── index.ts
└── ...
```

Should be:
```
packages/prd-workflow/src/
├── handlers/          ← Single concept
│   ├── planning.ts
│   ├── execution.ts
│   └── review.ts
└── ...
```

### 10. SDK Core Needs Update

The SDK currently has:
- `SignalReducer` type
- `ProcessManager` type
- Separate subscription logic for each

Should have:
- `SignalHandler` type (one thing)
- Returns `Signal[]` for emissions
- Immer wrapping built-in

---

## Process Problems

### 11. Ralphy Didn't Read CLAUDE.md

The task list didn't instruct Ralphy to read project rules before implementing.

### 12. No Clear Definition of Done

Tasks were marked "complete" without validating against acceptance criteria.

---

## What's Actually Working

Despite the issues, some things ARE correct:

1. ✅ Immer integration works (produce wrapping)
2. ✅ Signal bus and routing works
3. ✅ Recording/replay API exists (just needs SqliteSignalStore)
4. ✅ `examples/recording-replay/` is a working reference
5. ✅ The mental model is now clear (see `docs/internal/MENTAL_MODEL.md`)

---

## Summary of Required Changes

| Area | Change |
|------|--------|
| SDK Core | Consolidate Reducer + ProcessManager → Handler |
| prd-workflow | Rewrite with Handler pattern |
| Stores | Implement SqliteSignalStore |
| CLI | Add prd:live, prd:record, prd:replay scripts |
| Tests | Delete mock tests, use real recordings |
| Types | Flow signal types through generics (no casts) |
