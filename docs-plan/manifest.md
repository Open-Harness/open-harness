# Documentation Plan Manifest

**Created**: 2026-01-01
**Status**: COMPLETE - Ready for Execution
**Goal**: Create a well-structured documentation site for end users and contributors

---

## Session Context

This manifest tracks the documentation planning effort across context windows. All research, decisions, and outlines are persisted here.

### Key Constraints
- External interfaces are stabilizing - prioritize documenting stable surface area
- Internals may still be refactored - avoid deep implementation docs
- Current "docs" are specs that code was compiled from - need user-facing docs

### Target Audiences
1. **End Users**: Developers using the SDK/harness
2. **Contributors**: Developers extending or maintaining the codebase

---

## Directory Structure

```
docs-plan/
├── manifest.md                    # This file - central index
├── research/                      # Sub-agent research outputs
│   ├── codebase.yaml             [COMPLETE]
│   ├── existing-docs.yaml        [COMPLETE]
│   ├── diataxis.yaml             [COMPLETE]
│   └── user-needs.yaml           [COMPLETE]
├── decisions/
│   └── ADR-001-documentation-structure.md [COMPLETE]
├── structure.md                   [COMPLETE] - Full site structure
└── outlines/
    ├── learn-tutorials.md        [COMPLETE] - 10 pages, ~30 hours
    ├── guides-howto.md           [COMPLETE] - 28 pages, ~44 hours
    ├── reference.md              [COMPLETE] - 35 pages, ~59 hours
    ├── concepts-explanation.md   [COMPLETE] - 20 pages, ~55 hours
    └── contributing.md           [COMPLETE] - 18 pages, ~47 hours
```

---

## Research Status

| Area | Status | Output File | Summary |
|------|--------|-------------|---------|
| Codebase Structure | COMPLETE | `research/codebase.yaml` | 4 packages, kernel core, dual runtime (Harness+Flow) |
| Existing Docs Audit | COMPLETE | `research/existing-docs.yaml` | 320 files, 90% spec, user docs are stubs |
| Diátaxis Methodology | COMPLETE | `research/diataxis.yaml` | 4 quadrants mapped to SDK context |
| User/Contributor Needs | COMPLETE | `research/user-needs.yaml` | 3 personas, critical gaps identified |

---

## Decisions Log

| ID | Date | Decision | Rationale | File |
|----|------|----------|-----------|------|
| ADR-001 | 2026-01-01 | Diátaxis navigation structure | User answered: Redesign navigation | `decisions/ADR-001-documentation-structure.md` |
| ADR-001 | 2026-01-01 | Parallel user/contributor tracks | User answered: Both equally | `decisions/ADR-001-documentation-structure.md` |
| ADR-001 | 2026-01-01 | Translate specs to user docs | User answered: Translation over sync | `decisions/ADR-001-documentation-structure.md` |
| ADR-001 | 2026-01-01 | Single version (no versioning) | User answered: Single version | `decisions/ADR-001-documentation-structure.md` |
| ADR-001 | 2026-01-01 | Keep oharnes internal | User answered: Keep internal | `decisions/ADR-001-documentation-structure.md` |
| ADR-002 | 2026-01-01 | Reference + Concepts first | Foundation before tutorials/guides | Updated in manifest |

---

## Final Plan Summary

### Site Structure (Diátaxis-based)

```
/                           # Landing page
├── /learn/                 # TUTORIALS (P1 - Critical)
│   ├── quickstart.mdx      # 5-min first flow
│   ├── first-flow.mdx      # Complete tutorial
│   ├── custom-node.mdx     # Build custom nodes
│   ├── hub-events.mdx      # Subscribe to events
│   ├── channels.mdx        # Attach channels
│   ├── testing.mdx         # Test your flows
│   └── advanced/           # Conditional, bindings, multi-agent
├── /guides/                # HOW-TO GUIDES (P2)
│   ├── flows/              # 5 guides
│   ├── nodes/              # 4 guides
│   ├── hub/                # 4 guides
│   ├── channels/           # 4 guides
│   ├── agents/             # 3 guides
│   ├── testing/            # 3 guides
│   └── debugging/          # 4 guides (critical for support)
├── /reference/             # REFERENCE (P2)
│   ├── api/                # 10 function/class docs
│   ├── types/              # 8 interface docs
│   ├── schemas/            # 3 Zod schema docs
│   ├── events/             # 4 event type docs
│   ├── bindings/           # 2 binding docs
│   ├── when/               # 2 when expression docs
│   ├── config/             # 2 config docs
│   └── kernel-spec/        # Synced from packages/kernel/docs
├── /concepts/              # EXPLANATION (P3)
│   ├── architecture/       # 4 architecture concepts
│   ├── flows/              # 4 flow concepts
│   ├── hub/                # 3 hub concepts
│   ├── channels/           # 2 channel concepts
│   ├── agents/             # 2 agent concepts
│   ├── testing/            # 2 testing concepts
│   └── design-decisions/   # 3 ADR explanations
└── /contributing/          # CONTRIBUTOR TRACK (P2)
    ├── architecture/       # 4 codebase architecture
    ├── development/        # 4 development workflow
    ├── extending/          # 3 extension guides
    ├── specifications/     # 3 spec reading guides
    └── releasing/          # 2 release guides
```

### Effort Estimates

| Section | Pages | Effort | Priority |
|---------|-------|--------|----------|
| /reference/ | 35 | ~59 hours | P1 - Foundation |
| /concepts/ | 20 | ~55 hours | P1 - Foundation |
| /contributing/ | 18 | ~47 hours | P2 |
| /learn/ | 10 | ~30 hours | P3 |
| /guides/ | 28 | ~44 hours | P3 |
| **TOTAL** | **111 pages** | **~235 hours** | - |

### Execution Order

**Phase 1: P1 - Reference (Foundation)** (~59 hours)
- /reference/api/ - All 10 function/class docs
- /reference/types/ - All 8 interface docs
- /reference/schemas/ - All 3 Zod schema docs
- /reference/events/ - All 4 event type docs
- /reference/bindings/ - A3 syntax reference
- /reference/when/ - When expression reference
- /reference/config/ - Configuration reference
- Sync kernel-spec

**Phase 2: P1 - Concepts (Foundation)** (~55 hours)
- /concepts/architecture/ - 4 architecture concepts
- /concepts/flows/ - DAG model, bindings, when, node lifecycle
- /concepts/hub/ - Event bus, context propagation, commands vs events
- /concepts/channels/ - Adapter pattern, bidirectional I/O
- /concepts/agents/ - Execution model, inbox pattern
- /concepts/testing/ - Replay model, conformance
- /concepts/design-decisions/ - ADR explanations

**Phase 3: P2 - Contributing** (~47 hours)
- /contributing/architecture/ - Codebase architecture
- /contributing/development/ - Workflow, testing, fixtures
- /contributing/extending/ - Custom nodes, channels, providers
- /contributing/specifications/ - Reading specs, traceability

**Phase 4: P3 - Tutorials & Guides** (~74 hours)
- /learn/ - All 10 tutorials
- /guides/ - All 28 how-to guides
- Landing page updates

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `structure.md` | Complete site structure with all pages |
| `outlines/learn-tutorials.md` | Detailed outlines for each tutorial |
| `outlines/guides-howto.md` | Detailed outlines for each how-to guide |
| `outlines/reference.md` | Detailed outlines for API reference |
| `outlines/concepts-explanation.md` | Detailed outlines for concept pages |
| `outlines/contributing.md` | Detailed outlines for contributor docs |
| `decisions/ADR-001-documentation-structure.md` | Key decisions and rationale |

---

## Content Creation Notes

### Voice Guidelines by Section

| Section | Voice | Example |
|---------|-------|---------|
| /learn/ | First-person plural, encouraging | "We'll create our first flow..." |
| /guides/ | Direct, task-focused | "To parse a YAML flow, do..." |
| /reference/ | Neutral, factual | "Returns FlowYaml object..." |
| /concepts/ | Discursive, reflective | "The Hub exists because..." |
| /contributing/ | Technical, direct | "The protocol/ directory contains..." |

### Code Examples

Every page needs working code examples:
- Tutorials: Complete, runnable examples
- Guides: Focused snippets solving the task
- Reference: Minimal usage examples
- Concepts: Illustrative examples

### Cross-Linking Strategy

- Tutorials link forward to guides for more
- Guides link to reference for details
- Reference links to concepts for understanding
- Concepts link to tutorials for practice
- Everything links to reference as needed

---

## Migration from Current Structure

The existing `apps/docs/` Fumadocs site will be reorganized:

1. **Navigation Config**: Update to Diátaxis structure
2. **File Reorganization**: Move stubs to new locations
3. **Content Fill**: Replace stubs with outlined content
4. **Kernel Spec Sync**: Keep existing sync mechanism

Migration can happen incrementally - landing page first, then tutorials, then expand.

---

## Success Criteria

1. **Users can start in 5 minutes**: Quickstart works flawlessly
2. **Users can build production flows**: Guides cover common tasks
3. **Users can find any API detail**: Reference is complete
4. **Users understand why**: Concepts explain design
5. **Contributors can onboard**: Contributing guides work
6. **No 404s**: All stubs replaced with content

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-01 | Initial manifest created, research phase started |
| 2026-01-01 | All 4 research agents completed, synthesis added |
| 2026-01-01 | User clarification complete, ADR-001 created |
| 2026-01-01 | Structure plan completed |
| 2026-01-01 | All 5 content outline files completed |
| 2026-01-01 | **PLAN COMPLETE** - Ready for execution |
| 2026-01-01 | Priority reordered: Reference + Concepts (P1), Contributing (P2), Tutorials/Guides (P3) |
