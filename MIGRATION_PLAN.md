# Safe Monorepo Migration Plan

## Overview

This plan migrates the monorepo from a monolithic SDK structure to a modular architecture with separate packages for providers, persistence, and transport layers. The migration is designed to be **incremental**, **testable**, and **reversible** at each step.

**Important:** At the end of each phase, we will **check in with you** before proceeding to the next phase.

## Package Initialization Command

For each new package, use this command to initialize:

```bash
bun init -y && bun add -D -E @biomejs/biome && bun x biome init --jsonc
```

Then manually add the required scripts to `package.json`:

```json
{
  "scripts": {
    "lint": "biome check . --write",
    "typecheck": "tsc --noEmit"
  }
}
```

These scripts will automatically register with Turborepo.

## Quick Reference: Package Setup Checklist

For each new package:

1. ✅ Run initialization command in package directory
2. ✅ Update `package.json`:
   - Set `name` to `@open-harness/package-name`
   - Add `lint` and `typecheck` scripts
   - Set `"type": "module"`
3. ✅ Copy TypeScript configs from `packages/sdk/`
4. ✅ Verify Turborepo recognizes it: `bun run typecheck` (should list new package)
5. ✅ Create `src/` directory and basic structure

## Migration Goals

1. **Extract** provider, persistence, and transport code into separate packages
2. **Remove** Node.js-specific dependencies from core SDK (make it web-compatible)
3. **Create** shared testing utilities and contract testing packages
4. **Maintain** backward compatibility during migration
5. **Ensure** all tests pass at each checkpoint

## Current State Analysis

### Files to Extract

**To `@open-harness/provider-anthropic`:**
- `packages/sdk/src/nodes/claude.agent.ts` (677 lines)
- `packages/sdk/src/testing/mock-query.ts` (used by provider tests)

**To `@open-harness/persistence-sqlite`:**
- `packages/sdk/src/persistence/sqlite-run-store.ts`
- Related tests: `packages/sdk/tests/persistence/run-store.test.ts` (needs splitting)

**To `@open-harness/transport-websocket`:**
- `packages/sdk/src/transport/websocket.ts`
- Transport interface (if separate from websocket.ts)

**To `@open-harness/nodes-basic` (or keep in core):**
- `packages/sdk/src/nodes/constant.ts`
- `packages/sdk/src/nodes/echo.ts`

### Node.js Dependencies to Remove

**In core SDK:**
- `node:crypto` → `globalThis.crypto.randomUUID()`
  - `src/runtime/runtime.ts`
  - `src/testing/mock-query.ts` (moves to provider package)

**Move to provider package (file system operations):**
- `node:fs` (existsSync, readFileSync) in `claude.agent.ts`
- `node:path` (resolve) in `claude.agent.ts`

### Current Dependencies

**SDK package.json dependencies:**
- `@anthropic-ai/claude-agent-sdk` → move to provider package
- `jsonata`, `yaml`, `zod` → keep in core (used by runtime)

**Consumers of `@open-harness/sdk`:**
- `packages/ai-sdk` (imports RuntimeEvent, Runtime, RuntimeCommand, etc.)

## Phase-by-Phase Implementation Plan

### Phase 0: Preparation & Setup (30 min)

**Goal:** Create infrastructure for new packages without breaking existing code.

#### Step 0.1: Create package directories
```bash
mkdir -p packages/provider-anthropic/src
mkdir -p packages/persistence-sqlite/src
mkdir -p packages/transport-websocket/src
mkdir -p packages/nodes-basic/src
mkdir -p packages/provider-testing/src
mkdir -p packages/persistence-testing/src
```

#### Step 0.2: Initialize each package
For each package directory, run:

```bash
cd packages/provider-anthropic
bun init -y && bun add -D -E @biomejs/biome && bun x biome init --jsonc

cd ../persistence-sqlite
bun init -y && bun add -D -E @biomejs/biome && bun x biome init --jsonc

cd ../transport-websocket
bun init -y && bun add -D -E @biomejs/biome && bun x biome init --jsonc

cd ../nodes-basic
bun init -y && bun add -D -E @biomejs/biome && bun x biome init --jsonc

cd ../provider-testing
bun init -y && bun add -D -E @biomejs/biome && bun x biome init --jsonc

cd ../persistence-testing
bun init -y && bun add -D -E @biomejs/biome && bun x biome init --jsonc
```

#### Step 0.3: Configure package.json for each package
For each package, update `package.json`:

1. Set package name (e.g., `"name": "@open-harness/provider-anthropic"`)
2. Add scripts (required for Turborepo):
   ```json
   {
     "scripts": {
       "lint": "biome check . --write",
       "typecheck": "tsc --noEmit"
     }
   }
   ```
3. Set `"type": "module"` if not already set
4. Add TypeScript config:
   - Copy `tsconfig.json` from `packages/sdk/`
   - Copy `tsconfig.build.json` if package will have a build step
   - Adjust paths and references as needed

#### Step 0.4: Create initial test structure
- Set up test directories for each package
- Create placeholder test files
- Add test scripts to package.json (optional for now)

#### Step 0.5: Verify Turborepo registration
```bash
# From root
bun run typecheck  # Should see all packages
bun run lint       # Should see all packages
```

**Checkpoint:** All packages exist, initialize correctly, scripts register with Turborepo, no functionality moved yet.

---

**🛑 CHECK-IN POINT: Phase 0 Complete**

Please review:
- [ ] All 6 packages initialized
- [ ] All packages have lint and typecheck scripts
- [ ] Turborepo recognizes all packages
- [ ] No errors in initialization

**Ready to proceed to Phase 1?**

---

### Phase 1: Extract Basic Nodes (1 hour)

**Goal:** Move constant and echo nodes to separate package (or decide to keep in core).

#### Step 1.1: Create `@open-harness/nodes-basic` package
- Copy `constant.ts` and `echo.ts` to new package
- Update exports
- Add tests

#### Step 1.2: Update SDK to import from nodes-basic
- Update `packages/sdk/src/nodes/index.ts` to re-export from nodes-basic
- Add dependency on `@open-harness/nodes-basic`

#### Step 1.3: Run tests
- Verify all SDK tests pass
- Verify nodes-basic tests pass
- Run Turborepo commands: `bun run typecheck && bun run lint && bun run test`

**Checkpoint:** Basic nodes extracted, SDK still works, tests pass.

**Decision Point:** If nodes are truly universal, we can keep them in core instead. This phase validates the extraction pattern.

---

**🛑 CHECK-IN POINT: Phase 1 Complete**

Please review:
- [ ] Basic nodes package created and configured
- [ ] SDK imports from nodes-basic
- [ ] All tests pass
- [ ] No TypeScript or lint errors

**Ready to proceed to Phase 2?**

---

### Phase 2: Extract Persistence SQLite (1.5 hours)

**Goal:** Move SQLite persistence to separate package.

#### Step 2.1: Create `@open-harness/persistence-sqlite` package
- Copy `sqlite-run-store.ts` to new package
- Copy `run-store.ts` interface (or keep in core as shared interface)
- Set up Bun-specific dependencies

#### Step 2.2: Create `@open-harness/persistence-testing` package
- Create `run-store-contract.ts` with contract tests
- Create sample data helpers
- Export contract testing utilities

#### Step 2.3: Update SDK
- Remove `sqlite-run-store.ts` from SDK exports
- Keep `run-store.ts` interface in core (shared contract)
- Keep `memory-run-store.ts` in core (web-compatible default)

#### Step 2.4: Update tests
- Move SQLite-specific tests to persistence-sqlite package
- Use contract tests from persistence-testing
- Keep memory store tests in SDK

#### Step 2.5: Run tests
- Verify SDK tests pass (memory store only)
- Verify persistence-sqlite contract tests pass
- Verify integration tests still work
- Run Turborepo commands: `bun run typecheck && bun run lint && bun run test`

**Checkpoint:** SQLite persistence extracted, core SDK is web-compatible for persistence layer.

---

**🛑 CHECK-IN POINT: Phase 2 Complete**

Please review:
- [ ] Persistence-sqlite package created
- [ ] Persistence-testing package created with contract tests
- [ ] SDK no longer exports sqlite-run-store
- [ ] All tests pass
- [ ] Contract tests validate RunStore interface

**Ready to proceed to Phase 3?**

---

### Phase 3: Extract WebSocket Transport (1 hour)

**Goal:** Move WebSocket transport to separate package.

#### Step 3.1: Create `@open-harness/transport-websocket` package
- Copy `websocket.ts` to new package
- Extract Transport interface (if not already separate)
- Set up Bun-specific dependencies

#### Step 3.2: Update SDK
- Remove `websocket.ts` from SDK exports
- Keep Transport interface in core (if it's a shared contract)

#### Step 3.3: Update tests
- Move WebSocket tests to transport-websocket package
- Update any SDK tests that use WebSocket transport

#### Step 3.4: Run tests
- Verify SDK tests pass
- Verify transport-websocket tests pass
- Run Turborepo commands: `bun run typecheck && bun run lint && bun run test`

**Checkpoint:** WebSocket transport extracted, core SDK has no transport dependencies.

---

**🛑 CHECK-IN POINT: Phase 3 Complete**

Please review:
- [ ] Transport-websocket package created
- [ ] SDK no longer exports websocket transport
- [ ] All tests pass
- [ ] Transport interface properly separated (if applicable)

**Ready to proceed to Phase 4?**

---

### Phase 4: Extract Anthropic Provider (2 hours)

**Goal:** Move Claude agent node to provider package.

#### Step 4.1: Create `@open-harness/provider-anthropic` package
- Copy `claude.agent.ts` to new package
- Copy `mock-query.ts` to provider package (testing utility)
- Move file system operations (they're provider-specific)

#### Step 4.2: Create `@open-harness/provider-testing` package
- Create `node-contract.ts` with contract tests
- Create helper utilities for testing nodes
- Export contract testing utilities

#### Step 4.3: Update SDK
- Remove `claude.agent.ts` from SDK exports
- Remove `@anthropic-ai/claude-agent-sdk` dependency
- Remove `mock-query.ts` from SDK exports

#### Step 4.4: Replace Node.js crypto in SDK core
- Update `src/runtime/runtime.ts`: `node:crypto` → `globalThis.crypto.randomUUID()`
- Verify web compatibility

#### Step 4.5: Update tests
- Move Claude-specific tests to provider-anthropic package
- Use contract tests from provider-testing
- Update SDK tests that used mock-query

#### Step 4.6: Run tests
- Verify SDK tests pass (no provider dependencies)
- Verify provider-anthropic contract tests pass
- Verify integration tests still work
- Run Turborepo commands: `bun run typecheck && bun run lint && bun run test`
- Verify SDK has no `node:crypto` imports (except in scripts/)

**Checkpoint:** Provider extracted, core SDK has no Node.js or provider dependencies.

---

**🛑 CHECK-IN POINT: Phase 4 Complete**

Please review:
- [ ] Provider-anthropic package created
- [ ] Provider-testing package created with contract tests
- [ ] SDK no longer exports claude.agent or mock-query
- [ ] SDK no longer has @anthropic-ai/claude-agent-sdk dependency
- [ ] SDK core uses globalThis.crypto (no node:crypto)
- [ ] All tests pass
- [ ] Core SDK is now web-compatible

**Ready to proceed to Phase 5?**

---

### Phase 5: Create SDK Testing Utilities (1.5 hours)

**Goal:** Export test utilities from SDK for use by other packages.

#### Step 5.1: Create SDK testing module
- Create `packages/sdk/src/testing/` directory structure:
  - `mocks/mock-runtime.ts`
  - `mocks/mock-nodes.ts` (if keeping basic nodes in core)
  - `mocks/test-flows.ts`
  - `contracts/runtime-contract.ts`
  - `index.ts` (exports)

#### Step 5.2: Extract existing test utilities
- Move mock runtime helpers to `testing/mocks/`
- Create contract tests for Runtime interface
- Create test flow helpers

#### Step 5.3: Update SDK exports
- Add `export * from "./testing/index.js"` to main index
- Create separate export path: `@open-harness/sdk/testing` (or use subpath exports)

#### Step 5.4: Update other packages to use SDK testing
- Update provider-testing to use SDK testing utilities
- Update persistence-testing to use SDK testing utilities
- Update ai-sdk tests to use SDK testing utilities

#### Step 5.5: Run tests
- Verify all packages can import SDK testing utilities
- Verify contract tests work correctly
- Run Turborepo commands: `bun run typecheck && bun run lint && bun run test`

**Checkpoint:** SDK exports test utilities, other packages use them.

---

**🛑 CHECK-IN POINT: Phase 5 Complete**

Please review:
- [ ] SDK testing module created and exported
- [ ] Mock runtime and test utilities available
- [ ] Contract tests for Runtime interface created
- [ ] Other packages can import from @open-harness/sdk/testing
- [ ] All tests pass

**Ready to proceed to Phase 6?**

---

### Phase 6: Update Consumers (1 hour)

**Goal:** Update packages that depend on SDK to work with new structure.

#### Step 6.1: Update `@open-harness/ai-sdk`
- Update imports to use new package structure
- Add dependencies on extracted packages if needed
- Update tests to use SDK testing utilities

#### Step 6.2: Update any apps that use SDK
- Check `apps/` directory for SDK usage
- Update imports as needed
- Verify apps still work

#### Step 6.3: Run full test suite
- Run all package tests
- Run integration tests
- Run app tests
- Run Turborepo commands: `bun run typecheck && bun run lint && bun run test`

**Checkpoint:** All consumers work with new package structure.

---

**🛑 CHECK-IN POINT: Phase 6 Complete**

Please review:
- [ ] ai-sdk package updated to use new structure
- [ ] All apps updated (if any)
- [ ] All imports resolve correctly
- [ ] Full test suite passes
- [ ] No breaking changes for consumers

**Ready to proceed to Phase 7?**

---

### Phase 7: Cleanup & Documentation (1 hour)

**Goal:** Final cleanup and documentation updates.

#### Step 7.1: Update README files
- Update SDK README (remove references to extracted code)
- Create READMEs for new packages
- Update root README if needed

#### Step 7.2: Update package.json descriptions
- Update package descriptions
- Ensure keywords are accurate
- Update repository URLs if needed

#### Step 7.3: Remove unused code
- Remove any leftover files
- Clean up unused imports
- Remove unused dependencies

#### Step 7.4: Final verification
- Run full test suite: `bun run test`
- Run type checking: `bun run typecheck`
- Run linter: `bun run lint`
- Verify builds work: `bun run build`
- Check all packages are registered with Turborepo

**Checkpoint:** Migration complete, all tests pass, documentation updated.

---

**🛑 CHECK-IN POINT: Phase 7 Complete - Migration Finished!**

Please review:
- [ ] All README files updated
- [ ] Package descriptions and keywords accurate
- [ ] No unused code or dependencies
- [ ] Full test suite passes
- [ ] All builds succeed
- [ ] Documentation is complete

**Migration is complete! Ready for final review and merge.**

---

## Risk Mitigation Strategies

### 1. Incremental Migration
- Each phase is independent and testable
- Can stop at any checkpoint and continue later
- Changes are isolated to specific packages

### 2. Backward Compatibility
- Keep interfaces in core where they're shared contracts
- Use re-exports during transition if needed
- Maintain API compatibility for consumers

### 3. Test Coverage
- Run full test suite after each phase
- Add contract tests before extraction
- Verify integration tests at each checkpoint

### 4. Dependency Management
- Use peer dependencies for SDK in extracted packages
- Use dev dependencies for testing packages
- Avoid circular dependencies

### 5. Rollback Plan
- Each phase can be reverted independently
- Git commits at each checkpoint
- Keep old code until migration is verified

## Package Structure After Migration

```
packages/
├── sdk/                          # Minimal core (web-compatible)
│   ├── src/
│   │   ├── core/                 # Types, events, state
│   │   ├── runtime/              # Runtime engine
│   │   ├── registry/             # Node registry
│   │   ├── persistence/
│   │   │   ├── run-store.ts      # Interface (shared)
│   │   │   └── memory-run-store.ts  # In-memory implementation
│   │   ├── testing/              # Test utilities (EXPORTED)
│   │   └── index.ts
│   └── tests/
│
├── provider-anthropic/           # Claude agent node
│   ├── src/
│   │   ├── claude.agent.ts
│   │   ├── testing/
│   │   └── index.ts
│   └── tests/
│
├── persistence-sqlite/          # SQLite store (Bun-only)
│   ├── src/
│   │   └── sqlite-run-store.ts
│   └── tests/
│
├── transport-websocket/         # WebSocket transport (Bun-only)
│   ├── src/
│   │   └── websocket.ts
│   └── tests/
│
├── nodes-basic/                  # Basic nodes (or keep in core)
│   ├── src/
│   │   ├── constant.ts
│   │   └── echo.ts
│   └── tests/
│
├── provider-testing/             # Shared provider test utilities
│   └── src/
│
└── persistence-testing/          # Shared persistence test utilities
    └── src/
```

## Dependencies After Migration

```
@open-harness/sdk
├── (no dependencies on providers/persistence/transport)
└── dependencies: jsonata, yaml, zod

@open-harness/provider-anthropic
├── peerDependencies: @open-harness/sdk
├── dependencies: @anthropic-ai/claude-agent-sdk
└── devDependencies: @open-harness/provider-testing

@open-harness/persistence-sqlite
├── peerDependencies: @open-harness/sdk
├── dependencies: bun:sqlite (or similar)
└── devDependencies: @open-harness/persistence-testing

@open-harness/transport-websocket
├── peerDependencies: @open-harness/sdk
└── dependencies: (Bun WebSocket APIs)

@open-harness/provider-testing
└── peerDependencies: @open-harness/sdk

@open-harness/persistence-testing
└── peerDependencies: @open-harness/sdk
```

## Time Estimate

- **Phase 0:** 30 minutes
- **Phase 1:** 1 hour
- **Phase 2:** 1.5 hours
- **Phase 3:** 1 hour
- **Phase 4:** 2 hours
- **Phase 5:** 1.5 hours
- **Phase 6:** 1 hour
- **Phase 7:** 1 hour

**Total:** ~9.5 hours (can be done incrementally over multiple sessions)

## Success Criteria

1. ✅ Core SDK has no Node.js-specific imports (except in scripts/)
2. ✅ Core SDK has no provider/persistence/transport dependencies
3. ✅ All extracted packages have their own tests
4. ✅ Contract tests ensure interface compliance
5. ✅ All existing tests pass
6. ✅ All consumers (ai-sdk, apps) work with new structure
7. ✅ Documentation is updated
8. ✅ Builds succeed for all packages

## Next Steps

1. Review this plan with the team
2. Create a feature branch from `dev`: `feat/monorepo-modularization`
3. Start with Phase 0 (preparation)
4. Execute phases incrementally, committing at each checkpoint
5. Open PR to `dev` when complete
