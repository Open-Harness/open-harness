# Open Harness Documentation Manifest

**Status:** Scaffolding Complete (Phase 1-2 Done)  
**Last Updated:** 2026-01-07  
**Approach:** High-level first, then drill down

---

## Overview

This manifest tracks all documentation pages for Open Harness (0-2.0 launch).

**Current Phase:** All scaffolding complete (outlines ready)  
**Next Phase:** Fill critical pages with full content

---

## Documentation Structure

```
specs/portable/
├── README.md (index, navigation, learning path)
├── 01-foundations/
│   ├── zen.md (COMPLETE - full content)
│   └── philosophy.md (OUTLINE)
├── 02-architecture/
│   ├── architecture.md (OUTLINE)
│   ├── providers.md (OUTLINE)
│   └── telemetry.md (COMPLETE - full content)
├── 03-patterns/
│   ├── skills-pattern.md (OUTLINE)
│   ├── scripts-pattern.md (OUTLINE)
│   └── evals-pattern.md (OUTLINE)
├── 04-getting-started/
│   ├── quickstart.md (OUTLINE)
│   ├── what-can-i-build.md (OUTLINE)
│   ├── vision.md (OUTLINE)
│   └── why-open-harness.md (OUTLINE)
└── 05-reference/
    ├── getting-started.md (OUTLINE)
    └── contributing.md (OUTLINE)
```

---

## Completion Status

### ✅ COMPLETE (Full Content)

**01-foundations/zen.md** - "Zen of Open Harness" - Mental model for building agentic systems
- The Core Pattern (Skills + Scripts + Evals)
- How to Think in This Paradigm
- Pattern Recognition (what to look for)
- Composition (how to combine skills/scripts/evals)
- The React Moment (how this changes building)

**02-architecture/telemetry.md** - Built-in telemetry capabilities
- Flow-level events (start, complete, pause, resume, abort)
- Node-level events (start, complete, error, skip)
- Edge-level events (fire)
- Loop-level events (iterate)
- State-level events (patch)
- Command events (received)
- Agent events (start, thinking, text, tool, error, complete, paused, aborted)
- Performance metrics (tokens, cost, duration, turns)
- Usage metrics (tokens, loops, sessions)
- Error telemetry (full context)
- State visibility (snapshots, patches)
- Agent reasoning visibility (thinking process)
- Tool call visibility (full tracing)
- Transport layer (HTTP-SSE, WebSocket, Local)
- Recording & replay (automatic capture, deterministic testing)

### 📋 OUTLINE ONLY (Sections + Short Descriptions)

**01-foundations/philosophy.md** - Core philosophy and design principles
- DX-First
- Skills + Scripts + Evals (the core pattern)
- Open Source Forever
- Ecosystem Building
- Human Flourishing

**02-architecture/architecture.md** - User-facing architecture overview
- System Components
- Execution Engine
- Provider Integration
- Evals System
- Recording & Replay
- Transport Layer

**02-architecture/providers.md** - Available providers, how to swap/mix
- Claude
- OpenCode (coming soon)
- Codex (coming soon)
- Swapping Providers (abstracted away)
- Mixing Providers (different agents, different providers)

**03-patterns/skills-pattern.md** - How skills work, why they're better than MCP
- What Are Skills
- Skills vs. MCP (progressive disclosure, rules, massive context)
- Skill Structure
- Progressive Disclosure
- Creating Skills

**03-patterns/scripts-pattern.md** - Scripts + shell optimization = universal access
- What Are Scripts
- Scripts vs. MCP (shell tool optimization)
- Shell Optimization
- Script Wrappers
- Examples

**03-patterns/evals-pattern.md** - How evals enable automatic improvement
- What Are Evals
- Why Evals Matter (data, not guesswork)
- Eval Types
- Recording and Replay
- Regression Detection

**04-getting-started/quickstart.md** - 5-minute tutorial (coding example)
- What You'll Build
- Step 1: Install SDK
- Step 2: Copy Example Workflow
- Step 3: Run It
- Step 4: See Events
- Step 5: Next Steps

**04-getting-started/what-can-i-build.md** - Concrete examples of what's possible
- Coding Workflows
- Trading Systems
- Data Pipelines
- Customer Support
- Research & Analysis
- Ops & Automation
- Custom Agentic Systems

**04-getting-started/vision.md** - Platform vision and long-term goals
- What Open Harness Is
- What Open Harness Is Not
- The Agentic Singularity
- Long-term Goals
- Open Source Forever

**04-getting-started/why-open-harness.md** - Why we built this, what problems it solves
- The Gap in Spec-Driven Development
- Why Existing Tools Fall Short
- What Open Harness Does Differently
- Who This Is For

**05-reference/getting-started.md** - Comprehensive onboarding guide
- Installation
- First Workflow
- Understanding Workflows
- Creating Skills
- Adding Evals
- Next Steps

**05-reference/contributing.md** - How to contribute to Open Harness
- Development Setup
- Code Style
- Testing
- Documentation Standards
- Pull Request Process

---

## Execution Plan

### ✅ Phase 1: Fill Zen Section (COMPLETE)
- [x] Write zen.md (full content, mental model)

### ✅ Phase 2: Outline All Pages (COMPLETE)
- [x] Create README.md (index, navigation, learning path)
- [x] Create zen.md (full content)
- [x] Create telemetry.md (full content)
- [x] Create outline file for each remaining page (12 files)
- [x] Add short descriptions for each section
- [x] Move all docs to portable/ with numbered subfolders

### ⏳ Phase 3: Fill Critical Pages (NEXT)
- [ ] Fill in quickstart.md (5-minute tutorial)
- [ ] Fill in skills-pattern.md (core approach)
- [ ] Fill in scripts-pattern.md (bash optimization)
- [ ] Fill in what-can-i-build.md (coding, trading examples)

### ⏳ Phase 4: Fill All Pages (SUBSEQUENT)
- [ ] Fill in all remaining outline files
- [ ] Review and refine
- [ ] Proofread and format

### ⏳ Phase 5: Launch Assets
- [ ] Landing page content
- [ ] Blog post
- [ ] Demo video
- [ ] Social media posts

---

## Notes

- **Zen section is COMPLETE:** Mental model foundation written
- **Telemetry section is COMPLETE:** Built-in capabilities documented
- **All outlines are COMPLETE:** 12 pages with sections + descriptions
- **Portable folder structure:** All docs in specs/portable/ with numbered subfolders
- **Skills are front and center:** Mental model primitive, what users create
- **Providers are abstracted away:** Users don't care, don't choose
- **Harness is infrastructure:** Makes skills production-grade
- **No comparisons:** Stand on own feet, no mentions of others
- **Open source forever:** Core platform, products can be proprietary
- **Ecosystem focus:** Shared skills, harnesses, providers, scripts
