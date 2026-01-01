# Next Cycle Inputs

**Source**: Retrospective decisions from 003-harness-renderer
**Generated**: 2025-12-26T14:30:00Z

---

## Priority 1: Context Scout + Verification Gates

**Root Causes Addressed**: RC003, RC005

### Decision

Create new `/oharnes.implement` command using controller pattern with proactive context loading and verification gates.

### Key Insight

> Reactive verification (type checkers, test gates) catches problems after they happen.
> Proactive context loading prevents problems before they arise by ensuring the agent only sees the right context for each task.

### Implementation

1. **Create `/oharnes.implement` command** (controller pattern)
   - Follow `/oharnes.retro` as template
   - Controller orchestrates, never loads full codebase context
   - Phase-based execution with sub-agent delegation

2. **Create Context Scout sub-agent** (`oharnes.implement:context-scout`)
   - Input: Task from tasks.md
   - Output: Minimal context manifest (which files, which spec sections)
   - Prevents prototype contamination by excluding irrelevant files

3. **Create Task Implementer sub-agent** (`oharnes.implement:task-implementer`)
   - Input: Task + minimal context from scout
   - Output: Implementation + file paths created/modified
   - Fresh context per task

4. **Create Verification sub-agent** (`oharnes.implement:verifier`)
   - Input: Task + implementation result
   - Output: Verification report (paths match? tests pass?)
   - Runs after each task completion

5. **Add verification gates to controller**
   - Pre-commit: Run `bun test`, block if failures
   - Task completion: Verify tasks marked `[X]`
   - Path verification: Confirm task file paths match actual
   - Add `--skip-tests` flag for override

### Files to Create

```
.claude/commands/oharnes.implement.md       # Controller command
.claude/agents/oharnes-implement-scout.md   # Context scout agent
.claude/agents/oharnes-implement-task.md    # Task implementer agent
.claude/agents/oharnes-implement-verify.md  # Verification agent
```

### User Notes

- Don't modify canonical spec-kit commands - create our own opinionated versions
- Use sub-agents for context isolation (like `/oharnes.retro` pattern)
- Root cause is lack of systematic context loading, not just missing verification

---

## Priority 2: Monologue System (Dedicated Feature Cycle)

**Root Causes Addressed**: RC002, RC004

### Decision

Create `004-monologue-system` spec as separate feature cycle to implement the decorator-based narrative system.

### Implementation

1. **Create feature spec** (`specs/004-monologue-system/`)
   - spec.md: Decorator-based narrative generation
   - plan.md: Event-driven architecture, integration with TaskHarness
   - tasks.md: Implementation breakdown

2. **Core components to implement**
   - `src/providers/anthropic/monologue/types.ts` - MonologueConfig, MonologueMetadata
   - `src/providers/anthropic/monologue/prompts.ts` - DEFAULT, TERSE, VERBOSE presets
   - `src/providers/anthropic/monologue/generator.ts` - AnthropicMonologueGenerator
   - `src/providers/anthropic/monologue/decorator.ts` - @AnthropicMonologue decorator
   - `src/providers/anthropic/monologue/index.ts` - Barrel export

3. **Migration path**
   - Replace 20+ manual `emitNarrative()` calls with decorator
   - Leverage existing event system (harness:start, task:start, etc.)
   - Follow @Record decorator pattern in `core/decorators.ts`

### Design Reference

From original spec (plan.md:102-113):
```
@AnthropicMonologue intercepts agent callbacks
  → buffers events
  → calls LLM to generate narratives
  → emits task:narrative events
```

Current (manual) pattern to replace:
```typescript
this.emitNarrative("Harness", `Starting ${task.id}`, task.id, callbacks);
```

Target (decorator) pattern:
```typescript
@AnthropicMonologue(scope: 'harness')
async run(callbacks?: ITaskHarnessCallbacks): Promise<HarnessSummary>
```

---

## Priority 3: Documentation (Prototype Warning)

**Root Cause Addressed**: RC001

### Decision

Add documentation warning users about prototype code in context.

### Implementation

Add to project documentation (e.g., README or CONTRIBUTING.md):

```markdown
## Best Practices for Spec-Driven Development

### Prototype Isolation

When using spec-driven development with AI agents:

1. **Move prototypes out of workspace** before running `/implement`
2. **Use separate branches** for prototype/spike work (e.g., `spike/*`)
3. **Prototype code in context can cause architectural divergence** -
   the agent may port prototype structure instead of following specification

The 003-harness-renderer failure was caused by a working prototype in
`listr2/examples/harness-renderer/` influencing the implementation to
deviate from the specification.
```

---

## Suggested Spec Additions for Next Features

When creating future feature specs, consider including:

1. **Context Scope Section**
   - List directories to include in agent context
   - List directories to exclude (prototypes, examples, etc.)

2. **Verification Gates Section**
   - Define what validation must pass before commit
   - Specify test coverage expectations
   - List critical file paths that must exist

3. **Task Context Manifest**
   - Per-task context requirements
   - Which files the task implementation should read
   - Which files the task should NOT access

---

**Generated by**: /oharnes.close
