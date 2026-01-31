# Open Harness Constitution

> Machine-checkable rules extracted from CLAUDE.md and ADRs.
> The validator greps for violation patterns - no rationalization possible.

## MUST Rules (Critical - Block on Violation)

### MUST-001: No TypeScript Build Artifacts in Source

NEVER emit `.js`, `.d.ts`, `.js.map`, or `.d.ts.map` files into `src/` directories.

**Grep patterns that indicate violation:**
- `tsc --outDir src`
- `emit.*src/`
- `outputDir.*src`

### MUST-002: No Mocks or Stubs

NEVER create mock services, stubs, or fabricated fixtures. Use real implementations with `:memory:` databases.

**Grep patterns that indicate violation:**
- `mock`
- `Mock`
- `stub`
- `Stub`
- `fake`
- `Fake`
- `jest.fn`
- `vi.fn`
- `sinon`
- `Effect.succeed([])` followed by test context
- `Effect.void` in test layer
- `Map<.*>()` as service substitute

### MUST-003: No API Key Checks

The Anthropic subscription handles auth automatically. NEVER add API key environment variable checks.

**Grep patterns that indicate violation:**
- `ANTHROPIC_API_KEY`
- `process.env.API_KEY`
- `apiKey.*required`
- `missing.*api.*key`
- `API key not found`

### MUST-004: Use ProviderRecorder for Provider Tests

All provider tests must use the ProviderRecorder infrastructure for recording/playback.

**Grep patterns that indicate violation:**
- `mock.*provider`
- `fake.*response`
- `simulated.*stream`
- `hardcoded.*completion`

### MUST-005: Follow ADR Decisions

Implementation must match accepted ADR specifications exactly.

**Grep patterns that indicate violation:**
- `ProviderRegistry` (deleted per ADR-010)
- `computeStateAt` as primary API (replaced by `deriveState` per ADR-006)
- `Domain/Interaction.ts` usage (deleted per ADR-002)
- nested `phases:` in task YAML (ralphy requires flat `tasks:`)

### MUST-006: Effect Schema at Boundaries

Use Effect Schema (`@effect/schema`) for validation at system boundaries per ADR-005.

**Grep patterns that indicate violation:**
- `JSON.parse.*as.*` without Schema validation
- `as unknown as` type casts
- `response.json() as`

### MUST-007: Events Are Source of Truth

Per ADR-006, events are the source of truth. State is derived, not stored independently.

**Grep patterns that indicate violation:**
- `state.*before.*event`
- `mutate.*then.*emit`
- `store.*state.*first`

## SHOULD Rules (Medium - Warn Only)

### SHOULD-001: Use Data.TaggedClass for Events

Per ADR-004, use `Data.TaggedClass` for event definitions with `_tag` discriminator.

**Grep patterns that indicate violation:**
- `type.*Event.*=.*{` without `_tag`
- `interface.*Event` without extends TaggedClass

### SHOULD-002: Use Match.exhaustive for Event Dispatch

Per ADR-004, use `Match.exhaustive` for type-safe event handling.

**Grep patterns that indicate violation:**
- `switch.*event.*type`
- `if.*event._tag ===`

### SHOULD-003: Agent Owns Provider

Per ADR-010, agents embed their provider directly (not model string).

**Grep patterns that indicate violation:**
- `model:.*string`
- `modelName`
- `getProvider.*model`

### SHOULD-004: Three-Tier Hook Architecture

Per ADR-013, React hooks follow primitives → grouped → unified structure.

**Grep patterns that indicate violation:**
- `useContext.*Workflow` without hook wrapper
- excessive individual hook exports

### SHOULD-005: Internal vs Public Exports

Per ADR-003, internal utilities go behind `/internal` entrypoints.

**Grep patterns that indicate violation:**
- `export.*Route.*Handler`
- `export.*SSE.*` from main index
- `export.*runAgentDef`

### SHOULD-006: Consistent Naming

Per ADR-008, use shorter names (`agent`, `prompt`, `type`) not verbose ones.

**Grep patterns that indicate violation:**
- `agentName`
- `promptText`
- `inputType`

## Built-in Anti-Patterns (Always Checked)

These patterns are ALWAYS flagged regardless of rule applicability:

```yaml
always_block:
  - "That's OK for"           # Rationalization
  - "mock harness"            # Explicit mock permission
  - "acceptable.*mock"        # Mock acceptance
  - "skip.*test.*api"         # Skipping tests
  - "TODO.*later"             # Deferred work in implementation

always_warn:
  - "for now"                 # Temporary solution
  - "verify it works"         # Vague verification
  - "should work"             # Uncertain implementation
  - "might need"              # Incomplete analysis
```

## ADR Reference

All implementations must comply with these accepted ADRs:

| ADR | Decision | Key Constraint |
|-----|----------|----------------|
| [ADR-001](./docs/plans/adr/001-execution-api.md) | Single `run()` API | No `execute()`, `streamWorkflow()` |
| [ADR-002](./docs/plans/adr/002-hitl-architecture.md) | Inline human on phase | Delete Domain/Interaction.ts |
| [ADR-003](./docs/plans/adr/003-public-vs-internal-exports.md) | `/internal` entrypoints | Route handlers internal-only |
| [ADR-004](./docs/plans/adr/004-event-observer-pattern.md) | PubSub + Data.TaggedClass | Single EventHub, Match.exhaustive |
| [ADR-005](./docs/plans/adr/005-type-safety-strategy.md) | Effect Schema at boundaries | No JSON.parse casts |
| [ADR-006](./docs/plans/adr/006-state-sourcing-model.md) | True event sourcing | Events first, state derived |
| [ADR-007](./docs/plans/adr/007-error-hierarchy.md) | Unified error hierarchy | Single error model |
| [ADR-008](./docs/plans/adr/008-naming-conventions.md) | Short field names | `agent` not `agentName` |
| [ADR-009](./docs/plans/adr/009-config-consolidation.md) | Nested config | Single server creation path |
| [ADR-010](./docs/plans/adr/010-provider-ownership-model.md) | Agent owns provider | No ProviderRegistry |
| [ADR-013](./docs/plans/adr/013-react-hooks-architecture.md) | Three-tier React hooks | React Query + grouped hooks |
