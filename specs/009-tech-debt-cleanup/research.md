# Research: Tech Debt Cleanup Sprint

**Feature Branch**: `009-tech-debt-cleanup`
**Date**: 2025-12-27

## Research Summary

Three unknowns identified and resolved during Phase 0 planning.

---

## R1: Test Migration Strategy

**Question**: How to convert `live-sdk.test.ts` from making real LLM calls to using replay-based fixtures?

### Decision

Move `live-sdk.test.ts` content to `agents.replay.test.ts` and delete the live file - the fixtures already exist and the pattern is proven.

### Rationale

The conversion is trivial because:

1. **Fixtures pre-exist**: The live tests already generated the exact fixtures needed
   - `recordings/golden/coding-agent/add-two-numbers.json`
   - `recordings/golden/review-agent/review-add-function.json`

2. **Pattern proven**: `agents.replay.test.ts` already demonstrates the EXACT pattern
   - Uses `createReplayContainer()` instead of `createRecordingContainer()`
   - Rest of the test is identical (same agents, same assertions)
   - Tests complete in <1s vs 120s timeout

3. **Zero behavior change**: Replay tests validate the SAME behavior
   - Same event callbacks (onStart, onText, onComplete, onToolCall)
   - Same result assertions (summary, decision, feedback)
   - Same agents under test (CodingAgent, ReviewAgent)

4. **Clean separation maintained**:
   - `bun run test` excludes `integration/` directory (already configured)
   - Deleting the live test removes network dependency from default test suite

### Implementation

Simple find-replace:
- `createRecordingContainer` → `createReplayContainer`
- Remove `recorder.startCapture/saveCapture` calls
- Move file from `tests/integration/` to `tests/replay/`
- Remove timeout config (replay is instant)

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Keep live tests but skip by default | Still requires maintaining parallel test files; fixtures can drift |
| Mock LLM responses inline | Replay fixtures are superior - they capture REAL interactions including tool calls |
| Use VCR/cassette-style recording | The existing GoldenReplayRunner IS a cassette pattern - reinventing wasted effort |

---

## R2: Git History Cleanup Strategy

**Question**: Best approach for removing errant "add function" commits from feature branches without disrupting collaboration?

### Decision

Create fresh feature branches from main and selectively cherry-pick only valid commits (avoid force push).

### Rationale

This approach is safest for collaborative environments because:

1. **Avoids History Rewriting**: Cherry-picking creates new commits rather than rewriting existing ones
2. **Surgical Precision**: Select exactly which commits to keep (valid feature work) and leave behind errant commits
3. **No Force Push Required**: Creating a new clean branch allows normal push without `--force`
4. **Preserves Uncommitted 008 Work**: Current 008 work can be committed on the clean branch
5. **Audit Trail**: Original polluted branches can be backed up before deletion

### Errant Commits Identified

From `git log --oneline --all --grep="add" -i`:

```
9be7eb2 feat: implement add function with input validation
fc50997 feat: implement addTwoNumbers function
1d975b5 feat: implement add function for adding two numbers
f209b97 feat: implement add function for two numbers
28171b1 feat: add function to add two numbers
83375cf feat: implement add function for adding two numbers
172aa3d feat: implement add function for two numbers
b16c093 feat: implement add function for two numbers
7ac759c feat: implement add function for adding two numbers
```

### Workflow

```bash
# 1. Create backup
git branch 008-backup 008-unified-event-system

# 2. Create clean branch from main
git checkout -b 008-unified-event-system-clean main

# 3. Cherry-pick ONLY valid 008 commits
git cherry-pick 2b31c7d  # docs(008): add unified event system spec
git cherry-pick 947fec7  # feat(008): implement UnifiedEventBus
git cherry-pick 6218b6e  # feat(008): implement defineRenderer factory
git cherry-pick f66807b  # test(008): add unit and integration tests
git cherry-pick 471b7b8  # feat(008): update providers and recordings

# 4. Commit uncommitted 008 work
git add -A && git commit -m "feat(008): complete unified event system"

# 5. Push clean branch (no --force)
git push origin 008-unified-event-system-clean

# 6. After verification, delete old branch
git branch -D 008-unified-event-system
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Interactive Rebase + Force Push | Force push dangerous in collaborative environments; risk of data loss |
| Git Revert | Doesn't remove commits from history; creates bloated commit/revert pairs |

---

## R3: Console.log Removal Strategy

**Question**: Which `console.log/error/warn` statements should be removed vs. kept?

### Decision

Remove ALL `console.*` statements from production runtime code. Keep ONLY in:
1. Renderer classes whose explicit purpose is terminal output
2. CompositeRenderer error isolation pattern
3. JSDoc example code blocks (documentation, not runtime)

### Categories

#### REMOVE (~20 instances in production runtime code)

| File | Lines | Action |
|------|-------|--------|
| `workflow/orchestrator.ts` | 42, 46, 52, 55, 60, 66, 72, 74 | Replace with event emissions |
| `factory/workflow-builder.ts` | 125 | Throw or emit error event |
| `monologue/anthropic-llm.ts` | 63 | Remove (already returns empty string) |
| `core/unified-event-bus.ts` | 189 | Emit error events instead |
| `harness/harness-instance.ts` | 186 | Emit warning events |
| `core/replay-runner.ts` | 70 | Throw error instead of warn + fallback |
| `factory/wrap-agent.ts` | 98 | Emit error events |

#### KEEP (~3 files with legitimate terminal output)

| File | Reason |
|------|--------|
| `harness/console-renderer.ts` | Class PURPOSE is console output |
| `harness/render-output.ts` | Default writer, allows custom injection |
| `harness/composite-renderer.ts` | Error isolation pattern for multi-renderer chains |

#### IGNORE (~30 instances in JSDoc)

All `@example` blocks in JSDoc comments - documentation only, not runtime code.

### Rationale

SC-005 states "Zero console.log or console.error statements in production source files (excluding error handlers)". Best practices for libraries:

1. Production libraries should NOT log to stderr/stdout - pollutes consuming applications
2. Console logging lacks structure, levels, context for production use
3. Libraries should emit events or throw errors, letting consumers decide handling
4. Console statements in catch blocks swallow errors instead of propagating them

### CompositeRenderer Exception Justification

CompositeRenderer follows the "error isolation" pattern where `console.error` is acceptable because:
- It dispatches to multiple renderers that may fail independently
- Throwing would break other renderers in the chain
- Consumer expects all renderers to attempt execution despite individual failures
- These are truly exceptional conditions (implementation bugs), not normal control flow

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Keep console.error in error handlers | Libraries shouldn't write to stderr - makes consumers lose control |
| Add configurable logger interface | Overengineered; UnifiedEventBus already provides event-driven communication |
| Strip at build time with Terser | Masks problem rather than fixing it; leaves confusing code in source |

---

## Research Confidence

All three decisions are **HIGH CONFIDENCE** based on:
- Existing codebase patterns that already solve similar problems
- Industry best practices from authoritative sources
- Alignment with constitution principles (especially "Verified by Reality")
