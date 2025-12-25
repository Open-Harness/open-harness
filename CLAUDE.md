# dao-spec-kit Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-25

## Active Technologies
- TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod, listr2 (optional peer) (003-harness-renderer)
- N/A (state in memory, recordings to filesystem) (003-harness-renderer)

- TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod (002-sdk-validation)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x (strict mode): Follow standard conventions

## Recent Changes
- 003-harness-renderer: Added TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod, listr2 (optional peer)

- 002-sdk-validation: Added TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod

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
