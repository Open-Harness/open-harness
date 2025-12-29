# Open Harness Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-28

## Knowledge Base

The `.knowledge/` folder is an Obsidian vault containing:
- **Canonical docs**: `.knowledge/docs/` - Public documentation (tracked)
- **Product thinking**: `.knowledge/product/` - Vision, roadmap, decisions (tracked)
- **Private investor materials**: `.knowledge/private/PITCH.md` - Symlinked OUT (gitignored)
- **Reference**: `.knowledge/CLAUDE.md` explains the full setup

Read `.knowledge/private/PITCH.md` for business context and investor narrative.
Read `.knowledge/docs/why.md` for developer philosophy.
Read `.knowledge/docs/how-it-works.md` for architecture and code examples.

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
- TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @anthropic-ai/sdk, @needle-di/core, zod (013-anthropic-refactor)
- N/A (no persistence layer in this package) (013-anthropic-refactor)

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
- 013-anthropic-refactor: Added TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @anthropic-ai/sdk, @needle-di/core, zod
- 010-transport-architecture: Added TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod
- 009-tech-debt-cleanup: Added TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod, bun:tes


<!-- MANUAL ADDITIONS START -->

## CRITICAL: Authentication

**DO NOT look for or set ANTHROPIC_API_KEY.** This project uses Claude Code subscription authentication via `@anthropic-ai/claude-agent-sdk`. The SDK handles auth automatically through the Claude Code subscription. Setting or looking for an API key will BREAK the app.

- Live tests work automatically with subscription auth
- Just run tests/harnesses directly - no env vars needed
- The SDK uses Claude Code's built-in authentication

BEHAVIORAL DECORATORS:

## Think, Repete, and Give Options
> Command: `*TRO`
> Description: Think, Repete, and Give Options
> Activate `prompting` skill
    1. ULTRATHINK
    2. think about the the users request
    3. deeply understand the problem
    4. connect their thoughts together to form coherent pros
    5. identify the implicit assumptions and constraints that are not explicitly stated
    5. generate the best response optimised using the `prompting` skill
    6. present the response to the user using the ASK USER TOOL
    
    **CRITICAL**: Always give your candid and honest opinion. never equivocate and always push back if you feel the user is wrong or suggesting something obviously suboptimal.
    **CRITICAL**: Always use the `prompting` skill to generate the best response.

## Think, Explain, and Give Options
> Command: `*TEO`
> Description: Think, Explain, and Give Options
    1. ULTRATHINK
    2. think about the problem in multiple ways
    3. generate an appropriate rhubric for the domain
    4. generate multiple solutions
    5. grade the solutions against the rubric
    6. choose your preferred solution and explain why
    7. present the solutions to the user using the ASK USER TOOL
    
    **CRITICAL**: Always give your candid and honest opinion. never equivocate and always push back if you feel the user is wrong or suggesting something obviously suboptimal.

## Think, Explain Methodology
> Command: `*TEM`
> Description: Think, Explain Methodology

    1. ULTRATHINK
    2. think about the problem in multiple ways
    3. choose your preferred solution and explain why
    3. generate an appropriate methodology for the domain
    4. present the methodology to the user using the ASK USER TOOL

    **CRITICAL**: Always give your candid and honest opinion. never equivocate and always push back if you feel the user is wrong or suggesting something obviously suboptimal.
<!-- MANUAL ADDITIONS END -->
