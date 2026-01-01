# SDK Consolidation Action Plan

## Phase 1: Safe Deletions (No Breaking Changes)

```bash
# Delete unused files
rm src/harness/base-harness.ts
rm src/harness/agent.ts
rm src/harness/composite-renderer.ts
rm -rf src/dashboard/

# Update harness/index.ts to remove exports
```

## Phase 2: Rename Types (Breaking)

### In `src/core/unified-events/types.ts`:
```typescript
// OLD → NEW
Transport → EventHub
Attachment → Transport
TransportStatus → EventHubStatus
```

### In `src/harness/define-renderer.ts`:
```typescript
// OLD → NEW
toAttachment() → toTransport()
defineRenderer() → defineTransport()
RendererConfig → TransportConfig
IUnifiedRenderer → ITransport
```

## Phase 3: Create New Folders

```bash
mkdir -p src/events
mkdir -p src/transports
mkdir -p src/recording
mkdir -p src/utils
```

## Phase 4: Move Files

### Events
```bash
git mv src/harness/event-context.ts src/events/types.ts
git mv src/core/unified-event-bus.ts src/events/bus.ts
git mv src/core/unified-events/filter.ts src/events/filter.ts
# Delete: src/harness/event-protocol.ts (legacy)
# Merge: src/harness/event-types.ts into events/types.ts
```

### Transports
```bash
git mv src/harness/define-renderer.ts src/transports/define.ts
git mv src/harness/session-context.ts src/transports/session.ts
git mv src/harness/render-output.ts src/transports/output.ts
# Deprecate: src/harness/base-renderer.ts
# Deprecate: src/harness/console-renderer.ts
```

### Utils
```bash
git mv src/harness/async-queue.ts src/utils/async-queue.ts
git mv src/harness/backoff.ts src/utils/backoff.ts
git mv src/harness/dependency-resolver.ts src/utils/dependency-resolver.ts
```

### Recording
```bash
git mv src/harness/harness-recorder.ts src/recording/recorder.ts
git mv src/harness/replay-controller.ts src/recording/controller.ts
git mv src/core/replay-runner.ts src/recording/runner.ts
git mv src/core/vault.ts src/recording/vault.ts
```

## Phase 5: Add READMEs

Create these files:
- `src/README.md` - Architecture overview
- `src/events/README.md` - Event system guide
- `src/transports/README.md` - Transport pattern
- `src/harness/README.md` - Runtime guide

## Phase 6: Fix Tests

1. Replace setTimeout with event-based waiting
2. Replace Math.random() with fixed values
3. Add missing unit tests for high-priority files

## Commands to Run After Each Phase

```bash
bun run typecheck  # Verify types
bun run lint       # Check lint
bun run test       # Run tests
```

## Files Ready for Immediate Deletion

| File | Reason |
|------|--------|
| `src/harness/base-harness.ts` | 0 imports, 0 tests |
| `src/harness/agent.ts` | Replaced by defineHarness |
| `src/harness/composite-renderer.ts` | Replaced by .attach() |
| `src/dashboard/*` | Empty directories |

## Key Renames Summary

| Current | New |
|---------|-----|
| `Transport` | `EventHub` |
| `Attachment` | `Transport` |
| `toAttachment()` | `toTransport()` |
| `defineRenderer()` | `defineTransport()` |
| `IUnifiedRenderer` | `ITransport` |
