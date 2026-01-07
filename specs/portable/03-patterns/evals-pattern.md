# Evals Pattern

**Status:** Outline Only  
**Purpose:** How evals enable automatic improvement

---

## Overview

Evals are built into Open Harness. No guesswork required.

---

## Sections

### What Are Evals

- Automatic quality measurement
- Data-driven improvement
- Record → Compare → Iterate

### Why Evals Matter

- No guesswork ("I think this is better")
- Data proves what's better
- Regression detection
- Optimization (cost vs. quality tradeoffs)

### Eval Types

- Assertions (output contains, latency under, cost under)
- Scorers (built-in: latency, cost, tokens)
- LLM-as-Judge (quality criteria, minScore)
- Human annotation (async, requires human input)
- Custom (user-defined functions)

### Recording and Replay

- Recordings capture everything (events, state, metrics)
- Replay is deterministic (same input → same output)
- Perfect for testing (reproduce bugs)
- Perfect for comparisons (A/B test prompts)
- Perfect for regression (catch breaking changes)

### Regression Detection

- Compare new runs to golden recordings
- Detect breaking changes automatically
- CI/CD integration (block bad deployments)
- Pass rates, avg latency, avg cost

---

## Purpose

Explain the evals pattern and how to use it.
