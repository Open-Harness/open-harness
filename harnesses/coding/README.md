# Coding Workflow Harness

A two-phase coding workflow that demonstrates the Open Harness SDK.

## Overview

This harness implements a complete coding workflow:

**Phase 1: Planning**
- Takes a PRD (Product Requirements Document)
- Breaks it into development tickets using an LLM

**Phase 2: Execution**
- For each ticket: generates code, then reviews it
- Continues until all tickets are completed

## Setup

```bash
bun install
```

## Usage

```bash
# Run the harness
bun start

# Development mode with hot reload
bun dev
```

## Architecture

This harness demonstrates:

- **BaseHarness**: Step-aware orchestration
- **Agent**: Lightweight agent wrapper with step context
- **AsyncGenerator pattern**: Yielding results as steps complete
- **State management**: Tracking tickets and progress

## Requirements

- Bun runtime
- `ANTHROPIC_API_KEY` environment variable (or Claude Code session)
