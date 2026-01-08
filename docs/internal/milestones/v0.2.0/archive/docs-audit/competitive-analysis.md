# Competitive Analysis

## Executive Summary

After analyzing Stripe, Next.js, Supabase, and Tailwind documentation against Open Harness, the key insight is clear: **gold standard docs prioritize user outcomes over product features**. Stripe organizes by business goal (Accept payments), not by API endpoint. Next.js scaffolds concepts before code. Tailwind gets to working code in one click. Open Harness currently organizes by internal architecture (Hub, Runtime, Channel) rather than user outcomes. The top patterns to steal: (1) outcome-first navigation, (2) framework-specific quickstarts like Supabase, (3) numbered step progressions like Tailwind, and (4) consistent terminology reinforcement for AI readability.

---

## Stripe Docs Analysis

### What They Do Well

**Task-First Hierarchy**: Navigation starts with use cases ("Accept payments online", "Sell subscriptions") before product categories. This guides visitors toward business outcomes rather than technical features.

**Progressive Disclosure**: Progression moves from simple use cases to specific products to implementation details. "Accept payments online" precedes detailed product documentation, scaffolding concepts before technical depth.

**Minimal Voice**: Language emphasizes action verbs ("Explore," "Browse," "Build") and avoids jargon in headings. Descriptions are intentionally brief.

**Prebuilt Solutions Prominent**: Ready-made components (Checkout, Payment Links) appear on the landing page, letting users skip complexity if they don't need it.

### What We Should Steal

- [ ] **Outcome-first sidebar**: Organize top-level nav by what users want to accomplish, not by internal components
- [ ] **Prebuilt paths**: Surface the easiest path prominently (e.g., "Use the CLI" vs "Build from scratch")
- [ ] **2-3 clicks to code**: Integration quickstarts accessible from homepage

### How They'd Restructure Our Docs

Stripe would replace our current sidebar:
```
Learn -> Guides -> Reference -> Concepts
```

With outcome-based navigation:
```
Build an agent pipeline
Run flows with webhooks
Add persistence to flows
Production deployment
---
API Reference
```

---

## Vercel/Next.js Analysis

### What They Do Well

**Two-Router Separation**: Acknowledges two parallel ecosystems (App Router vs Pages Router) with clear visual separation. Users choose their path immediately.

**Educational Landing**: The `/docs` homepage is educational and welcoming. Explains *what* Next.js is before diving into *how*. Recommends prerequisites (React Foundations course).

**Dependency Chains**: Structure uses explicit learning paths:
```
Installation
    -> Project Structure
    -> Layouts and Pages
    -> Linking and Navigating
    -> Server and Client Components
    -> Fetching Data
```

Each concept assumes knowledge of previous ones.

**Search-First Navigation**: Prominent `Cmd+K` search for non-linear learners who know what they want.

**Community as First-Class Citizen**: GitHub Discussions, Discord, X, Reddit all prominently linked.

### What We Should Steal

- [ ] **Prerequisites acknowledgment**: Clearly state what users should know before starting
- [ ] **Dependency chain visualization**: Show the learning path explicitly
- [ ] **Parallel ecosystem support**: If we have multiple entry points (YAML-first vs Code-first), separate them clearly
- [ ] **Search prominence**: Make search the primary discovery mechanism

### How They'd Restructure Our Docs

Next.js would add a welcoming landing page that explains:
1. What Open Harness is (one sentence)
2. Who it's for
3. What you should know first (TypeScript, basic async)
4. Three paths: Quick Start, Full Tutorial, API Reference

---

## Supabase Analysis

### What They Do Well

**Framework-First Navigation**: Sidebar organizes by developer's tech stack (React, Next.js, Flutter). Users select their framework immediately, not Supabase's product categories.

**Consistent Card Structure**: Every quickstart follows identical structure (project setup, sample data, query examples). Pattern recognition aids learning.

**Breadth-First Approach**: Let developers choose their framework immediately rather than forcing linear progression.

**Modular Examples**: Each quickstart is self-contained with no prerequisite reading assumed. Users can jump in anywhere.

**16 Framework Quickstarts**: Comprehensive coverage shows commitment to meeting developers where they are.

### What We Should Steal

- [ ] **Framework-specific quickstarts**: "Open Harness with Bun", "Open Harness with Node.js", "Open Harness with Hono"
- [ ] **Consistent card design**: Every guide card has same description format: "Learn how to [action] with Open Harness in [framework]"
- [ ] **Self-contained tutorials**: No required prerequisite reading; each page stands alone

### How They'd Restructure Our Docs

Supabase would add a framework grid to the landing page:
```
Get Started
[ React + Open Harness ]  [ Next.js + Open Harness ]
[ Node.js + Open Harness ]  [ Bun + Open Harness ]
[ Hono + Open Harness ]  [ Express + Open Harness ]
```

Each links to a tailored quickstart using that framework's idioms.

---

## Tailwind Analysis

### What They Do Well

**1 Click to Code**: From the "Using Vite" tab, you see the first code block immediately. No preamble.

**Numbered Step Progression**: 6 sequential steps, each with a numbered pill (01-06) and accompanying code samples immediately visible. Linear, unambiguous.

**Contextual Help**: "Are you stuck? Setting up Tailwind with Vite can be a bit different across different build tools. Check our framework guides..." Prevents user frustration.

**Action-Oriented Labels**: Code blocks labeled "Terminal", "vite.config.ts", "CSS", "HTML" immediately contextualize what you're looking at.

**Tabbed Installation**: 5 paths (Vite, PostCSS, CLI, Framework Guides, Play CDN) let users self-select complexity level.

**Reference as Search Aid**: Categorical sidebar with full taxonomy visible on every page. Users navigate by scanning.

### What We Should Steal

- [ ] **Numbered steps with visual pills**: "Step 01: Create project" not "Step 1: Create project"
- [ ] **Labeled code blocks**: Always show filename/context above code
- [ ] **"Are you stuck?" blocks**: Contextual help before users give up
- [ ] **Installation tabs**: Multiple paths with increasing complexity

### How They'd Restructure Our Docs

Tailwind would redesign our quickstart page:
```
Get started with Open Harness
It's event-driven, declarative, and observable.

[ Using Bun ]  [ Using Node.js ]  [ Using Docker ]  [ Play in Browser ]

Step 01: Create your project
[Terminal]
mkdir my-flow && cd my-flow && bun init -y

Step 02: Install Open Harness
[Terminal]
bun add @open-harness/sdk

Step 03: Define your flow
[flow.yaml]
name: hello-world
...
```

---

## Diataxis Framework Assessment

### Are We Using It Right?

**Partially**. Our current structure maps roughly to Diataxis:

| Section | Diataxis Type | Assessment |
|---------|---------------|------------|
| Learn | Tutorials | Correct placement |
| Guides | How-to | Mostly correct |
| Reference | Reference | Correct |
| Concepts | Explanation | Correct |

However, the content within sections often mixes types.

### What We're Doing Wrong

1. **Tutorials that assume too much**: The quickstart uses custom node types before explaining what nodes are. Tutorials should hold the user's hand completely.

2. **How-to guides that explain too much**: Guides should be terse task completion. "Here's how to add persistence" not "Here's why persistence matters and how to add it."

3. **Concepts mixed into Reference**: Architecture page has conceptual explanation mixed with API surface description.

4. **Missing explicit learning progression**: Tutorials don't clearly state what you'll know after completing them.

5. **Landing page is a sales pitch, not a map**: Gold standard landing pages orient users to *where they are* in the docs, not *what the product does*.

### How to Fix

1. **Audit each page for type purity**: Every page should be clearly ONE of the four types
2. **Add "What you'll learn" to tutorials**: Set expectations
3. **Strip explanation from reference**: Reference should be facts only
4. **Add "Prerequisites" to how-to guides**: Assume competence but specify what competence
5. **Redesign landing page as navigation hub**: Show the four quadrants explicitly

---

## 2025 Best Practices

### Trends

| Trend | Relevance to Open Harness |
|-------|---------------------------|
| **LLMs as primary doc consumers** | Our docs should be AI-readable for Claude/GPT integration |
| **MCP integration for docs** | Could expose our docs via MCP for AI-assisted development |
| **llms.txt files** | Should create structured outline for AI crawling |
| **Passage-level indexing** | Short paragraphs (3-5 lines) with single ideas |
| **Consistent terminology** | Reuse exact terms ("flow", "node", "binding") consistently |

### What We're Missing

1. **No llms.txt file**: Should create structured outline for AI systems
2. **Inconsistent terminology**: We say "flow", "pipeline", "workflow" interchangeably
3. **Long paragraphs**: Architecture page has 100+ word paragraphs that chunk poorly
4. **Vague headings**: "Architecture" doesn't tell AI systems *what* about architecture
5. **No machine-readable context stream**: Could expose docs via MCP

### AI-Readability Checklist

- [ ] Create `/llms.txt` with prioritized content outline
- [ ] Audit all headings for specificity (replace "Overview" with "HubEventSystem")
- [ ] Break paragraphs to 3-5 lines maximum
- [ ] Establish terminology glossary and enforce consistency
- [ ] Add semantic formatting (tables, code blocks, bullet points)
- [ ] Test chunking with embedding playground

---

## Patterns to Adopt

### P0: Must Have for v0.2.0

1. **Numbered Step Progressions**
   - What: Replace prose instructions with numbered steps and visual pills
   - Why: Tailwind's approach reduces cognitive load and prevents users from losing their place
   - How: Redesign quickstart with Step 01, Step 02, etc. with labeled code blocks
   - Stolen from: Tailwind

2. **Framework-Specific Quickstarts**
   - What: Multiple entry points based on user's existing stack
   - Why: Supabase shows this dramatically improves onboarding for users with existing projects
   - How: Create "Open Harness + Bun", "Open Harness + Node.js" quickstarts
   - Stolen from: Supabase

3. **Contextual "Are You Stuck?" Blocks**
   - What: Inline help callouts that anticipate common problems
   - Why: Prevents user frustration and support tickets
   - How: Add callout components after each step with common failure modes
   - Stolen from: Tailwind

4. **Outcome-First Navigation**
   - What: Top-level nav organized by user goals, not product architecture
   - Why: Stripe's task-first hierarchy guides users to business outcomes
   - How: Restructure sidebar to start with "Build a pipeline", "Add observability", etc.
   - Stolen from: Stripe

### P1: Should Have

1. **Learning Path Visualization**
   - What: Explicit dependency chains showing recommended progression
   - Why: Next.js shows each concept builds on previous ones
   - How: Add visual "Prerequisites" and "Next Steps" to every page
   - Stolen from: Next.js

2. **Prominent Search**
   - What: `Cmd+K` search as primary navigation for experienced users
   - Why: Non-linear learners want to jump directly to what they need
   - How: Add Algolia/Typesense search with keyboard shortcut
   - Stolen from: Next.js, Tailwind

3. **Self-Contained Pages**
   - What: Each page stands alone without required prerequisite reading
   - Why: Users arrive via search, not sequential navigation
   - How: Add minimal context at top of each page, link to deeper content
   - Stolen from: Supabase

4. **llms.txt for AI Readability**
   - What: Structured outline file for LLM consumption
   - Why: AI tools are becoming primary documentation interface
   - How: Generate `/llms.txt` with page summaries and priorities
   - Stolen from: 2025 best practices

### P2: Nice to Have

1. **Installation Tabs**
   - What: Multiple installation paths with tabbed interface
   - Why: Different complexity levels for different users
   - How: Add tabs for "Quick (CLI)", "Standard (npm)", "Docker"
   - Stolen from: Tailwind

2. **Community Section**
   - What: First-class citizen links to Discord, GitHub Discussions
   - Why: Builds ecosystem and reduces support burden
   - How: Add "Get Help" section to footer/sidebar
   - Stolen from: Next.js

3. **Prebuilt Solutions Section**
   - What: Ready-made templates and examples for common use cases
   - Why: Users often want to skip learning and just ship
   - How: Add "Templates" section with copy-paste solutions
   - Stolen from: Stripe

---

## Structure Recommendations

### Proposed Sidebar Structure

Current structure:
```
Learn
  Quickstart
  Your First Agent
  Multi-Agent Flow
  Persistence
Guides
  Deployment
  Agents
  Channels
  Expressions
  Flows
Reference
  API
  Expressions
  Types
  Schemas
Concepts
  Architecture
  Event System
  ...
```

Proposed structure (outcome-first):
```
Getting Started
  Installation
  Your First Flow (5 min)

Build Flows
  Single Agent
  Multi-Agent Pipelines
  Conditional Branching
  Loops and Iteration

Connect to the World
  WebSocket Integration
  HTTP Endpoints
  Custom Channels

Production
  Persistence
  Observability
  Deployment

---
Reference
  API
  Flow YAML Schema
  Expression Syntax
  Event Types

Understand
  Architecture
  Why JSONata?
  Design Decisions
```

Key changes:
1. "Getting Started" replaces "Learn" (action-oriented)
2. "Build Flows" organized by complexity progression
3. "Connect to the World" is user outcome, not "Channels"
4. "Production" groups deployment concerns
5. "Understand" replaces "Concepts" (user action)

### Landing Page Redesign

Current landing page:
- Product description
- Four feature bullets
- One code example
- Four cards to sections

Proposed landing page:
```
Open Harness

Event-driven workflow orchestration for multi-agent AI systems.

[What is Open Harness?] [Who is it for?] [Prerequisites]

---

Getting Started                          Build
[ 5-min Quickstart ]                     [ Flow Patterns ]
[ Installation Guide ]                   [ Agent Types ]
                                         [ Expressions ]

Connect                                  Deploy
[ WebSocket ]                            [ Persistence ]
[ HTTP/REST ]                            [ Production ]

---

Understand the System
[ Architecture ] [ Event Model ] [ Design Decisions ]

---

Reference
[ API ] [ YAML Schema ] [ Types ]
```

Key changes:
1. Welcoming intro with prerequisites
2. Visual four-quadrant layout
3. Action-oriented labels
4. Clear separation of concerns

---

## Writing Style Guide Elements

Based on patterns observed in successful docs:

### Voice

| Do | Don't |
|----|-------|
| "Create a flow" | "You will create a flow" |
| "Run this command" | "Now you should run the following command" |
| "The Hub broadcasts events" | "The Hub is responsible for broadcasting events to all registered listeners" |

### Structure

| Pattern | Example |
|---------|---------|
| **Numbered steps** | Step 01: Create project |
| **Labeled code blocks** | `[flow.yaml]` above code |
| **One idea per paragraph** | Max 3-5 lines |
| **Action verbs in headings** | "Install Dependencies" not "Dependencies" |

### Terminology Consistency

Establish canonical terms:

| Canonical | Avoid |
|-----------|-------|
| flow | workflow, pipeline |
| node | step, stage, task |
| binding | interpolation, template |
| Hub | harness, orchestrator |

### Callout Patterns

```markdown
<Callout type="tip">
Tip content here
</Callout>

<Callout type="warning">
Warning content here
</Callout>

<Callout type="stuck" title="Are you stuck?">
If you see [error], try [solution].
</Callout>
```

---

## Sources

- [Stripe Documentation](https://docs.stripe.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Diataxis Framework](https://diataxis.fr/)
- [AI Documentation Trends 2025 - Mintlify](https://www.mintlify.com/blog/ai-documentation-trends-whats-changing-in-2025)
- [We Fixed Our Documentation with Diataxis - Sequin](https://blog.sequinstream.com/we-fixed-our-documentation-with-the-diataxis-framework/)
- [What is Diataxis - I'd Rather Be Writing](https://idratherbewriting.com/blog/what-is-diataxis-documentation-framework)
