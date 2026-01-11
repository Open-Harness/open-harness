---
title: "Claude Code Configuration"
description: "Claude Code agent configuration, commands, and skills"
---

# Claude Code Configuration

This directory contains Claude Code configuration for the Open Harness project.

## Contents

| Directory | Description |
|-----------|-------------|
| `agents/` | Sub-agent definitions (oharnes agents) |
| `commands/` | Slash commands (oharnes commands) |
| `patterns/` | Anti-pattern registry for historical awareness |
| `prompts/` | Prompt templates and context files |
| `reports/` | Generated reports from audits and retrospectives |
| `skills/` | Skill definitions |

| File | Description |
|------|-------------|
| `CLAUDE.md` | Project-specific Claude Code instructions |
| `settings.json` | Claude Code settings |

## oharnes System

The oharnes system provides a structured workflow for feature development:

### Commands

| Command | Description |
|---------|-------------|
| `/oharnes.specify` | Create feature specification |
| `/oharnes.plan` | Generate implementation plan |
| `/oharnes.tasks` | Generate task breakdown |
| `/oharnes.implement` | Execute implementation |
| `/oharnes.verify` | Verify implementation |
| `/oharnes.retro` | Run retrospective |
| `/oharnes.close` | Close retrospective cycle |
| `/oharnes.analyze` | Analyze spec consistency |

### Agents

Sub-agents handle specific tasks:

- `oharnes.plan:researcher` - Research unknowns
- `oharnes.plan:validator` - Validate plans
- `oharnes.implement:scout` - Build context manifest
- `oharnes.implement:verifier` - Verify task completion
- `oharnes.verify:*` - Verification agents
- `oharnes.retro:*` - Retrospective agents

## Pattern Registry

The `patterns/` directory contains:

- `anti-patterns.yaml` - Known problematic patterns
- Historical warnings for scouts and verifiers

## Development

To add new commands or agents:

1. Follow templates in existing files
2. Use consistent naming: `oharnes.<command>` or `oharnes.<command>:<agent>`
3. See `.claude/CLAUDE.md` for development guidelines

## See Also

- [CLAUDE.md](../CLAUDE.md) - Project-level instructions
- [`specs/`](../specs/README.md) - Feature specifications
- [`patterns/README.md`](patterns/README.md) - Anti-pattern documentation
