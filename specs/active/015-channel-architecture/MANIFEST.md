# Channel Architecture & ReactFlow UI Integration

**Status**: Active
**Created**: 2026-01-01
**Supersedes**: GitHub Issue #34 (now outdated)

---

## Problem Statement

We want an n8n-style visual editor for flows using ReactFlow. But before building UI, we need to validate that our core event-driven architecture actually works end-to-end.

**Current gaps:**
1. No end-to-end validation (GitHub channel tests use MockHub, not real Hub)
2. Channel pattern exists but isn't formalized (each channel reimplements)
3. Hub doesn't manage channel lifecycle (manual wiring)
4. FlowYaml lacks position data for visualization
5. NodeRegistry lacks metadata for node palette
6. Executor doesn't emit node-level events for visualization

---

## Architectural Decisions

### AD-001: Registered Channels Pattern

Channels are **registered with the Hub**, not manually attached.

```typescript
// Define channel
const channel = defineChannel({
  name: "websocket",
  config: { port: 3001 },
  state: () => ({ clients: [] }),
  on: { "*": streamToClients },
});

// Register with Hub (Hub owns lifecycle)
hub.registerChannel(channel);

// Hub activates on start, cleans up on stop
await hub.start();
await hub.stop();
```

**Why**: Modularity, testability, lifecycle management.

### AD-002: Fix Types, Don't Add Adapters

Instead of Flow↔ReactFlow adapter layer, fix the source types:

- Add `position?: { x: number; y: number }` to `NodeSpec`
- Add `metadata?: NodeMetadata` to `NodeTypeDefinition`

ReactFlow reads FlowYaml directly. No conversion layer.

**Why**: Adapters are cruft that exists because types are incomplete.

### AD-003: Validate Before Building

Create end-to-end validation test BEFORE building more infrastructure.

**Why**: We've built this 3-4 times. Need to prove the core loop works.

---

## Success Criteria

At the end of this work:

1. **E2E Loop Proven**: Test shows Executor → Hub → Channel → User → Hub → Executor works
2. **Round-trip Test**: Load FlowYaml → display in ReactFlow → edit → save → YAML matches
3. **Execution Visualization**: Nodes light up as they execute
4. **Node Palette**: Shows available nodes with metadata

---

## Phases

### Phase 0: End-to-End Validation [COMPLETE ✅]

**Goal**: Prove the core loop works with REAL components.

**Deliverables**:
- [x] Test channel that records events and can inject commands
- [x] Simple flow YAML (2-3 nodes)
- [x] Integration test: run flow, verify events, send command, verify response
- [x] Document gaps discovered (see below)

**Location**: `packages/kernel/tests/e2e/channel-loop.test.ts`

**Validation Results** (2026-01-01):
- ✅ **6 tests passing** - Core loop works
- ✅ Events flow from Executor → Hub → Channel
- ✅ Channel can inject: `send()`, `reply()`, `abort()`
- ✅ Multiple channels work simultaneously
- ✅ Multi-node flows with edges work correctly

**Gaps Discovered**:
1. **No node-level events** - Executor wraps nodes in `task:start/complete`, but no `node:start/complete` (Phase 3 will fix)
2. **Manual attachment** - Channels use `Attachment` pattern but Hub doesn't track them (Phase 1 will fix)
3. **GitHub channel has duplicate types** - Defines own Hub interface instead of importing from kernel

### Phase 1: Hub Registration API [COMPLETE ✅]

**Goal**: Hub manages channel lifecycle.

**Deliverables**:
- [x] `hub.registerChannel(channel)` method
- [x] `hub.unregisterChannel(name)` method
- [x] `hub.start()` activates all registered channels
- [x] `hub.stop()` cleans up all channels
- [x] Update `ChannelDefinition` type in protocol (added `ChannelInstance`)

**Files**:
- `packages/kernel/src/protocol/channel.ts` - types (added `ChannelInstance`)
- `packages/kernel/src/protocol/events.ts` - added `ChannelEvents`
- `packages/kernel/src/protocol/hub.ts` - added interface methods
- `packages/kernel/src/engine/hub.ts` - implementation

**Implementation Results** (2026-01-02):
- ✅ **25 unit tests passing** - `tests/unit/hub.channels.test.ts`
- ✅ Fluent chaining: `hub.registerChannel(a).registerChannel(b).start()`
- ✅ Idempotent lifecycle (start/stop safe to call multiple times)
- ✅ Error isolation (handler errors don't crash hub)
- ✅ Late registration (channels registered after start() auto-activate)
- ✅ Channel events: `channel:registered`, `channel:started`, `channel:stopped`, `channel:error`
- ✅ State isolation per channel
- ✅ Existing E2E tests still pass (67 total tests)

### Phase 2: Type Fixes [COMPLETE ✅]

**Goal**: FlowYaml and NodeRegistry have all data needed for visualization.

**Deliverables**:
- [x] Add `position?: { x: number; y: number }` to `NodeSpec`
- [x] Add `metadata?: NodeMetadata` to `NodeTypeDefinition`
- [x] `NodeMetadata` includes: displayName, description, category, icon, ports
- [x] `registry.listWithMetadata()` returns full metadata

**Files**:
- `packages/kernel/src/protocol/flow.ts` - NodeSpec, NodePosition, NodeMetadata, PortDefinition
- `packages/kernel/src/flow/registry.ts` - listWithMetadata(), NodeTypeInfo
- `packages/kernel/src/flow/validator.ts` - NodePositionSchema

**Implementation Results** (2026-01-02):
- ✅ **16 unit tests passing** - `tests/unit/registry.metadata.test.ts`
- ✅ `NodePosition` interface with x/y coordinates
- ✅ `NodeMetadata` with displayName, description, category, icon, color, ports
- ✅ `PortDefinition` with name, type (input/output), dataType, description
- ✅ `NodeSpec.position` optional field for ReactFlow visualization
- ✅ `NodeTypeDefinition.metadata` optional field
- ✅ `registry.listWithMetadata()` returns type, metadata, and capabilities
- ✅ Validator schema updated with `NodePositionSchema`
- ✅ All 83 kernel tests pass

### Phase 3: Execution Events [COMPLETE ✅]

**Goal**: Executor emits node-level events for visualization.

**Deliverables**:
- [x] `node:start { nodeId, nodeType }` event
- [x] `node:complete { nodeId, output, durationMs }` event
- [x] `node:error { nodeId, error, stack? }` event
- [x] `node:skipped { nodeId, reason: 'when' | 'edge' }` event

**Files**:
- `packages/kernel/src/flow/executor.ts` - emit events during execution
- `packages/kernel/src/protocol/events.ts` - NodeEvents type

**Implementation Results** (2026-01-02):
- ✅ **10 unit tests passing** - `tests/unit/executor.events.test.ts`
- ✅ `node:start` emitted before node execution with nodeId and nodeType
- ✅ `node:complete` emitted after success with output and durationMs
- ✅ `node:error` emitted on failure with error message and stack trace
- ✅ `node:skipped` emitted with reason ("when" for condition, "edge" for edge filter)
- ✅ Events emitted in correct order (start before complete/error)
- ✅ Multi-node flows emit events in execution order
- ✅ All 93 kernel tests pass

### Phase 4: WebSocket Channel [COMPLETE ✅]

**Goal**: Stream events to browser, receive commands.

**Deliverables**:
- [x] WebSocket channel using Bun.serve()
- [x] Follows registered channel pattern
- [x] Streams all events to connected clients
- [x] Handles incoming commands (send, sendTo, sendToRun, reply, abort)
- [x] Integration tests with real WebSocket connections

**Files**:
- `packages/kernel/src/channels/websocket.ts` - createWebSocketChannel()
- `packages/kernel/src/channels/index.ts` - exports
- `packages/kernel/tests/e2e/websocket-channel.test.ts` - 16 integration tests

**Implementation Results** (2026-01-02):
- ✅ **16 integration tests passing** - `tests/e2e/websocket-channel.test.ts`
- ✅ WebSocket server using Bun.serve() on configurable port
- ✅ Health endpoint at `/health` with client count
- ✅ All hub events broadcast to connected clients as JSON
- ✅ Client commands: send, sendTo, sendToRun, reply, abort
- ✅ Acknowledgments sent for successful commands
- ✅ Error messages for invalid commands/JSON
- ✅ Lifecycle events: websocket:started, websocket:connected, websocket:disconnected, websocket:stopped
- ✅ Multi-client support with proper cleanup on disconnect
- ✅ All 109 kernel tests pass

### Phase 5: React Client (packages/flow-ui)

**Goal**: Visual flow editor and execution monitor.

**Deliverables**:
- [ ] New package: `packages/flow-ui`
- [ ] ReactFlow-based flow visualization
- [ ] WebSocket connection to kernel
- [ ] Node palette from registry metadata
- [ ] Execution state visualization (nodes light up)
- [ ] Edit capabilities (add/remove/connect nodes)
- [ ] Save to FlowYaml

**Dependencies**: Phases 1-4 complete

---

## What's NOT Needed

Explicitly out of scope to prevent cruft:

- ❌ `defineChannel()` as separate helper function (use registered pattern)
- ❌ Flow↔ReactFlow adapter layer (fix types instead)
- ❌ Separate console channel abstraction (can be simple subscriber)
- ❌ Complex channel configuration system (keep it simple)
- ❌ Channel hot-reloading (not MVP)

---

## Open Questions

1. **GitHub channel migration**: Should we migrate it to registered pattern or leave as-is?
2. **Shared types**: GitHub channel has own Hub types - should import from kernel?
3. **Auto-layout**: When position data missing, use dagre for auto-layout?

---

## References

- Old Issue: https://github.com/Open-Harness/open-harness/issues/34
- GitHub channel: `packages/github-channel/`
- Kernel docs: `packages/kernel/docs/`
- Research: `docs/research/RESEARCH-SUMMARY.md`
