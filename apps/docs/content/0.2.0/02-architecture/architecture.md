# Architecture

**Status:** Outline Only  
**Purpose:** User-facing architecture overview

---

## Overview

How Open Harness works under the hood (user-facing, not internal details).

---

## Sections

### System Components

- Workflows (nodes, edges, bindings, state)
- Execution Engine (how workflows run)
- Provider Integration (how agents connect)
- Evals System (how quality is measured)
- Recording & Replay (how testing works)
- Transport Layer (HTTP, WebSocket, local)

### Execution Engine

- Compiler (parse YAML, build DAG)
- Scheduler (determine ready nodes)
- Executor (run nodes, handle errors)
- State Manager (track status, snapshots)
- Event Bus (emit all events)

### Provider Integration

- Provider Traits (abstraction layer)
- Provider Adapters (SDK integration)
- Session Management (stateful agents)
- Swap Providers (change without code)
- Mix Providers (different agents in same workflow)

### Evals System

- Assertions (output constraints)
- Scorers (built-in metrics)
- Recording (capture everything)
- Replay (deterministic testing)
- Comparison (before vs. after)

### Recording & Replay

- Recording modes (live, record, replay, passthrough)
- Recording stores (in-memory, file, sqlite)
- Deterministic IDs (input hash based)
- Replay testing (same input → same output)
- Regression detection (compare to golden)

### Transport Layer

- HTTP-SSE (browser-based UIs)
- WebSocket (TUI, real-time apps)
- Local (CLI tools, dev)
- Event streaming (full visibility)
- Bidirectional communication (commands, events)

---

## Purpose

User-facing architecture overview (how it works, not implementation details).
