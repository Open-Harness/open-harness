# v0.3.0 Semantics Rename: Phases 7, 8, 9 Handoff

## Context

The v0.3.0 semantics rename is in progress. **Phases 1-6 and 10 are COMPLETE**. Code changes are done and verified (typecheck, lint, tests all pass).

**What was renamed:**
- `Provider` → `Harness` (SDK adapters that "harness" an AI SDK)
- `Harness` → `Workflow` (orchestration layer that coordinates workflows)

**Signal semantics:**
- Orchestration signals: `harness:start` → `workflow:start`, `harness:end` → `workflow:end`
- SDK adapter signals: `provider:start` → `harness:start`, `provider:end` → `harness:end`
- Agents activate on `workflow:start` (orchestration event), NOT `harness:start` (SDK adapter event)

---

## Rename Mapping Reference

### Types
| Old | New |
|-----|-----|
| `Provider<TInput, TOutput>` | `Harness<TInput, TOutput>` |
| `ProviderInput` | `HarnessInput` |
| `ProviderOutput` | `HarnessOutput` |
| `ProviderCapabilities` | `HarnessCapabilities` |
| `ProviderState` | `HarnessState` |
| `ClaudeProvider` | `ClaudeHarness` |
| `ClaudeProviderConfig` | `ClaudeHarnessConfig` |
| `CodexProvider` | `CodexHarness` |
| `CodexProviderConfig` | `CodexHarnessConfig` |
| `Harness<TState>` | `Workflow<TState>` |
| `HarnessConfig<TState>` | `WorkflowConfig<TState>` |
| `createHarness<TState>()` | `createWorkflow<TState>()` |
| `HarnessFactory<TState>` | `WorkflowFactory<TState>` |
| `ReactiveHarnessConfig` | `ReactiveWorkflowConfig` |
| `ReactiveHarnessResult` | `ReactiveWorkflowResult` |

### Functions
| Old | New |
|-----|-----|
| `setDefaultProvider()` | `setDefaultHarness()` |
| `getDefaultProvider()` | `getDefaultHarness()` |
| `createHarness()` | `createWorkflow()` |
| `isHarness()` | `isWorkflow()` |

### Signals
| Old | New | Layer |
|-----|-----|-------|
| `provider:start` | `harness:start` | SDK Adapter |
| `provider:end` | `harness:end` | SDK Adapter |
| `provider:error` | `harness:error` | SDK Adapter |
| `harness:start` | `workflow:start` | Orchestration |
| `harness:end` | `workflow:end` | Orchestration |
| `harness:terminating` | `workflow:terminating` | Orchestration |

### Config Properties
| Old | New |
|-----|-----|
| `signalProvider` | `signalHarness` |
| `provider:` (in runReactive) | `harness:` |

### Packages
| Old | New |
|-----|-----|
| `@open-harness/provider-claude` | `@open-harness/claude` |
| `@open-harness/provider-openai` | `@open-harness/openai` |

### Comments/Documentation
| Old | New |
|-----|-----|
| "provider" (SDK context) | "harness" |
| "harness" (orchestration context) | "workflow" |
| "Provider lifecycle" | "Harness lifecycle" |
| "Harness lifecycle" | "Workflow lifecycle" |
| "on harness:start" | "on workflow:start" |

---

## Phase 7: Documentation (apps/docs)

Update all MDX files in `apps/docs/` to use new naming.

### Files to Update
```bash
# Find all MDX files
find apps/docs -name "*.mdx" -type f
```

### Search Patterns
```bash
# Find old naming in docs
grep -rn "ClaudeProvider\|CodexProvider\|createHarness\|signalProvider" apps/docs/
grep -rn "provider:start\|provider:end\|provider:error" apps/docs/
grep -rn "harness:start\|harness:end" apps/docs/  # Check context - may need workflow:
grep -rn "@open-harness/provider-" apps/docs/
```

### Key Changes
1. Import statements: `ClaudeProvider` → `ClaudeHarness`, `createHarness` → `createWorkflow`
2. Code examples: Update variable names, signal names, config properties
3. Conceptual explanations: "provider" → "harness", "harness" → "workflow" where appropriate
4. Package references: `@open-harness/provider-claude` → `@open-harness/claude`

### Verification
```bash
cd apps/docs && bun run build
```

---

## Phase 8: Internal Documentation

Update all MD files throughout the repo.

### Files to Update
```bash
# Find all MD files (excluding node_modules, .git)
find . -name "*.md" -type f -not -path "*/node_modules/*" -not -path "*/.git/*"
```

### Priority Files
1. `CLAUDE.md` (root)
2. `.claude/CLAUDE.md`
3. `packages/CLAUDE.md`
4. All package README files
5. All example README files
6. Spec files in `specs/`

### Search Patterns
```bash
grep -rn "ClaudeProvider\|CodexProvider\|createHarness" --include="*.md" .
grep -rn "provider:start\|provider:end" --include="*.md" .
grep -rn "@open-harness/provider-" --include="*.md" .
```

---

## Phase 9: Package Configuration

Update package.json files and related config.

### Files to Check
```bash
# All package.json files
find packages -name "package.json" -type f
```

### Specific Updates
1. **Dependency names**: Any references to old package names
2. **Description fields**: Update terminology
3. **Keywords**: Update if they reference old names
4. **tsconfig.json path mappings**: Verify paths are correct

### Verification
```bash
bun install  # Ensure deps resolve
bun run typecheck
bun run test
```

---

## Final Step: Opus Multi-Spectrum Analysis

After completing phases 7, 8, 9, launch an Opus subagent to do a fresh-eyes review:

```
Use the Task tool with:
- subagent_type: "Explore"
- model: "opus"
- prompt: See below
```

### Opus Review Prompt

```
# v0.3.0 Semantics Rename - Fresh Eyes Audit

You are performing a comprehensive multi-spectrum analysis of the v0.3.0 semantics rename to catch any missed references.

## Rename Summary
- `Provider` → `Harness` (SDK adapters)
- `Harness` → `Workflow` (orchestration)
- `provider:*` signals → `harness:*` signals
- `harness:*` signals → `workflow:*` signals (for orchestration)
- Package names: `@open-harness/provider-*` → `@open-harness/claude`, `@open-harness/openai`

## Your Task

Perform a thorough audit across these dimensions:

### 1. Code Consistency
Search for any remaining old naming:
- `ClaudeProvider`, `CodexProvider`, `Provider<`
- `createHarness<` (should be `createWorkflow<`)
- `signalProvider` (should be `signalHarness`)
- `provider:start`, `provider:end`, `provider:error`
- `harness:start`, `harness:end` used as activation triggers (should usually be `workflow:start`, `workflow:end`)

### 2. Documentation Consistency
Check docs for outdated:
- Import examples
- Code snippets
- Conceptual explanations using old terminology
- API references

### 3. Configuration Consistency
Check:
- package.json files for old package names
- tsconfig.json for path mappings
- Any build/config files

### 4. Test Consistency
Verify tests use correct:
- Signal names in assertions
- Type names in mocks
- Activation patterns

### 5. Comment/JSDoc Consistency
Search for comments still using old terminology

## Output Format

Provide a report with:
1. **CRITICAL**: Must-fix issues that would break functionality
2. **IMPORTANT**: Naming inconsistencies that should be fixed
3. **MINOR**: Documentation/comment updates that would be nice to have
4. **CLEAN**: Areas that passed audit

For each issue found, provide:
- File path and line number
- Current text
- Suggested fix
```

---

## Completion Checklist

- [ ] Phase 7: All MDX docs updated, docs build passes
- [ ] Phase 8: All internal MD files updated
- [ ] Phase 9: Package configs verified
- [ ] Opus audit launched and issues addressed
- [ ] Final verification: `bun run typecheck && bun run lint && bun run test`
- [ ] Commit with message: `docs(v030): complete semantics rename documentation updates`
