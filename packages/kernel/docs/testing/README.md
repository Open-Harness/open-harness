# Testing Infrastructure

This section documents the testing protocol, workflow, and validation strategy for the kernel + flow system.

## Overview

Testing follows a **spec-driven, fixture-based, TDD workflow**:

1. **Write test spec first** - Define requirements in Bullock-style `.test-spec.md` files
2. **Record fixtures** - Capture realistic scenarios (explicit, opt-in recording)
3. **Write replay tests** - Fast TDD loop using fixtures (no network, deterministic)
4. **Prove completion** - Run authoritative live test with real SDK

## Test Categories

- **Unit tests** (`tests/unit/`) - Pure logic, no fixtures, no network
- **Replay tests** (`tests/replay/`) - Fast, deterministic, uses fixtures
- **Live tests** (`scripts/live/`) - Authoritative, uses real SDK, proves completion

## Documentation

- [Testing Protocol](testing-protocol.md) - Testing infrastructure protocol spec
- [Test Spec Template](test-spec-template.md) - Template for all `.test-spec.md` files
- [Validation Guide](validation.md) - Multi-layer validation strategy and checklists
- [Workflow Guide](workflow.md) - Step-by-step testing workflow

## Quick Reference

### Fixture Lifecycle

```
1. Record: bun scripts/record-fixture.ts <component> <fixture-name>
   → Writes to fixtures/scratch/ (gitignored)

2. Review: Inspect fixtures/scratch/<component>/<fixture-name>.jsonl

3. Promote: Move to fixtures/golden/ (committed)
```

### Test Workflow

```
1. Write spec: tests/specs/<component>.test-spec.md
2. Record fixture: bun scripts/record-fixture.ts <component> <fixture>
3. Write test: tests/replay/<component>.<feature>.test.ts
4. TDD loop: bun test tests/replay/ (fast, deterministic)
5. Live test: bun scripts/live/<component>-live.ts (authoritative)
```

## Key Principles

- **Spec-first**: Test specs define requirements before implementation
- **Explicit recording**: Fixtures recorded via script, never accidentally
- **Multi-layer validation**: Static structure + behavioral execution + completeness
- **Interface contracts**: Initial specs test protocol types, not implementations
