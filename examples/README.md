---
title: "Examples"
description: "Working examples demonstrating Open Harness features"
---

# Examples

This directory contains working examples demonstrating Open Harness capabilities.

## Contents

| Directory | Description | Complexity |
|-----------|-------------|------------|
| `simple-reactive/` | Minimal reactive workflow | Beginner |
| `multi-provider/` | Using multiple AI providers | Intermediate |
| `trading-agent/` | Multi-agent trading workflow | Advanced |
| `recording-replay/` | Record and replay signals | Intermediate |
| `testing-signals/` | Signal-based test patterns | Intermediate |
| `speckit/` | Specification toolkit examples | Advanced |

## Quick Start

```bash
# Run any example from the repository root
bun run examples/simple-reactive/index.ts
bun run examples/trading-agent/index.ts
```

## Example Overview

### Beginner

**[simple-reactive/](simple-reactive/README.md)** - Start here. Shows:
- `createWorkflow<TState>()` factory pattern
- `activateOn` signal triggers
- Guard conditions with `when`
- Template expansion in prompts

### Intermediate

**[multi-provider/](multi-provider/README.md)** - Using different AI providers:
- ClaudeHarness vs CodexHarness
- Per-agent harness configuration
- Provider-specific options

**[recording-replay/](recording-replay/README.md)** - Test determinism:
- Recording signal streams
- Replaying without API calls
- Snapshot testing

**[testing-signals/](testing-signals/README.md)** - Test patterns:
- Signal assertions
- Vitest matchers
- Integration test setup

### Advanced

**[trading-agent/](trading-agent/README.md)** - Flagship example:
- Parallel agent execution
- Signal chaining
- Guard conditions
- State-driven decisions
- Early termination

**[speckit/](speckit/README.md)** - Specification toolkit:
- Multi-level specification
- Agent coordination
- Complex workflows

## Creating New Examples

1. Create a new directory under `examples/`
2. Add `index.ts` as the entry point
3. Add `README.md` following the template:

```markdown
# Example Name

Brief description.

## What This Shows

1. Feature one
2. Feature two

## Running

\`\`\`bash
bun run examples/your-example/index.ts
\`\`\`

## Code Walkthrough

...
```

## See Also

- [`packages/`](../packages/README.md) - Core packages
- [`apps/docs/`](../apps/docs/README.md) - Full documentation
- [Tutorials](https://docs.open-harness.dev/docs/learn) - Step-by-step guides
