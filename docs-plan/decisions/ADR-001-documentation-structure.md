# ADR-001: Documentation Structure and Strategy

**Date**: 2026-01-01
**Status**: Accepted
**Deciders**: User + Planning Session

## Context

Open Harness has comprehensive internal specifications (packages/kernel/docs/) but lacks user-facing documentation. The existing Fumadocs site (apps/docs/) contains mostly stubs. We need to create a complete documentation site for both end users and contributors.

## Decision

### 1. Navigation Structure
**Decision**: Redesign navigation around Diátaxis principles while keeping Fumadocs framework.

The four Diátaxis quadrants map to:
- **Tutorials** → `/learn/` - Learning-oriented hands-on experiences
- **How-to Guides** → `/guides/` - Task-oriented problem-solving
- **Reference** → `/reference/` - Technical facts lookup
- **Explanation** → `/concepts/` - Understanding-oriented discussions

### 2. Audience Strategy
**Decision**: Parallel tracks for both end users and contributors.

- **User Track**: SDK consumers building with Flow (tutorials, quickstarts, how-tos)
- **Contributor Track**: Developers extending the codebase (architecture, testing, workflow)

Both tracks share `/reference/` and `/concepts/` where appropriate.

### 3. Spec Translation
**Decision**: Translate kernel spec content into user-friendly documentation.

Rather than just syncing the spec as-is:
- Extract concepts from specs and rewrite for accessibility
- Create tutorials that demonstrate spec concepts practically
- Reference section links back to canonical spec for deep dives
- Maintain spec as source of truth; user docs as accessible layer

### 4. Versioning
**Decision**: Single version (latest only).

- Simpler maintenance
- External interfaces are stabilizing but not yet released
- Can add versioning later when releases are published

### 5. Internal Docs Scope
**Decision**: Keep oharnes workflow documentation internal (.claude/).

- Contributor docs in public site focus on: architecture, testing, extension points
- oharnes commands/agents stay in .claude/ for AI tooling
- Not relevant to external contributors

## Consequences

### Positive
- Clear separation of content by user need (Diátaxis)
- Both audiences served without confusion
- Spec translation makes content accessible
- Single version reduces maintenance burden

### Negative
- Translation effort required (can't just sync spec)
- Two parallel tracks means more content to create
- Must maintain alignment between spec and user docs

### Risks
- Spec-to-user-docs drift over time
- Contributor track may be deprioritized
- Full outline scope is ambitious

## Related
- Research: `docs-plan/research/*.yaml`
- Structure: `docs-plan/structure.md` (to be created)
