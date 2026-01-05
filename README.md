# Open Harness

![Status: Alpha](https://img.shields.io/badge/status-alpha-orange)

> Event-driven workflow orchestration for production multi-agent AI systems.

## Overview

Open Harness provides a declarative, event-driven framework for building multi-agent systems:

- **Declarative Workflows**: Define agent pipelines in YAML, not imperative code
- **Full Observability**: Every event flows through a central Hub you can subscribe to
- **JSONata Expressions**: Powerful data bindings with a proven expression language
- **Replay Testing**: Record and replay agent interactions for deterministic tests

## Quick Start

### Installation

```bash
# Add the SDK to your project
bun add @open-harness/sdk
```

### Hello World Flow

Create `flow.yaml`:

```yaml
name: hello-world
nodes:
  - id: researcher
    type: claude.agent
    input:
      prompt: "Research: {{ flow.input.topic }}"

  - id: summarizer
    type: claude.agent
    input:
      prompt: "Summarize this research: {{ researcher.text }}"

edges:
  - from: researcher
    to: summarizer
```

Run it:

```typescript
import { runFlow, parseFlowYaml } from "@open-harness/sdk";
import { readFileSync } from "node:fs";

const flow = parseFlowYaml(readFileSync("flow.yaml", "utf-8"));
const snapshot = await runFlow({ flow, input: { topic: "quantum computing" } });

console.log("Results:", snapshot.outputs);
```

## Documentation

- 📚 [Full Documentation](https://docs.open-harness.dev) - Tutorials, guides, and API reference
- 🚀 [Quickstart Tutorial](https://docs.open-harness.dev/docs/learn/quickstart) - Run your first flow in 5 minutes
- 🏗️ [Architecture](https://docs.open-harness.dev/docs/concepts/architecture) - Understand the system design
- 📖 [Contributing Guide](CONTRIBUTING.md) - How to contribute to Open Harness

## Features

- **Event-Driven Architecture**: All components communicate through events for full observability
- **JSONata Bindings**: Connect data between nodes with a powerful expression language
- **Conditional Flow Control**: Branch workflows based on node outputs
- **State Management**: Track run state across executions
- **Multiple Transports**: WebSocket, HTTP, CLI adapters for different environments
- **Replay Testing**: Record live executions and replay for deterministic tests

## Development

```bash
# Clone the repository
git clone https://github.com/your-org/open-harness.git
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
│   └── docs/             # Documentation site (Next.js + Fumadocs)
├── packages/
│   └── sdk/              # Core Open Harness SDK
├── specs/                # Feature specifications
└── .beads/               # Issue tracking
```

## Authentication

When using the SDK with Claude agents, authentication is handled automatically through the Claude Code subscription:

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
