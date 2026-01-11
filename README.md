# Open Harness

![Status: Alpha](https://img.shields.io/badge/status-alpha-orange)

> Signal-based observability infrastructure for production AI agents.

## Overview

Open Harness provides a reactive, signal-based architecture for building observable AI agent systems:

- **Signal-Based Architecture**: All agent events flow as typed signals through a central bus
- **Full Observability**: Subscribe to any signal pattern for logging, metrics, or custom handlers
- **Harness Adapters**: Unified interface for Claude, OpenAI, and other AI providers
- **Replay Testing**: Record and replay agent interactions for deterministic tests

## Quick Start

### Installation

```bash
bun add @open-harness/core
```

### Hello World

```typescript
import { ClaudeHarness } from "@open-harness/core";
import { SignalBus, attachReporter, createConsoleReporter } from "@open-harness/core";

// Create a signal bus for observability
const bus = new SignalBus();

// Attach a console reporter to see all signals
attachReporter(bus, createConsoleReporter());

// Create a harness for Claude
const harness = new ClaudeHarness({ model: "claude-sonnet-4-20250514" });

// Run the harness - it yields signals as the agent streams
const input = {
  messages: [{ role: "user", content: "What is quantum computing?" }],
};

for await (const signal of harness.run(input, { signal: new AbortController().signal })) {
  bus.emit(signal); // Route signals through the bus

  // Handle specific signals
  if (signal.name === "harness:text:delta") {
    process.stdout.write(signal.payload.content);
  }
}
```

## Documentation

- [Full Documentation](https://docs.open-harness.dev) - Tutorials, guides, and API reference
- [Quickstart Tutorial](https://docs.open-harness.dev/docs/learn/quickstart) - Run your first harness
- [Architecture](https://docs.open-harness.dev/docs/concepts/architecture) - Understand the signal-based design
- [Contributing Guide](CONTRIBUTING.md) - How to contribute to Open Harness

## Core Concepts

### Signals

Everything in Open Harness is a signal. Signals are typed events with a name, payload, and metadata:

```typescript
interface Signal<T = unknown> {
  name: string;           // e.g., "harness:text:delta"
  payload: T;             // Typed payload
  timestamp: number;      // When the signal was created
  source?: SignalSource;  // Where it came from
}
```

### SignalBus

The central dispatcher for all signals. Subscribe to patterns and handle events:

```typescript
const bus = new SignalBus();

// Subscribe to all harness signals
bus.subscribe("harness:*", (signal) => {
  console.log(signal.name, signal.payload);
});

// Subscribe to specific patterns
bus.subscribe("harness:text:*", (signal) => {
  // Handle text deltas and completions
});
```

### Harnesses

Harnesses wrap AI providers and emit signals as async generators:

```typescript
const harness = new ClaudeHarness();

for await (const signal of harness.run(input, ctx)) {
  // Signals: harness:start, harness:text:delta, harness:tool:call, harness:end, etc.
}
```

## Features

- **Reactive Signal Architecture**: Typed signals flow through a central bus
- **Pattern Matching**: Subscribe to signals using glob patterns (`harness:*`, `harness:text:*`)
- **Multiple Reporters**: Console, metrics, custom reporters attach to the bus
- **Harness Adapters**: Claude, OpenAI Codex, with more coming
- **Snapshot State**: Derive point-in-time state from signal history
- **Replay Testing**: Record signals and replay for deterministic tests

## Development

```bash
# Clone the repository
git clone https://github.com/open-harness/open-harness.git
cd open-harness

# Install dependencies
bun install

# Run tests
bun run test

# Type checking
bun run typecheck

# Lint and format
bun run lint
```

## Project Structure

```
open-harness/
├── apps/
│   └── docs/                    # Documentation site (Next.js + Fumadocs)
├── packages/
│   ├── adapters/
│   │   └── harnesses/           # Harness implementations (Claude, OpenAI)
│   ├── internal/
│   │   ├── signals/             # SignalBus, stores, reporters
│   │   └── signals-core/        # Signal primitives, Harness interface
│   └── open-harness/
│       ├── core/                # Public core API
│       ├── testing/             # Test utilities
│       └── vitest/              # Vitest matchers
├── specs/                       # Feature specifications
└── .beads/                      # Issue tracking
```

## Authentication

When using harnesses with Claude, authentication is handled automatically through the Claude Code subscription:

```bash
# Live tests work automatically with subscription auth
bun run test:live
```

**Do not set `ANTHROPIC_API_KEY`** - the SDK handles auth through your Claude Code subscription.

## Git Workflow

We use a standard branching model:

```
master (release ~1x/month)
   ↑
  dev (integration branch)
   ↑
feature/* (your work)
```

- Create feature branches from `dev`
- PRs target `dev` for integration
- `dev` merges to `master` for releases

---

## Issue Tracking with Beads

We use [Beads](https://github.com/steveyegge/beads) for lightweight, git-native issue tracking.

### For New Team Members

```bash
# Install beads CLI (if not already installed)
curl -sSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash

# The repo is already configured - just start using it
bd list              # See open issues
bd show <id>         # View issue details
bd create            # Create new issue
```

### How We Use Beads

**Sync Branch Pattern**: Issue data lives on a dedicated `beads-sync` branch, not in your feature branches. This prevents merge conflicts and keeps code branches clean.

```
Your code:                 Beads data:
master ← dev ← feat/*      beads-sync (auto-synced)
```

**Daily workflow**:
```bash
# Start of session - context auto-injected via hooks

# Work on issues
bd start <id>        # Mark issue in-progress
bd comment <id>      # Add progress notes

# End of session - ALWAYS sync before stopping
bd sync              # Commits + pushes beads changes
```

### Key Commands

| Command | Description |
|---------|-------------|
| `bd list` | List open issues |
| `bd create` | Create new issue |
| `bd show <id>` | View issue details |
| `bd start <id>` | Start working on issue |
| `bd close <id>` | Close completed issue |
| `bd sync` | Sync changes to remote |
| `bd status` | Show database status |
| `bd doctor` | Health check |

### Why Sync Branch?

1. **No merge conflicts** - Feature branches don't carry beads data
2. **Multi-agent friendly** - Agents can work in parallel without collision
3. **Clean PRs** - Code reviews aren't cluttered with issue metadata

### New Clone Setup

If you clone this repo fresh:

```bash
# The sync-branch is already configured in .beads/config.yaml
# Just make sure your local daemon knows about it:
bd config set sync.branch beads-sync
bd hooks install
```

---

## Contributing

1. Create a feature branch from `dev`
2. Make your changes
3. Run `bun run typecheck && bun run lint`
4. Create PR targeting `dev`
5. Ensure `bd sync` is run before ending your session

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines.

## Alpha Status

This is an **alpha release**. Expect:

- evolving APIs and potentially breaking changes
- documentation gaps that we're actively improving
- missing features that are planned for future releases

We welcome feedback, bug reports, and contributions as we prepare for beta.

## License

MIT - see [LICENSE](LICENSE) for details
