# Documentation Restructure Handoff

**Date:** 2026-01-08
**Status:** Phase 9 (DX Audit) complete, Documentation Completeness in progress
**Branch:** `v0.2.0/stabilization`
**Previous Work:** DX audit passed, starter-kit created, evals-pattern.md fixed

---

## Mission

Restructure Open Harness documentation to achieve world-class DX through progressive disclosure, using a single threaded example that builds throughout.

**Core Principle:** Complexity lives in the SDK, simplicity lives in user code. The docs should reflect this.

---

## Context

### What is Open Harness?

Open Harness is an event-driven workflow execution system for building production multi-agent AI systems.

**Core primitives:**
- **Flows** - Declarative workflow definitions (YAML or code)
- **Nodes** - Units of work (agents, transforms, etc.)
- **Edges** - Connections between nodes
- **Hub** - Central event coordinator
- **Runtime** - Flow execution engine
- **Channels** - Protocol integrations (WebSocket, HTTP, etc.)

**v0.2.0 adds:**
- **Provider abstraction** - Multi-provider support (Claude, OpenCode, Codex)
- **Recording & Replay** - Deterministic testing
- **Eval system** - Measure and compare workflow performance

### Current State: Two Parallel Doc Structures

**`apps/docs/content/docs/`** - Original structure (Diátaxis-inspired):
```
learn/          → Tutorials (quickstart, your-first-agent, multi-agent, persistence)
guides/         → How-tos (agents, channels, deployment, expressions, flows)
concepts/       → Explanations (architecture, event-system, expressions, persistence)
reference/      → Reference (API, types, schemas)
```

**`apps/docs/content/0.2.0/`** - v0.2.0 parallel structure (to be merged):
```
01-foundations/ → philosophy.md, zen.md
02-architecture/→ architecture.md, providers.md, telemetry.md
03-patterns/    → evals-pattern.md, skills-pattern.md, scripts-pattern.md
04-getting-started/ → quickstart.md, vision.md, what-can-i-build.md, why-open-harness.md
05-reference/   → getting-started.md, contributing.md
```

### Decision: Merge Into Single Structure

The v0.2.0 docs were a mistake - they created duplication instead of extension. We're merging them into the existing structure.

**What's good about existing docs:**
- Diátaxis structure (learn → guides → concepts → reference)
- Progressive complexity
- Real code examples

**What's NOT good:**
- Content is incomplete/shallow
- Examples don't build on each other
- No single threaded narrative
- Concepts introduced too early
- Missing v0.2.0 features

---

## Grading Rubric

Use this rubric to assess EVERYTHING - docs, examples, SDK APIs. Be critical. If something sucks, say it sucks.

### Documentation Quality (per page)

| Criterion | 1 (Bad) | 3 (Okay) | 5 (Excellent) |
|-----------|---------|----------|---------------|
| **Clarity** | Confusing, jargon-heavy | Understandable with effort | Crystal clear, no re-reading needed |
| **Completeness** | Major gaps, leaves questions | Covers basics, some gaps | Comprehensive, anticipates questions |
| **Accuracy** | Outdated, broken examples | Mostly correct | 100% accurate, tested examples |
| **Actionable** | Theory only, no "do this" | Some guidance | Clear steps, copy-paste works |
| **Progressive** | Dumps everything at once | Some structure | Perfect layering, complexity builds |

### Example Quality

| Criterion | 1 (Bad) | 3 (Okay) | 5 (Excellent) |
|-----------|---------|----------|---------------|
| **Realistic** | Toy example, useless | Demonstrates concept | Something you'd actually build |
| **Minimal** | Bloated, too much | Some noise | Only essential code shown |
| **Runnable** | Broken, won't run | Works with tweaks | Copy-paste and it runs |
| **Explained** | No context | Some comments | Every line purposeful and explained |
| **Connected** | Standalone, isolated | Links to others | Builds on previous, threads through |

### SDK/API DX (surfaced through docs)

| Criterion | 1 (Bad) | 3 (Okay) | 5 (Excellent) |
|-----------|---------|----------|---------------|
| **Obviousness** | Need to read source | Need docs | Obvious from types/autocomplete |
| **Defaults** | Must configure everything | Some defaults | Works with zero config |
| **Error Messages** | Cryptic, unhelpful | Points to problem | Tells you exactly how to fix |
| **Naming** | Confusing, inconsistent | Okay, some oddities | Self-documenting, consistent |
| **Escape Hatches** | Locked in, can't customize | Some extensibility | Full control when needed |

### Writing Quality

| Criterion | 1 (Bad) | 3 (Okay) | 5 (Excellent) |
|-----------|---------|----------|---------------|
| **Concise** | Bloated, repetitive | Some filler | Every word earns its place |
| **Voice** | Robotic, passive | Neutral | Active, direct, confident |
| **Scannable** | Wall of text | Some headers | Headers, bullets, easy to scan |
| **Tone** | Condescending or confusing | Professional | Friendly expert, respects reader |

---

## Your Task: Multi-Spectrum Analysis + Restructure Plan

### Phase 1: Fan-Out Analysis (Parallel Agents)

Launch these analysis agents in parallel. Each should be CRITICAL - we want to know what sucks, not just what exists.

#### Agent 1: Content Quality Audit
```
Audit all existing documentation files in apps/docs/content/docs/

For each file, grade against the Documentation Quality rubric above (1-5 per criterion).

Also identify:
- What's GOOD and should be kept
- What SUCKS and needs rewriting
- What's MISSING entirely
- What's WRONG (outdated, broken)
- What's CONFUSING (even if technically correct)

Be harsh. If the writing is bad, say it's bad.

Output: content-audit.yaml with:
  - Per-file scores
  - Specific issues quoted
  - Recommendations (keep/rewrite/delete/merge)
```

#### Agent 2: User Journey & Friction Analysis
```
Map the ACTUAL user journey (not ideal) through current docs:
1. Land on docs site - what do they see?
2. Try to get started - where do they go?
3. Hit first problem - where do they get stuck?
4. Try to understand - what confuses them?
5. Look up reference - can they find it?

For each stage, identify:
- FRICTION POINTS - where do users get stuck?
- DEAD ENDS - where do docs fail to answer?
- CONFUSION - where do docs make it worse?
- GAPS - what questions have no answers?

Think like a frustrated user, not a fan.

Output: user-journey.yaml with:
  - Journey map with friction scores
  - Specific pain points quoted
  - Gap analysis
```

#### Agent 3: Example Quality Audit
```
Audit ALL code examples in the docs:

For each example:
1. Does it actually run? (test it)
2. Is it minimal or bloated?
3. Is it realistic or toy?
4. Does it connect to other examples?
5. Grade against Example Quality rubric

Also design the SINGLE THREADED EXAMPLE:
- What workflow threads through all docs?
- How does it grow at each level?
- What concepts does each level introduce?

Output: example-audit.yaml with:
  - Per-example scores and issues
  - Which examples are broken
  - The threaded example specification
```

#### Agent 4: SDK DX Audit (Through Documentation Lens)
```
This is crucial: BAD DOCS often mean BAD APIs.

As you analyze docs, identify SDK issues:
- What's HARD TO EXPLAIN? → Probably hard to use
- What needs EXCESSIVE CONTEXT? → API is confusing
- What has LOTS OF CAVEATS? → Design smell
- What do users NEED TO KNOW but shouldn't? → Leaky abstraction

Specific questions:
- Is `createHarness()` vs `runFlow()` confusing?
- Are the concepts (Hub, Runtime, Channel) necessary for users?
- Is the YAML vs TypeScript story clear?
- Are error messages helpful?
- What would Stripe do differently?

Output: sdk-dx-issues.yaml with:
  - API pain points surfaced
  - Naming issues
  - Missing conveniences
  - Recommendations for SDK improvements (for v0.3.0)
```

#### Agent 5: Competitive & Best Practices Analysis
```
Compare against gold standard docs:
- Stripe Docs
- Vercel/Next.js Docs
- Supabase Docs
- Tailwind Docs

For each, identify:
- What do they do that we don't?
- What patterns should we steal?
- What's their quickstart structure?
- How do they handle progressive disclosure?
- How do they thread examples?

Also research:
- Diátaxis framework - are we using it right?
- Documentation best practices 2024-2025

Output: competitive-analysis.md with:
  - Specific patterns to adopt
  - Structure recommendations
  - Writing style recommendations
```

#### Agent 6: v0.2.0 Feature Integration
```
For each v0.2.0 feature, determine placement:

EVALS:
- Who needs this? (everyone vs power users)
- Prerequisites to understand it?
- Where in journey should it appear?
- Current state of eval docs - grade it

PROVIDERS:
- Same questions
- Is multi-provider a core or advanced concept?

RECORDING:
- Same questions
- Is this for testing only or also debugging?

Output: v020-integration.yaml with:
  - Feature placement recommendations
  - Prerequisites map
  - Current state assessment
```

### Phase 2: Fan-In Synthesis

After all agents complete, synthesize into a CRITICAL report:

1. **What Sucks** - Top 10 issues across all analyses
2. **What's Good** - What to preserve
3. **SDK Issues** - Problems surfaced that need SDK fixes (v0.3.0 backlog)
4. **New Structure Proposal** - The merged documentation tree
5. **Content Migration Plan** - What moves where, what gets written, what gets deleted
6. **Example Thread Specification** - The single example that builds throughout
7. **Writing Standards** - Voice, tone, style guide for new content
8. **Priority Order** - What to write first for v0.2.0 release

---

## Constraints

### Progressive Disclosure Rules

1. **Learn section comes FIRST** - Users want to DO, not READ
2. **Concepts come AFTER doing** - Explain only what they've experienced
3. **Reference is for lookup, not learning** - Don't send beginners there
4. **Each page should be self-contained** - But link to deeper content
5. **Complexity is opt-in** - Simple by default, advanced when requested

### The Single Example Requirement

**CRITICAL**: Progressive disclosure is about CONCEPTS, not "more agents."

Adding a second agent is NOT more important than understanding STATE. The progression should teach one CORE CONCEPT per level, in order of importance:

**Level 1: Hello World** - Just make something work
- Single node, input → output
- Concept: "Flows execute nodes"

**Level 2: State** - The fundamental building block
- Same node, but now it tracks state (counter, history, etc.)
- Concept: "Workflows have memory"
- This is MORE important than multi-agent!

**Level 3: Data Flow** - Passing data between nodes
- NOW add a second node
- Focus on bindings: `{{ previousNode.output }}`
- Concept: "Nodes communicate through bindings"

**Level 4: Conditions** - Branching logic
- Add a `when` clause to an edge
- Concept: "Flows can branch based on data"

**Level 5: Persistence** - Save and resume
- Add RunStore, show resume from saved state
- Concept: "Workflows survive restarts"

**Level 6: Recording** - Deterministic replay
- Record a run, replay it
- Concept: "Test without hitting APIs"

**Level 7: Evals** - Measure and compare
- Define cases, variants, gates
- Concept: "Data proves what's better"

**Each level introduces ONE concept. The example BUILDS - level 7 is the same workflow as level 1, just with all the concepts added.**

The audit should verify: Are these concepts covered? In this order? With a building example?

### What NOT to Include in v0.2.0 Docs

- `telemetry.md` → Defer to v0.3.0 (OTel/wide events)
- `skills-pattern.md` → Not v0.2.0 scope
- `scripts-pattern.md` → Not v0.2.0 scope
- Deep internals → Keep in code comments, not user docs

---

## Key Files to Read

### Architecture Understanding
```
packages/internal/core/src/index.ts          # What core exports
packages/internal/core/src/eval/README.md    # Eval system docs
packages/internal/core/src/recording/README.md # Recording docs
apps/starter-kit/README.md                   # Working eval example
```

### Existing Docs
```
apps/docs/content/docs/index.mdx             # Landing page
apps/docs/content/docs/learn/quickstart.mdx  # Current quickstart
apps/docs/content/docs/concepts/architecture.mdx # Architecture
apps/docs/content/docs/meta.json             # Navigation structure
```

### v0.2.0 Content to Merge
```
apps/docs/content/0.2.0/01-foundations/zen.md           # Good content, keep
apps/docs/content/0.2.0/03-patterns/evals-pattern.md    # Just updated, keep
```

---

## Success Criteria

1. **Brutal honesty** - We know exactly what sucks and why
2. **SDK issues surfaced** - Problems that need fixing in code, not just docs
3. **Single structure** - No more parallel 0.2.0/ directory
4. **Progressive example** - One workflow that builds throughout
5. **Clear user journey** - Each section answers a specific question
6. **v0.2.0 features integrated** - Evals, providers, recording in right places
7. **Actionable plan** - Know exactly what to write and in what order
8. **Quality bar set** - Clear standards for new content

---

## Output Expected

Create these files in `docs/internal/milestones/v0.2.0/docs-audit/`:

### 1. `AUDIT_SUMMARY.md` - Executive summary
```markdown
## What Sucks (Top 10)
[Ranked list of worst issues, with quotes]

## What's Good (Keep These)
[What's working, don't break it]

## SDK Issues Surfaced
[API problems that docs revealed - backlog for v0.3.0]

## Overall Grade
[Letter grade A-F with justification]
```

### 2. `CONTENT_SCORES.yaml` - Per-file grades
```yaml
files:
  - path: docs/learn/quickstart.mdx
    scores:
      clarity: 4
      completeness: 2
      accuracy: 3
      actionable: 4
      progressive: 3
    issues:
      - "Example on line 45 doesn't match current API"
      - "Missing explanation of what `registry` is"
    recommendation: rewrite
```

### 3. `EXAMPLE_THREAD.md` - The progressive example
```markdown
## The Coding Assistant Workflow

### Level 1: Hello World
[Code + what it teaches]

### Level 2: Multi-Node
[Code + what it adds]

### Level 3: Iteration
[Code + what it adds]

... etc
```

### 4. `NEW_STRUCTURE.md` - Documentation tree
```markdown
## Proposed Structure

docs/
├── index.mdx          # [description]
├── learn/
│   ├── quickstart.mdx # [description, status: rewrite]
...
```

### 5. `MIGRATION_PLAN.md` - What to do
```markdown
## Delete
- [file]: [reason]

## Keep As-Is
- [file]: [reason]

## Rewrite
- [file]: [what's wrong, what it should be]

## New Content Needed
- [file]: [what it covers, why it's needed]
```

### 6. `WRITING_GUIDE.md` - Standards for new content
```markdown
## Voice
[How we write]

## Structure
[How pages are organized]

## Examples
[Standards for code examples]

## Anti-patterns
[What NOT to do, with examples from current docs]
```

### 7. `PRIORITY_ORDER.md` - What to write when
```markdown
## P0: Must have for v0.2.0
1. [file] - [effort estimate] - [why critical]

## P1: Should have
...

## P2: Nice to have
...

## Deferred to v0.3.0
...
```

---

## Commands

```bash
# From repo root
bun run typecheck   # Verify no breaks
bun run lint        # Keep it clean

# Test the docs site
cd apps/docs && bun run dev
```

---

*Generated by Phase 9 agent on 2026-01-08*
