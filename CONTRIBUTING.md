# Contributing to Open Harness

This guide covers the development workflow. For non-negotiable principles, see the [Constitution](.specify/memory/constitution.md).

## Development Workflow

### Branch Naming

- `feature/<short-description>` — new functionality
- `fix/<short-description>` — bug fixes
- `refactor/<short-description>` — code restructuring
- `docs/<short-description>` — documentation only

### Commit Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new agent type
fix: correct token injection order
docs: update constitution
refactor: simplify container setup
test: add golden recording for workflow
chore: update dependencies
```

## Quality Gates

All changes MUST pass these gates before merge:

| Gate | Command | Enforcement |
|------|---------|-------------|
| Type Check | `bun run check-types` | CI |
| Build | `bun run build` | CI |
| Recorded Tests | `bun run test` | CI |
| Completion Proof | Live integration test | Manual |
| Review | Self-review minimum | Process |

### Before Submitting

1. `bun run check-types` — verify type safety
2. `bun run build` — ensure all packages compile
3. `bun run test` — verify recorded tests pass
4. Update recordings if agent behavior changed
5. Self-review for console.logs, TODOs, accidental changes

### When Marking Work Complete

Run at least one live integration test to prove the feature works with real LLM calls. This is the "Completion Proof" gate.

## Testing Strategy

See [docs/patterns/testing.md](docs/patterns/testing.md) for the recorder pattern and testing workflow.

**Quick reference:**
- Unit tests → `tests/unit/` (pure logic only)
- Integration tests → `tests/integration/` (real or recorded LLM calls)
- Golden recordings → `recordings/golden/` (committed to repo)

## DI Patterns

See [docs/patterns/di.md](docs/patterns/di.md) for dependency injection patterns.

**Quick reference:**
- Internals use `@injectable()` + `inject(Token)`
- Externals use factory functions (`createAgent()`, `createWorkflow()`)
- Composition root is `container.ts`

## Exceptions

Hotfixes for production incidents may bypass review gates but MUST be followed up with proper review and test coverage within 24 hours.
