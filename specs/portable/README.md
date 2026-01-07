# Open Harness Documentation

**Purpose:** Complete documentation for Open Harness (0.2.0)  
**Structure:** Portable, numbered sections for easy navigation

---

## Overview

This folder contains all Open Harness documentation, organized into numbered sections for progressive learning.

**How to use:**

1. Start with **01-foundations** (mental model, core philosophy)
2. Continue to **02-architecture** (how it works under hood)
3. Learn **03-patterns** (skills, scripts, evals patterns)
4. Follow **04-getting-started** (quickstart, what can I build)
5. Reference **05-reference** (contributing, detailed guides)

---

## Documentation Structure

```
01-foundations/     - Mental model, philosophy, what is harness
02-architecture/     - System architecture, providers, telemetry
03-patterns/        - Skills pattern, scripts pattern, evals pattern
04-getting-started/  - Quickstart, what can I build, vision
05-reference/       - Getting started guide, contributing guide
```

---

## Sections

### 01: Foundations

**Purpose:** Understand the mental model and core philosophy

**Contents:**

- [Zen of Open Harness](./01-foundations/zen.md) - Mental model for building agentic systems
- [Philosophy](./01-foundations/philosophy.md) - Core philosophy and design principles

**Start here first.** This is the foundation everything else builds on.

---

### 02: Architecture

**Purpose:** Understand how Open Harness works under the hood

**Contents:**

- [Architecture](./02-architecture/architecture.md) - System components, execution engine, provider integration
- [Providers](./02-architecture/providers.md) - Available providers, how to swap/mix
- [Telemetry](./02-architecture/telemetry.md) - Built-in observability, full event system

**Learn how:** Workflows run, providers integrate, telemetry works.

---

### 03: Patterns

**Purpose:** Learn the core patterns for building agentic systems

**Contents:**

- [Skills Pattern](./03-patterns/skills-pattern.md) - How skills work, why skills > MCP
- [Scripts Pattern](./03-patterns/scripts-pattern.md) - Scripts + bash optimization = universal access
- [Evals Pattern](./03-patterns/evals-pattern.md) - How evals enable automatic improvement

**Learn how:** Create skills, wrap scripts, define evals.

---

### 04: Getting Started

**Purpose:** Get up and running with Open Harness

**Contents:**

- [Quickstart](./04-getting-started/quickstart.md) - 5-minute tutorial (coding example)
- [What Can I Build](./04-getting-started/what-can-i-build.md) - Concrete examples (coding, trading, data, ops)
- [Vision](./04-getting-started/vision.md) - Platform vision and long-term goals
- [Why Open Harness](./04-getting-started/why-open-harness.md) - Why we built this, what problems it solves

**Learn by doing:** Quickstart tutorial, explore what's possible.

---

### 05: Reference

**Purpose:** Detailed guides and contributing

**Contents:**

- [Getting Started Guide](./05-reference/getting-started.md) - Comprehensive onboarding guide
- [Contributing](./05-reference/contributing.md) - How to contribute to Open Harness

**Reference materials:** Deep dives, contribution guide.

---

## Learning Path

### New to Open Harness?

**Day 1: Foundations**

1. Read [Zen of Open Harness](./01-foundations/zen.md) (30 min)
2. Read [Philosophy](./01-foundations/philosophy.md) (15 min)
3. Understand the mental model (skills + scripts + evals)

**Day 2-3: Architecture**

1. Read [Architecture](./02-architecture/architecture.md) (30 min)
2. Read [Providers](./02-architecture/providers.md) (15 min)
3. Read [Telemetry](./02-architecture/telemetry.md) (20 min)
4. Understand how system works

**Day 4-5: Patterns**

1. Read [Skills Pattern](./03-patterns/skills-pattern.md) (20 min)
2. Read [Scripts Pattern](./03-patterns/scripts-pattern.md) (20 min)
3. Read [Evals Pattern](./03-patterns/evals-pattern.md) (20 min)
4. Understand how to create skills, wrap scripts, define evals

**Day 6-7: Getting Started**

1. Follow [Quickstart](./04-getting-started/quickstart.md) (30 min)
2. Read [What Can I Build](./04-getting-started/what-can-i-build.md) (20 min)
3. Build your first workflow
4. Explore other examples

**Week 2+: Reference**

1. Read [Getting Started Guide](./05-reference/getting-started.md) (45 min)
2. Read [Contributing](./05-reference/contributing.md) (20 min)
3. Build custom workflows
4. Contribute to ecosystem

---

## Key Concepts

### Skills (Primitives)

**What they are:**

- Mental model building blocks (like components in React)
- Portable units of domain expertise
- Can run on any provider (Claude, OpenCode, Codex)

**What they contain:**

- Prompt (what agent knows)
- Scripts (what agent can use)
- Rules (what agent must do)
- Evals (how to measure success)

**Learn more:** [Skills Pattern](./03-patterns/skills-pattern.md)

---

### Scripts (Universal Access)

**What they are:**

- Wrappers around libraries you already use
- Executed via a shell tool
- Universal access to capabilities in the execution environment

**What this means:**

- Agent can call ANY Python script
- Agent can call ANY TypeScript script
- Agent can call ANY CLI tool (kubectl, docker, aws, terraform)
- Agent can access ANY library (pandas, numpy, CCXT, Web3.py)

**Learn more:** [Scripts Pattern](./03-patterns/scripts-pattern.md)

---

### State (Your System)

**What it is:**

- Your custom workflow state (what persists across time)
- The memory your system builds (analysis history, artifacts, positions)
- What you checkpoint for pause/resume and replay

**What this means:**

- You’re not building one-off prompts; you’re building systems with history
- The harness owns and manages state while the workflow runs

---

### Evals (Automatic Improvement)

**What they are:**

- Automatic quality measurement
- Data-driven improvement
- Record → Compare → Iterate

**What this means:**

- No guesswork ("I think this is better")
- Data proves what's better
- Regression detection
- CI/CD integration

**Learn more:** [Evals Pattern](./03-patterns/evals-pattern.md)

---

### Providers (Abstracted Away)

**What they are:**

- Claude SDK, OpenCode SDK, Codex SDK
- The "engine" that runs skills

**What this means:**

- You DON'T choose a provider (harness runs skills on all)
- You DON'T care about providers (they're abstracted away)
- Harness runs evals on all providers
- You see eval results (which provider is better?)
- You choose based on evals (or harness chooses automatically)

**Learn more:** [Providers](./02-architecture/providers.md)

---

### Harness (Infrastructure)

**What it is:**

- Layer above skills and providers
- Orchestrates skills
- Makes skills production-grade

**What it provides (for free):**

- Flow orchestration (nodes, edges, state, events)
- Full telemetry (auto-captured, no configuration)
- Evals (record, replay, compare, regression)
- Reliability (retries, timeout, production-grade)
- Transport layers (HTTP-SSE, WebSocket, Local)
- Recording & replay (automatic capture, deterministic testing)

**Learn more:** [Architecture](./02-architecture/architecture.md)

---

## Quick Links

### Most Important Documents

1. [Zen of Open Harness](./01-foundations/zen.md) - Mental model foundation
2. [Skills Pattern](./03-patterns/skills-pattern.md) - How to create skills
3. [Quickstart](./04-getting-started/quickstart.md) - 5-minute tutorial
4. [What Can I Build](./04-getting-started/what-can-i-build.md) - Concrete examples

### For Deep Dives

1. [Architecture](./02-architecture/architecture.md) - How it works under hood
2. [Telemetry](./02-architecture/telemetry.md) - Built-in observability
3. [Evals Pattern](./03-patterns/evals-pattern.md) - Automatic improvement
4. [Getting Started Guide](./05-reference/getting-started.md) - Comprehensive guide

---

## Manifest

**Status:** Scaffolding Complete  
**Completion:**

- ✅ Zen of Open Harness (full content)
- ✅ Telemetry (full content)
- ✅ Philosophy (outline)
- ✅ Skills Pattern (outline)
- ✅ Scripts Pattern (outline)
- ✅ Evals Pattern (outline)
- ✅ Quickstart (outline)
- ✅ What Can I Build (outline)
- ✅ Architecture (outline)
- ✅ Providers (outline)
- ✅ Getting Started (outline)
- ✅ Why Open Harness (outline)
- ✅ Contributing (outline)

**Next Phase:** Fill critical pages with full content (quickstart, skills-pattern, scripts-pattern, what-can-i-build)

---

## Notes

- **Skills are front and center:** Mental model primitive, what you create
- **Providers are abstracted away:** Users don't care, don't choose
- **Harness is infrastructure:** Makes skills production-grade, abstracts providers
- **State is the substrate:** Your system’s memory (persists across time)
- **Built-in telemetry:** Full observability, auto-captured, no configuration
- **Open source forever:** Core platform, products can be proprietary
- **Ecosystem focus:** Shared skills, harnesses, providers, scripts

---

**Start here:** [Zen of Open Harness](./01-foundations/zen.md)
