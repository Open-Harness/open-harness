# Open Harness Documentation Index

**Type:** Monorepo with 5 parts
**Primary Language:** TypeScript
**Architecture:** SDK + CLI + Applications Pattern
**Last Updated:** 2025-12-24

## Project Overview

**Open Harness** (working name: "dao") is an extensible workflow SDK for building AI agent applications. Built on top of the Anthropic Agent SDK, it provides clean abstractions for creating agents, workflows, and task management with readable narrative output (Monologue).

The project consists of:
- A **core SDK** (`@dao/sdk`) - The heart of the system
- A **CLI** (`@dao/cli`) - Workflow runner for YAML-configured workflows
- A **Trading Bot** - Example application demonstrating SDK usage
- A **Documentation Site** - Next.js-based docs (scaffolded)
- A **Backend Server** - Hono-based API server (minimal)

## Project Structure

This project consists of 5 parts:

### @dao/sdk (packages/sdk)
- **Type:** Library
- **Location:** `packages/sdk/`
- **Tech Stack:** TypeScript, Bun, Anthropic Agent SDK, NeedleDI
- **Entry Point:** `src/index.ts`
- **Status:** Working, nearly publishable

### @dao/cli (apps/cli)
- **Type:** CLI
- **Location:** `apps/cli/`
- **Tech Stack:** TypeScript, Bun, Commander, Chalk
- **Entry Point:** `src/index.ts`
- **Status:** Code complete, needs integration fixes

### trading-bot (apps/trading-bot)
- **Type:** Backend/CLI Application
- **Location:** `apps/trading-bot/`
- **Tech Stack:** TypeScript, Bun, CCXT, Technical Indicators
- **Entry Point:** `index.ts`
- **Status:** Example application, working tests

### docs (apps/docs)
- **Type:** Web (Next.js)
- **Location:** `apps/docs/`
- **Tech Stack:** Next.js 16, React 19, TailwindCSS, shadcn/ui
- **Entry Point:** `src/app/page.tsx`
- **Status:** Scaffolded, minimal content

### server (apps/server)
- **Type:** Backend API
- **Location:** `apps/server/`
- **Tech Stack:** Hono, Bun
- **Entry Point:** `src/index.ts`
- **Status:** Minimal scaffold

## Cross-Part Integration

The SDK is the central dependency:
- CLI imports `@dao/sdk` for workflow execution
- Trading Bot demonstrates SDK patterns (but doesn't import directly yet)
- All apps share `@dao/config` workspace package

## Quick Reference

| Part | Stack | Entry | Status |
|------|-------|-------|--------|
| SDK | TS + Anthropic SDK + NeedleDI | `src/index.ts` | Working |
| CLI | TS + Commander | `src/index.ts` | Code Complete |
| Trading Bot | TS + CCXT | `index.ts` | Example App |
| Docs | Next.js 16 | `src/app/page.tsx` | Scaffolded |
| Server | Hono | `src/index.ts` | Minimal |

## Generated Documentation

### Core Documentation
- [Project Overview](./project-overview.md) - Executive summary and high-level architecture
- [Source Tree Analysis](./source-tree-analysis.md) - Annotated directory structure

### Part-Specific Documentation

#### SDK (@dao/sdk)
- [Architecture - SDK](./architecture-sdk.md) - Technical architecture for the SDK
- [API Reference - SDK](./api-reference-sdk.md) - Public API documentation
- [Development Guide - SDK](./development-guide-sdk.md) - Setup and dev workflow

#### CLI (@dao/cli)
- [Architecture - CLI](./architecture-cli.md) - Technical architecture for the CLI
- [Development Guide - CLI](./development-guide-cli.md) - Setup and dev workflow

#### Trading Bot
- [Architecture - Trading Bot](./architecture-trading-bot.md) - Technical architecture
- [Development Guide - Trading Bot](./development-guide-trading-bot.md) - Setup and dev workflow

### Integration
- [Integration Architecture](./integration-architecture.md) - How parts communicate

## Existing Documentation

- [SDK README](../packages/sdk/README.md) - SDK overview and quick start
- [SDK QUICKSTART](../packages/sdk/QUICKSTART.md) - Detailed getting started guide
- [SDK PROJECT_STRUCTURE](../packages/sdk/PROJECT_STRUCTURE.md) - SDK internal structure
- [Root README](../README.md) - Project overview (outdated - references "Better-T-Stack")
- [Trading Bot Architecture](../TRADING-BOT-ARCHITECTURE.md) - Trading bot design doc

## Getting Started

### Prerequisites
- Bun 1.3.3+
- Node.js 20+ (for some tooling)
- Anthropic API key (for SDK usage)

### Setup
```bash
bun install
```

### Run Locally

**SDK Examples:**
```bash
cd packages/sdk
bun example:basic
bun example:workflow
bun example:autonomous
```

**CLI:**
```bash
cd apps/cli
bun dao --help
```

**Trading Bot:**
```bash
cd apps/trading-bot
bun test
bun cli --help
```

**Docs Site:**
```bash
cd apps/docs
bun dev
```

### Run Tests
```bash
# SDK tests
cd packages/sdk && bun test

# Trading Bot tests
cd apps/trading-bot && bun test
```

## For AI-Assisted Development

This documentation was generated specifically to enable AI agents to understand and extend this codebase.

### When Planning New Features:

**SDK features:**
→ Reference: `architecture-sdk.md`, `api-reference-sdk.md`

**CLI features:**
→ Reference: `architecture-cli.md`, `architecture-sdk.md` (CLI depends on SDK)

**Trading Bot features:**
→ Reference: `architecture-trading-bot.md`

**Full-stack features:**
→ Reference: All architecture docs + `integration-architecture.md`

---

_Documentation generated by BMAD Method `document-project` workflow_
