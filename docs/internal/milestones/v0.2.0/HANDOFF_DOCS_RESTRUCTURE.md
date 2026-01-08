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

## Your Task: Multi-Spectrum Analysis + Restructure Plan

### Phase 1: Fan-Out Analysis (Parallel Agents)

Launch these analysis agents in parallel:

#### Agent 1: Content Audit
```
Audit all existing documentation files in apps/docs/content/docs/
For each file, assess:
- Completeness (1-5 scale)
- Accuracy vs current codebase
- Code examples: do they work?
- What's missing?

Output: content-audit.yaml with per-file assessments
```

#### Agent 2: User Journey Analysis
```
Map the ideal user journey for Open Harness:
1. "What is this?" → First impression
2. "Can I try it?" → Time to first success
3. "How do I do X?" → Task completion
4. "How does it work?" → Understanding
5. "What's the API?" → Reference lookup

For each stage, identify:
- What questions users have
- What content answers them
- What's missing

Output: user-journey.yaml with gaps identified
```

#### Agent 3: Example Thread Analysis
```
Design a SINGLE example that threads through all docs:
- Starts minimal (hello world)
- Adds complexity progressively
- Covers all major features by the end
- Each doc section builds on previous

Consider: What workflow is:
- Simple enough to start with
- Rich enough to demonstrate all features
- Realistic (something users would actually build)

Output: example-thread.md with the progressive example design
```

#### Agent 4: Competitive Analysis
```
Analyze documentation patterns from best-in-class projects:
- Stripe (gold standard for DX)
- Vercel/Next.js
- Supabase
- LangChain

What do they do well?
What patterns can we adopt?

Output: competitive-analysis.md with recommendations
```

#### Agent 5: v0.2.0 Integration Analysis
```
Analyze where v0.2.0 features fit in the existing structure:
- Evals: where in the journey?
- Providers: where in the journey?
- Recording: where in the journey?

For each, determine:
- Is it core (everyone needs) or advanced (some need)?
- When should it be introduced?
- What prerequisites does it have?

Output: v020-integration.yaml with placement recommendations
```

### Phase 2: Fan-In Synthesis

After all agents complete, synthesize into:

1. **New Structure Proposal** - The merged documentation tree
2. **Content Migration Plan** - What moves where, what gets written
3. **Example Thread Specification** - The single example that builds throughout
4. **Priority Order** - What to write first for v0.2.0 release

---

## Constraints

### Progressive Disclosure Rules

1. **Learn section comes FIRST** - Users want to DO, not READ
2. **Concepts come AFTER doing** - Explain only what they've experienced
3. **Reference is for lookup, not learning** - Don't send beginners there
4. **Each page should be self-contained** - But link to deeper content
5. **Complexity is opt-in** - Simple by default, advanced when requested

### The Single Example Requirement

The example should be a **coding assistant workflow** that:

**Level 1 (Quickstart):** Single node, takes a task, returns code
```yaml
nodes:
  - id: coder
    type: claude.agent
    input:
      prompt: "{{ flow.input.task }}"
```

**Level 2 (Multi-node):** Adds a reviewer node
```yaml
nodes:
  - id: coder
    type: claude.agent
    input:
      prompt: "{{ flow.input.task }}"
  - id: reviewer
    type: claude.agent
    input:
      prompt: "Review this code: {{ coder.text }}"
edges:
  - from: coder
    to: reviewer
```

**Level 3 (Iteration):** Coder revises based on review
```yaml
# Add iteration logic
```

**Level 4 (Persistence):** Save and resume workflows

**Level 5 (Recording):** Record and replay for testing

**Level 6 (Evals):** Measure and compare performance

Each level introduces ONE new concept. Users can stop at any level and have something useful.

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

1. **Single structure** - No more parallel 0.2.0/ directory
2. **Progressive example** - One workflow that builds throughout
3. **Clear user journey** - Each section answers a specific question
4. **v0.2.0 features integrated** - Evals, providers, recording in right places
5. **Actionable plan** - Know exactly what to write and in what order

---

## Output Expected

Create `docs/internal/milestones/v0.2.0/DOCS_RESTRUCTURE_PLAN.md` with:

```markdown
## New Documentation Structure

[Full tree with descriptions]

## Example Thread Specification

[The progressive example at each level]

## Migration Plan

[What moves where, what gets deleted, what gets written]

## Writing Priority

[Ordered list of what to write for v0.2.0 release]

## Estimated Effort

[Rough scope for each item]
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
