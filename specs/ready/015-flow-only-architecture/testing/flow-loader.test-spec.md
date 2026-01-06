# Flow Loader Test Specification

**Component**: `packages/kernel/src/flow/loader.ts`  
**Last Updated**: 2025-12-31  
**Status**: Draft

## Overview

Tests for Flow loader extensions: `flow.nodePacks` allowlist and `promptFile` resolution.

## Test Requirements

### R1: nodePacks allowlist

**Fixture**: `fixtures/golden/flow/loader-nodepacks.jsonl`  
**Test File**: `tests/replay/flow.loader.test.ts`  
**Test Name**: `"loads allowed node packs and rejects disallowed"`

**Scenario**:
1. Provide FlowSpec with `flow.nodePacks` including one allowed and one disallowed pack
2. Loader reads `oh.config.ts` allowlist
3. Run loader

**Assertions**:
- Allowed pack is loaded
- Disallowed pack raises an error

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow loader-nodepacks
```

---

### R2: promptFile resolution

**Fixture**: `fixtures/golden/flow/loader-promptfile.jsonl`  
**Test File**: `tests/replay/flow.loader.test.ts`  
**Test Name**: `"resolves promptFile relative to YAML"`

**Scenario**:
1. FlowSpec node references `promptFile: ./prompts/test.md`
2. Loader resolves path relative to FlowSpec file
3. Loader injects prompt text into node input

**Assertions**:
- Prompt content is injected into node input
- Missing file raises an error

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow loader-promptfile
```

---

## Live Test (Authoritative)

**Script**: `scripts/live/flow-loader-live.ts`  
**Requirement**: MUST pass before marking Flow loader complete  
**Timeout**: 30s  
**Description**: Loads FlowSpecs with node packs and promptFile using real filesystem

**Execution**:
```bash
bun scripts/live/flow-loader-live.ts
```

**Success Criteria**:
- Allowed packs load
- Disallowed packs reject
- promptFile injects content correctly

---

## Unit Tests (Pure Logic)

**Test File**: `tests/unit/flow.loader.unit.test.ts`

**Requirements**:
- Path resolution is correct for relative promptFile
- nodePacks allowlist matching is deterministic

---

## Coverage Checklist

- [ ] R1: nodePacks allowlist
- [ ] R2: promptFile resolution
- [ ] Live test script
- [ ] Unit tests for pure logic

---

## Notes

- Loader must not read outside project root.
