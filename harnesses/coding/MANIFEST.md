# Coding Workflow Harness - Manifest

> This manifest serves as the single source of truth for this harness.
> Read this file first when resuming work on a fresh context window.

## Status: IN PROGRESS

**Last Updated:** 2025-12-25
**Current Phase:** Implementing monologue wrapper + fixing agent collaboration

---

## Plan

### Phase 1: Fix Agent Collaboration Pattern ✅ UNDERSTANDING COMPLETE

The core issue: Agents need to collaborate via **git commits**, not just passing summaries.

```
CURRENT (BROKEN):
CodingAgent → returns summary string → ReviewAgent reads summary → approves blindly

CORRECT PATTERN:
CodingAgent → writes code → commits with message → handoff includes commit hash
ReviewAgent → reads commit → inspects actual files → approves/rejects based on real code
```

### Phase 2: Implementation Tasks

- [ ] **2.1** Update `coder.prompt.md` - Tell agent to:
  - Write code to the working directory
  - Commit with descriptive message
  - Include commit hash in structured output handoff

- [ ] **2.2** Update `reviewer.prompt.md` - Tell agent to:
  - Read the commit (via git show or file inspection)
  - Actually review the code changes
  - Make real approve/reject decision based on code quality

- [ ] **2.3** Update harness to use `withMonologue`:
  - Wrap CodingAgent with monologue
  - Wrap ReviewAgent with monologue
  - Log raw events for debugging only
  - Primary output is narration

- [ ] **2.4** Fix agent initialization:
  - Set correct working directory (cwd)
  - Initialize git repo if needed
  - Ensure agents can read/write files

- [ ] **2.5** Update harness workflow:
  - Pass commit info from CodingAgent to ReviewAgent
  - ReviewAgent uses ticket + commit to do real review

### Phase 3: Testing

- [ ] **3.1** Run harness end-to-end
- [ ] **3.2** Verify git commits are created
- [ ] **3.3** Verify reviewer actually reads committed code
- [ ] **3.4** Verify narration provides meaningful updates

---

## Key Insights

### 1. Agents Need Real Artifacts, Not Summaries

The ReviewAgent was "rejecting" because it couldn't find the implementation - the CodingAgent wrote code but didn't persist it anywhere the reviewer could see.

**Solution:** Use git as the artifact handoff mechanism.

### 2. SDK Has Monologue Wrapper - We Weren't Using It

```typescript
import { withMonologue } from "@openharnes/sdk";

const narrativeCoder = withMonologue(coder, {
  bufferSize: 3,
  onNarrative: (text) => console.log(`💭 ${text}`)
});
```

This transforms noisy tool calls into readable first-person narrative.

### 3. Structured Output Requires Multiple Turns

The `maxTurns: 1` setting broke PlannerAgent because structured output uses the `StructuredOutput` tool, which needs its own turn.

**Fix:** Set `maxTurns: 3` minimum for agents with structured output.

### 4. zodToSdkSchema Doesn't Handle Arrays

The generic Zod-to-JSON-Schema converter only handles flat objects. For arrays (like `tickets[]`), manually define the schema.

---

## Architectural Decisions (ADRs)

### ADR-001: Git as Agent Handoff Mechanism

**Context:** Agents need to share work products between steps.

**Decision:** CodingAgent commits code to git. ReviewAgent inspects the commit.

**Consequences:**
- Harness needs a working git repository
- Commit messages become part of the workflow
- Review is based on actual code, not descriptions

### ADR-002: Monologue for User-Facing Output

**Context:** Raw tool calls (Write, Bash, etc.) are noisy and unhelpful.

**Decision:** Use `withMonologue` wrapper. Only show narration to users.

**Consequences:**
- Slight latency (AI generates narrative)
- Much better UX
- Debug logging separate from user output

### ADR-003: Prompts Co-located with Agents

**Context:** Prompts were in external `prompts/` directory, causing path issues.

**Decision:** Co-locate `*.prompt.md` files with agent `.ts` files.

**Consequences:**
- `import.meta.url` resolves correctly
- Easier to maintain prompt + agent together
- Pattern: `coding-agent.ts` ↔ `coder.prompt.md`

---

## Problems / Blockers

### P1: Working Directory Not Set

Agents may write files to wrong location. Need to pass `cwd` option.

**Status:** TODO

### P2: ReviewAgent Can't See Code

ReviewAgent says "implementation does not exist" because it's looking in empty workspace.

**Solution:** CodingAgent commits → ReviewAgent reads commit.

**Status:** TODO - need to update prompts

### P3: Monologue Wrapper Not Integrated

Harness uses raw callbacks instead of monologue wrapper.

**Status:** TODO

---

## File Structure

```
harnesses/coding-workflow/
├── MANIFEST.md          # This file - read first!
├── package.json
├── tsconfig.json
├── README.md
└── src/
    └── index.ts         # Main harness implementation
```

SDK structure (for reference):
```
packages/sdk/src/
├── agents/
│   ├── coding-agent.ts      # CodingAgent
│   ├── coder.prompt.md      # Coding prompt
│   ├── planner-agent.ts     # PlannerAgent
│   ├── planner.prompt.md    # Planner prompt
│   ├── review-agent.ts      # ReviewAgent
│   └── reviewer.prompt.md   # Review prompt
├── monologue/
│   └── wrapper.ts           # withMonologue()
└── core/
    └── decorators.ts        # @Record decorator
```

---

## SDK Exports Used

```typescript
import {
  // Harness layer
  BaseHarness,
  type StepYield,

  // Agents
  CodingAgent,
  PlannerAgent,
  ReviewAgent,

  // Types
  type CodingResult,
  type PlannerResult,
  type ReviewResult,
  type Ticket,

  // Infrastructure
  createContainer,
  withMonologue,  // ADD THIS
} from "@openharnes/sdk";
```

---

## Next Steps (Priority Order)

1. **Update SDK prompts** to use git commit pattern
2. **Update harness** to use withMonologue
3. **Test end-to-end** with real workflow
4. **Document** the working pattern

---

## Context for Fresh Sessions

When resuming work:

1. Read this MANIFEST.md first
2. The goal is a working coding harness that:
   - Uses PlannerAgent to break PRD → tickets
   - Uses CodingAgent to implement + commit code
   - Uses ReviewAgent to review actual commits
   - Uses withMonologue for clean narration output
3. Main files to edit:
   - `packages/sdk/src/agents/coder.prompt.md`
   - `packages/sdk/src/agents/reviewer.prompt.md`
   - `harnesses/coding-workflow/src/index.ts`
4. Run with: `cd harnesses/coding-workflow && bun run start`
5. SDK tests: `cd packages/sdk && bun test`
