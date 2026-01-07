# Agent Kickoff: SDK v0.2.0 Phase 1 - Package Restructure

**Agent Context:** You are starting implementation of Open Harness SDK v0.2.0

**Your Mission:** Complete Phase 1: Package Restructure (4-5 hours estimated)

---

## Read Before Starting

1. **Review Implementation Plan:**
   - File: `SDK_IMPLEMENTATION_PLAN.md`
   - Focus on: Phase 1 section (lines 35-100)
   - Understand objective and all tasks

2. **Review Build Manifest:**
   - File: `BUILD_MANIFESTS.md`
   - Focus on: Phase 1 section
   - Understand done criteria and verification commands
   - Review global done criteria (top of file)

---

## Your Objective

Reorganize existing code into new folder structure (`src/server/`, `src/client/`) without breaking any functionality or tests.

**Current State:**
- Packages exist in `packages/` workspace
- `transport-websocket` - WebSocket server (Bun.serve)
- `transport/ai-sdk` - Local AI Kit transport
- `provider-anthropic` - Anthropic provider
- `persistence/sqlite` - SQLite run store
- All packages have their own package.json, tests, etc.

**Target State:**
- Single package `@open-harness/sdk`
- `src/core/` - Core runtime (no changes)
- `src/server/` - All server-specific code
- `src/client/` - All client-specific code (empty for now)
- Old package folders deleted after verification

---

## Tasks to Complete

### 1. Create Folder Structure
```bash
mkdir -p src/server/{transports,providers,api-routes,middleware,persistence}
mkdir -p src/client/{transports,ai-sdk,react}
mkdir -p tests/server/
mkdir -p tests/client/
```

**Verification:**
```bash
ls -la src/server/  # Must have: transports/, providers/, persistence/, api-routes/, middleware/
ls -la src/client/  # Must have: transports/, ai-sdk/, react/
ls -la tests/server/  # Must exist
ls -la tests/client/  # Must exist
```

### 2. Move WebSocket Transport
```bash
mv packages/transport/websocket/src/* src/server/transports/
mv packages/transport/websocket/tsconfig.json src/server/transports/
mv packages/transport/websocket/biome.jsonc src/server/transports/
```

**Files to move:**
- `websocket-server.ts` (or `websocket.ts`)
- `tsconfig.json`
- `biome.jsonc`
- Any test files (move to `tests/server/`)

### 3. Move AI SDK Local Transport
```bash
mv packages/transport/ai-sdk/src/* src/server/transports/
mv packages/transport/ai-sdk/tests/* tests/server/
mv packages/transport/ai-sdk/tsconfig.json src/server/transports/
mv packages/transport/ai-sdk/biome.jsonc src/server/transports/
```

**CRITICAL:** Rename `transport.ts` → `ai-sdk-local-transport.ts`

**Files to move:**
- All `.ts` files from `src/`
- All test files to `tests/server/`
- Config files

### 4. Move Anthropic Provider
```bash
mv packages/providers/anthropic/src/* src/server/providers/
mv packages/providers/anthropic/tests/* tests/server/
mv packages/providers/anthropic/tsconfig.json src/server/providers/
mv packages/providers/anthropic/biome.jsonc src/server/providers/
```

**Files to move:**
- `claude.agent.ts`
- `mock-query.ts` (and `testing/` folder)
- Test files
- Config files

### 5. Move SQLite Persistence
```bash
mv packages/persistence/sqlite/src/* src/server/persistence/
mv packages/persistence/sqlite/tests/* tests/server/
mv packages/persistence/sqlite/tsconfig.json src/server/persistence/
mv packages/persistence/sqlite/biome.jsonc src/server/persistence/
```

**Files to move:**
- `sqlite-run-store.ts`
- Test files
- Config files

### 6. Update All Imports

**In each moved file:**

**BEFORE:**
```typescript
import type { Runtime } from "@open-harness/sdk";
import type { RuntimeEvent } from "@open-harness/sdk/core/events";
```

**AFTER:**
```typescript
import type { Runtime } from "../../core/runtime/runtime";
import type { RuntimeEvent } from "../../core/events/events";
```

**Pattern:**
- `@open-harness/sdk` → `../../core/`
- `@open-harness/sdk/core/types` → `../../core/types/`
- `@open-harness/sdk/runtime` → `../../core/runtime/`
- `@open-harness/sdk/events` → `../../core/events/`

**Check for any workspace imports:**
```bash
rg "workspace:" src/server/
# Expected: No results after updates
```

### 7. Update Package References

**In moved files:**

Remove any references to old package names:
- `@open-harness/transport-websocket`
- `@open-harness/provider-anthropic`
- `@open-harness/persistence-sqlite`
- `@open-harness/transport/ai-sdk`

Check for any other package.json dependencies in imports.

### 8. Create Server Index File

**File:** `src/server/index.ts`

```typescript
// Transports
export { WebSocketServerTransport } from "./transports/websocket-server.js";
export { LocalAIKitTransport } from "./transports/ai-sdk-local-transport.js";

// Providers
export { createAnthropicProvider } from "./providers/anthropic-provider.js";

// Persistence
export { SQLiteRunStore } from "./persistence/sqlite-store.js";
```

**Verification:**
```bash
bun run typecheck src/server/index.ts
# Expected: Exit code 0
```

### 9. Update Root package.json

**Changes needed:**

**Remove from `workspaces`:**
- `packages/transport-websocket`
- `packages/transport/ai-sdk`
- `packages/providers/anthropic`
- `packages/persistence/sqlite`

**Remove from `devDependencies`:**
- Any references to old package names

**Add to `scripts` (if not present):**
```json
{
  "scripts": {
    "build:server": "bun build src/server/index.ts --outdir dist/server --format esm --target=bun",
    "test:server": "bun test tests/server/"
  }
}
```

### 10. Create Gitkeep Files

```bash
# For empty folders
touch src/client/transports/.gitkeep
touch src/client/ai-sdk/.gitkeep
touch src/client/react/.gitkeep
touch tests/server/.gitkeep
touch tests/client/.gitkeep
```

### 11. Verify All Tests Pass

```bash
# Run all existing tests
bun run test

# Expected: Exit code 0, all tests pass
# Expected: Zero regressions from package restructure
```

### 12. Clean Up Old Package Folders

**ONLY AFTER all verification passes:**

```bash
# Delete old package folders
rm -rf packages/transport/websocket
rm -rf packages/transport/ai-sdk
rm -rf packages/providers/anthropic
rm -rf packages/persistence/sqlite
```

**WAIT:** Do NOT delete until:
- All imports updated
- All tests pass
- TypeScript compiles
- Linting passes

---

## Phase 1 Done Criteria

A phase is **COMPLETE** when ALL criteria are met:

### 1.1 Folder Structure Created
```bash
ls -la src/server/
# Output must include: transports/, providers/, persistence/, api-routes/, middleware/, index.ts

ls -la src/client/
# Output must include: transports/, ai-sdk/, react/, index.ts

ls -la tests/server/
# Output must exist

ls -la tests/client/
# Output must exist
```

### 1.2 Files Moved Correctly
```bash
# All moved files exist in new locations
test -f src/server/transports/websocket-server.ts
test -f src/server/transports/ai-sdk-local-transport.ts
test -f src/server/providers/anthropic-provider.ts
test -f src/server/persistence/sqlite-store.ts
test -f src/server/index.ts
```

### 1.3 Imports Updated
```bash
# No workspace imports
rg "workspace:" src/server/
# Expected: No results

# No broken imports
bun run typecheck
# Expected: Exit code 0
```

### 1.4 TypeScript Compiles
```bash
bun run typecheck
# Expected: Exit code 0, no errors
```

### 1.5 No Linting Errors
```bash
bun run lint
# Expected: Exit code 0, no warnings or errors
```

### 1.6 No Test Regressions
```bash
bun run test
# Expected: All existing tests pass (same count or more)
```

### 1.7 Documentation Updated
```bash
# No references to old package names
rg "@open-harness/transport-websocket" src/
# Expected: No results

rg "@open-harness/provider-anthropic" src/
# Expected: No results

rg "@open-harness/persistence-sqlite" src/
# Expected: No results
```

---

## Global Done Criteria

In addition to phase-specific criteria, ensure:

1. ✅ **TypeScript:** Zero compilation errors
   ```bash
   bun run typecheck
   ```

2. ✅ **Linting:** Zero warnings or errors
   ```bash
   bun run lint
   ```

3. ✅ **Tests:** All pass (no regressions)
   ```bash
   bun run test
   ```

---

## Blocking Conditions

**STOP if ANY:**
- ❌ TypeScript errors
- ❌ Linting errors
- ❌ Test failures
- ❌ Broken imports that can't be fixed

**ASK FOR HELP if:**
- Unclear about import paths
- Confused about workspace configuration
- Tests fail in unexpected ways

---

## Before You Commit

**Checklist:**
- [ ] All tasks 1-12 complete
- [ ] All phase-specific criteria 1.1-1.7 met
- [ ] All global done criteria 1-3 met
- [ ] Old package folders deleted
- [ ] README.md updated to reflect new structure (if needed)

**Commit message:**
```
feat: phase 1 - package restructure

- Create src/server/ and src/client/ folder structure
- Move WebSocket transport to server/transports/
- Move AI SDK local transport to server/transports/ (rename)
- Move Anthropic provider to server/providers/
- Move SQLite persistence to server/persistence/
- Update all imports from workspace to local paths
- Create server/index.ts exports
- Update package.json workspaces and scripts
- All tests pass, no regressions

Phase 1/7 complete
```

---

## After Phase 1

**You're done when:**
- ✅ All code moved and imports updated
- ✅ All tests pass
- ✅ Ready to proceed to Phase 2 (Hono API Routes)

**Next phase will be:** Phase 2: Hono API Routes (8-10 hours)

---

**Good luck! Remember:**
- Verify each step before moving to next
- Run tests frequently to catch issues early
- Use the build manifest as your checklist
- Don't skip the done criteria!

**Reference docs:**
- `SDK_IMPLEMENTATION_PLAN.md` - Full plan
- `BUILD_MANIFESTS.md` - Build manifests with verification commands
