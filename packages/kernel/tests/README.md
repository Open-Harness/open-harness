# Tests

Test structure follows the conformance definition in `docs/implementation/conformance.md`.

## Directory Structure

- `tests/unit/` - Pure logic tests (no network, no fixtures)
- `tests/replay/` - Fast, deterministic tests using fixtures
- `tests/fixtures/golden/` - Committed fixtures (used in CI)
- `tests/fixtures/scratch/` - Gitignored, local experiments
- `tests/specs/` - Test specifications (Bullock-style)

## Commands

- `bun test` - Safe tests only (unit + replay)
- `bun test:unit` - Unit tests only
- `bun test:replay` - Replay tests only
- `bun test:live` - Live tests (explicit opt-in)

## See Also

- `docs/testing/` - Testing protocol and workflow
- `docs/implementation/conformance.md` - Conformance definition
