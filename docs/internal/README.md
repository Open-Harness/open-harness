# Internal Documentation

Project planning, decisions, and historical context for Open Harness development.

**This is NOT user-facing documentation.** User docs live in `apps/docs/`.

---

## Structure

```
docs/internal/
├── README.md           # You are here
├── milestones/         # Version-level planning
│   └── v0.2.0/
│       ├── VERSION_PLAN.md         # Master plan for v0.2.0
│       ├── EVAL_COMPLETION_PLAN.md # Detailed eval feature plan
│       └── EVAL_HISTORY_SUMMARY.md # Why we chose the hybrid model
├── templates/          # Reusable planning templates
│   └── VERSION_PLAN_TEMPLATE.md    # Template for future versions
├── decisions/          # Architecture Decision Records (ADRs)
│   ├── PROVIDER_ARCHITECTURE.md
│   └── PROVIDER_CLEAN_BREAK_IMPLEMENTATION_PLAN.md
└── archive/            # Historical exploration docs (not canonical)
    └── (dated exploration docs)
```

---

## How to Use

### Starting a New Version

1. Copy `templates/VERSION_PLAN_TEMPLATE.md` to `milestones/vX.Y.Z/VERSION_PLAN.md`
2. Fill in vision, scope, critical paths BEFORE writing code
3. Track progress by updating checkboxes in VERSION_PLAN.md

### Making Architecture Decisions

1. Create a new file in `decisions/` (e.g., `FEATURE_ARCHITECTURE.md`)
2. Document: Context, Decision, Consequences
3. Reference from VERSION_PLAN.md or feature plans

### Current Work

**Active:** `milestones/v0.2.0/VERSION_PLAN.md`

---

## What Goes Where

| Content Type | Location | Example |
|--------------|----------|---------|
| Version-level plan | `milestones/vX.Y.Z/VERSION_PLAN.md` | v0.2.0 scope, critical paths, release criteria |
| Feature plan | `milestones/vX.Y.Z/{FEATURE}_PLAN.md` | Detailed implementation plan for a feature |
| Architecture decision | `decisions/{NAME}.md` | Design choices with rationale |
| Exploration/research | `archive/` | Dated docs from discovery phases |
| Templates | `templates/` | Reusable structures |
| User-facing docs | `apps/docs/` (NOT here) | Guides, tutorials, API reference |
