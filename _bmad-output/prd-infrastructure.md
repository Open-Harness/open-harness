# Product Requirements Document - Infrastructure

**Project:** Open Harness  
**Track:** Infrastructure  
**Author:** Abdullah  
**Date:** December 24, 2025  
**Version:** 1.0  

---

## Executive Summary

This PRD covers the **infrastructure foundation** for Open Harness - making the repository contributor-ready with clean structure, working publishing, and developer experience basics.

This is **infrastructure work that unlocks velocity** - not feature development, but the foundation that enables future feature development.

**Scope:** Repo structure, CI/CD, publishing, documentation scaffolds  
**Not in Scope:** SDK primitives, Harness API, agent features (see PRD-Harness)

---

## Problem Statement

Currently, the monorepo structure prevents:
- New contributors from understanding how to add examples
- Clean separation between stable (SDK/CLI) and experimental (examples)
- Proper publishing and versioning workflows
- Clear developer onboarding path

---

## Success Criteria

### Developer Experience

- **5-Minute Rule**: Clone, install, and run an example in under 5 minutes
- **Self-Evident Structure**: No "where do I put this?" questions
- **Self-Documenting**: Every folder has a README answering "what is this?"

### Technical Success

- **Publishing Works First Try**: `npm publish` from `packages/sdk` succeeds
- **Fresh Clone Passes CI**: `git clone && bun install && bun run build` works
- **Examples Execute**: Each example runs successfully out of the box

### Measurable Outcomes

| Metric | Target | Validation |
|--------|--------|------------|
| Clone-to-run time | < 5 minutes | Manual test |
| README coverage | 100% of folders | CI check |
| First external PR | < 30 days post-publish | GitHub tracking |
| Dead links | 0 | CI link checker |

---

## MVP Scope

### Must Have

- [ ] Monorepo restructure complete (`packages/`, `apps/`, `examples/`)
- [ ] Trading bot moved to `examples/` or `_experimental/`
- [ ] Server package deleted (dead code)
- [ ] SDK publishing scripts work
- [ ] Root README explains the project
- [ ] Every folder has a README (minimum: one sentence + purpose)

### Should Have

- [ ] CI/CD pipeline (GitHub Actions)
  - `bun install` works
  - `bun run build` compiles
  - `bun run lint` passes (Biome)
  - `bun test` unit tests pass
- [ ] Changesets for versioning + changelog automation
- [ ] GitHub Actions for automated npm publishing
- [ ] CONTRIBUTING.md guiding new contributors
- [ ] Issue templates (environment, repro steps, expected behavior)
- [ ] PR templates guiding contribution process

### Nice to Have (Post-MVP)

- [ ] Fumadocs skeleton deployed
- [ ] VS Code snippets for common patterns
- [ ] Cross-platform CI matrix (Mac + Linux)

---

## User Journeys

### Journey 1: Alex - The Curious Evaluator

Alex finds Open Harness on GitHub. They see a clean structure: `packages/`, `apps/`, `examples/`. The root README answers their questions in 30 seconds:
1. What is this? → First line explains it
2. Is it mature enough? → Version badge
3. Can I try it quickly? → Quickstart command

Within 5 minutes, Alex has cloned, installed, and run an example. It works.

### Journey 2: Sam - The First-Time Contributor

Sam wants to contribute an example. They find `CONTRIBUTING.md` in the root. It says: "To add an example, create a folder in `examples/` with a README."

In 20 minutes, Sam creates their example, writes a README, and opens a PR. CI passes on first try. Two days later, merged.

### Journey 3: Jordan - The SDK Consumer

Jordan runs `npm install @openharness/sdk`. The quickstart shows a 10-line example. Within 15 minutes, they have a working agent.

### Journey 4: Abdullah - The Maintainer

Abdullah reviews a PR. CI already ran - tests pass, build succeeds. He merges with confidence.

When he fixes a bug, he runs `bun changeset`, commits, and merges. GitHub Actions bumps version, updates changelog, publishes to npm. No manual steps.

---

## Technical Requirements

### Runtime & Language
- TypeScript-first, Bun-first
- Node.js compatible (Bun recommended)
- Contributors MUST use Bun for PRs

### Package Distribution
- npm publishing (`@openharness/sdk`)
- Works with bun/npm/pnpm/yarn

### Folder Structure

```
open-harness/
├── packages/
│   └── sdk/                 # Core SDK
├── apps/
│   ├── cli/                 # CLI runner
│   └── docs/                # Documentation site
├── examples/                # Working examples
│   └── [example-name]/
├── _experimental/           # Not ready for use
│   ├── trading-bot/
│   └── autonomous-coder/
├── README.md                # Project overview
├── CONTRIBUTING.md          # How to contribute
└── .github/
    ├── workflows/           # CI/CD
    ├── ISSUE_TEMPLATE/
    └── PULL_REQUEST_TEMPLATE.md
```

---

## Out of Scope

❌ **Not in this PRD:**
- SDK primitives (Harness, Agent, Step, State) → See PRD-Harness
- New features or API changes → See PRD-Harness
- Full documentation content (scaffolds only)
- Video tutorials or visual content

---

## Dependencies

- None - this is foundational work

## Blocked By

- Nothing - can start immediately

## Blocks

- PRD-Harness benefits from clean structure but doesn't strictly require it
