# Quickstart: Tech Debt Cleanup Sprint

**Feature Branch**: `009-tech-debt-cleanup`
**Date**: 2025-12-27

## Overview

This guide provides step-by-step execution procedures for the tech debt cleanup sprint. Follow the work streams in order.

---

## Pre-Cleanup Verification

Run before starting any cleanup work:

```bash
# Verify current test state
cd packages/sdk
bun run test           # Should pass (unit + replay)
bun run typecheck      # Should pass
bun run lint           # Note any existing issues

# Record baseline metrics
time bun run test      # Note current duration
git log --oneline -20  # Note errant commits visible
```

---

## Work Stream 1: Test Infrastructure (FR-001 to FR-004)

### Goal
Convert `live-sdk.test.ts` to replay-based tests.

### Step 1.1: Verify Fixtures Exist

```bash
ls recordings/golden/coding-agent/
# Should show: add-two-numbers.json

ls recordings/golden/review-agent/
# Should show: review-add-function.json
```

### Step 1.2: Create Replay Test

Copy the test pattern from existing replay tests:

```typescript
// packages/sdk/tests/replay/live-sdk.replay.test.ts

import { describe, expect, test } from "bun:test";
import { CodingAgent } from "../../src/providers/anthropic/agents/coding-agent.js";
import { ReviewAgent } from "../../src/providers/anthropic/agents/review-agent.js";
import { createReplayContainer } from "../helpers/replay-runner.js";

describe("Agent Replay Tests (converted from live)", () => {
  test("CodingAgent replays with callbacks", async () => {
    const { container } = createReplayContainer(
      "golden/coding-agent",
      "add-two-numbers"
    );
    const coder = container.get(CodingAgent);

    const events: string[] = [];
    const result = await coder.execute(
      "Write a function that adds two numbers",
      "integration_test_session",
      {
        callbacks: {
          onStart: () => events.push("start"),
          onText: () => events.push("text"),
          onToolCall: (event) => events.push(`tool:${event.toolName}`),
          onComplete: () => events.push("complete"),
        },
      }
    );

    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(events).toContain("start");
    expect(events).toContain("complete");
  });

  test("ReviewAgent replays with callbacks", async () => {
    const { container } = createReplayContainer(
      "golden/review-agent",
      "review-add-function"
    );
    const reviewer = container.get(ReviewAgent);

    const events: string[] = [];
    const result = await reviewer.review(
      "Write a function that adds two numbers",
      "Created an add function that takes two parameters and returns their sum",
      "integration_test_session",
      {
        callbacks: {
          onStart: () => events.push("start"),
          onText: () => events.push("text"),
          onComplete: () => events.push("complete"),
        },
      }
    );

    expect(result).toBeDefined();
    expect(result.decision).toMatch(/^(approve|reject)$/);
    expect(events).toContain("start");
    expect(events).toContain("complete");
  });
});
```

### Step 1.3: Delete Original Live Test

```bash
rm packages/sdk/tests/integration/live-sdk.test.ts
```

### Step 1.4: Verify

```bash
bun run test  # Should pass, includes new replay test
time bun run test  # Should be < 60 seconds
```

---

## Work Stream 2: Git History Cleanup (FR-005 to FR-007)

### Goal
Remove errant commits and properly commit 008 work.

### Step 2.1: Commit Uncommitted 008 Work First

```bash
# Currently on 009-tech-debt-cleanup branch
git status  # Verify uncommitted files

# Stage and commit 008 work
git add .claude/commands/code-review.md AGENTS.md specs/ready/transport-architecture.md
git commit -m "docs(008): add remaining 008 documentation artifacts

Adds code review command, agents documentation, and transport architecture spec.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### Step 2.2: Document Errant Commits

The following commits should NOT exist on feature branches:

```
9be7eb2 feat: implement add function with input validation
fc50997 feat: implement addTwoNumbers function
1d975b5 - f209b97 - 28171b1 - 83375cf - 172aa3d - b16c093 - 7ac759c
(all "add function" variants)
```

**Decision**: Apply research.md R2 strategy (cherry-pick to clean branch):

```bash
# Only if these commits are blocking PR review or causing confusion:

# 1. Create backup of current branch state
git branch 009-backup-$(date +%Y%m%d)

# 2. Create clean branch from master
git checkout master
git checkout -b 009-tech-debt-cleanup-clean

# 3. Cherry-pick ONLY valid 009 cleanup commits (not errant add function commits)
git cherry-pick <valid-cleanup-commit-hashes>

# 4. Continue work on clean branch
# 5. After verification, rename branches
git branch -m 009-tech-debt-cleanup 009-tech-debt-cleanup-dirty
git branch -m 009-tech-debt-cleanup-clean 009-tech-debt-cleanup
```

**Alternative (if commits already pushed to shared remote)**: Document in retrospective, squash on merge to main. This avoids force-push risks in collaborative environments

### Step 2.3: Verify Branch State

```bash
git log --oneline -20  # All recent commits should relate to cleanup
```

---

## Work Stream 3: Deprecated Exports (FR-008 to FR-010)

### Goal
Remove unused deprecated exports, mark remaining with warnings.

### Step 3.1: Remove Unused Exports

**File: `packages/sdk/src/providers/anthropic/runner/anthropic-runner.ts`**

Remove the LiveSDKRunner alias (line 44):

```typescript
// DELETE this:
/**
 * @deprecated Use AnthropicRunner instead. This alias exists for migration.
 */
export const LiveSDKRunner = AnthropicRunner;
```

**File: `packages/sdk/src/index.ts`**

Remove the StreamCallbacks re-export (line 300-302):

```typescript
// DELETE this:
/**
 * @deprecated Use IAgentCallbacks instead. Will be removed in next major version.
 */
export type { StreamCallbacks } from "./callbacks/types.js";
```

### Step 3.2: Add Deprecation Warnings (FR-009)

For exports still in use internally, add runtime deprecation warnings:

**File: `packages/sdk/src/providers/anthropic/runner/base-agent.ts`**

Add constructor warning for BaseAgent:

```typescript
// In BaseAgent constructor (around line 65)
constructor(
  @inject(IAgentRunnerToken) protected readonly runner: IAgentRunner,
  @inject(IEventBusToken) protected readonly eventBus: IEventBus,
) {
  // FR-009: Emit deprecation warning
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
    console.warn(
      '[@openharness/sdk] BaseAgent is deprecated. Use BaseAnthropicAgent instead. ' +
      'See https://github.com/Open-Harness/sdk/blob/main/docs/deprecation-schedule.md'
    );
  }
}
```

**File: `packages/sdk/src/core/tokens.ts`**

For `IAgentRunnerToken`, deprecation is compile-time only (TypeScript type). Add JSDoc enhancement:

```typescript
/**
 * @deprecated Use IAnthropicRunnerToken instead.
 * Migration: Replace `container.bind(IAgentRunnerToken)` with `container.bind(IAnthropicRunnerToken)`
 * @see https://github.com/Open-Harness/sdk/blob/main/docs/deprecation-schedule.md
 */
export const IAgentRunnerToken = new InjectionToken<IAgentRunner>("IAgentRunner");
```

**Note**: Runtime warnings are suppressed in test environment (`NODE_ENV !== 'test'`) to avoid noise in test output

### Step 3.3: Remove Console Statements

**File: `packages/sdk/src/workflow/orchestrator.ts`**

Replace all console.log/warn/error with event emissions or remove entirely:

```typescript
// BEFORE:
console.log(`Starting Task: ${task.id}`);

// AFTER:
// Remove entirely - orchestrator should be silent
// Consumers use renderers to display progress
```

**File: `packages/sdk/src/monologue/anthropic-llm.ts`**

Remove console.error (line 63):

```typescript
// BEFORE:
console.error("[MonologueLLM] Generation error:", error);
return "";

// AFTER:
return "";  // Error already logged by caller via structured error handling
```

### Step 3.4: Verify

```bash
bun run typecheck  # Must pass
bun run test       # Must pass
grep -r "console\." packages/sdk/src/ | grep -v "\.test\." | grep -v "/\*"
# Should only show renderer files and CompositeRenderer
```

---

## Work Stream 4: Documentation (FR-011 to FR-012)

### Goal
Create deprecation schedule document.

### Step 4.1: Create Deprecation Schedule

```bash
mkdir -p docs
```

Create `docs/deprecation-schedule.md`:

```markdown
# Deprecation Schedule

Last updated: 2025-12-27

## Currently Deprecated

| Export | Replacement | Introduced | Removal Target |
|--------|-------------|------------|----------------|
| `BaseAgent` | `BaseAnthropicAgent` | 0.1.0 | 1.0.0 |
| `StreamCallbacks` (in base-agent) | `IAgentCallbacks` | 0.1.0 | 1.0.0 |
| `IAgentRunnerToken` | `IAnthropicRunnerToken` | 0.1.0 | 1.0.0 |

## Migration Guide

### BaseAgent → BaseAnthropicAgent

```typescript
// Before
import { BaseAgent } from "@openharness/sdk";

// After
import { BaseAnthropicAgent } from "@openharness/sdk";
```

### StreamCallbacks → IAgentCallbacks

The callback interface is identical; only the type name changed:

```typescript
// Before
const callbacks: StreamCallbacks = { onText: ... };

// After
const callbacks: IAgentCallbacks = { onText: ... };
```

### IAgentRunnerToken → IAnthropicRunnerToken

```typescript
// Before
container.bind(IAgentRunnerToken).toValue(runner);

// After
container.bind(IAnthropicRunnerToken).toValue(runner);
```

## Version History

- **0.1.0**: Initial release with original API
- **0.2.0** (planned): Remove deprecated exports marked for 1.0.0
```

### Step 4.2: Document Fixture Regeneration

Add to `docs/deprecation-schedule.md` or create `docs/test-fixtures.md`:

```markdown
## Test Fixture Regeneration

Golden recordings are captured from real LLM interactions and stored in `recordings/golden/`.

### When to Regenerate

- Agent prompt changes
- SDK message format changes
- New agent capabilities needed

### How to Regenerate

1. Modify `tests/integration/` tests to capture new behavior
2. Run with `bun run test:live`
3. Recordings are saved automatically via `recorder.saveCapture()`
4. Commit updated fixtures

### Fixture Structure

```
recordings/golden/
├── coding-agent/
│   └── add-two-numbers.json    # CodingAgent scenario
├── parser-agent/
│   └── *.json                  # ParserAgent scenarios
└── review-agent/
    └── review-add-function.json # ReviewAgent scenario
```
```

---

## Final Verification

After completing all work streams:

```bash
cd packages/sdk

# Full test suite
bun run test        # Must pass
time bun run test   # Must be < 60 seconds

# Type checking
bun run typecheck   # Must pass

# Lint
bun run lint        # Must pass

# Verify console statements removed
grep -r "console\." src/ | grep -v "/\*" | grep -v "renderer\|RenderOutput\|CompositeRenderer"
# Should return empty or only legitimate renderers

# Verify deprecation doc exists
cat docs/deprecation-schedule.md

# Check git log
git log --oneline -10  # All commits should relate to cleanup
```

---

## Success Criteria Checklist

- [ ] SC-001: `bun run test` completes in < 60 seconds
- [ ] SC-002: Zero test failures from network issues
- [ ] SC-003: All commits on branch relate to cleanup
- [ ] SC-004: Deprecated exports reduced by 50%
- [ ] SC-005: Zero console statements in production (except renderers)
- [ ] SC-006: `docs/deprecation-schedule.md` exists
