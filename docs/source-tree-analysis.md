# Source Tree Analysis

Annotated directory structure for the Open Harness monorepo.

## Root Structure

```
open-harness/
├── apps/                     # Application packages
│   ├── cli/                  # @openharnes/cli - Workflow runner
│   ├── docs/                 # Documentation site (Next.js)
│   ├── server/               # Backend API (Hono)
│   └── trading-bot/          # Example trading application
├── packages/                 # Library packages
│   ├── sdk/                  # @openharnes/sdk - Core SDK
│   └── config/               # Shared TypeScript config
├── docs/                     # Generated documentation (this folder)
├── _bmad/                    # BMad Method tooling
├── _bmad-output/             # BMad planning artifacts
├── .claude/                  # Claude Code/OpenCode configuration
├── .cursor/                  # Cursor IDE configuration
├── package.json              # Root workspace config
├── turbo.json                # Turborepo configuration
├── biome.json                # Biome linting config
└── bun.lock                  # Bun lockfile
```

## SDK Package (packages/sdk)

**The core library - most important part of the codebase.**

```
packages/sdk/
├── src/                      # Production source code
│   ├── index.ts              # ★ Main entry point - all exports
│   │
│   ├── core/                 # DI infrastructure (hidden from users)
│   │   ├── container.ts      # ★ Composition root - all bindings
│   │   ├── tokens.ts         # Interfaces & InjectionTokens
│   │   ├── vault.ts          # Recording storage
│   │   ├── recording-factory.ts  # Factory for @Record decorator
│   │   ├── decorators.ts     # @Record decorator
│   │   ├── live-runner.ts    # Real Claude SDK runner
│   │   └── replay-runner.ts  # Replay from recordings
│   │
│   ├── factory/              # Public factories (user-facing)
│   │   ├── agent-factory.ts  # ★ createAgent() - 3 modes
│   │   └── workflow-builder.ts # ★ createWorkflow()
│   │
│   ├── runner/               # Base agent runtime
│   │   ├── base-agent.ts     # ★ BaseAgent class
│   │   ├── models.ts         # Event types & data models
│   │   └── prompts.ts        # Prompt registry
│   │
│   ├── agents/               # Built-in agent implementations
│   │   ├── coding-agent.ts   # CodingAgent (example)
│   │   ├── review-agent.ts   # ReviewAgent (example)
│   │   └── monologue.ts      # AgentMonologue (internal)
│   │
│   ├── workflow/             # Workflow orchestration
│   │   ├── orchestrator.ts   # Workflow class
│   │   └── task-list.ts      # ★ TaskList primitive
│   │
│   ├── monologue/            # Monologue wrapper
│   │   └── wrapper.ts        # ★ withMonologue()
│   │
│   └── examples/             # Living documentation
│       ├── basic-agent.ts    # Simple agent usage
│       ├── workflow-demo.ts  # Workflow example
│       ├── recording-demo.ts # Recording/replay demo
│       ├── callbacks.ts      # Callback patterns
│       ├── custom-agent.ts   # Custom agent patterns
│       ├── custom-workflow.ts # Custom workflow
│       ├── thinking-test.ts  # Extended thinking
│       └── autonomous-agent/ # ★ 24-hour autonomous agent demo
│           ├── index.ts      # Entry point
│           ├── README.md     # Comprehensive documentation
│           ├── prompts/      # Agent prompts
│           └── src/          # Agent implementations
│
├── tests/                    # Test suites
│   ├── unit/                 # Unit tests
│   │   └── container.test.ts # DI container tests
│   ├── integration/          # Integration tests
│   │   └── live-sdk.test.ts  # Live SDK tests
│   └── fixtures/             # Test data
│       └── e2e/              # E2E recordings
│
├── scripts/                  # Utility scripts
│   ├── e2e-capture.ts        # Capture E2E sessions
│   └── harvest.ts            # Golden recording capture
│
├── README.md                 # SDK overview
├── QUICKSTART.md             # Detailed getting started
├── PROJECT_STRUCTURE.md      # Internal structure docs
├── CLAUDE.md                 # AI assistant rules
└── package.json              # Package configuration
```

## CLI Package (apps/cli)

**Workflow runner for YAML-configured autonomous agents.**

```
apps/cli/
├── src/
│   ├── index.ts              # ★ CLI entry point (Commander setup)
│   │
│   ├── commands/             # CLI commands
│   │   ├── run.ts            # ★ `dao run <workflow>` command
│   │   ├── init.ts           # `dao init` command
│   │   ├── status.ts         # `dao status` command
│   │   └── validate.ts       # `dao validate` command
│   │
│   ├── config/               # Configuration loading
│   │   ├── index.ts          # Config exports
│   │   └── loader.ts         # ★ YAML config loader
│   │
│   ├── schemas/              # Zod schemas
│   │   ├── index.ts          # Schema exports
│   │   ├── task.ts           # Task schema
│   │   └── workflow.ts       # ★ Workflow config schema
│   │
│   ├── data-sources/         # Data source abstractions
│   │   ├── index.ts          # Exports
│   │   ├── json-file.ts      # JSON file data source
│   │   └── types.ts          # Type definitions
│   │
│   └── workflows/            # Workflow implementations
│       └── autonomous.ts     # ★ Autonomous workflow executor
│
├── CLAUDE.md                 # AI assistant rules (Bun)
├── README.md                 # CLI documentation
└── package.json              # Dependencies (imports @openharnes/sdk)
```

## Trading Bot (apps/trading-bot)

**Example application demonstrating SDK patterns.**

```
apps/trading-bot/
├── index.ts                  # Entry point
├── trading-cli.ts            # CLI interface
│
├── src/
│   ├── index.ts              # Module exports
│   │
│   ├── core/                 # Core infrastructure
│   │   ├── container.ts      # ★ Local DI container
│   │   ├── database.ts       # SQLite database
│   │   └── time-source.ts    # Time abstraction (for testing)
│   │
│   ├── services/             # Business services
│   │   ├── market-service.ts # ★ Market data + indicators
│   │   ├── order-service.ts  # Order execution
│   │   └── risk-service.ts   # Risk validation
│   │
│   ├── workflow/             # Trading workflow
│   │   └── trading-workflow.ts # ★ 7-stage pipeline
│   │
│   ├── ccxt/                 # Exchange abstraction
│   │   ├── ccxt-interface.ts # Interface definitions
│   │   ├── ccxt-wrapper.ts   # Real CCXT wrapper
│   │   └── mock-ccxt.ts      # Mock for testing
│   │
│   ├── backtest/             # Backtesting system
│   │   ├── backtest-runner.ts
│   │   ├── backtest-data-loader.ts
│   │   ├── backtest-metrics.ts
│   │   └── index.ts
│   │
│   └── snapshotting/         # State persistence
│       ├── agent-state.ts
│       └── snapshot-storage.ts
│
├── tests/                    # Test suites
│   ├── smoke/                # Quick sanity tests
│   ├── integration/          # Integration tests
│   │   ├── workflow.integration.test.ts # ★ Main workflow tests
│   │   ├── market-service.integration.test.ts
│   │   └── risk-service.integration.test.ts
│   └── helpers/              # Test utilities
│       └── test-container.ts # Test container factory
│
├── skills/                   # Agent skill documents
│   ├── cli-operating-manual.md
│   ├── risk-management.md
│   └── trading-strategy.md
│
├── CLAUDE.md                 # AI assistant rules
└── package.json              # Dependencies
```

## Docs Site (apps/docs)

**Next.js documentation site (scaffolded).**

```
apps/docs/
├── src/
│   ├── app/                  # Next.js app router
│   │   ├── page.tsx          # Home page (placeholder)
│   │   ├── layout.tsx        # Root layout
│   │   └── favicon.ico
│   │
│   ├── components/           # React components
│   │   ├── ui/               # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   └── ...
│   │   ├── header.tsx
│   │   ├── loader.tsx
│   │   ├── mode-toggle.tsx
│   │   ├── providers.tsx
│   │   └── theme-provider.tsx
│   │
│   ├── lib/                  # Utilities
│   │   └── utils.ts
│   │
│   └── index.css             # Global styles
│
├── next.config.ts            # Next.js config
├── components.json           # shadcn/ui config
├── postcss.config.mjs        # PostCSS config
└── package.json              # Dependencies
```

## Server (apps/server)

**Minimal Hono API server.**

```
apps/server/
├── src/
│   └── index.ts              # ★ Hono app (minimal)
│
├── tsdown.config.ts          # Build config
└── package.json              # Dependencies
```

## Critical Files Summary

| File | Purpose |
|------|---------|
| `packages/sdk/src/index.ts` | All public SDK exports |
| `packages/sdk/src/factory/agent-factory.ts` | `createAgent()` function |
| `packages/sdk/src/factory/workflow-builder.ts` | `createWorkflow()` function |
| `packages/sdk/src/runner/base-agent.ts` | `BaseAgent` class |
| `packages/sdk/src/workflow/task-list.ts` | `TaskList` primitive |
| `packages/sdk/src/monologue/wrapper.ts` | `withMonologue()` function |
| `packages/sdk/src/core/container.ts` | DI composition root |
| `apps/cli/src/workflows/autonomous.ts` | Autonomous workflow executor |
| `apps/trading-bot/src/workflow/trading-workflow.ts` | 7-stage trading pipeline |

## Integration Points

```
@openharnes/cli ─────imports────> @openharnes/sdk
                              │
                              ├─── createAgent()
                              ├─── withMonologue()
                              └─── StreamCallbacks

trading-bot ──────────────> (standalone, demonstrates patterns)
                              │
                              └─── Similar Container/Workflow patterns

apps/docs ────────────────> (no SDK dependency yet)

apps/server ──────────────> (no SDK dependency yet)
```
