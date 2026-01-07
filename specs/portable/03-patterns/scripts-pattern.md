# Scripts Pattern

**Status:** Outline Only  
**Purpose:** Scripts + shell optimization = universal access

---

## Overview

The Scripts Pattern gives agents universal access to anything via shell execution.

---

## Sections

### What Are Scripts

- Wrappers around libraries you already use
- Simple Python/TypeScript scripts
- Executed via a shell tool (e.g. bash)
- Universal access to any capability

### Scripts vs. MCP

- MCP: Tool invocation, limited scope
- Scripts: Shell tool + library wrappers + CLI integration
- Why Scripts > MCP (universal access vs. limited protocol)

### Shell Optimization

- Agent shell tool = universal access
- Can call ANY Python script
- Can call ANY TypeScript script
- Can call ANY CLI tool
- Can access ANY library

### Script Wrappers

- How to wrap libraries (CCXT, pandas, Web3.py)
- How to wrap CLIs (kubectl, docker, terraform)
- How to make them agent-friendly
- How to expose them via the shell tool

### Examples

- Trading: CCXT wrapper, TA-Lib wrapper
- Data Science: Pandas wrapper, NumPy wrapper
- DevOps: Kubernetes wrapper, Docker wrapper
- ML: TensorFlow wrapper, PyTorch wrapper

---

## Purpose

Explain the scripts pattern and shell optimization.
