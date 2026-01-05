# Contributing to Open Harness

Thank you for your interest in contributing to Open Harness! This guide will help you get started.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) >= 1.3.3
- [Git](https://git-scm.com/)
- [Beads](https://github.com/steveyegge/beads) for issue tracking

### Initial Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/open-harness.git
   cd open-harness
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Install Git hooks** (automatic via `prepare` script):
   ```bash
   bun run hooks:install
   ```

   The hooks will be installed automatically when you run `bun install`, but you can manually reinstall them if needed.

## Git Hooks

This project uses [Lefthook](https://github.com/evilmartians/lefthook) for Git hooks to maintain code quality.

### Pre-commit Hooks

When you commit code, the following checks run automatically:

1. **Beads issue tracking** - Links commits to issues
2. **Biome linting & formatting** - Automatically fixes staged files
   - Runs on: `*.{js,jsx,ts,tsx,json,jsonc,css,md}`
   - Auto-fixes formatting issues
   - Stages fixed files automatically

### Pre-push Hooks

Before pushing to remote, these checks run:

1. **Test suite** - Ensures all tests pass
2. **Type checking** - Catches type errors before CI

### Hook Management

```bash
# Install hooks
bun run hooks:install

# Uninstall hooks
bun run hooks:uninstall

# Skip hooks (not recommended)
git commit --no-verify
```

### Performance

- Pre-commit hooks typically run in **< 5 seconds**
- Only staged files are checked (via lint-staged)
- Hooks run in parallel for speed

## Code Quality

### Running Checks Manually

```bash
# Lint all files
bun run lint

# Type check
bun run typecheck

# Run tests
bun run test

# Build
bun run build
```

### Biome Configuration

This project uses [Biome](https://biomejs.dev/) for linting and formatting:

- **Formatter**: Tabs, 120 character line width, double quotes
- **Linter**: Recommended rules enabled
- **Auto-organize imports**: Enabled

Configuration is in `biome.json` at the root.

## Workflow

### Branching Strategy

This project uses a **feature → dev → master** workflow:

```
master (production/stable)
  ↑
  └── dev (integration branch)
       ↑
       └── feat/* (feature branches)
```

**IMPORTANT**: Always branch from `dev`, not `master`:

```bash
git checkout dev
git pull origin dev
git checkout -b feat/your-feature-name
```

### Commits

- Use conventional commit format: `type(scope): message`
- Link commits to beads issues: `fix: resolve bug (bd-abc123)`
- Keep commits atomic and focused

### Pull Requests

- Target `dev` branch (not `master`)
- Open PRs with `gh pr create` (or GitHub UI if needed)
- Ensure all hooks pass
- Add tests for new features
- Link the bead/issue in the PR description

### Documentation Updates

- If you change behavior, configuration, or user-facing surfaces, update docs in the same PR.
- If docs are not impacted, note "N/A" with a brief explanation in the PR checklist.

## Project Structure

```
open-harness/
├── apps/           # Applications
├── packages/       # Shared packages
├── spikes/         # Experimental code
├── specs/          # Feature specifications
└── .claude/        # Claude Code configuration
```

## Issue Tracking

This project uses [Beads](https://github.com/steveyegge/beads) for git-native issue tracking.

```bash
# List open issues
bd list --status=open

# Show issue details
bd show <issue-id>

# Create new issue
bd create

# Start working on issue
bd update <issue-id> --status in_progress

# Close issue
bd close <issue-id>
```

### Issue Reporting Guidelines

When creating issues (Beads or GitHub), include:
- What you were trying to do
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Logs, screenshots, or recordings when relevant
- Environment details (OS, Bun version, package versions)

## Agent Workflow

Agents should follow the Beads workflow and quality gates.

### Beads Workflow

1. `bd ready` to find unblocked work.
2. `bd update <issue-id> --status in_progress` to mark the issue in progress.
3. Implement in a dedicated worktree if needed.
4. `bd close <issue-id>` when done, then `bd sync` before ending the session.

### Quality Gates

- `bun run typecheck`
- `bun run lint`
- `bun run test`
- `bun run test:live` when SDK integrations are touched

### Escalation

- If blocked, create a blocking issue and stop work until a human resolves it.

### Human-Only Tasks

- Releases and deployments
- Security-sensitive changes (auth, permissions, secrets)
- Breaking API changes
- New architectural patterns

## Getting Help

- Check existing documentation in `apps/docs/` and `specs/`
- Review the [Open Harness CLI guidelines](CLAUDE.md)
- Open a beads issue: `bd create`
- Ask in project discussions

## Questions?

If you have questions about contributing, please:

1. Check the documentation first
2. Search existing beads issues
3. Create a new issue if needed

Happy contributing! 🚀
