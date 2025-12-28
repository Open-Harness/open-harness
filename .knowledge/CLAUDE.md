# Open Harness Knowledge Base

This is the canonical knowledge base for the Open Harness project - an Obsidian vault that serves as the single source of truth for documentation, planning, and reference materials.

## For AI Agents

When working on Open Harness, this vault contains:

| Path | Purpose | Read Priority |
|------|---------|---------------|
| `docs/why.md` | Developer philosophy | HIGH - Read first |
| `docs/concepts/` | Core primitives (Agent, Harness, Transport) | HIGH |
| `product/vision.md` | Product direction | MEDIUM |
| `product/roadmap.md` | What we're building | MEDIUM |
| `private/PITCH.md` | Investor narrative (if accessible) | FOR CONTEXT |

### Key Concepts

Open Harness has **three primitives**:

1. **Agent** - Unit of AI behavior (provider-agnostic, typed I/O)
2. **Harness** - Orchestration layer (composes agents, manages state)
3. **Transport** - Output destinations (console, WebSocket, community-built)

### The Mantra

> **Simplicity scales.**

---

## Vault Architecture

```
.knowledge/                    # Obsidian vault (IN REPO - tracked)
├── .obsidian/                 # Obsidian config
├── CLAUDE.md                  # This file (AI instructions)
├── Home.md                    # Vault landing page
│
├── docs/                      # CANONICAL PUBLIC DOCS (tracked)
│   ├── why.md                 # Philosophy
│   ├── quickstart.md          # Getting started
│   └── concepts/              # Core concepts
│
├── product/                   # Product thinking (tracked)
│   ├── vision.md
│   ├── roadmap.md
│   └── decisions/             # ADRs
│
├── resources/                 # Research & reference (tracked)
│
├── templates/                 # Obsidian templates (tracked)
│
├── daily/                     # Daily notes (GITIGNORED)
│
└── private/                   # SYMLINK → ~/Documents/OpenHarness-Private/
                               # (GITIGNORED - investor materials)
```

### What's Tracked vs Ignored

| Folder | Git Status | Notes |
|--------|------------|-------|
| `docs/` | Tracked | Public documentation |
| `product/` | Tracked | Shareable with team |
| `resources/` | Tracked | Research materials |
| `templates/` | Tracked | Obsidian templates |
| `daily/` | **Gitignored** | Personal daily notes |
| `private/` | **Gitignored** | Symlink to external folder |

---

## For Humans: How to Use This Vault

### Opening in Obsidian

1. Open Obsidian
2. "Open folder as vault"
3. Select `.knowledge/` folder in the repo

### The Private Folder

The `private/` folder is a **symlink** pointing to `~/Documents/OpenHarness-Private/`.

This means:
- Investor materials live **outside** the repo
- They never get committed or pushed
- Obsidian sees them as part of the vault
- Other team members won't have this folder (broken symlink for them)

**To set up on a new machine:**
```bash
mkdir -p ~/Documents/OpenHarness-Private/meetings
mkdir -p ~/Documents/OpenHarness-Private/financials
# The symlink in the repo will now resolve
```

### Front Matter Convention

Every note should have front matter:

```yaml
---
tags:
  - docs        # or: product, investor, meeting, decision
  - concept     # or: guide, reference, note
created: 2024-12-28
updated: 2024-12-28
status: draft  # or: review, final
---
```

### Dataview Queries

This vault uses [Dataview](https://github.com/blacksmithgu/obsidian-dataview) for dynamic content.

**Install**: Settings → Community Plugins → Browse → "Dataview" → Install → Enable

Example queries in `Home.md` show recent files, open decisions, etc.

---

## Updating This System

### Adding New Docs

1. Create in appropriate folder (`docs/`, `product/`, etc.)
2. Add front matter with tags
3. Link from relevant `_index.md` file
4. Cross-link with `[[wiki-links]]`

### Adding New Sections

1. Create folder
2. Add `_index.md` as section overview
3. Update `Home.md` with link
4. Update this file's architecture diagram

### Syncing Docs to SDK

The `docs/` folder is the canonical source. To sync to `/packages/sdk/`:

```bash
# Manual sync (or set up a script)
cp -r .knowledge/docs/* packages/sdk/docs/
```

Consider automating this in CI for releases.

---

*Last updated: 2024-12-28*
