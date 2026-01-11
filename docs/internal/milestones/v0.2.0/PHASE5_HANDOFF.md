# Phase 5 Handoff: Integration Example

**Priority:** CRITICAL - This is the user's first impression
**Approach:** Iterative design before implementation

> **NOTE:** See `PHASE5_RESEARCH_PROMPT.md` for the full fan-out research protocol.
> This file is the quick reference. The research prompt is the detailed methodology.

---

## Context

Everything we've built leads to this. Phases 1-4 created:
- `agent()` + `harness()` + `run()` API
- `@open-harness/vitest` with custom matchers
- Fixture recording/replay system
- Clean documentation

Now we need **one example that makes it click**.

---

## Your Task

**DO NOT jump straight into implementation.**

First, present options and ask questions. The DX must be perfect - a user should be able to copy this and immediately understand what's happening.

---

## Design Questions to Ask

### 1. What domain should the example use?

| Option | Pros | Cons |
|--------|------|------|
| **Code reviewer** | Technical audience gets it | Maybe too "meta" |
| **Customer support** | Relatable, clear inputs | Less exciting |
| **Data extractor** | Structured output demo | More complex |
| **General assistant** | Simple, universal | Maybe too basic |

**Ask:** Which domain resonates best for our target user?

### 2. How complex should the first example be?

| Option | Description |
|--------|-------------|
| **Minimal** | Single agent, one test, ~20 lines |
| **Realistic** | Single agent, 3-4 tests, assertions |
| **Multi-agent** | Harness with 2 agents, workflow |

**Ask:** Should we start dead simple, or show realistic usage?

### 3. What should the file structure look like?

```
Option A: Flat (minimal)
examples/quickstart/
├── package.json
├── vitest.config.ts
├── agent.ts
└── agent.test.ts

Option B: Organized (realistic)
examples/quickstart/
├── package.json
├── vitest.config.ts
├── src/
│   └── agents/
│       └── reviewer.ts
├── tests/
│   └── reviewer.test.ts
└── fixtures/           # Pre-recorded for instant CI
    └── ...
```

**Ask:** Flat or organized? Pre-recorded fixtures included?

### 4. What assertions matter most?

| Matcher | Shows |
|---------|-------|
| `toHaveLatencyUnder()` | Performance gates |
| `toCostUnder()` | Budget control |
| `toHaveTokensUnder()` | Token efficiency |
| `expect(output).toContain()` | Content validation |

**Ask:** Which assertions demonstrate the most value?

---

## Three Possible Example Shapes

### Shape A: "Hello World" (Minimal)

```typescript
// agent.ts
import { agent } from '@open-harness/core'

export const greeter = agent({
  prompt: 'Greet the user warmly.'
})

// agent.test.ts
import { test, expect } from 'vitest'
import { run } from '@open-harness/vitest'
import { greeter } from './agent'

test('greets user', async () => {
  const result = await run(greeter, { prompt: 'Hello!' })

  expect(result.output).toBeDefined()
  expect(result).toHaveLatencyUnder(5000)
})
```

**Pros:** Dead simple, zero friction
**Cons:** Doesn't show the power

---

### Shape B: "Code Reviewer" (Realistic)

```typescript
// src/agents/reviewer.ts
import { agent } from '@open-harness/core'

export const codeReviewer = agent({
  prompt: `You are a senior code reviewer.
Analyze code for bugs, security issues, and improvements.
Be specific and actionable in your feedback.`
})

// tests/reviewer.test.ts
import { describe, test, expect } from 'vitest'
import { run } from '@open-harness/vitest'
import { codeReviewer } from '../src/agents/reviewer'

describe('code reviewer', () => {
  test('catches division by zero', async () => {
    const result = await run(codeReviewer, {
      prompt: 'function divide(a, b) { return a / b; }'
    })

    expect(result.output).toMatch(/division|zero|undefined/i)
    expect(result).toHaveLatencyUnder(10000)
    expect(result).toCostUnder(0.02)
  })

  test('identifies SQL injection', async () => {
    const result = await run(codeReviewer, {
      prompt: 'const q = `SELECT * FROM users WHERE id = ${id}`'
    })

    expect(result.output).toMatch(/injection|sanitize|parameterized/i)
  })

  test('approves clean code', async () => {
    const result = await run(codeReviewer, {
      prompt: `function add(a: number, b: number): number {
        return a + b;
      }`
    })

    expect(result).toHaveTokensUnder(500)
  })
})
```

**Pros:** Shows real testing patterns, multiple assertions
**Cons:** More to digest upfront

---

### Shape C: "Multi-Agent Workflow" (Advanced)

```typescript
// src/harness.ts
import { agent, harness } from '@open-harness/core'

const classifier = agent({
  prompt: 'Classify code as: bug, security, style, or ok'
})

const explainer = agent({
  prompt: 'Explain the issue in plain English'
})

export const reviewHarness = harness({
  agents: { classifier, explainer },
  flow: async (agents, input) => {
    const classification = await agents.classifier.run(input)
    if (classification.output.includes('ok')) {
      return { verdict: 'approved', explanation: null }
    }
    const explanation = await agents.explainer.run({
      prompt: `${input.prompt}\n\nIssue type: ${classification.output}`
    })
    return { verdict: classification.output, explanation: explanation.output }
  }
})

// tests/harness.test.ts
test('multi-agent review', async () => {
  const result = await run(reviewHarness, {
    prompt: 'function divide(a, b) { return a / b; }'
  })

  expect(result.output.verdict).toBe('bug')
  expect(result.output.explanation).toContain('zero')
})
```

**Pros:** Shows harness power, real workflows
**Cons:** Too much for first example?

---

## Recommendation

My recommendation: **Start with Shape B (Code Reviewer)**, because:

1. **Relatable** - Everyone understands code review
2. **Shows value** - Multiple test cases, different assertions
3. **Not overwhelming** - Single agent, clear structure
4. **Expandable** - Can add harness example as "advanced" section

But I want to hear from you:

1. Does the code reviewer domain work, or would you prefer something else?
2. Should fixtures be pre-recorded so `bun test` works immediately?
3. Do you want a README with explanation, or let the code speak?
4. Should this live in `examples/quickstart/` or rebuild `apps/starter-kit/`?

---

## Quality Bar

The example is not done until:

- [ ] User can clone, `bun install`, `bun test` and see passing tests
- [ ] Fixture mode works: `FIXTURE_MODE=record` then `FIXTURE_MODE=replay`
- [ ] Code is self-explanatory (minimal comments needed)
- [ ] Shows at least 2 custom matchers
- [ ] Shows content assertion (not just metrics)
- [ ] README explains "what you just ran" in <30 seconds read time

---

## Implementation Order (After Design Approval)

1. Create directory structure
2. Write the agent(s)
3. Write tests with assertions
4. Record fixtures for CI
5. Write minimal README
6. Verify the full flow works
7. Run quality gates

---

## Files to Reference

- MANIFEST: `docs/internal/milestones/v0.2.0/MANIFEST.md` (Phase 5 spec)
- Vitest plugin: `packages/open-harness/vitest/` (matchers, reporter)
- Core API: `packages/internal/core/src/api/` (agent, harness, run)
- Updated docs: `apps/docs/content/docs/learn/quickstart.mdx`

---

## Begin

Start by presenting the three shapes above and asking the design questions. Get explicit approval before writing any code.
