# Architecture Decision Records (ADRs)

This folder contains Architecture Decision Records and the technical debt inventory for the Open Scaffold project.

## How This Works

1. **Technical Debt Inventory** tracks all identified issues
2. **ADRs** document decisions made to resolve those issues
3. When an ADR is accepted, related issues in the inventory are marked resolved

## Files

| File | Purpose |
|------|---------|
| [technical-debt-inventory.md](./technical-debt-inventory.md) | Master list of all technical debt issues |
| [001-execution-api.md](./001-execution-api.md) | ADR: Execution API Design |
| [002-hitl-architecture.md](./002-hitl-architecture.md) | ADR: Human-in-the-Loop Architecture |
| [003-public-vs-internal-exports.md](./003-public-vs-internal-exports.md) | ADR: Public vs Internal Exports |
| [004-event-observer-pattern.md](./004-event-observer-pattern.md) | ADR: Event/Observer Pattern |
| [005-type-safety-strategy.md](./005-type-safety-strategy.md) | ADR: Type Safety Strategy |
| [006-state-sourcing-model.md](./006-state-sourcing-model.md) | ADR: State Sourcing Model |
| [007-error-hierarchy.md](./007-error-hierarchy.md) | ADR: Error Hierarchy |
| [008-naming-conventions.md](./008-naming-conventions.md) | ADR: Naming Conventions |
| [009-config-consolidation.md](./009-config-consolidation.md) | ADR: Config Consolidation |
| [010-provider-ownership-model.md](./010-provider-ownership-model.md) | ADR: Provider Ownership Model |
| [011-service-instantiation-pattern.md](./011-service-instantiation-pattern.md) | ADR: Service Instantiation Pattern |
| [012-phase-lifecycle-specification.md](./012-phase-lifecycle-specification.md) | ADR: Phase Lifecycle Specification |

## ADR Status Legend

- **Proposed** - Under discussion
- **Accepted** - Decision made, ready to implement
- **Implemented** - Code changes complete
- **Superseded** - Replaced by another ADR

## Quick Links

### By Decision Area

| Area | ADR | Status |
|------|-----|--------|
| Execution API | [ADR-001](./001-execution-api.md) | Accepted |
| HITL Architecture | [ADR-002](./002-hitl-architecture.md) | Accepted |
| Public vs Internal Exports | [ADR-003](./003-public-vs-internal-exports.md) | Accepted |
| Event/Observer Pattern | [ADR-004](./004-event-observer-pattern.md) | Accepted |
| Type Safety Strategy | [ADR-005](./005-type-safety-strategy.md) | Accepted |
| State Sourcing Model | [ADR-006](./006-state-sourcing-model.md) | Accepted |
| Error Hierarchy | [ADR-007](./007-error-hierarchy.md) | Accepted |
| Naming Conventions | [ADR-008](./008-naming-conventions.md) | Accepted |
| Config Consolidation | [ADR-009](./009-config-consolidation.md) | Accepted |
| Provider Ownership Model | [ADR-010](./010-provider-ownership-model.md) | Accepted |
| Service Instantiation Pattern | [ADR-011](./011-service-instantiation-pattern.md) | Proposed |
| Phase Lifecycle Specification | [ADR-012](./012-phase-lifecycle-specification.md) | Proposed |

## Process

1. Discover issues during audit → add to inventory
2. Group related issues into decision areas
3. Discuss options with tradeoffs
4. Make decision → create ADR
5. Mark related issues as resolved in inventory
6. Implement changes
