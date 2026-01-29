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
| HITL Architecture | TBD | — |
| Public vs Internal Exports | TBD | — |
| Event/Observer Pattern | TBD | — |
| Type Safety Strategy | TBD | — |
| State Sourcing Model | TBD | — |
| Error Hierarchy | TBD | — |
| Naming Conventions | TBD | — |
| Config Consolidation | TBD | — |

## Process

1. Discover issues during audit → add to inventory
2. Group related issues into decision areas
3. Discuss options with tradeoffs
4. Make decision → create ADR
5. Mark related issues as resolved in inventory
6. Implement changes
