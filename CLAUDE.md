# dao-spec-kit Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-25

## Active Technologies
- TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod, listr2 (optional peer) (003-harness-renderer)
- N/A (state in memory, recordings to filesystem) (003-harness-renderer)
- TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod, bun:tes (004-test-infra-audit)
- JSON fixture files in `recordings/golden/`, JSONL E2E recordings in `tests/fixtures/e2e/` (004-test-infra-audit)
- TypeScript 5.x (strict mode) + @anthropic-ai/sdk (NEW), @needle-di/core, zod (005-monologue-system)
- N/A (in-memory buffer, history ephemeral per-session) (005-monologue-system)
- N/A (state in memory) (007-fluent-harness-dx)
- TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod, node:async_hooks (AsyncLocalStorage) (008-unified-event-system)
- N/A (in-memory event bus, no persistence) (008-unified-event-system)
- JSON fixture files in `recordings/golden/`, test fixtures as embedded data (009-tech-debt-cleanup)
- N/A (in-memory event bus, message queues) (010-transport-architecture)

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
- 010-transport-architecture: Added TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod
- 009-tech-debt-cleanup: Added TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod, bun:tes
- 008-unified-event-system: Added TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod, node:async_hooks (AsyncLocalStorage)


<!-- MANUAL ADDITIONS START -->

## CRITICAL: Authentication

**DO NOT look for or set ANTHROPIC_API_KEY.** This project uses Claude Code subscription authentication via `@anthropic-ai/claude-agent-sdk`. The SDK handles auth automatically through the Claude Code subscription. Setting or looking for an API key will BREAK the app.

- Live tests work automatically with subscription auth
- Just run tests/harnesses directly - no env vars needed
- The SDK uses Claude Code's built-in authentication

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
