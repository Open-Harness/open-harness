# Epic Dependency Matrix: Runtime Refactoring Initiative

**Last Updated:** 2026-01-07  
**Total Beads:** 46 (after open-harness-9mq's 14)  
**Epics:** 5  
**Timeline:** 4-6 weeks (depending on parallelization)  
**Status:** Planning Phase

---

## Executive Summary

```
open-harness-9mq (COMPLETE ✅)
├── Runtime Reorganization (4 subsystems)
├── Error Handling Layer (CompilationError, ExecutionError, ExpressionError)
├── 101 Tests
└── 8 Comprehensive READMEs

    ├─ Epic 1: Transport Layer (12 beads) ────────────┐
    │  ├─ @internal/client                            │ Can start
    │  └─ @open-harness/client                        │ immediately
    │                                                  │
    ├─ Epic 2: Persistence Layer (8 beads) ──────────┤
    │  ├─ adapters/run-store/sqlite                   │
    │  └─ adapters/run-store/testing                  │
    │                                                  │
    ├─ Epic 3: Server Integration (12 beads) ────────┐
    │  ├─ @internal/server (depends: E1 + E2)        │ Start after
    │  └─ @open-harness/server                       │ E1 + E2 done
    │                                                 │
    ├─ Epic 4: Framework Integration (8 beads) ────┐
    │  ├─ @open-harness/react (depends: E3)        │ Start after
    │  └─ @open-harness/testing                    │ E3 done
    │                                               │
    └─ Epic 5: Final Pass & Validation (6 beads) ─┐
       ├─ Error propagation & SDK docs             │ Start after
       ├─ Migration guide                          │ E1-E4 done
       └─ Full E2E validation                      │
```

---

## Epic 1: Transport Layer (12 beads)

**Purpose:** Add neverthrow error handling to HTTP/SSE client layer  
**Dependencies:** open-harness-9mq ✅ (no blocking dependencies)  
**Timeline:** 40-60 hours  
**Parallelization:** Can run in parallel with Epic 2  
**Critical Path:** YES (blocks Epic 3)

### Bead Dependencies Graph

```
bd-xxxxx.1: @internal/client errors
  └─ bd-xxxxx.2: @internal/client Result methods
      ├─ bd-xxxxx.3: @internal/client documentation
      │   └─ bd-xxxxx.4: @internal/client tests
      │       └─ bd-xxxxx.5: @internal/client validation
      │
      └─ bd-xxxxx.6: @open-harness/client errors
          └─ bd-xxxxx.7: @open-harness/client Result methods
              ├─ bd-xxxxx.8: @open-harness/client documentation
              │   └─ bd-xxxxx.9: @open-harness/client tests
              │       └─ bd-xxxxx.10: @open-harness/client validation
              │
              └─ bd-xxxxx.11: Integration tests (E1 + E2)
                  └─ bd-xxxxx.12: Epic 1 final validation
```

### Detailed Bead Breakdown

| Bead | Task | Dependencies | Status | Effort | Notes |
|------|------|--------------|--------|--------|-------|
| 1.1 | @internal/client: Create error types | open-harness-9mq ✅ | Pending | 4h | HttpClientError, ClientTransportError (5-7 codes) |
| 1.2 | @internal/client: Add Result methods | 1.1 | Pending | 6h | wrapHttpThrow, all public classes get *Result variants |
| 1.3 | @internal/client: Document | 1.2 | Pending | 4h | README with examples, error codes, architecture |
| 1.4 | @internal/client: Test Result API | 1.3 | Pending | 6h | 25-30 tests covering all error paths |
| 1.5 | @internal/client: Validate & commit | 1.4 | Pending | 2h | typecheck, lint, test, push, beads sync |
| 1.6 | @open-harness/client: Create error types | 1.5 | Pending | 3h | Wraps @internal/client errors, adds SDK-level codes |
| 1.7 | @open-harness/client: Add Result methods | 1.6 | Pending | 5h | All public SDK client methods get Result variants |
| 1.8 | @open-harness/client: Document | 1.7 | Pending | 4h | README with SDK examples, error recovery |
| 1.9 | @open-harness/client: Test Result API | 1.8 | Pending | 6h | 25-30 tests, SDK-level integration scenarios |
| 1.10 | @open-harness/client: Validate & commit | 1.9 | Pending | 2h | typecheck, lint, test, push, beads sync |
| 1.11 | Transport layer integration tests | 1.10 | Pending | 4h | E2E tests for client + server communication |
| 1.12 | Epic 1 final validation & hand-off | 1.11 | Pending | 2h | Metadata sync, push to remote, beads close |

---

## Epic 2: Persistence Layer (8 beads)

**Purpose:** Add neverthrow error handling to SQLite & testing persistence layers  
**Dependencies:** open-harness-9mq ✅ (no blocking dependencies)  
**Timeline:** 30-40 hours  
**Parallelization:** Can run in parallel with Epic 1  
**Critical Path:** YES (blocks Epic 3)

### Bead Dependencies Graph

```
bd-xxxxx.13: adapters/run-store/sqlite errors
  └─ bd-xxxxx.14: adapters/run-store/sqlite Result methods
      ├─ bd-xxxxx.15: adapters/run-store/sqlite documentation
      │   └─ bd-xxxxx.16: adapters/run-store/sqlite tests
      │       └─ bd-xxxxx.17: adapters/run-store/sqlite validation
      │
      └─ bd-xxxxx.18: adapters/run-store/testing errors
          └─ bd-xxxxx.19: adapters/run-store/testing Result methods
              ├─ bd-xxxxx.20: adapters/run-store/testing documentation
              │   └─ bd-xxxxx.21: adapters/run-store/testing tests
              │       └─ bd-xxxxx.22: Epic 2 final validation
```

### Detailed Bead Breakdown

| Bead | Task | Dependencies | Status | Effort | Notes |
|------|------|--------------|--------|--------|-------|
| 2.1 | SQLite: Create error types | open-harness-9mq ✅ | Pending | 3h | PersistenceError (6-8 codes: DB_ERROR, SCHEMA_ERROR, etc.) |
| 2.2 | SQLite: Add Result methods | 2.1 | Pending | 5h | wrapPersistenceThrow on saveSnapshot, loadSnapshot, listSnapshots |
| 2.3 | SQLite: Document | 2.2 | Pending | 4h | README with connection patterns, migration guide |
| 2.4 | SQLite: Test Result API | 2.3 | Pending | 5h | 20-25 tests covering DB failures, migrations, constraints |
| 2.5 | SQLite: Validate & commit | 2.4 | Pending | 2h | typecheck, lint, test, push, beads sync |
| 2.6 | Testing store: Create error types | 2.5 | Pending | 2h | InMemoryPersistenceError (simpler, 3-4 codes) |
| 2.7 | Testing store: Add Result methods | 2.6 | Pending | 3h | Same StateStore interface, simpler error handling |
| 2.8 | Testing store: Document + tests + validate | 2.7 | Pending | 6h | Lightweight docs, 15-20 tests, single commit |

---

## Epic 3: Server Integration (12 beads)

**Purpose:** Add neverthrow error handling to server layer  
**Dependencies:** Epic 1 (Transport) ✅ + Epic 2 (Persistence) ✅  
**Timeline:** 50-70 hours  
**Parallelization:** Cannot start until E1 + E2 done  
**Critical Path:** YES (blocks Epic 4)

### Bead Dependencies Graph

```
bd-xxxxx.23: @internal/server errors
  └─ bd-xxxxx.24: @internal/server Result methods
      ├─ bd-xxxxx.25: @internal/server documentation
      │   └─ bd-xxxxx.26: @internal/server tests
      │       └─ bd-xxxxx.27: @internal/server validation
      │
      └─ bd-xxxxx.28: @open-harness/server errors
          └─ bd-xxxxx.29: @open-harness/server Result methods
              ├─ bd-xxxxx.30: @open-harness/server documentation
              │   └─ bd-xxxxx.31: @open-harness/server tests
              │       └─ bd-xxxxx.32: @open-harness/server validation
              │
              └─ bd-xxxxx.33: Integration with client + persistence
                  └─ bd-xxxxx.34: Epic 3 final validation
```

### Detailed Bead Breakdown

| Bead | Task | Dependencies | Status | Effort | Notes |
|------|------|--------------|--------|--------|-------|
| 3.1 | @internal/server: Create error types | E1 + E2 ✅ | Pending | 4h | ServerError, routing errors, integration errors |
| 3.2 | @internal/server: Add Result methods | 3.1 | Pending | 7h | All route handlers, middleware get Result variants |
| 3.3 | @internal/server: Document | 3.2 | Pending | 4h | README with server architecture, error propagation |
| 3.4 | @internal/server: Test Result API | 3.3 | Pending | 7h | 30+ tests with mocked client + persistence |
| 3.5 | @internal/server: Validate & commit | 3.4 | Pending | 2h | typecheck, lint, test, push, beads sync |
| 3.6 | @open-harness/server: Create error types | 3.5 | Pending | 3h | Wraps @internal/server + @internal/client errors |
| 3.7 | @open-harness/server: Add Result methods | 3.6 | Pending | 8h | Large module, all public methods get Result variants |
| 3.8 | @open-harness/server: Document | 3.7 | Pending | 5h | Comprehensive guide with usage examples |
| 3.9 | @open-harness/server: Test Result API | 3.8 | Pending | 8h | 35+ tests with real client + persistence scenarios |
| 3.10 | @open-harness/server: Validate & commit | 3.9 | Pending | 2h | typecheck, lint, test, push, beads sync |
| 3.11 | Server + client integration tests | 3.10 | Pending | 5h | E2E tests: client calls server, server uses persistence |
| 3.12 | Epic 3 final validation & hand-off | 3.11 | Pending | 2h | All subsystems integrated, no regressions |

---

## Epic 4: Framework Integration (8 beads)

**Purpose:** Add neverthrow error handling to React & testing utilities  
**Dependencies:** Epic 3 (Server) ✅  
**Timeline:** 35-45 hours  
**Parallelization:** Cannot start until E3 done  
**Critical Path:** YES (blocks Epic 5)

### Bead Dependencies Graph

```
bd-xxxxx.35: @open-harness/react errors
  └─ bd-xxxxx.36: @open-harness/react Result hooks
      ├─ bd-xxxxx.37: @open-harness/react documentation
      │   └─ bd-xxxxx.38: @open-harness/react tests
      │       └─ bd-xxxxx.39: @open-harness/react validation
      │
      └─ bd-xxxxx.40: @open-harness/testing errors
          └─ bd-xxxxx.41: @open-harness/testing Result utilities
              ├─ bd-xxxxx.42: @open-harness/testing documentation
              │   └─ bd-xxxxx.43: @open-harness/testing tests
              │       └─ bd-xxxxx.44: Epic 4 final validation
```

### Detailed Bead Breakdown

| Bead | Task | Dependencies | Status | Effort | Notes |
|------|------|--------------|--------|--------|-------|
| 4.1 | React: Create error types | E3 ✅ | Pending | 3h | HookError, ComponentError (React-specific codes) |
| 4.2 | React: Add Result hooks | 4.1 | Pending | 6h | useRuntime, useHarness, useEvents all get Result variants |
| 4.3 | React: Document | 4.2 | Pending | 4h | README with hook examples, error boundaries |
| 4.4 | React: Test Result hooks | 4.3 | Pending | 6h | 20+ tests with React Testing Library |
| 4.5 | React: Validate & commit | 4.4 | Pending | 2h | typecheck, lint, test, push, beads sync |
| 4.6 | Testing: Create error types + Result utils | 4.5 | Pending | 4h | TestError, test helper functions that return Result |
| 4.7 | Testing: Document + tests | 4.6 | Pending | 6h | Lightweight docs, 15-20 tests, single commit |
| 4.8 | Epic 4 final validation & hand-off | 4.7 | Pending | 2h | All framework code integrated |

---

## Epic 5: Final Pass & Validation (6 beads)

**Purpose:** Cross-cutting error handling, documentation, and comprehensive validation  
**Dependencies:** Epics 1-4 all complete ✅  
**Timeline:** 25-35 hours  
**Parallelization:** Cannot start until all E1-E4 done  
**Critical Path:** YES (release blocker)

### Bead Dependencies Graph

```
bd-xxxxx.45: Error propagation across boundaries
  ├─ bd-xxxxx.46: Master SDK documentation
  │   ├─ bd-xxxxx.47: Migration guide (breaking changes)
  │   └─ bd-xxxxx.48: Full E2E validation suite
  │       └─ bd-xxxxx.49: Performance validation
  │           └─ bd-xxxxx.50: Final cleanup & push
  │               └─ bd-xxxxx.51: Epic 5 completion
```

### Detailed Bead Breakdown

| Bead | Task | Dependencies | Status | Effort | Notes |
|------|------|--------------|--------|--------|-------|
| 5.1 | Error propagation validation | E1-E4 ✅ | Pending | 6h | Map error flows across all boundaries, ensure no loss |
| 5.2 | Master SDK README | 5.1 | Pending | 5h | Central doc listing all error types, recovery patterns |
| 5.3 | Migration guide | 5.2 | Pending | 4h | Document API changes (if any), backward compat notes |
| 5.4 | Full E2E validation suite | 5.3 | Pending | 8h | Complex scenarios: client→server→persistence→response |
| 5.5 | Performance validation | 5.4 | Pending | 4h | Ensure Result types don't slow down hot paths |
| 5.6 | Final cleanup & metadata sync | 5.5 | Pending | 2h | Update all READMEs, push, close epics, final beads sync |

---

## Parallelization Strategy

### Option A: Sequential (Safe, Predictable)
```
E1 (weeks 1-2) → E2 (weeks 1-2 parallel)
E3 (weeks 3-4)
E4 (weeks 5)
E5 (week 6)
Timeline: 6 weeks
```

### Option B: Aggressive Parallel (Fastest)
```
E1 + E2 (weeks 1-2) [parallel, no blocking]
E3 (weeks 3-4) [depends: E1+E2]
E4 (weeks 5) [depends: E3]
E5 (weeks 6) [depends: E1-E4]
Timeline: 6 weeks (same end, but E1+E2 truly parallel)
```

### Option C: Recommended Balanced
```
E1 (weeks 1-2) [critical client dependency]
E2 parallel with E1.9 (weeks 1-2) [no blocking]
E3 (weeks 3-4) [start after E1+E2 done]
E4 (week 5) [start after E3 done]
E5 (week 6) [start after E4 done]
Timeline: 6 weeks (good safety + parallelization)
```

---

## Dependency Rules

### Hard Dependencies (Block Work)
- Epic 2 **cannot** start before Epic 1.4 (client context)
- Epic 3 **cannot** start before Epic 1.5 + Epic 2.5 (both complete)
- Epic 4 **cannot** start before Epic 3.10 (server stable)
- Epic 5 **cannot** start before Epic 4.7 (all features done)

### Soft Dependencies (Same Epic, Sequential)
- Within Epic 1: each bead depends on previous bead's completion
- Within Epic 2: same as above
- Etc.

### No Dependencies (Can Parallelize)
- Epic 1 and Epic 2 can run in parallel
- Different beads within same epic can overlap (with caution)

---

## Hand-Off Template (For Each Bead)

Every bead will include this information in its Beads issue:

```
[bd-xxxxx.N] {Epic Name}: {Task Name}

WHAT IS THIS?
{1-2 sentence description of the work}

WHY DOES THIS MATTER?
{Why this bead exists, what it unblocks}

WHAT CHANGED IN DEPENDENCIES?
{What happened in earlier beads that affects this one}

YOUR ACCEPTANCE CRITERIA:
□ {Specific acceptance criterion 1}
□ {Specific acceptance criterion 2}
□ {Specific acceptance criterion 3}
... (5-7 total)

HOW TO DO IT:
{Step-by-step implementation guide}

HOW TO VALIDATE:
1. Run: bun run typecheck
2. Run: bun run lint
3. Run: bun run test
4. Run: git push
5. Verify: No regressions vs main branch

WHAT UNBLOCKS NEXT:
- bd-xxxxx.(N+1): {Next task name}
```

---

## Quality Gate Requirements (All Beads)

Every bead must achieve:
- ✅ Typecheck: 100% passing
- ✅ Lint: 0 issues
- ✅ Tests: 100% passing, no regressions
- ✅ Git: All changes committed and pushed
- ✅ Beads: Issue closed, synced to remote

---

## Timeline Summary

| Epic | Beads | Effort | Start | End | Blocking |
|------|-------|--------|-------|-----|----------|
| E1: Transport | 12 | 40-60h | Week 1 | Week 2 | YES (blocks E3) |
| E2: Persistence | 8 | 30-40h | Week 1 | Week 2 | YES (blocks E3) |
| E3: Server | 12 | 50-70h | Week 3 | Week 4 | YES (blocks E4) |
| E4: Framework | 8 | 35-45h | Week 5 | Week 5 | YES (blocks E5) |
| E5: Final | 6 | 25-35h | Week 6 | Week 6 | Release |

**Total:** 46 beads, 180-250 hours, 6 weeks (with parallelization)

---

## Critical Success Factors

1. **Clear Hand-offs** - Each bead has copy-paste ready instructions
2. **Dependency Awareness** - Teams know what they block/unblock
3. **Autonomous Execution** - Agents don't need to ask questions mid-task
4. **Rich Context** - Every bead includes "why" not just "what"
5. **Validated at Each Step** - No surprises at end
6. **Parallel Where Safe** - E1+E2 can truly run in parallel

---

## Next Steps

1. **Approve this matrix** (confirms dependencies are correct)
2. **Select parallelization strategy** (A/B/C above)
3. **Create detailed bead specs** (1 Epic at a time)
4. **Assign agents** (1 agent per epic or smaller groups)
5. **Begin Epic 1 + 2** (can start simultaneously)

**Ready to generate detailed Epic 1 specification with all 12 bead hand-off prompts?**
