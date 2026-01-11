---
title: "Scripts"
description: "Development and build scripts"
---

# Scripts

This directory contains development and build scripts for Open Harness.

## Contents

| Script | Description |
|--------|-------------|
| `new-worktree` | Create a new git worktree for feature development |
| `update-readme-metadata.ts` | Update README front matter with git metadata |

## Scripts

### `new-worktree`

Creates a new git worktree for isolated feature development.

```bash
./scripts/new-worktree --epic <bead-id> --feature "Feature Name"
```

Options:
- `--epic` - Beads epic ID to claim
- `--feature` - Human-readable feature name
- `--app` - App to launch (`claude` or `opencode`)
- `--base` - Base branch (default: `origin/dev`)

### `update-readme-metadata.ts`

Updates README.md front matter with git commit information.

```bash
bun run scripts/update-readme-metadata.ts
```

Updates:
- `lastUpdated` - ISO timestamp
- `lastCommit` - Git commit hash
- `lastCommitDate` - Commit date

## Adding Scripts

1. Create the script in this directory
2. Add a shebang for shell scripts: `#!/usr/bin/env bash`
3. Make executable: `chmod +x scripts/your-script`
4. Document in this README

## See Also

- [CLAUDE.md](../CLAUDE.md) - Development guidelines
- [`.beads/`](../.beads/README.md) - Issue tracking with Beads
