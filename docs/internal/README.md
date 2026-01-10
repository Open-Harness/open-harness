# Internal Documentation

Project planning, decisions, and historical context for Open Harness development.

**This is NOT user-facing documentation.** User docs live in `apps/docs/`.

---

## Structure

```
docs/internal/
├── README.md           # You are here
├── milestones/         # Version-level planning
│   └── v0.3.0/
│       ├── ARCHITECTURE.md    # Signal-based reactive architecture
│       ├── ROADMAP.md         # Epic tracking and progress
│       ├── GREENFIELD.md      # Clean slate design
│       └── milestones/        # Phase-specific details
├── templates/          # Reusable planning templates
│   └── VERSION_PLAN_TEMPLATE.md
├── decisions/          # Architecture Decision Records (ADRs)
│   ├── PROVIDER_ARCHITECTURE.md
│   └── PROVIDER_CLEAN_BREAK_IMPLEMENTATION_PLAN.md
└── archive/            # Historical exploration docs (not canonical)
    └── (dated exploration docs)
```

---

## How to Use

### Starting a New Version

1. Copy `templates/VERSION_PLAN_TEMPLATE.md` to `milestones/vX.Y.Z/`
2. Fill in vision, scope, critical paths BEFORE writing code
3. Track progress by updating checkboxes in ROADMAP.md

### Making Architecture Decisions

1. Create a new file in `decisions/` (e.g., `FEATURE_ARCHITECTURE.md`)
2. Document: Context, Decision, Consequences
3. Reference from ROADMAP.md or feature plans

### Current Work

**Active:** `milestones/v0.3.0/ROADMAP.md`

The v0.3.0 release introduces the signal-based reactive architecture:
- Signals as first-class primitives
- `createHarness<TState>()` factory pattern
- `agent({ activateOn, emits, when })` configuration
- `runReactive()` execution
- Event-sourced recording/replay

---

## What Goes Where

| Content Type | Location | Example |
|--------------|----------|---------|
| Version-level plan | `milestones/vX.Y.Z/ROADMAP.md` | v0.3.0 epics, progress tracking |
| Architecture spec | `milestones/vX.Y.Z/ARCHITECTURE.md` | Signal-based design, mental model |
| Architecture decision | `decisions/{NAME}.md` | Design choices with rationale |
| Exploration/research | `archive/` | Dated docs from discovery phases |
| Templates | `templates/` | Reusable structures |
| User-facing docs | `apps/docs/` (NOT here) | Guides, tutorials, API reference |
