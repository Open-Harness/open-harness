---
name: adr-deep-audit
description: Use when auditing a repo for ADR/spec drift, dual architectures, legacy compatibility layers, or conflicting event/state models before refactoring.
---

# ADR Deep Audit

## Overview

A repeatable, code-first audit workflow to find **dual architectures**, **legacy/compat shims**, and **spec/ADR drift**—especially in event/state systems—before attempting cleanup.

## When to Use

- The repo has “new architecture” goals (new event types / new runtime) but still feels muddied.
- You suspect backwards-compat layers are creating bugs (mis-mapped events, inconsistent payloads, duplicated serialization).
- You need an exhaustive inventory of what must be removed, with file-level evidence.

## Outputs (required)

1. **Inventory table** (everything legacy/compat/dual-path)
2. **Runtime trace notes** (what actually happens in execution)
3. **Risk + removal prerequisites** per item (tests/fixtures/contracts)

## Audit Method (code-first)

### 1) Establish the canonical spec set

- Identify the authoritative docs (ADRs, PRD, constitution/rules).
- Extract the **non-negotiables** as invariants (e.g., single event model, single wire format, no dual storage).

### 2) Build a “smell” search list (fast discovery)

Search for these strings and patterns:

- `legacy`, `compat`, `compatibility`, `migration`, `shim`, `adapter`
- `deprecated`, `for now`, `temporary`, `kept for backward`
- `toLegacy`, `fromLegacy`, `workflowEventTo*`, `*ToWorkflowEvent`
- duplicated maps: `tagToEventName`, `nameMap`, `toSerializedEvent`
- old wire/event names that should be gone: `state:updated`, `input:response`
- parallel APIs: multiple `run/execute/stream` entrypoints
- dual persistence: “legacy table”, “old format”, “new format”

Record *all matching files*.

### 3) Partition the system into audit zones

Audit each zone independently and look for boundary translations:

1. **Domain event model** (new types)
2. **Persistence/wire format** (EventStore, SSE, EventBus)
3. **Runtime emission** (where events are created, serialized, and published)
4. **State derivation** (deriveState / caches / checkpoints)
5. **Client consumption** (SSE parsing, React hooks, legacy Provider)
6. **Server routes/programs** (input events, normalization, state endpoints)
7. **Tests** (tests that pin legacy behavior; tests that validate migration)

For each zone, identify:

- Primary types
- Secondary (compat) types
- Converters between them
- Where the “truth” lives (events vs state)

### 4) Validate by tracing real execution paths

Do not trust comments. Trace:

- **emit path:** where an event originates → how it’s named → how it’s stored → how it’s sent to clients
- **read path:** how state is computed for routes/UI → what event names it expects
- **HITL path:** request → response → state update → next-phase routing

Write down “what happens” with file+function references.

### 5) Produce the inventory table (exhaustive)

Use this template:

| Area | Item | Location(s) | What it does (actual) | Why it exists | Spec conflict | Bug risk | Removal prerequisites |
|---|---|---|---|---|---|---|---|

Rules:
- One row per distinct compat/dual-path mechanism.
- Include exact file paths and key functions.
- If two mechanisms overlap, reference each other.

### 6) Define deletion sequencing gates

For each inventory item, specify:

- what API/contracts would change (public types, SSE payloads, DB schema)
- which tests must be updated/added first
- whether recorded fixtures must be regenerated

## Common Failure Modes to catch

- Multiple `_tag → name` maps (guaranteed drift)
- “New events” internally but “old names” persisted/wired (silent incompat)
- State derivation supporting both formats indefinitely
- Server accepting old input events while client emits new ones (or vice versa)
- Duplicate provider recorder schemas/tables and code paths

## Done Criteria

An audit is only “done” when:

- The inventory has **no unexplained legacy/compat code paths left**
- Each row has a concrete removal prerequisite
- Highest-risk inconsistencies (event naming/serialization) are identified with exact locations
