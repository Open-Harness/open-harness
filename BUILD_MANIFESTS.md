# Build Manifests - Open Harness SDK v0.2.0

**Purpose:** Track implementation progress with clear "done" criteria for each phase
**Status:** Planning Complete → Implementation Ready
**Created:** 2025-01-06

---

## Global Done Criteria (Apply to ALL Phases)

### Definition of "Done"
A phase is **COMPLETE** only when **ALL** criteria are met:

1. ✅ **TypeScript:** Zero TypeScript compilation errors
   ```bash
   bun run typecheck
   # Must exit with code 0
   ```

2. ✅ **Linting:** Zero linting warnings or errors
   ```bash
   bun run lint
   # Must exit with code 0 with no warnings
   ```

3. ✅ **Tests:** All existing tests pass (no regressions)
   ```bash
   bun run test
   # Must exit with code 0
   ```

4. ✅ **New Tests:** All new tests for phase pass
   ```bash
   bun test tests/<phase>/  # Specific to phase
   # Must exit with code 0
   ```

5. ✅ **Build:** Build produces expected outputs
   ```bash
   bun run build:core
   bun run build:server
   bun run build:client
   # Must produce dist/ files
   ```

6. ✅ **Imports:** All imports resolve correctly
   - No "Module not found" errors
   - No circular dependency warnings
   - All workspace imports correct

7. ✅ **Documentation:** README and doc blocks updated
   - No outdated references
   - New APIs documented
   - Examples updated

### Blocking Conditions
**Phase CANNOT be marked complete if ANY:**
- ❌ TypeScript errors (even non-critical)
- ❌ Linting warnings or errors
- ❌ Test failures (even flaky tests)
- ❌ Build failures
- ❌ Missing documentation
- ❌ Broken imports

---

## Phase 1: Package Restructure (4-5 hours)

### Objective
Reorganize existing code into new folder structure without breaking functionality.

### Tasks
- [ ] Create folder structure: `src/server/`, `src/client/`, `tests/server/`, `tests/client/`
- [ ] Move `packages/transport/websocket/src/*` → `src/server/transports/`
- [ ] Move `packages/transport/ai-sdk/src/*` → `src/server/transports/` (rename to `ai-sdk-local-transport.ts`)
- [ ] Move `packages/providers/anthropic/src/*` → `src/server/providers/`
- [ ] Move `packages/persistence/sqlite/src/*` → `src/server/persistence/`
- [ ] Update all imports in moved files (workspace → local)
- [ ] Update package references in moved files
- [ ] Create `src/server/index.ts` with exports
- [ ] Remove old package dependencies from root `package.json`
- [ ] Update root `package.json` workspace configuration
- [ ] Delete old package folders after verification

### File Changes
```
CREATE:
  src/server/transports/websocket-server.ts      (moved)
  src/server/transports/ai-sdk-local-transport.ts (moved + renamed)
  src/server/providers/anthropic-provider.ts (moved)
  src/server/persistence/sqlite-store.ts (moved)
  src/server/index.ts                        (new)
  tests/server/.gitkeep                       (new)
  tests/client/.gitkeep                       (new)

DELETE:
  packages/transport/websocket/               (after verification)
  packages/transport/ai-sdk/               (after verification)
  packages/providers/anthropic/             (after verification)
  packages/persistence/sqlite/               (after verification)

MODIFY:
  src/server/transports/*.ts                   (imports)
  src/server/providers/*.ts                   (imports)
  src/server/persistence/*.ts                  (imports)
  package.json                               (workspaces, deps)
```

### Phase-Specific Done Criteria

#### 1.1 Folder Structure Created
**Verification:**
```bash
ls -la src/server/
# Output must include: transports/, providers/, persistence/, index.ts

ls -la src/client/
# Output must include: (empty - will be populated in later phases)

ls -la tests/server/
# Output must include: .gitkeep

ls -la tests/client/
# Output must include: .gitkeep
```

#### 1.2 Files Moved Correctly
**Verification:**
```bash
# All moved files exist in new locations
test -f src/server/transports/websocket-server.ts
test -f src/server/transports/ai-sdk-local-transport.ts
test -f src/server/providers/anthropic-provider.ts
test -f src/server/persistence/sqlite-store.ts
test -f src/server/index.ts
```

#### 1.3 Imports Updated
**Verification:**
```bash
# No workspace imports
rg "workspace:" src/server/
# Expected: No results

# No broken imports
bun run typecheck
# Expected: Exit code 0
```

#### 1.4 TypeScript Compiles
**Verification:**
```bash
bun run typecheck
# Expected: Exit code 0, no errors
```

#### 1.5 No Linting Errors
**Verification:**
```bash
bun run lint
# Expected: Exit code 0, no warnings or errors
```

#### 1.6 No Test Regressions
**Verification:**
```bash
bun run test
# Expected: All existing tests pass
```

#### 1.7 Documentation Updated
**Verification:**
```bash
# No references to old package names
rg "@open-harness/transport-websocket" src/
# Expected: No results

rg "@open-harness/provider-anthropic" src/
# Expected: No results

rg "@open-harness/persistence-sqlite" src/
# Expected: No results
```

### Done Checklist
- [ ] All tasks complete
- [ ] All phase-specific criteria met
- [ ] All global done criteria met
- [ ] Ready to proceed to Phase 2

---

## Phase 2: Hono API Routes (8-10 hours)

### Objective
Build HTTP + SSE API for remote clients using Hono framework.

### Tasks
- [ ] Add Hono dependencies to `package.json`
- [ ] Add `uuid` dependency for run ID generation
- [ ] Create `src/server/api-routes/chat.ts` (~80 lines)
  - [ ] Implement POST `/api/chat` endpoint
  - [ ] Extract last user message from UIMessage[]
  - [ ] Generate unique run ID using UUID v4
  - [ ] Dispatch command to runtime
  - [ ] Return run ID for SSE subscription
  - [ ] Validate input
  - [ ] Error handling
- [ ] Create `src/server/api-routes/events.ts` (~60 lines)
  - [ ] Implement GET `/api/events/:runId` endpoint
  - [ ] Setup SSE streaming with `streamSSE` from Hono
  - [ ] Subscribe to runtime events
  - [ ] Filter events by runId
  - [ ] Transform events to UI parts
  - [ ] Implement 30-minute inactivity timeout
  - [ ] Close SSE on terminal events (flow:complete, flow:aborted, flow:paused)
  - [ ] Handle client disconnect
  - [ ] Cleanup subscriptions
- [ ] Create `src/server/api-routes/commands.ts` (~40 lines)
  - [ ] Implement POST `/api/commands` endpoint
  - [ ] Validate command structure
  - [ ] Dispatch to runtime
  - [ ] Return 202 Accepted
- [ ] Create `src/server/api-routes/health.ts` (~20 lines)
  - [ ] Implement GET `/health` endpoint
  - [ ] Return status and timestamp
- [ ] Create `src/server/middleware/cors.ts` (~15 lines)
  - [ ] Export CORS middleware from @hono/cors
  - [ ] Default to opt-in (no origin configured)
  - [ ] Document usage pattern
- [ ] Create `src/server/middleware/error-handler.ts` (~30 lines)
  - [ ] Implement error handling middleware
  - [ ] Log errors for development
  - [ ] Emit SSE error if connection exists
  - [ ] Return JSON error responses
- [ ] Create `src/server/api-routes/index.ts` (~30 lines)
  - [ ] Aggregate all route handlers
  - [ ] Export as `createAPIRoutes(runtime)`
- [ ] Update `src/server/index.ts` to export API routes
- [ ] Write unit tests for `chat.ts`
  - [ ] Mock runtime
  - [ ] Test happy path
  - [ ] Test validation errors
  - [ ] Test run ID generation
- [ ] Write unit tests for `events.ts`
  - [ ] Mock runtime and streamSSE
  - [ ] Test SSE streaming
  - [ ] Test event filtering by runId
  - [ ] Test timeout handling
  - [ ] Test cleanup
- [ ] Write unit tests for `commands.ts`
  - [ ] Mock runtime
  - [ ] Test command dispatching
  - [ ] Test validation
- [ ] Write unit tests for `health.ts`
- [ ] Write unit tests for middleware
- [ ] Write integration test:
  - [ ] Start server with test runtime
  - [ ] POST to `/api/chat`
  - [ ] Subscribe to `/api/events/:runId`
  - [ ] Verify events stream back
  - [ ] Verify cleanup on complete

### File Changes
```
CREATE:
  src/server/api-routes/chat.ts              (~80 lines)
  src/server/api-routes/events.ts            (~60 lines)
  src/server/api-routes/commands.ts          (~40 lines)
  src/server/api-routes/health.ts            (~20 lines)
  src/server/api-routes/index.ts             (~30 lines)
  src/server/middleware/cors.ts               (~15 lines)
  src/server/middleware/error-handler.ts      (~30 lines)
  tests/server/api-routes.test.ts            (~200 lines)
  tests/server/middleware.test.ts            (~100 lines)
  tests/server/integration.test.ts            (~150 lines)

MODIFY:
  src/server/index.ts                         (add API routes export)
  package.json                                (add hono, uuid deps)

ADD TO GITHUB:
  .github/workflows/test-api.yml               (optional, for API testing)
```

### Phase-Specific Done Criteria

#### 2.1 Dependencies Added
**Verification:**
```bash
cat package.json | grep "hono"
# Expected: "hono": "^4.x"

cat package.json | grep "uuid"
# Expected: "uuid": "^10.x"

bun install
# Expected: No errors
```

#### 2.2 API Routes Compile
**Verification:**
```bash
bun test tests/server/api-routes.test.ts
# Expected: All tests pass

bun test tests/server/middleware.test.ts
# Expected: All tests pass
```

#### 2.3 TypeScript Compiles
**Verification:**
```bash
bun run typecheck
# Expected: Exit code 0
# Focus on src/server/api-routes/ and src/server/middleware/
```

#### 2.4 No Linting Errors
**Verification:**
```bash
bun run lint
# Expected: Exit code 0
```

#### 2.5 Integration Test Passes
**Verification:**
```bash
bun test tests/server/integration.test.ts
# Expected: Full flow from POST to SSE streaming works
```

#### 2.6 API Documentation
**Verification:**
```bash
# All routes have JSDoc
rg "@param\|@returns\|@throws" src/server/api-routes/
# Expected: Results for all exported functions

# All middleware has JSDoc
rg "@param\|@returns" src/server/middleware/
# Expected: Results for all exported functions
```

### Done Checklist
- [ ] All tasks complete
- [ ] All phase-specific criteria met
- [ ] All global done criteria met
- [ ] Ready to proceed to Phase 3

---

## Phase 3: Remote AI Kit Transport (6-8 hours)

### Objective
Build `RemoteAIKitTransport` for remote clients using HTTP + SSE.

### Tasks
- [ ] Create `src/client/ai-sdk/remote-transport.ts` (~180 lines)
  - [ ] Implement `RemoteAIKitTransportOptions` interface
  - [ ] Implement `RemoteAIKitTransport` class
  - [ ] Implement `sendMessages()` method (ChatTransport interface)
  - [ ] POST to `/api/chat` with messages
  - [ ] Parse response to get runId
  - [ ] Create EventSource connection to `/api/events/:runId`
  - [ ] Transform SSE events to `UIMessageChunk`
  - [ ] Handle connection failures
  - [ ] Implement abort signal support
  - [ ] Validate UI parts before enqueuing
  - [ ] Handle stream closure gracefully
  - [ ] Close on terminal events (text-end, data-end)
- [ ] Create `src/client/ai-sdk/index.ts` (~10 lines)
  - [ ] Export `RemoteAIKitTransport`
  - [ ] Export types
- [ ] Write unit tests:
  - [ ] Mock `fetch` for POST requests
  - [ ] Mock `EventSource` for SSE
  - [ ] Test happy path (POST → SSE stream)
  - [ ] Test connection failures
  - [ ] Test timeout handling
  - [ ] Test abort signal handling
  - [ ] Test invalid chunks (should be skipped)
  - [ ] Test stream closure
- [ ] Write integration test:
  - [ ] Use real Hono server from Phase 2
  - [ ] Create RemoteAIKitTransport
  - [ ] Call `sendMessages()`
  - [ ] Verify SSE receives events
  - [ ] Verify cleanup
- [ ] Update `src/client/index.ts` to export remote transport

### File Changes
```
CREATE:
  src/client/ai-sdk/remote-transport.ts        (~180 lines)
  src/client/ai-sdk/index.ts                  (~10 lines)
  tests/client/remote-transport.test.ts        (~250 lines)
  tests/client/integration.test.ts               (~100 lines)

MODIFY:
  src/client/index.ts                             (add remote transport export)
```

### Phase-Specific Done Criteria

#### 3.1 Transport Implements ChatTransport
**Verification:**
```bash
# Class has required methods
rg "sendMessages\(" src/client/ai-sdk/remote-transport.ts
# Expected: Exactly 1 result (method definition)

# Class implements interface
rg "implements ChatTransport" src/client/ai-sdk/remote-transport.ts
# Expected: 1 result
```

#### 3.2 TypeScript Compiles
**Verification:**
```bash
bun run typecheck
# Expected: Exit code 0
# Focus on src/client/ai-sdk/
```

#### 3.3 Unit Tests Pass
**Verification:**
```bash
bun test tests/client/remote-transport.test.ts
# Expected: All tests pass
```

#### 3.4 Integration Test Passes
**Verification:**
```bash
bun test tests/client/integration.test.ts
# Expected: Full HTTP + SSE flow works
```

#### 3.5 No Linting Errors
**Verification:**
```bash
bun run lint src/client/ai-sdk/
# Expected: Exit code 0
```

#### 3.6 Exports Correct
**Verification:**
```bash
# Exported from index
rg "RemoteAIKitTransport" src/client/index.ts
# Expected: 1 result (export statement)

# Types exported
rg "export.*Options\|export.*interface" src/client/ai-sdk/index.ts
# Expected: Options and types exported
```

### Done Checklist
- [ ] All tasks complete
- [ ] All phase-specific criteria met
- [ ] All global done criteria met
- [ ] Ready to proceed to Phase 4

---

## Phase 4: HTTP + SSE Client (4-6 hours)

### Objective
Build reusable HTTP + SSE client for low-level access.

### Tasks
- [ ] Create `src/client/transports/http-sse-client.ts` (~200 lines)
  - [ ] Implement `HTTPSSEClientOptions` interface
  - [ ] Implement `HTTPSSEClient` class
  - [ ] Implement `connect(runId, onEvent)` method
  - [ ] Create EventSource connection to `/api/events/:runId`
  - [ ] Parse SSE events and call `onEvent`
  - [ ] Handle connection errors
  - [ ] Implement reconnection logic with exponential backoff
  - [ ] Implement `sendCommand(command)` method
  - [ ] POST to `/api/commands`
  - [ ] Implement `startChat(messages)` method
  - [ ] POST to `/api/chat` and return runId
  - [ ] Implement `disconnect()` method
  - [ ] Close EventSource and cleanup timers
  - [ ] Add `reconnectDelay` and `maxReconnectAttempts` options
  - [ ] Add timeout option
- [ ] Write unit tests:
  - [ ] Mock `fetch` and `EventSource`
  - [ ] Test connection lifecycle
  - [ ] Test event reception
  - [ ] Test reconnection logic
  - [ ] Test timeout handling
  - [ ] Test `sendCommand()` method
  - [ ] Test `startChat()` method
  - [ ] Test `disconnect()` method
- [ ] Create `src/client/transports/index.ts` (~5 lines)
- [ ] Update `src/client/index.ts` to export HTTP client

### File Changes
```
CREATE:
  src/client/transports/http-sse-client.ts          (~200 lines)
  src/client/transports/index.ts                   (~5 lines)
  tests/client/http-sse-client.test.ts            (~200 lines)

MODIFY:
  src/client/index.ts                                  (add HTTP client export)
```

### Phase-Specific Done Criteria

#### 4.1 Client Has All Methods
**Verification:**
```bash
# Required methods exist
rg "connect\(|sendCommand\(|startChat\(|disconnect\(" src/client/transports/http-sse-client.ts
# Expected: 4 results
```

#### 4.2 TypeScript Compiles
**Verification:**
```bash
bun run typecheck
# Expected: Exit code 0
# Focus on src/client/transports/
```

#### 4.3 Unit Tests Pass
**Verification:**
```bash
bun test tests/client/http-sse-client.test.ts
# Expected: All tests pass
```

#### 4.4 No Linting Errors
**Verification:**
```bash
bun run lint src/client/transports/
# Expected: Exit code 0
```

#### 4.5 Reconnection Logic Tested
**Verification:**
```bash
# Exponential backoff implemented
rg "Math.pow\(2" src/client/transports/http-sse-client.ts
# Expected: 1 result

# Max reconnection attempts
rg "maxReconnectAttempts" src/client/transports/http-sse-client.ts
# Expected: 1 result
```

#### 4.6 Exported from Client Index
**Verification:**
```bash
rg "HTTPSSEClient" src/client/index.ts
# Expected: 1 result (export statement)
```

### Done Checklist
- [ ] All tasks complete
- [ ] All phase-specific criteria met
- [ ] All global done criteria met
- [ ] Ready to proceed to Phase 5

---

## Phase 5: React Hooks (3-4 hours)

### Objective
Build `useHarness()` and `useRuntime()` hooks for React apps.

### Tasks
- [ ] Create `src/client/react/use-harness.ts` (~70 lines)
  - [ ] Implement `UseHarnessOptions` interface
  - [ ] Implement `UseHarnessReturn` interface
  - [ ] Implement `useHarness()` hook
  - [ ] State: events, status, isConnected, error
  - [ ] Auto-connect to server if `autoConnect` (default: true)
  - [ ] Monitor events for status updates
  - [ ] Update status based on flow events
  - [ ] Return sendMessage and sendCommand methods
  - [ ] Cleanup on unmount
  - [ ] Handle connection errors
- [ ] Create `src/client/react/use-runtime.ts` (~40 lines)
  - [ ] Implement `UseRuntimeReturn` interface
  - [ ] Implement `useRuntime(runtime)` hook
  - [ ] State: events array
  - [ ] Subscribe to runtime events via `runtime.onEvent()`
  - [ ] Return dispatch, run, events
  - [ ] Cleanup on unmount
- [ ] Create `src/client/react/index.ts` (~10 lines)
  - [ ] Export `useHarness`
  - [ ] Export `useRuntime`
  - [ ] Export types
- [ ] Add `react` and `react-dom` as peer dependencies
- [ ] Write tests:
  - [ ] Test `useHarness()` hook lifecycle
  - [ ] Test event subscription
  - [ ] Test status updates
  - [ ] Test cleanup
  - [ ] Test `useRuntime()` hook
  - [ ] Test runtime event subscription
  - [ ] Test all cleanup scenarios
- [ ] Update `src/client/index.ts` to export React hooks

### File Changes
```
CREATE:
  src/client/react/use-harness.ts               (~70 lines)
  src/client/react/use-runtime.ts               (~40 lines)
  src/client/react/index.ts                     (~10 lines)
  tests/client/react-hooks.test.ts              (~150 lines)

MODIFY:
  src/client/index.ts                               (add React hooks export)
  package.json                                     (add react peer deps)
```

### Phase-Specific Done Criteria

#### 5.1 useHarness Hook Works
**Verification:**
```bash
# Hook has correct state
rg "useState.*events\|useState.*status\|useState.*isConnected" src/client/react/use-harness.ts
# Expected: 3 results

# Hook returns correct API
rg "return.*{\|events:,\|status:,\|sendMessage:,\|sendCommand:,\|isConnected:" src/client/react/use-harness.ts
# Expected: Returns all required properties
```

#### 5.2 useRuntime Hook Works
**Verification:**
```bash
# Hook accepts runtime
rg "useRuntime\(" src/client/react/use-runtime.ts
# Expected: 1 result

# Hook returns runtime methods
rg "return.*{\|dispatch:,\|run:,\|events:" src/client/react/use-runtime.ts
# Expected: Returns all required properties
```

#### 5.3 TypeScript Compiles
**Verification:**
```bash
bun run typecheck
# Expected: Exit code 0
# Focus on src/client/react/
```

#### 5.4 Tests Pass
**Verification:**
```bash
bun test tests/client/react-hooks.test.ts
# Expected: All tests pass
```

#### 5.5 No Linting Errors
**Verification:**
```bash
bun run lint src/client/react/
# Expected: Exit code 0
```

#### 5.6 React Peer Dependency Added
**Verification:**
```bash
cat package.json | grep -A 3 "peerDependencies"
# Expected: Contains "react": "^18.0.0"
```

#### 5.7 Exported from Client Index
**Verification:**
```bash
rg "from './react'" src/client/index.ts
# Expected: 1 result (re-export)
```

### Done Checklist
- [ ] All tasks complete
- [ ] All phase-specific criteria met
- [ ] All global done criteria met
- [ ] Ready to proceed to Phase 6

---

## Phase 6: Build System & Exports (3-4 hours)

### Objective
Configure multi-entry point builds and conditional exports.

### Tasks
- [ ] Update `package.json` with conditional exports:
  - [ ] Add `exports` field with `.` (core)
  - [ ] Add `./server` export
  - [ ] Add `./client` export
  - [ ] Add `./react` export
  - [ ] Add `browser` field (block server exports in browser)
  - [ ] Add `edge-runtime` field (block server exports in edge)
- [ ] Update `scripts` in `package.json`:
  - [ ] Update `build` to run all builds
  - [ ] Add `build:core` script
  - [ ] Add `build:server` script
  - [ ] Add `build:client` script
  - [ ] Keep `build:types` script
  - [ ] Add `test:server` script
  - [ ] Add `test:client` script
- [ ] Update `dependencies` in `package.json`:
  - [ ] Add `hono`: ^4.0.0
  - [ ] Add `@hono/cors`: ^1.0.0
  - [ ] Add `@hono/streaming`: ^1.0.0
  - [ ] Add `uuid`: ^10.0.0
  - [ ] Ensure `ai` is NOT a direct dependency (peer dep)
- [ ] Add `peerDependencies` in `package.json`:
  - [ ] Add `react`: ^18.0.0
  - [ ] Keep `typescript`: ^5
- [ ] Update `tsconfig.build.json`:
  - [ ] Add `src/server/**/*` to include
  - [ ] Add `src/client/**/*` to include
  - [ ] Add `src/client/react/**/*` to include
  - [ ] Verify `outDir` is `./dist`
- [ ] Test core build:
  - [ ] Run `bun run build:core`
  - [ ] Verify `dist/index.js` exists
  - [ ] Verify `dist/index.d.ts` exists
- [ ] Test server build:
  - [ ] Run `bun run build:server`
  - [ ] Verify `dist/server/index.js` exists
  - [ ] Verify `dist/server/index.d.ts` exists
- [ ] Test client build:
  - [ ] Run `bun run build:client`
  - [ ] Verify `dist/client/index.js` exists
  - [ ] Verify `dist/client/index.d.ts` exists
- [ ] Test react build:
  - [ ] Verify `dist/client/react/index.js` exists
  - [ ] Verify `dist/client/react/index.d.ts` exists
- [ ] Test all exports:
  - [ ] Create test file importing from `@open-harness/sdk`
  - [ ] Create test file importing from `@open-harness/sdk/server`
  - [ ] Create test file importing from `@open-harness/sdk/client`
  - [ ] Create test file importing from `@open-harness/sdk/react`
  - [ ] Run all test files
  - [ ] Verify all imports work

### File Changes
```
MODIFY:
  package.json                                     (exports, scripts, deps, peerDeps)
  tsconfig.build.json                              (include paths, outDir)
  src/server/index.ts                               (verify exports)
  src/client/index.ts                               (verify exports)
  src/index.ts                                     (verify core exports)

CREATE:
  tests/build/exports.test.ts                     (~100 lines)
  .github/workflows/build.yml                      (optional, for CI)
```

### Phase-Specific Done Criteria

#### 6.1 Package.json Exports Correct
**Verification:**
```bash
cat package.json | rg -A 20 '"exports"'
# Expected: All 4 exports defined (core, server, client, react)

cat package.json | rg -A 5 '"browser"'
# Expected: Server blocked in browser

cat package.json | rg -A 5 '"edge-runtime"'
# Expected: Server blocked in edge
```

#### 6.2 Build Scripts Work
**Verification:**
```bash
bun run build:core
test -f dist/index.js && test -f dist/index.d.ts
# Expected: Both exist

bun run build:server
test -f dist/server/index.js && test -f dist/server/index.d.ts
# Expected: Both exist

bun run build:client
test -f dist/client/index.js && test -f dist/client/index.d.ts
# Expected: Both exist
```

#### 6.3 TypeScript Build Works
**Verification:**
```bash
bun run build:types
# Expected: All .d.ts files generated without errors
```

#### 6.4 All Imports Work
**Verification:**
```bash
bun test tests/build/exports.test.ts
# Expected: All imports resolve, no errors
```

#### 6.5 No Linting Errors
**Verification:**
```bash
bun run lint
# Expected: Exit code 0
```

#### 6.6 Peer Dependencies Correct
**Verification:**
```bash
cat package.json | rg -A 5 '"peerDependencies"'
# Expected: react and typescript listed
```

### Done Checklist
- [ ] All tasks complete
- [ ] All phase-specific criteria met
- [ ] All global done criteria met
- [ ] Ready to proceed to Phase 7

---

## Phase 7: Documentation & Migration (2-3 hours)

### Objective
Update all documentation for new architecture.

### Tasks
- [ ] Update `README.md`:
  - [ ] Add browser/edge runtime quick start section
  - [ ] Add server quick start section
  - [ ] Add local development quick start section
  - [ ] Add platform compatibility table
  - [ ] Add architecture diagram (HTTP + SSE)
  - [ ] Remove old package references
  - [ ] Update installation instructions
  - [ ] Update examples
  - [ ] Link to new documentation
- [ ] Create `MIGRATION.md`:
  - [ ] Document breaking changes from v0.1.0
  - [ ] Document package name changes
  - [ ] Document import path changes
  - [ ] Document new features
  - [ ] Provide migration examples
  - [ ] Document deprecations
- [ ] Create `docs/guides/browser.md`:
  - [ ] Browser setup guide
  - [ ] RemoteAIKitTransport usage
  - [ ] React hooks usage
  - [ ] Common patterns
- [ ] Create `docs/guides/server.md`:
  - [ ] Server setup guide
  - [ ] Hono API usage
  - [ ] Anthropic provider setup
  - [ ] Configuration examples
- [ ] Create `docs/guides/react.md`:
  - [ ] useHarness hook guide
  - [ ] useRuntime hook guide
  - [ ] Component examples
  - [ ] State management patterns
- [ ] Create `docs/api-reference/remote-transport.md`:
  - [ ] API reference for RemoteAIKitTransport
  - [ ] Options reference
  - [ ] Method documentation
- [ ] Create `docs/api-reference/local-transport.md`:
  - [ ] API reference for LocalAIKitTransport
  - [ ] Method documentation
- [ ] Update existing docs:
  - [ ] Remove old package references
  - [ ] Add links to new guides
  - [ ] Update architecture diagrams

### File Changes
```
MODIFY:
  README.md                                      (~300 lines updated)
  docs/index.md                                  (add new guide links)

CREATE:
  MIGRATION.md                                    (~200 lines)
  docs/guides/browser.md                         (~150 lines)
  docs/guides/server.md                          (~150 lines)
  docs/guides/react.md                            (~150 lines)
  docs/api-reference/remote-transport.md             (~100 lines)
  docs/api-reference/local-transport.md              (~80 lines)
```

### Phase-Specific Done Criteria

#### 7.1 README Updated
**Verification:**
```bash
# No old package references
rg "@open-harness/transport-websocket" README.md
# Expected: No results

rg "@open-harness/provider-anthropic" README.md
# Expected: No results

# Has all 3 quick starts
rg "### Browser\|### Server\|### Local" README.md
# Expected: 3 results

# Has platform compatibility table
rg "Platform Compatibility\|Browser/Edge\|Node.js/Bun" README.md
# Expected: Table exists
```

#### 7.2 Migration Guide Complete
**Verification:**
```bash
test -f MIGRATION.md
# Expected: File exists

# Has breaking changes section
rg "Breaking Changes\|### v0.1.0" MIGRATION.md
# Expected: Breaking changes documented

# Has migration examples
rg "v0.1.0:\|v0.2.0:" MIGRATION.md
# Expected: Before/after examples
```

#### 7.3 New Guides Created
**Verification:**
```bash
test -f docs/guides/browser.md
test -f docs/guides/server.md
test -f docs/guides/react.md
# Expected: All 3 files exist

# All guides have examples
rg "```typescript" docs/guides/
# Expected: Code examples in each guide
```

#### 7.4 No Broken Links
**Verification:**
```bash
# Check for broken internal links
rg "\[.*\]\(.*\)" README.md docs/
# Expected: All links valid
```

#### 7.5 Documentation Consistent
**Verification:**
```bash
# Package naming consistent across docs
rg "@open-harness/sdk" docs/
# Expected: Only references to new structure

# No typos in code examples
bun test docs/
# Expected: All code examples compile
```

### Done Checklist
- [ ] All tasks complete
- [ ] All phase-specific criteria met
- [ ] All global done criteria met
- [ ] Ready for release

---

## Global Completion Criteria

### Project Complete When ALL:

1. ✅ **All Phases Complete**
   - [ ] Phase 1: Package Restructure
   - [ ] Phase 2: Hono API Routes
   - [ ] Phase 3: Remote AI Kit Transport
   - [ ] Phase 4: HTTP + SSE Client
   - [ ] Phase 5: React Hooks
   - [ ] Phase 6: Build System & Exports
   - [ ] Phase 7: Documentation & Migration

2. ✅ **TypeScript Clean**
   ```bash
   bun run typecheck
   # Exit code 0, zero errors
   ```

3. ✅ **Linting Clean**
   ```bash
   bun run lint
   # Exit code 0, zero warnings or errors
   ```

4. ✅ **All Tests Pass**
   ```bash
   bun run test
   # Exit code 0, all tests pass
   ```

5. ✅ **Build Produces All Outputs**
   ```bash
   bun run build
   # Expected: dist/index.js, dist/server/, dist/client/
   ```

6. ✅ **All Exports Work**
   ```bash
   # Test each export path
   bun test tests/build/exports.test.ts
   # Exit code 0
   ```

7. ✅ **Documentation Complete**
   - [ ] README updated
   - [ ] Migration guide created
   - [ ] All new guides created
   - [ ] API references created
   - [ ] No broken links

8. ✅ **No Regressions**
   - [ ] All existing tests still pass
   - [ ] No breaking changes to existing APIs

9. ✅ **Ready to Publish**
   - [ ] `publishConfig.access: "public"` set
   - [ ] `files` array includes all necessary files
   - [ ] Version bumped to 0.2.0
   - [ ] Changelog created (via changeset)

---

## Verification Commands

### Full Verification Suite
```bash
# 1. TypeScript
bun run typecheck
echo "TypeScript: $?"

# 2. Linting
bun run lint
echo "Linting: $?"

# 3. All tests
bun run test
echo "Tests: $?"

# 4. Specific tests
bun run test:server
bun run test:client
echo "Server tests: $?"
echo "Client tests: $?"

# 5. Build
bun run build
echo "Build: $?"

# 6. Exports
bun test tests/build/exports.test.ts
echo "Exports: $?"

# 7. Dist files exist
ls -la dist/
ls -la dist/server/
ls -la dist/client/
```

---

## Blocking Issues Tracker

Track any blockers that prevent completion of a phase.

### Current Blockers
None

### Resolved Blockers
Add resolved issues here with date and resolution.

---

## Progress Tracking

### Overall Progress
- [ ] Phase 1: Package Restructure (4-5 hours)
- [ ] Phase 2: Hono API Routes (8-10 hours)
- [ ] Phase 3: Remote AI Kit Transport (6-8 hours)
- [ ] Phase 4: HTTP + SSE Client (4-6 hours)
- [ ] Phase 5: React Hooks (3-4 hours)
- [ ] Phase 6: Build System & Exports (3-4 hours)
- [ ] Phase 7: Documentation & Migration (2-3 hours)

**Total Estimated:** 30-40 hours

### Time Tracking
(Update during implementation)

---

**Document Version:** 1.0
**Last Updated:** 2025-01-06
**Status:** ✅ Ready for Implementation
