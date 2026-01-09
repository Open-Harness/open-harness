# Skills Pattern

**Status:** Outline Only  
**Purpose:** How skills work, why they're better than MCP

---

## Overview

The Skills Pattern is the core approach to building agentic systems in Open Harness.

---

## Sections

### What Are Skills

- Domain expertise encoded for agents
- Prompt (what agent knows)
- Rules (what agent must do)
- Scripts (what agent can use)
- Evals (how to measure success)

### Skills vs. MCP

- MCP: Tool discovery, standard interface, protocol
- Skills: Progressive disclosure, rules, massive context, smart chunking
- Why Skills > MCP (empowerment vs. abstraction)

### Skill Structure

- name (identifier)
- systemPrompt (agent's domain knowledge)
- tools (scripts agent can call)
- rules (hard-coded constraints)
- evals (quality criteria)
- chunking (massive context management)

### Progressive Disclosure

- Phase 1: Load titles only
- Phase 2: Load abstracts
- Phase 3: Load full content
- Why this matters (manage massive context)
- Smart chunking strategies

### Creating Skills

- Step 1: Define prompt (your domain knowledge)
- Step 2: Add rules (constraints, safety)
- Step 3: Create scripts (wrap libraries)
- Step 4: Define evals (success criteria)
- Step 5: Test and iterate

---

## Purpose

Explain the skills pattern and how to use it.
