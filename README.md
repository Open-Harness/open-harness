# Open Harness

A TypeScript monorepo for building AI agent systems using the Claude Agent SDK.

## Overview

Open Harness provides infrastructure for building, testing, and running multi-agent AI systems:

- **kernel-v3** - Core agent execution engine with event streaming
- **horizon-agent** - Multi-agent implementation system (planner, coder, reviewer)
- **flow-ui** - Terminal UI components for agent interfaces

## Quick Start

```bash
# Install dependencies
bun install

# Run the horizon agent
bun run dev

# Type check
bun run check-types

# Lint and format
bun run check
```

## Project Structure

```
open-harness/
├── apps/
│   ├── horizon-agent/    # Multi-agent TUI application
│   └── docs/             # Documentation site
├── packages/
│   ├── kernel-v3/        # Core agent execution engine
│   ├── kernel/           # Legacy kernel (deprecated)
│   ├── flow-ui/          # Terminal UI components
│   └── ...
├── specs/                # Feature specifications
└── .beads/               # Issue tracking (see Workflow below)
```

## Development

### Commands

```bash
# Run tests (safe - no network)
bun run test

# Run with live SDK (requires Claude Code subscription)
bun run test:live

# Type checking
bun run check-types

# Lint
bun run check
```

### Authentication

This project uses Claude Code subscription authentication via `@anthropic-ai/claude-agent-sdk`.
**Do not set `ANTHROPIC_API_KEY`** - the SDK handles auth automatically through your Claude Code subscription.

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
3. Run `bun run check-types && bun run check`
4. Create PR targeting `dev`
5. Ensure `bd sync` is run before ending your session

## License

Private - All rights reserved
