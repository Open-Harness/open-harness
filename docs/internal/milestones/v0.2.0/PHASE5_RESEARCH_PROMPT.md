# Phase 5: Threaded Example Design

**Priority:** CRITICAL - This is the user's first impression of Open Harness
**Approach:** Fan-out research → Multi-criteria analysis → Synthesis → Design

---

## Your Mission

Design the **one example** that threads through all documentation levels and shows the full power of Open Harness. This example will be the reference point for every tutorial, guide, and API doc.

**DO NOT start implementing.** This prompt is about DESIGN.

---

## Protocol

### Step 1: Activate Context

```
Activate: prompting skill
Read: docs/internal/milestones/v0.2.0/archive/EXAMPLE_THREAD.md (the pattern)
Read: docs/internal/milestones/v0.2.0/archive/SDK_DX_DECISIONS.md (the decisions)
Read: docs/internal/milestones/v0.2.0/MANIFEST.md (current state)
Read: packages/internal/core/src/api/ (the actual API)
```

Understand:
- The progressive thread pattern (Levels 1-7)
- The locked decisions (agent, harness, run, vitest, fixtures)
- What code actually exists today

---

### Step 2: Fan-Out Research (Parallel Agents)

Spawn 5 research agents in parallel. Each explores ONE dimension:

#### Agent 1: Domain Analysis
```
Research question: What example domain resonates best with Open Harness users?

Explore:
- Code review (meta, developers understand it)
- Issue triage (practical, real workflow)
- Data extraction (structured output showcase)
- Content generation (creative, but less testable)
- API testing (technical, shows quality gates)

For each, analyze:
- How naturally does it support state?
- How naturally does it support structured output?
- How naturally does it support variant comparison?
- How relatable is it to target users (AI/agent builders)?

Output: Ranked list with rationale
```

#### Agent 2: Progressive Complexity Analysis
```
Research question: What's the right progression from Level 1 → Level 7?

Constraints:
- Level 1: Must work in < 10 lines
- Level 2: Must introduce state (fundamental decision)
- Level 3-4: Build complexity gradually
- Level 5-6: Show eval/comparison power
- Level 7: Full CI integration

For each level:
- What ONE concept does it teach?
- What code is added vs. previous level?
- What stays the same (continuity)?

Output: Level-by-level outline with concept and delta
```

#### Agent 3: DX Anti-Pattern Analysis
```
Research question: What should we AVOID in the example?

Read: docs/internal/milestones/v0.2.0/archive/DX_AUDIT_RESULTS.md
Read: Any retrospective docs for past friction

Identify:
- Brittle patterns (regex on LLM output)
- Confusing patterns (too many concepts at once)
- Unrealistic patterns (toy examples that don't scale)
- Missing patterns (things users will need but we don't show)

Output: Anti-pattern list with "instead do this" alternatives
```

#### Agent 4: Structured Output Analysis
```
Research question: How do we show structured output done RIGHT?

Explore:
- Zod schema integration
- Output validation
- Deterministic assertions on structured data
- How this enables reliable eval

Key insight: Structured output is what makes evals work.
Without it, you're matching on vibes.

Output: Best practices for structured output in examples
```

#### Agent 5: Competitive Analysis
```
Research question: What do the best agent frameworks show in their quickstart?

Research (web):
- LangChain quickstart
- AutoGPT examples
- CrewAI getting started
- Vercel AI SDK examples

For each:
- What's the first example?
- How do they handle testing?
- What do they show vs. hide?
- What's their "aha moment"?

Output: Competitive landscape + what we can learn
```

---

### Step 3: Synthesis

After all 5 agents return, synthesize:

```
Inputs:
- Domain ranking (Agent 1)
- Progressive outline (Agent 2)
- Anti-patterns to avoid (Agent 3)
- Structured output patterns (Agent 4)
- Competitive insights (Agent 5)

Produce:
- DOMAIN: The chosen domain with rationale
- THREAD: The 7-level progression with code sketches
- PATTERNS: What we demonstrate at each level
- ANTI-PATTERNS: What we explicitly avoid
- DIFFERENTIATORS: What makes ours better than competitors
```

---

### Step 4: Rubric Evaluation

Grade the synthesized design against this rubric:

| Criterion | Weight | Question |
|-----------|--------|----------|
| **First 5 Minutes** | 25% | Can a user copy Level 1, run it, and understand what happened? |
| **Progressive Clarity** | 20% | Does each level teach exactly ONE new concept? |
| **Realistic Usage** | 20% | Would a real user actually write code like this? |
| **Eval Power** | 15% | Does it show comparison, fixtures, and gates by Level 6? |
| **Structured Output** | 10% | Are assertions on structured data, not regex? |
| **State Story** | 10% | Is state introduced early (Level 2) and used throughout? |

Score each criterion 1-5. Total must be ≥ 4.0 to proceed.

If score < 4.0, iterate on the weakest criteria.

---

### Step 5: Present Options

Present 2-3 candidate designs to the user:

For each candidate:
```
## Candidate [N]: [Domain Name]

### Why This Domain
[2-3 sentences]

### The Thread
| Level | Concept | Code Delta |
|-------|---------|------------|
| 1 | ... | ... |
| ... | ... | ... |

### Sample Code (Level 3)
[Show enough to get the feel]

### Rubric Score
[Score breakdown]

### Trade-offs
- Pros: ...
- Cons: ...
```

Ask the user to choose or provide feedback.

---

### Step 6: Detailed Design (After Approval)

Only after user approves a direction:

```
Produce:
1. Full code for all 7 levels
2. File structure
3. README content
4. What to put in examples/ vs. apps/starter-kit/
5. Pre-recorded fixtures for instant CI
6. Quality gates (what commands must pass)
```

---

## Key Constraints

### API (Locked Decisions)
```typescript
// Definition
import { agent, harness } from '@open-harness/core'

// Execution
import { run } from '@open-harness/core'

// Testing
import { test, expect } from 'vitest'
import { setupMatchers } from '@open-harness/vitest'

// Fixtures
await run(agent, input, { fixture: 'name', mode: 'record', store })
```

### No Brittle Assertions
```typescript
// ❌ NEVER
expect(result.output).toMatch(/division|zero/i)

// ✅ ALWAYS
expect(result.output.category).toBe('bug')
expect(result.output.severity).toBeGreaterThan(0.7)
```

### Structured Output Required
```typescript
const agent = agent({
  prompt: '...',
  output: z.object({
    category: z.enum(['bug', 'feature', 'question']),
    confidence: z.number().min(0).max(1)
  })
})
```

### State is Fundamental
```typescript
// Level 2 introduces state
const reviewer = agent({
  prompt: '...',
  state: {
    reviewCount: 0,
    issuesFound: []
  }
})
```

---

## Success Criteria

The example is done when:

1. [ ] User can `bun install && bun test` and see passing tests
2. [ ] Level 1 is < 15 lines and works
3. [ ] Each level adds exactly ONE concept
4. [ ] No regex assertions on LLM output
5. [ ] Variant comparison is shown (prompt A vs. prompt B)
6. [ ] Fixtures work: `FIXTURE_MODE=record` then `FIXTURE_MODE=replay`
7. [ ] OpenHarnessReporter shows pass rate and gates
8. [ ] User says "I understand how this works"

---

## Reference Files

```
docs/internal/milestones/v0.2.0/archive/EXAMPLE_THREAD.md
docs/internal/milestones/v0.2.0/archive/SDK_DX_DECISIONS.md
docs/internal/milestones/v0.2.0/MANIFEST.md
packages/internal/core/src/api/agent.ts
packages/internal/core/src/api/harness.ts
packages/internal/core/src/api/run.ts
packages/open-harness/vitest/src/matchers.ts
packages/open-harness/vitest/src/reporter.ts
apps/docs/content/docs/learn/quickstart.mdx
```

---

## Begin

Start with Step 1 (Activate Context), then Step 2 (Fan-Out Research).

Do not skip steps. Do not implement before design is approved.

The DX is everything. Take the time to get this right.
