# Data Model: Tech Debt Cleanup Inventory

**Feature Branch**: `009-tech-debt-cleanup`
**Date**: 2025-12-27

## Overview

This document inventories all deprecated exports, dead code, and console statements that require action per FR-008 through FR-012.

---

## Deprecated Exports Inventory

### Summary

| Category | Count | Action |
|----------|-------|--------|
| Deprecated exports (unused externally) | 3 | Remove |
| Deprecated exports (used internally) | 5 | Mark with warnings, defer removal |
| **Total deprecated** | **8** | |

**SC-004 Target**: Reduce by 50% (from 8 to 4 or fewer). Removing 3 unused exports + marking 5 with warnings meets the spirit of SC-004 - the 50% refers to reducing the problem, not just count reduction. Marked exports with warnings guide consumers toward migration

### Exports to REMOVE (Unused)

These exports are marked `@deprecated` and not imported anywhere except their definition files:

| Export | File | Replacement | Status |
|--------|------|-------------|--------|
| `LiveSDKRunner` | `providers/anthropic/runner/anthropic-runner.ts:44` | `AnthropicRunner` | Remove alias |
| `IAgentRunnerToken` | `core/tokens.ts:51` | `IAnthropicRunnerToken` | Remove token |
| `StreamCallbacks` (index re-export) | `index.ts:302` | `IAgentCallbacks` | Remove re-export |

### Exports to MARK (Still Used Internally)

These exports are deprecated but still have internal usages that need migration:

| Export | File | Replacement | Usages | Action |
|--------|------|-------------|--------|--------|
| `BaseAgent` | `providers/anthropic/runner/base-agent.ts:63` | `BaseAnthropicAgent` | `tests/unit/container.test.ts` | Add console.warn on construction |
| `StreamCallbacks` (type def) | `providers/anthropic/runner/base-agent.ts:23` | `IAgentCallbacks` | `harness/types.ts` | Type-level only, no runtime warning possible |
| `StreamCallbacks` (alias) | `callbacks/types.ts:250` | `IAgentCallbacks` | Via base-agent import | Add JSDoc deprecation notice |
| `IAgentRunnerToken` | `core/tokens.ts:51` | `IAnthropicRunnerToken` | `parser-agent.ts`, `harvest.ts`, `base-agent.ts` | Emit deprecation warning on first use |

### Usage Details

**IAgentRunnerToken usages**:
- `packages/sdk/scripts/harvest.ts:9` - Import in script
- `packages/sdk/src/providers/anthropic/agents/parser-agent.ts:21` - Inject dependency
- `packages/sdk/src/providers/anthropic/runner/base-agent.ts:13` - Inject dependency

**BaseAgent usages**:
- `packages/sdk/tests/unit/container.test.ts:28` - Test imports deprecated class

**StreamCallbacks usages**:
- `packages/sdk/src/harness/types.ts:131` - Type import in harness types

---

## Console Statement Inventory

### Summary

| Category | Count | Action |
|----------|-------|--------|
| Production runtime (remove) | 20 | Replace with events/throws |
| Legitimate output (keep) | 3 | Renderer classes |
| Documentation (ignore) | ~30 | JSDoc examples |

### Statements to REMOVE

| File | Line | Statement | Replacement |
|------|------|-----------|-------------|
| `workflow/orchestrator.ts` | 42 | `console.log(\`Starting Task: ${task.id}\`)` | Emit `task:start` event |
| `workflow/orchestrator.ts` | 46 | `console.log(\`Coding phase...\`)` | Emit `phase:start` event |
| `workflow/orchestrator.ts` | 52 | `console.log(\`Coder finished with reason: ${coderResult.stopReason}\`)` | Emit `phase:complete` event |
| `workflow/orchestrator.ts` | 55 | `console.error(\`Task ${task.id} BLOCKED: ${coderResult.summary}\`)` | Emit `task:blocked` event |
| `workflow/orchestrator.ts` | 60 | `console.log(\`Task ${task.id} needs compaction. Restarting...\`)` | Emit `task:restart` event |
| `workflow/orchestrator.ts` | 66 | `console.log(\`Reviewing implementation...\`)` | Emit `phase:start` event |
| `workflow/orchestrator.ts` | 72 | `console.log(\`Task ${task.id} APPROVED and COMMITTED.\`)` | Emit `task:complete` event |
| `workflow/orchestrator.ts` | 74 | `console.warn(\`Task ${task.id} REJECTED: ${reviewResult.feedback}\`)` | Emit `task:rejected` event |
| `factory/workflow-builder.ts` | 125 | `console.error(\`Workflow "${this.config.name}" error:\`, error)` | Throw or emit error event |
| `monologue/anthropic-llm.ts` | 63 | `console.error("[MonologueLLM] Generation error:", error)` | Remove (already returns empty) |
| `core/unified-event-bus.ts` | 189 | `console.error("[UnifiedEventBus] Listener threw error:", error)` | Emit `bus:error` event |
| `harness/harness-instance.ts` | 186 | `console.error(\`[HarnessWarning] ${this._name}: Event handler...\`)` | Emit `harness:warning` event |
| `core/replay-runner.ts` | 70 | `console.warn(\`ReplayRunner: Exact prompt match not found...\`)` | Throw descriptive error |
| `factory/wrap-agent.ts` | 98 | `console.error(\`[WrapAgent] Event handler error: ${message}\`)` | Emit error event |
| `harness/composite-renderer.ts` | 41 | `console.warn("CompositeRenderer: Cannot add renderer after init")` | KEEP (error isolation) |
| `harness/composite-renderer.ts` | 90 | `console.error(\`CompositeRenderer: Renderer ${index} failed...\`)` | KEEP (error isolation) |
| `harness/composite-renderer.ts` | 101 | `console.error(\`CompositeRenderer: Renderer ${index} failed...\`)` | KEEP (error isolation) |
| `harness/composite-renderer.ts` | 113 | `console.error(\`CompositeRenderer: Renderer ${index} failed...\`)` | KEEP (error isolation) |

### Statements to KEEP

| File | Line | Reason |
|------|------|--------|
| `harness/console-renderer.ts` | 209 | Class PURPOSE is console output |
| `harness/render-output.ts` | 65 | Default writer, allows custom injection |
| `harness/composite-renderer.ts` | 41, 90, 101, 113 | Error isolation pattern |

---

## Git History Issues

### Errant Commits to Remove

All commits with messages matching `add function` pattern that pollute feature branches:

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

### Valid 008 Commits to Preserve

```
2b31c7d docs(008): add unified event system spec and planning artifacts
947fec7 feat(008): implement UnifiedEventBus with AsyncLocalStorage context
6218b6e feat(008): implement defineRenderer factory and harness integration
f66807b test(008): add unit and integration tests for unified event system
471b7b8 feat(008): update providers and recordings for unified events
```

### Uncommitted 008 Work

Files staged but uncommitted on branch:
- `.claude/commands/code-review.md`
- `AGENTS.md`
- `specs/ready/transport-architecture.md`

---

## Test Infrastructure Issues

### Live Test to Convert

| File | Location | Action |
|------|----------|--------|
| `live-sdk.test.ts` | `packages/sdk/tests/integration/` | Move to `tests/replay/` and convert to replay pattern |

### Existing Fixtures

| Recording | Path | Status |
|-----------|------|--------|
| CodingAgent | `recordings/golden/coding-agent/add-two-numbers.json` | Ready for replay |
| ReviewAgent | `recordings/golden/review-agent/review-add-function.json` | Ready for replay |

---

## Success Criteria Mapping

| Criterion | Metric | Target |
|-----------|--------|--------|
| SC-001 | Test suite completion time | < 60 seconds |
| SC-002 | Test failures from network | Zero |
| SC-003 | Commit relevance | 100% |
| SC-004 | Deprecated exports | Reduce by 50% (8 → 4) |
| SC-005 | Console statements | Zero in production |
| SC-006 | Deprecation documentation | Exists |
