---
tags:
  - product
  - index
created: 2024-12-28
updated: 2024-12-28
---

# Product

Internal product thinking for Open Harness. This section is tracked in git and shareable with the team.

## Strategy

- [[vision|Vision]] - Where we're going long-term
- [[roadmap|Roadmap]] - What we're building and when

## Decisions

Architecture Decision Records (ADRs) for significant choices:

```dataview
TABLE status, created
FROM "product/decisions"
WHERE file.name != "_index" AND file.name != "_template"
SORT created DESC
```

→ [[decisions/_template|Decision Template]]

---

## Key Links

- [[../docs/why|Why Open Harness]] - The public philosophy
- [[../private/PITCH|Investor Pitch]] - Business framing
