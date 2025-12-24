# Open Harness - Project Overview

## Executive Summary

**Open Harness** is an extensible workflow SDK for building AI agent applications with Anthropic's Claude. It provides a clean, type-safe abstraction layer that simplifies the creation of autonomous agents, multi-agent workflows, and long-running automation tasks.

### Vision
Create a universal harness for AI agent development that:
- Abstracts away SDK complexity (currently Anthropic, future: multi-provider)
- Provides clean APIs for agents, workflows, and task management
- Enables human-readable narrative output from complex agent interactions
- Supports both simple single-agent tasks and complex multi-agent orchestration

### Current State
- **SDK**: Working, well-tested, nearly publishable
- **CLI**: Code complete, integration issues to resolve
- **Trading Bot**: Example application demonstrating patterns
- **Docs/Server**: Scaffolded, minimal content

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     YOUR APPLICATION                             │
│  (Trading Bot, CLI Workflow, Custom Apps)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │    Agent     │  │   Workflow   │  │      Monologue       │   │
│  │              │  │              │  │                      │   │
│  │ (Prompt +    │──│ (Tasks +     │  │ (Readable Output     │   │
│  │  State +     │  │  Agents +    │  │  Layer - transforms  │   │
│  │  Logic)      │  │  Orchestr.)  │  │  tool noise)         │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      TaskList                             │   │
│  │  (State management, progress tracking, history)           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│               @dao/sdk (Clean API Surface)                       │
├─────────────────────────────────────────────────────────────────┤
│               DI Container (NeedleDI - Hidden)                   │
├─────────────────────────────────────────────────────────────────┤
│               @anthropic-ai/claude-agent-sdk                     │
└─────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### Four Primitives

1. **Agent** - Reusable AI behavior unit
   - Prompt template + state + custom logic
   - Three creation patterns: built-in, config-based, class-based
   
2. **Workflow** - Multi-agent orchestration
   - Combines agents with task management
   - User-defined execute function for full control
   
3. **Task** - Work unit with state
   - Lifecycle: pending → in_progress → completed/failed
   - Progress tracking and history
   
4. **Monologue** - Readable output layer
   - Transforms tool noise into narrative
   - Perfect for long-running agents

### Key Design Principles

- **Zero Leakage**: DI/container complexity is internal
- **Composable**: Mix and match agents and workflows
- **Extensible**: Built-in agents are just examples
- **Type-Safe**: Full TypeScript support with IntelliSense
- **Promise + Callbacks**: No async generators exposed

## Technology Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| Runtime | Bun 1.3.3 | Fast all-in-one JS runtime |
| Language | TypeScript 5 | Type safety |
| AI SDK | @anthropic-ai/claude-agent-sdk | Claude integration |
| DI | @needle-di/core | Dependency injection |
| Build | Turborepo | Monorepo management |
| Linting | Biome | Fast linting/formatting |
| Testing | Bun Test | Native Bun testing |

## Repository Structure

```
open-harness/
├── apps/
│   ├── cli/              # Workflow runner CLI (@dao/cli)
│   ├── docs/             # Documentation site (Next.js)
│   ├── server/           # Backend API (Hono)
│   └── trading-bot/      # Example application
├── packages/
│   ├── sdk/              # Core SDK (@dao/sdk)
│   └── config/           # Shared TypeScript config
├── _bmad/                # BMad Method tooling
├── _bmad-output/         # BMad artifacts
└── docs/                 # Generated documentation
```

## Use Cases

### Perfect For
- Multi-agent workflows (code-review-deploy pipelines)
- Long-running automation with progress tracking
- Custom agent behaviors with state
- Readable output from complex agent interactions
- Autonomous coding agents (24-hour+ sessions)

### Not Ideal For
- Single-prompt LLM calls (use Anthropic SDK directly)
- Real-time chat applications (different architecture needed)

## Project Status

| Component | Status | Notes |
|-----------|--------|-------|
| SDK Core | Working | Ready for internal use |
| Agent Factory | Working | All three patterns functional |
| Workflow Builder | Working | Task management integrated |
| Monologue | Working | Narrative generation functional |
| CLI | Code Complete | Integration issue to resolve |
| Trading Bot | Example | Tests passing, demonstrates patterns |
| Docs Site | Scaffolded | Needs content |
| Server | Minimal | Basic Hono scaffold |

## Next Steps (Recommended)

1. **Consolidate naming**: Finalize "Open Harness" as official name
2. **Fix CLI integration**: Resolve the "doesn't work" issue
3. **Publish SDK**: Prepare @dao/sdk for npm publication
4. **Document APIs**: Generate comprehensive API documentation
5. **Build docs site**: Populate with guides and examples

## Links

- [SDK README](../packages/sdk/README.md)
- [SDK Quick Start](../packages/sdk/QUICKSTART.md)
- [Trading Bot Architecture](../TRADING-BOT-ARCHITECTURE.md)
