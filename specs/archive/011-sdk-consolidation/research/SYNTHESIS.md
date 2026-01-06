# SDK Consolidation Discovery Synthesis

**Date**: 2025-12-28
**Status**: Discovery Complete - Ready for Implementation

---

## Executive Summary

6 parallel discovery agents analyzed the SDK from different dimensions. Key findings:

| Dimension | Critical Issues |
|-----------|-----------------|
| **Architecture** | 3 event systems, 4 renderer patterns, 5 harness classes |
| **Type Conflicts** | 12 duplicate type definitions |
| **Folder Structure** | 26 files in harness/ (should be ~10) |
| **Test Coverage** | 38% coverage, 45 flaky setTimeout patterns |
| **Documentation** | 0 README files in src/, 11 folders need docs |
| **Orphan Code** | 4-6 files ready for deletion |

---

## Critical Decisions Made (from ADR-001)

### Naming (Pino Model)
| Current | New | Rationale |
|---------|-----|-----------|
| `Transport` (interface) | `EventHub` | Bidirectional hub, not just source |
| `Attachment` | `Transport` | Matches Pino - carries to destinations |
| `toAttachment()` | `toTransport()` | Consistent naming |
| `defineRenderer` | `defineTransport` | Not just renderers need state |

### Canonical Systems (Pick ONE)
| Concept | Keep | Delete |
|---------|------|--------|
| **Events** | `BaseEvent` (event-context.ts) | `HarnessEvent`, `FluentHarnessEvent` |
| **Renderer** | `defineTransport()` | `IHarnessRenderer`, `BaseHarnessRenderer` |
| **Harness** | `HarnessInstance` + `TaskHarness` | `BaseHarness`, `Agent` |

---

## Issues by Priority

### P0: Delete Now (No Breaking Changes)
```
src/harness/base-harness.ts     - Unused abstract class, 0 imports
src/harness/agent.ts            - Replaced by defineHarness
src/harness/composite-renderer.ts - Replaced by .attach() pattern
src/dashboard/                   - Empty directory structure
```

### P1: Rename Types
```yaml
# File: src/core/unified-events/types.ts
Transport interface → EventHub
Attachment type → Transport
toAttachment() → toTransport()

# File: src/harness/define-renderer.ts
RendererConfig → TransportConfig (or delete, use single config)
defineRenderer() → defineTransport()
```

### P2: Consolidate Event Types (Breaking)
```
KEEP:   src/harness/event-context.ts (BaseEvent - canonical)
DELETE: src/harness/event-protocol.ts (HarnessEvent - legacy)
MERGE:  src/harness/event-types.ts → event-context.ts

Duplicates to resolve:
- NarrativeEvent (3 definitions)
- SessionPromptEvent (2 definitions)
- RendererConfig (2 definitions)
- NarrativeEntry (4 definitions)
```

### P3: Reorganize Folder Structure
```
CURRENT: src/harness/ (26 files, 6+ concerns)

PROPOSED:
src/
├── events/           # All event types, bus, filter
│   ├── types.ts      # BaseEvent, EnrichedEvent
│   ├── bus.ts        # UnifiedEventBus
│   └── filter.ts     # Event filtering
├── harness/          # Runtime only (10 files)
│   ├── instance.ts   # HarnessInstance (fluent)
│   ├── task-harness.ts
│   ├── control-flow.ts
│   └── state.ts
├── transports/       # Output destinations
│   ├── define.ts     # defineTransport()
│   ├── console.ts    # ConsoleTransport
│   └── session.ts    # SessionContext
├── recording/        # Replay infrastructure
├── utils/            # Generic utilities
│   ├── async-queue.ts
│   ├── backoff.ts
│   └── dependency-resolver.ts
└── index.ts
```

### P4: Fix Test Quality
```
HIGH: 45 setTimeout usages causing flakiness
- tests/unit/transport.test.ts (12 instances)
- tests/replay/interactive-session.test.ts (6 instances)

MEDIUM: 4 Math.random() usages (non-deterministic)
- tests/integration/unified-events.test.ts

ACTION: Replace with event-based coordination
```

### P5: Add Documentation
```
Must-have READMEs:
- src/README.md (architecture overview)
- src/harness/README.md (event systems guide)
- src/core/README.md (DI container, tokens)

Must-document concepts:
- Event Systems (3→1 migration)
- API Levels (wrapAgent vs defineHarness)
- Transport Architecture (EventHub + Transport)
- Session Mode (HITL workflows)
```

---

## Type Conflicts Detail

### NarrativeEvent (3 definitions)
| File | Fields |
|------|--------|
| event-types.ts | `agent: string`, `timestamp: Date` |
| event-context.ts | `importance: NarrativeImportance` |
| monologue/types.ts | `agentName: enum`, `taskId`, `metadata` |

**Resolution**: Consolidate to single type with optional fields

### SessionPromptEvent (2 definitions)
| File | Difference |
|------|------------|
| event-types.ts | Has `timestamp: Date` |
| event-context.ts | No timestamp (added via EnrichedEvent) |

**Resolution**: Use event-context.ts version

### RendererConfig (2 definitions)
| File | Fields |
|------|--------|
| renderer-interface.ts | mode, sessionId, replaySpeed, verbosity |
| define-renderer.ts | colors, unicode, verbosity |

**Resolution**: Rename to `HarnessRendererConfig` vs `DisplayConfig`

---

## Files to Move

### To src/events/
```
src/harness/event-context.ts → src/events/types.ts
src/harness/event-types.ts → src/events/fluent-types.ts (or merge)
src/harness/event-protocol.ts → DELETE (legacy)
src/core/unified-event-bus.ts → src/events/bus.ts
src/core/unified-events/filter.ts → src/events/filter.ts
src/core/event-bus.ts → src/events/legacy-bus.ts (deprecate)
```

### To src/transports/
```
src/harness/define-renderer.ts → src/transports/define.ts
src/harness/base-renderer.ts → src/transports/base.ts (deprecate)
src/harness/console-renderer.ts → src/transports/console.ts
src/harness/session-context.ts → src/transports/session.ts
src/harness/render-output.ts → src/transports/output.ts
```

### To src/utils/
```
src/harness/async-queue.ts → src/utils/async-queue.ts
src/harness/backoff.ts → src/utils/backoff.ts
src/harness/dependency-resolver.ts → src/utils/dependency-resolver.ts
```

### To src/recording/
```
src/harness/harness-recorder.ts → src/recording/recorder.ts
src/harness/replay-controller.ts → src/recording/controller.ts
src/core/replay-runner.ts → src/recording/runner.ts
src/core/vault.ts → src/recording/vault.ts
```

---

## Test Utilities to Export

Move to `src/testing/` for SDK consumers:
```
tests/helpers/mock-monologue-llm.ts
tests/helpers/recording-wrapper.ts
tests/helpers/replay-runner.ts
```

---

## Implementation Order

### Phase 1: Safe Cleanup (No Breaking Changes)
1. Delete empty `src/dashboard/`
2. Delete unused `src/harness/base-harness.ts`
3. Delete unused `src/harness/agent.ts`
4. Delete `src/harness/composite-renderer.ts`
5. Fix lint issues (non-null assertions in tests)

### Phase 2: Rename Types
1. `Transport` → `EventHub` in types.ts
2. `Attachment` → `Transport` in types.ts
3. `toAttachment()` → `toTransport()`
4. Update all imports

### Phase 3: Reorganize Folders
1. Create new directories (events/, transports/, utils/, recording/)
2. Move files with git mv
3. Update imports throughout
4. Add barrel exports (index.ts per folder)

### Phase 4: Consolidate Types (Breaking)
1. Merge event systems into event-context.ts
2. Resolve duplicate type names
3. Add deprecation notices to old exports
4. Update harness/index.ts exports

### Phase 5: Documentation
1. Add README.md to each new folder
2. Document API migration guide
3. Add JSDoc to undocumented exports

---

## Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Files in harness/ | 26 | 10 |
| Event systems | 3 | 1 |
| Renderer patterns | 4 | 1 |
| Duplicate types | 12 | 0 |
| Test coverage | 38% | 60%+ |
| README files | 0 | 6+ |

---

## Research Files Generated

- `type-conflicts.yaml` - 12 duplicate types with resolutions
- `folder-structure.yaml` - Current vs proposed structure
- `doc-opportunities.yaml` - 11 folders need docs, 14 undocumented APIs
- `test-analysis.yaml` - 42 untested files, 45 flaky patterns

---

## Next Steps

1. **Commit this synthesis** to preserve discovery
2. **Start Phase 1** - safe deletions
3. **Run tests** after each phase to catch regressions
