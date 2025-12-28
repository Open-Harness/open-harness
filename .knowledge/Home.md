---
tags:
  - meta
  - index
created: 2024-12-28
updated: 2024-12-28
---

# Open Harness Knowledge Base

Welcome to the canonical knowledge base for **Open Harness** - the infrastructure layer for AI agents.

> **Simplicity scales.**

---

## Quick Navigation

### Documentation
- [[docs/_index|Public Docs]] - Canonical documentation (publishable)
- [[docs/why|Why Open Harness]] - The philosophy
- [[docs/concepts/_index|Core Concepts]] - Agent, Harness, Transport

### Product
- [[product/_index|Product Thinking]] - Vision, roadmap, decisions
- [[product/vision|Vision]] - Where we're going
- [[product/roadmap|Roadmap]] - What we're building

### Private (Investor Materials)
- [[private/PITCH|Investor Pitch]] - "Vercel for AI agents"
- [[private/meetings/_index|Meeting Notes]] - Investor conversations

### Reference
- [[resources/_index|Resources]] - Research, competitors, inspiration

---

## The Three Primitives

```
┌─────────────────────────────────────────────┐
│                 HARNESS                      │
│         (Orchestrates everything)            │
│                                              │
│    ┌─────────┐           ┌─────────┐        │
│    │  AGENT  │  ←─────→  │  AGENT  │        │
│    └─────────┘           └─────────┘        │
│                                              │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
            ┌─────────────┐
            │  TRANSPORT  │  → Console, WebSocket, Metrics
            └─────────────┘
```

---

## Recent Activity

```dataview
TABLE file.mtime AS "Modified", tags
FROM ""
WHERE file.name != "Home" AND !contains(file.path, ".obsidian")
SORT file.mtime DESC
LIMIT 10
```

---

## Quick Links

| Resource | Description |
|----------|-------------|
| [[CLAUDE]] | AI agent instructions |
| [[templates/_index\|Templates]] | Note templates |
| [[daily/_index\|Daily Notes]] | Your working notes |

---

*See [[CLAUDE]] for how AI tools interact with this vault.*
