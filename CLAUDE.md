# dao-spec-kit Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-25

## Active Technologies
- TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod, listr2 (optional peer) (003-harness-renderer)
- N/A (state in memory, recordings to filesystem) (003-harness-renderer)
- TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod, bun:tes (004-test-infra-audit)
- JSON fixture files in `recordings/golden/`, JSONL E2E recordings in `tests/fixtures/e2e/` (004-test-infra-audit)
- TypeScript 5.x (strict mode) + @anthropic-ai/sdk (NEW), @needle-di/core, zod (005-monologue-system)
- N/A (in-memory buffer, history ephemeral per-session) (005-monologue-system)

- TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod (002-sdk-validation)

## Project Structure

```text
src/
tests/
```

## Commands

```bash
# In packages/sdk/:
bun run test        # Safe tests only (unit + replay, no network)
bun run test:live   # Integration tests (requires auth)
bun run typecheck   # Type checking
bun run lint        # Linting
```

## Code Style

TypeScript 5.x (strict mode): Follow standard conventions

## Recent Changes
- 005-monologue-system: Added TypeScript 5.x (strict mode) + @anthropic-ai/sdk (NEW), @needle-di/core, zod
- 004-test-infra-audit: Added TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod, bun:tes
- 003-harness-renderer: Added TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod, listr2 (optional peer)


<!-- MANUAL ADDITIONS START -->
BEHAVIORAL DECORATORS:
## Think, Explain, and Give Options
> Command: `*TEO`
    1. ULTRATHINK
    2. think about the problem in multiple ways
    3. generate an appropriate rhubric for the domain
    4. generate multiple solutions
    5. grade the solutions against the rubric
    6. choose your preferred solution and explain why
    7. present the solutions to the user using the ASK USER TOOL

## Think, Explain Methodology
> Command: `*TEM`
    1. ULTRATHINK
    2. think about the problem in multiple ways
    3. choose your preferred solution and explain why
    3. generate an appropriate methodology for the domain
    4. present the methodology to the user using the ASK USER TOOL

<!-- MANUAL ADDITIONS END -->
