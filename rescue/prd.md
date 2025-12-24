---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - path: "docs/project-overview.md"
    type: "project-docs"
  - path: "docs/architecture-sdk.md"
    type: "project-docs"
  - path: "packages/sdk/README.md"
    type: "project-docs"
  - path: "packages/sdk/QUICKSTART.md"
    type: "project-docs"
  - path: "TRADING-BOT-ARCHITECTURE.md"
    type: "project-docs"
  - path: "_bmad-output/issues/dao-sdk-agent-architecture-gaps.md"
    type: "issues"
  - path: "_bmad-output/tech-spec-dao-cli-workflow-runner.md"
    type: "tech-spec"
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 0
  projectDocs: 7
workflowType: 'prd'
lastStep: 0
project_name: 'Open Harness'
user_name: 'Abdullah'
date: '2024-12-24'
---

# Product Requirements Document - Open Harness

**Author:** Abdullah
**Date:** 2024-12-24

---

## Executive Summary

Open Harness is an extensible workflow SDK for building AI agent applications with Anthropic's Claude. The core SDK is functional and nearly ready for npm publishing, but the monorepo structure needs reorganization to be contributor-ready.

This PRD defines the foundation reorganization effort to transform the current developer-hostile structure into a clean, navigable monorepo that enables both external contributors and internal development velocity.

### What Makes This Special

This is **infrastructure work that unlocks velocity** - not feature development, but the foundation that enables future feature development. Currently, the monorepo structure prevents:
- New contributors from understanding how to add examples
- Clean separation between stable (SDK/CLI) and experimental (examples)
- Proper publishing and versioning workflows
- Clear developer onboarding path

The reorganization creates a **contributor-ready foundation** where the structure itself guides developers on how to build with and contribute to Open Harness.

## Project Classification

**Technical Type:** developer_tool (SDK + CLI + monorepo)
**Domain:** General (developer tooling infrastructure)
**Complexity:** Medium
**Project Context:** Brownfield - reorganizing existing functional codebase

### Scope Summary

**Phase 1: Structural Foundation**
- Reorganize monorepo: `packages/` (SDK), `apps/` (CLI), `examples/` (trading bot + future)
- Branch management: Move trading bot to separate branch, clean up main
- Publishing setup: npm scripts, versioning, CI/CD pipeline

**Phase 2: Developer Onboarding Foundation**
- Fumadocs skeleton: Landing, quickstart, auto-generated examples index
- README hierarchy: Each package/app/example self-documenting
- Clear stability signals: What's stable vs experimental

**Target:** Contributor-ready foundation (not end-user polish)

---

## Success Criteria

### User Success (Developer Experience)

- **5-Minute Rule**: A new developer can clone, install, and run an example in under 5 minutes
- **Self-Evident Structure**: No "where do I put this?" questions - folder structure guides contribution
- **Self-Documenting**: Every folder has a README answering "what is this?" in one sentence

### Business Success

- **Contributor Velocity**: First external PR submitted within 30 days of publishing
- **No Onboarding Debt**: Zero "how does this repo work?" issues/DMs in first month
- **Internal Velocity**: Add a new example in under 30 minutes without touching core

### Technical Success

- **Publishing Works First Try**: `npm publish` from `packages/sdk` succeeds without manual steps
- **Fresh Clone Passes CI**: `git clone && bun install && bun run build` works every time
- **Examples Execute**: Each example runs successfully out of the box

### Measurable Outcomes

| Metric | Target | Validation |
|--------|--------|------------|
| Clone-to-run time | < 5 minutes | Manual test |
| README coverage | 100% of folders | CI check |
| First external PR | < 30 days post-publish | GitHub tracking |
| Dead links | 0 | CI link checker |

---

## Product Scope

### MVP - Minimum Viable Product

- [ ] Monorepo restructure complete (`packages/`, `apps/`, `examples/`)
- [ ] Trading bot moved to `examples/` (or separate branch)
- [ ] Server package deleted
- [ ] SDK publishing scripts work
- [ ] Root README explains the project
- [ ] Every folder has a README

### Growth Features (Post-MVP)

- [ ] Fumadocs skeleton deployed
- [ ] CI/CD pipeline for automated publishing
- [ ] Changesets for versioning
- [ ] Contribution guide (CONTRIBUTING.md)

### Vision (Future)

- [ ] Auto-generated API docs
- [ ] Multiple example agents showcasing different patterns
- [ ] Community showcase of third-party examples

---

## User Journeys

### Journey 1: Alex Chen - The Curious Evaluator

Alex is a senior developer at a startup building an AI-powered code review tool. They've been wrestling with the Anthropic SDK directly, managing agent state manually, and their codebase is becoming a mess of callbacks and retry logic. Late one evening, while searching GitHub for "Claude agent framework," they stumble upon Open Harness.

They click into the repo and immediately see a clean structure: `packages/`, `apps/`, `examples/`. The root README answers their first questions in 30 seconds:
1. **What is this?** → First line explains it
2. **Is it mature enough?** → Version badge, "used by" examples
3. **Can I try it quickly?** → Quickstart command right there

Within 5 minutes, Alex has cloned the repo, run `bun install`, and executed the example. It works. The monologue output shows readable narrative instead of raw tool calls. They think, "This is exactly what I needed - someone already solved the agent orchestration problem." By the next standup, Alex is pitching Open Harness to their team.

### Journey 2: Sam Rivera - The First-Time Contributor

Sam has been using Open Harness for a month to build an autonomous documentation agent. They've developed a pattern they're proud of - an agent that reads a codebase and generates README files. They want to share it as an example.

Sam navigates to the repo and finds `CONTRIBUTING.md` in the root. It says: "To add an example, create a folder in `examples/` with a README explaining your pattern." They look at the existing trading bot example as a template.

In 20 minutes, Sam has created `examples/readme-generator/`, added their code, written a README explaining the "codebase-to-docs" pattern, and run the tests locally. They open a PR. The CI passes on first try because the structure is self-evident - no special configuration needed. Two days later, their example is merged and they're officially an Open Harness contributor.

### Journey 3: Jordan Park - The SDK Consumer

Jordan is building a customer support agent that handles refund requests autonomously. They've heard about Open Harness from a colleague and want to try it.

They run `npm install @openharness/sdk` and open the README. The quickstart shows a 10-line example creating an agent with a custom prompt. Jordan copies it, modifies the prompt for refund handling, and runs it. Within 15 minutes, they have a working agent that can process a refund request.

Over the next week, Jordan explores the SDK further - adding a TaskList for tracking multiple requests, using the Monologue wrapper for readable logs their ops team can monitor. Each capability is discoverable through TypeScript autocomplete and documented with JSDoc comments. Jordan never needs to ask "how does this work?" - the code tells them.

### Journey 4: Abdullah - The Maintainer

Abdullah wakes up to a GitHub notification - Sam has opened a PR adding a new example. He clicks through to the PR and sees the CI has already run: all tests pass, the build succeeds, and the new example is isolated in `examples/readme-generator/`. He doesn't need to clone locally to verify - the CI did the work.

He reviews the code, leaves one small comment about README formatting, and Sam fixes it within the hour. Abdullah clicks "Merge" with confidence. The example is live.

A week later, Abdullah fixes a bug in the SDK's TaskList. He runs `bun changeset`, describes the fix, and commits. When he merges to main, GitHub Actions automatically bumps the version, updates the changelog, and publishes to npm. No manual `npm publish`, no version number juggling.

A month in, an issue comes in: "Example doesn't work on Node 18." The issue template already captured the user's environment, steps to reproduce, and expected behavior. Abdullah can triage in 2 minutes instead of 20 back-and-forth comments asking for details.

---

### Journey Requirements Summary

| Journey | Key Capabilities Required |
|---------|---------------------------|
| **Evaluator (Alex)** | Clear README hierarchy, working examples, 5-min clone-to-run |
| **Contributor (Sam)** | CONTRIBUTING.md, example template, CI that validates PRs |
| **SDK Consumer (Jordan)** | npm publishing, quickstart docs, discoverable API |
| **Maintainer (Abdullah)** | CI/CD pipeline, Changesets, issue/PR templates |

**Revealed Requirements (MVP additions from Journey 4):**
- CI that validates PRs (build, test, lint) automatically
- Changesets for automated versioning and changelog
- GitHub Actions for release automation
- Issue templates (environment, repro steps, expected behavior)
- PR template guiding contributors

---

## Developer Tool Requirements

### Core Concept: The Harness Pattern

**What is Open Harness?**

Open Harness is a TypeScript framework for building autonomous AI agents that maintain coherent decision-making over extended periods of time.

Unlike one-shot LLM calls, Open Harness agents:
- **Persist state** across sessions and restarts
- **Build on previous work** with iterative refinement loops
- **Execute autonomously** for hours or days without human intervention

**What Open Harness is NOT:**
- A chatbot framework (request/response)
- A simple API wrapper (Anthropic SDK already does that)
- A prompt library

### Target Use Cases

| Use Case | Description | Example |
|----------|-------------|---------|
| **Software Engineering Agents** | Autonomous coding, spec building, test generation | BMAD workflow execution |
| **Trading Agents** | Strategy execution, portfolio management over time | Autonomous trading bot |
| **Meta-Agents** | Agents orchestrating other agents through workflows | Agent running BMAD for multiple projects |

### SDK Primitives (Harness Lens)

| Primitive | Purpose |
|-----------|---------|
| **Agent** | Autonomous decision-maker with persistent identity |
| **Workflow** | Decision loop structure for iterative execution |
| **Task** | Unit of work tracked across sessions |
| **Monologue** | Human-readable trace of autonomous reasoning |

### Technical Requirements

**Runtime & Language:**
- TypeScript-first, Bun-first
- Node.js compatible (but Bun recommended)
- Contributors MUST use Bun for PRs

**Package Distribution:**
- npm publishing (`@openharness/sdk`)
- Works with bun/npm/pnpm/yarn (Bun recommended)

**Documentation Strategy:**
- Guides & tutorials (scaffolded, not fully written for MVP)
- API reference (auto-generated from TypeScript types)
- Examples auto-generate docs when added to `harnesses/` folder

**IDE Support:**
- TypeScript types + JSDoc provide IntelliSense
- VS Code snippets (roadmap item)

### Folder Structure Update

Based on the Harness pattern, rename `examples/` to `harnesses/`:

```
harnesses/
├── trading/           # Autonomous trading agent
├── autonomous-coder/  # Autonomous coding agent (from SDK example)
└── [future]/          # Additional harness implementations
```

Each harness folder contains:
- Implementation code
- README explaining the pattern
- Auto-generated docs integration

---

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Platform MVP - Building contributor-ready foundation with working reference implementation

**Core Philosophy:** "Stop defining tools. Start teaching systems."

Open Harness's architectural magic is simplicity:
- **No MCP complexity** - One tool (Bash) instead of dozens of custom tools
- **No context bloat** - Teach the system via prompt, not tool schemas
- **Leverage Claude's training** - It already knows Bash, we teach it systems

**Resource Requirements:**
- Primary: 1 developer (Abdullah)
- Timeline: Flexible - prioritize doing it right over speed
- Dependencies: Working neomutt installation for reference harness

### MVP Feature Set (Phase 1)

**Infrastructure Foundation**

✅ **Monorepo Restructure:**
- `packages/` - SDK core
- `apps/` - CLI and future applications  
- `harnesses/` - Reference implementations (renamed from `examples/`)
- Delete server package (dead code)

✅ **Experimental Marking:**
- Move `trading/` to `_experimental-trading/` (not ready)
- Move `autonomous-coder/` to `_experimental-autonomous-coder/` (broken, needs architecture fixes)

✅ **Developer Experience:**
- Root README explaining Open Harness vision
- Minimum README in every folder (one sentence + quick start)
- Full README only for root and SDK package
- CONTRIBUTING.md guiding new contributors
- Issue templates (environment, repro steps, expected behavior)
- PR templates guiding contribution process

✅ **Automation Layer (Enables "Contributor-Ready"):**
- CI/CD pipeline (GitHub Actions)
  - `bun install` works
  - `bun run build` compiles
  - `bun run lint` passes (Biome)
  - `bun test` unit tests pass
  - Fast (<2 min), structural checks only
- Changesets for versioning + changelog automation
- GitHub Actions for automated npm publishing
- Publishing scripts work first try

**Reference Harness Implementation (NEW)**

✅ **`harnesses/email-assistant/` - The Showcase Example:**

Progressive disclosure teaching the harness pattern:

```
harnesses/email-assistant/
├── README.md              # Narrative: "Managing Email with Open Harness"
├── basic/                 # Step 1: Simple agent calling neomutt via Bash
│   ├── index.ts
│   └── prompts/
│       └── email-manager.md
├── workflow/              # Step 2: Multi-step harness with state
│   ├── index.ts
│   └── prompts/
└── advanced/              # Step 3: Full autonomous email management
    ├── index.ts
    └── prompts/
```

**Why email-assistant?**
- **Real tool:** neomutt (installable everywhere: `brew install neomutt`)
- **Demonstrates core pattern:** Agent + Bash + Prompt teaching system
- **Progressive complexity:** Basic → Workflow → Autonomous
- **Testable:** Deterministic CLI tool, mockable bash execution
- **Relatable:** Everyone has email pain - immediate value understanding

**Architecture Highlight:**
```typescript
const emailAgent = createAgent({
  name: 'email-assistant',
  prompt: emailPrompt,  // Teaches neomutt commands + workflow
  tools: ['bash(neomutt:*)']  // Scoped bash access - NO custom tool schemas
})
```

**No MCP. No tool definitions. Just Bash + prompt.**

**SDK Terminology Fix (NEW)**

✅ **Rename `Workflow` → `Harness` throughout SDK:**
- Update TypeScript types, exports
- Update documentation, examples
- Migration guide for existing users
- Reflects true abstraction: wrapping agents for long-running autonomous execution

### Post-MVP Features

**Phase 2 (Growth):**
- Fumadocs skeleton deployed (landing, quickstart, auto-generated harness index)
- VS Code snippets for common harness patterns
- Fix `_experimental-autonomous-coder/` (requires solving agent architecture gaps)
- Fix `_experimental-trading/` (functional trading strategy)
- Additional harness examples (git-assistant, ffmpeg-processor)
- Cross-platform CI matrix (Mac + Linux)
- E2E tests with real Anthropic API

**Phase 3 (Expansion):**
- Auto-generated API docs from TypeScript types
- Multiple harness showcases demonstrating different patterns
- Community harness gallery
- Performance benchmarks
- Long-running agent testing suite (session persistence, decision coherence, chaos testing)

### Core User Journeys Supported in MVP

| Journey | Enabled By |
|---------|-----------|
| **Evaluator (Alex)** | Clean structure, root README, working email-assistant harness (5-min runnable) |
| **Contributor (Sam)** | CONTRIBUTING.md, harness template, CI validates PRs automatically |
| **SDK Consumer (Jordan)** | npm publishing, quickstart docs, discoverable TypeScript API |
| **Maintainer (Abdullah)** | CI/CD, Changesets, GitHub Actions, issue/PR templates |

### Must-Have Capabilities (Pass/Fail Gates)

| Capability | Test | Status |
|------------|------|--------|
| Clone and build | `git clone && bun install && bun run build` succeeds | ✅ MVP |
| Run reference harness | `cd harnesses/email-assistant/basic && bun start` works in <5 min | ✅ MVP |
| Contribute new harness | Follow CONTRIBUTING.md, PR passes CI first try | ✅ MVP |
| Publish SDK | `npm publish` from packages/sdk succeeds without manual steps | ✅ MVP |
| Discover structure | Every folder README answers "what is this?" | ✅ MVP |

### Risk Mitigation Strategy

**Technical Risks:**
- **Risk:** Email-assistant harness is complex to build correctly
- **Mitigation:** Start with basic/ (simplest version), iterate to workflow/, then advanced/
- **Fallback:** If neomutt proves problematic, use simpler CLI tool (curl, git)

**Market Risks:**
- **Risk:** "Contributor-ready" doesn't actually attract contributors
- **Validation:** Track time-to-first-external-PR (30-day target)
- **Mitigation:** Active outreach to developer communities once shipped

**Resource Risks:**
- **Risk:** Takes longer than expected to build reference harness correctly
- **Mitigation:** Timeline is flexible - prioritize quality over speed
- **Contingency:** Ship infrastructure first, add email-assistant harness incrementally

### Out of Scope (Explicitly Deferred)

❌ **Not in this PRD:**
- Fixing agent architecture gaps (structured output contracts, workflow guardrails)
- Multiple working harness examples beyond email-assistant
- Full documentation content (scaffolds only)
- Video tutorials or visual content
- Multi-language SDK support (Python, etc.)
- Advanced testing (E2E, integration, performance)
