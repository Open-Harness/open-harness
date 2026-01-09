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
specs/
├── MANIFEST.md (this file)
├── zen.md (COMPLETE - full content)
├── telemetry.md (COMPLETE - full content)
├── vision.md (OUTLINE ONLY)
├── why-open-harness.md (OUTLINE ONLY)
├── skills-pattern.md (OUTLINE ONLY)
├── scripts-pattern.md (OUTLINE ONLY)
├── evals-pattern.md (OUTLINE ONLY)
├── quickstart.md (OUTLINE ONLY)
├── what-can-i-build.md (OUTLINE ONLY)
├── architecture.md (OUTLINE ONLY)
├── providers.md (OUTLINE ONLY)
├── getting-started.md (OUTLINE ONLY)
├── contributing.md (OUTLINE ONLY)
└── philosophy.md (OUTLINE ONLY)
```

---

## Completion Status

### ✅ COMPLETE (Full Content)

**1. zen.md** - "Zen of Open Harness" - Mental model for building agentic systems
- The Core Pattern (Skills + Scripts + Evals)
- How to Think in This Paradigm
- Pattern Recognition (what to look for)
- Composition (how to combine skills/scripts/evals)
- The React Moment (how this changes building)

**2. telemetry.md** - Built-in telemetry capabilities
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

**3. vision.md** - Platform vision and long-term goals
- What Open Harness Is
- What Open Harness Is Not
- The Agentic Singularity
- Long-term Goals
- Open Source Forever

**4. why-open-harness.md** - Why we built this, what problems it solves
- The Gap in Spec-Driven Development
- Why Existing Tools Fall Short
- What Open Harness Does Differently
- Who This Is For

**5. skills-pattern.md** - How skills work, why they're better than MCP
- What Are Skills
- Skills vs. MCP
- Skill Structure
- Progressive Disclosure
- Creating Skills

**6. scripts-pattern.md** - Scripts + bash optimization = universal access
- What Are Scripts
- Scripts vs. MCP
- Bash Optimization
- Script Wrappers
- Examples

**7. evals-pattern.md** - How evals enable automatic improvement
- What Are Evals
- Why Evals Matter
- Eval Types
- Recording and Replay
- Regression Detection

**8. quickstart.md** - 5-minute tutorial (coding example)
- What You'll Build
- Step 1: Install SDK
- Step 2: Copy Example Workflow
- Step 3: Run It
- Step 4: See Events
- Step 5: Next Steps

**9. what-can-i-build.md** - Concrete examples of what's possible
- Coding Workflows
- Trading Systems
- Data Pipelines
- Customer Support
- Research & Analysis
- Ops & Automation
- Custom Agentic Systems

**10. architecture.md** - User-facing architecture overview
- System Components
- Execution Engine
- Provider Integration
- Evals System
- Recording & Replay
- Transport Layer

**11. providers.md** - Available providers, how to swap/mix
- Claude
- OpenCode (coming soon)
- Codex (coming soon)
- Swapping Providers
- Mixing Providers
- Provider Capabilities

**12. getting-started.md** - Comprehensive onboarding guide
- Installation
- First Workflow
- Understanding Workflows
- Creating Skills
- Adding Evals
- Next Steps

**13. contributing.md** - How to contribute to Open Harness
- Development Setup
- Code Style
- Testing
- Documentation Standards
- Pull Request Process

**14. philosophy.md** - Core philosophy and design principles
- DX-First
- Skills + Scripts + Evals
- Open Source Forever
- Ecosystem Building
- Human Flourishing

---

## Execution Plan

### ✅ Phase 1: Fill Zen Section (COMPLETE)
- [x] Write zen.md (full content, mental model)

### ✅ Phase 2: Outline All Pages (COMPLETE)
- [x] Create MANIFEST.md
- [x] Create zen.md (full content)
- [x] Create telemetry.md (full content)
- [x] Create outline file for each remaining page (12 files)
- [x] Add short descriptions for each section

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
- **No comparisons:** Stand on own feet, no mentions of others
- **Skills-first approach:** This is the way to use Open Harness
- **Scripts pattern:** Bash optimization = universal access
- **Built-ins documented:** Telemetry, SDK elements, shadcn components
- **Ecosystem focus:** Shared components, providers, harnesses all part of Open Harness
