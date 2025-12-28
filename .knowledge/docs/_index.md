---
tags:
  - docs
  - index
created: 2024-12-28
updated: 2024-12-28
---

# Documentation

This is the **canonical public documentation** for Open Harness. Everything here is publishable - it may be synced to the npm package, website, or README.

## Core Documents

- [[why|Why Open Harness]] - The philosophy and motivation
- [[quickstart|Quickstart]] - Get started in 5 minutes

## Concepts

The three primitives:

- [[concepts/agents|Agents]] - Units of AI behavior
- [[concepts/harness|Harness]] - The orchestration layer
- [[concepts/transports|Transports]] - Output destinations

## Examples

- [[examples/basic-workflow|Basic Workflow]] - Your first multi-agent workflow

---

## Publishing

This folder is the source of truth. To sync to the SDK package:

```bash
cp -r .knowledge/docs/* packages/sdk/docs/
```
