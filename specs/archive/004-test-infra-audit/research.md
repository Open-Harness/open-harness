# Research Findings: Testing Infrastructure Audit

**Feature**: 004-test-infra-audit
**Date**: 2025-12-26
**Status**: Complete

## U001: Test Script Separation

### Decision
Use package.json scripts with path-based filtering to separate safe tests from live tests.

### Rationale
Bun's test runner currently lacks native support for test exclusion patterns (feature request #21395 still open). The most reliable approach is explicit directory specification in npm scripts.

### Recommended Configuration

```json
{
  "scripts": {
    "test": "bun test tests/unit tests/replay",
    "test:unit": "bun test tests/unit",
    "test:replay": "bun test tests/replay",
    "test:live": "bun test tests/integration",
    "test:all": "bun test tests/"
  }
}
```

### Requirement Mapping
- **FR-001**: `bun test` runs only unit + replay (safe tests) ✅
- **FR-004**: `bun test:live` for integration tests ✅
- **SC-001**: Default suite completes without network ✅

### Alternatives Rejected
| Alternative | Reason Rejected |
|-------------|-----------------|
| bunfig.toml test.root | Only sets one starting directory, can't combine unit + replay |
| Wait for pathIgnorePatterns | Open feature request, no timeline |
| Environment variable conditionals | Pollutes test code with infrastructure logic |

---

## U002: Recording Container Behavior

### Decision
Current implementation is **COMPLIANT** - recording requires explicit `startCapture()` call.

### Analysis
From `packages/sdk/tests/helpers/recording-wrapper.ts`:

```typescript
export class RecordingRunner implements IAgentRunner {
  private isCapturing = false;  // OFF by default

  async run(args) {
    // Only captures when isCapturing is true
    if (this.isCapturing) {
      this.capturedMessages.push(msg);
    }
  }

  startCapture(scenarioId: string): void {
    this.isCapturing = true;  // Must be explicitly called
  }
}
```

### Key Findings
1. `createRecordingContainer()` does NOT auto-start recording
2. `RecordingRunner.isCapturing` defaults to `false`
3. Recording only occurs after explicit `recorder.startCapture()` call
4. Save requires explicit `recorder.saveCapture()` call

### Requirement Mapping
- **FR-006**: Live tests don't record by default ✅ COMPLIANT
- **FR-007**: Recording requires explicit request ✅ COMPLIANT

### No Changes Needed
The current implementation already satisfies the spec requirements.

---

## U003: Bun Test Ecosystem Best Practices

### Decision
Use package.json scripts with explicit directory paths as the standard pattern.

### Rationale
- Bun test runner auto-discovers `*.test.ts` and `*_test.ts` files
- No native exclude patterns available yet
- npm scripts provide clear, self-documenting commands
- Compatible with CI/CD environments

### Recommended Structure
```
tests/
├── unit/           # Pure logic, no external deps, fast (<1s total)
├── replay/         # Recorded fixtures, deterministic, no network
└── integration/    # Live API calls, uses OAuth auth
```

### Naming Conventions
- Unit tests: `*.test.ts` (e.g., `validation.test.ts`)
- Replay tests: `*.replay.test.ts` (e.g., `agent.replay.test.ts`)
- Live tests: `*.test.ts` in integration/ dir (e.g., `live-sdk.test.ts`)

---

## U004: Fixture Recovery Handling

### Decision
Implement clear error messages with recovery guidance for missing/corrupted fixtures.

### Recommended Approach

1. **Missing Fixture Detection**
   ```typescript
   // In replay-runner.ts
   async load(): Promise<void> {
     try {
       const content = await fs.readFile(filePath, "utf-8");
       this.session = JSON.parse(content);
     } catch (error) {
       throw new Error(
         `Fixture not found: ${filePath}\n` +
         `To regenerate: bun test:live --record\n` +
         `See: packages/sdk/docs/TESTING.md#fixture-management`
       );
     }
   }
   ```

2. **Corrupted Fixture Detection**
   - Validate JSON structure on load
   - Check required fields (scenarioId, messages array)
   - Provide clear error with regeneration instructions

3. **Partial Recording Protection**
   - Write to temp file first
   - Atomic rename on success
   - Never overwrite good fixture with partial data

### Edge Cases from Spec
| Scenario | Handling |
|----------|----------|
| No API credentials in CI | Default tests pass (unit + replay only) |
| Interrupted recording | Temp file discarded, original preserved |
| Missing fixture | Clear error with regeneration command |
| Corrupted fixture | Validation error with recovery steps |
| Offline environment | Unit + replay work fully offline |

---

## Authentication Model Clarification

### Important Note
This project uses **OAuth/subscription authentication** (via Claude Code), NOT `ANTHROPIC_API_KEY`.

- **DO NOT** check for `ANTHROPIC_API_KEY` - it's not used
- OAuth token is automatically available when running in Claude Code context
- Live tests should just run - auth is already configured

### Documentation Update Needed
Remove any references to `ANTHROPIC_API_KEY` in documentation. Update `live-sdk.test.ts` to remove the API key check logging:

```typescript
// REMOVE this check - it's misleading
if (process.env.ANTHROPIC_API_KEY) {
  console.log("Using API key authentication");
} else {
  console.log("Using subscription authentication (no API key)");
}
```

---

## U005: Multi-Dimensional Audit Methodology

### Decision
Use a systematic 5-dimension audit framework with specific tools and commands for each dimension.

### Context
The spec requires examining testing infrastructure across multiple dimensions (FR-015 to FR-019) to surface at least 5 actionable findings beyond the 3 known issues (SC-005).

### Audit Framework

#### Dimension 1: Test Isolation & Dependencies (FR-015)

**What to examine**:
- Test files importing from other test files (indicates shared state)
- Global variables or singletons modified during tests
- Tests that fail when run in isolation vs. in suite
- Container instances shared across tests

**Audit commands**:
```bash
# Find cross-test imports
grep -r "from.*tests/" tests/ --include="*.test.ts" | grep -v "helpers/"

# Find global state mutations
grep -rn "global\." tests/ --include="*.test.ts"
grep -rn "process.env" tests/ --include="*.test.ts"

# Run tests individually to check isolation
for f in tests/unit/*.test.ts; do bun test "$f" && echo "PASS: $f"; done
```

**Red flags**:
- Tests importing from other test directories
- Shared container instances without reset
- Environment variable manipulation without cleanup

#### Dimension 2: Test Performance & Execution Time (FR-016)

**What to examine**:
- Individual test duration
- Category-level timing (unit vs replay vs integration)
- Timeout configurations
- Slow test identification

**Audit commands**:
```bash
# Time each test category
time bun test tests/unit
time bun test tests/replay
time bun test tests/integration

# Check for excessive timeouts (indicates slow tests)
grep -rn "timeout:" tests/ --include="*.test.ts"
```

**Benchmarks**:
| Category | Target | Concern Threshold |
|----------|--------|-------------------|
| Unit (total) | <5s | >10s |
| Replay (total) | <10s | >20s |
| Integration (per test) | <60s | >120s |

**Red flags**:
- Unit tests taking >1s each
- Replay tests taking >5s each
- Default suite exceeding 30s (SC-001 violation)

#### Dimension 3: Test Coverage & Gaps (FR-017)

**What to examine**:
- Source files without corresponding tests
- Public API functions without test coverage
- Edge cases from spec not covered
- Untested error paths

**Audit approach**:
```bash
# List source files
find src/ -name "*.ts" -not -path "*/node_modules/*" > src_files.txt

# List test files
find tests/ -name "*.test.ts" > test_files.txt

# Compare coverage
# For each src file, check if corresponding test exists
```

**Coverage mapping**:
| Source Directory | Expected Test Location | Check |
|-----------------|------------------------|-------|
| src/core/ | tests/unit/ | Pure logic coverage |
| src/providers/ | tests/unit/ + tests/replay/ | Agent behavior |
| src/agents/ | tests/integration/ | Live behavior |

**Red flags**:
- Core modules without unit tests
- Agents without replay tests
- Error handlers without test coverage

#### Dimension 4: Fixture Management & Staleness (FR-018)

**What to examine**:
- Recording age (when was it captured?)
- Fixture size trends
- Missing metadata in recordings
- Orphaned fixtures (not used by any test)

**Audit commands**:
```bash
# Check fixture ages
find recordings/ -name "*.json" -exec stat -f "%Sm %N" {} \;

# Check fixture sizes
du -h recordings/golden/*

# Find fixtures referenced in tests
grep -rh "createReplayContainer" tests/ | grep -o '"[^"]*"' | sort | uniq

# Compare to actual fixture files to find orphans
ls recordings/golden/*/*.json
```

**Staleness indicators**:
- Fixture >30 days old without update
- API response format changed since capture
- Test passing but fixture has deprecated fields

**Red flags**:
- Fixtures from old API versions
- Large fixtures (>100KB) suggesting over-capture
- Orphaned fixtures consuming disk space

#### Dimension 5: Parallelization & Optimization (FR-019)

**What to examine**:
- Tests that could run in parallel
- Serial dependencies that prevent parallelization
- Resource contention (file system, ports)
- Bun's built-in parallelization usage

**Audit approach**:
```bash
# Check for file system writes in tests
grep -rn "writeFile\|mkdir" tests/ --include="*.test.ts"

# Check for port usage
grep -rn "listen\|port" tests/ --include="*.test.ts"

# Check for explicit serial markers
grep -rn "serial\|runInBand" tests/ --include="*.test.ts"
```

**Parallelization opportunities**:
| Test Type | Parallelizable? | Constraint |
|-----------|-----------------|------------|
| Unit tests | Yes | No shared state |
| Replay tests | Yes | Fixture read-only |
| Integration tests | Limited | OAuth token rate limits |

**Red flags**:
- Tests that write to the same file
- Tests that use the same port
- Tests with timing-sensitive assertions

### Audit Deliverable Template

The audit will produce `specs/004-test-infra-audit/audit.md` with this structure:

```markdown
# Testing Infrastructure Audit Report

## Executive Summary
- Total findings: N
- Critical: X, High: Y, Medium: Z, Low: W

## Findings by Dimension

### 1. Test Isolation (FR-015)
| ID | Finding | Severity | Effort | Recommendation |
|----|---------|----------|--------|----------------|
| AF-001 | ... | ... | ... | ... |

### 2. Performance (FR-016)
...

### 3. Coverage (FR-017)
...

### 4. Fixture Management (FR-018)
...

### 5. Optimization (FR-019)
...

## Prioritized Action Plan
1. [Critical] ...
2. [High] ...
```

### Requirement Mapping
- **FR-015**: Dimension 1 audit ✅
- **FR-016**: Dimension 2 audit ✅
- **FR-017**: Dimension 3 audit ✅
- **FR-018**: Dimension 4 audit ✅
- **FR-019**: Dimension 5 audit ✅
- **SC-005**: 5-dimension framework ensures comprehensive findings ✅

---

## Summary

| Unknown | Status | Changes Needed |
|---------|--------|----------------|
| U001: Test separation | Resolved | Update package.json scripts |
| U002: Recording behavior | Resolved | No changes - already compliant |
| U003: Bun best practices | Resolved | Document in TESTING.md |
| U004: Fixture recovery | Resolved | Add error handling + docs |
| U005: Audit methodology | Resolved | 5-dimension framework defined |

All unknowns resolved. Ready for Phase 1: Design & Contracts.
