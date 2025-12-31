# Implementation Roadmap

This roadmap defines the **dependency-ordered milestones** for compiling the spec into working code.

## Milestone 0: Conformance Scaffolding

**Goal**: Establish test structure and behavioral gates before any runtime code.

**Inputs**:
- `docs/testing/testing-protocol.md` - Testing infrastructure protocol
- `docs/implementation/conformance.md` - Conformance definition

**Outputs**:
- Test directory structure: `tests/unit/`, `tests/replay/`, `tests/fixtures/{golden,scratch}/`
- Live script directory: `scripts/live/`
- Package scripts: `test:unit`, `test:replay`, `test` (safe default), `test:live` (explicit)

**Conformance Gates**:
- [ ] Test directories exist
- [ ] Package scripts separate safe vs live tests
- [ ] Default `bun test` runs only safe tests (no network, no writes)

**Authoritative Script**: N/A (no runtime yet)

**Done Criteria**: Can run `bun test` and verify it's safe (no network, no fixture writes, fast).

---

## Milestone 1: Hub Minimal Runtime

**Goal**: Implement the smallest Hub that can emit/subscribe/filter events with correct envelope.

**Inputs**:
- `docs/spec/hub.md` - Hub protocol
- `docs/spec/events.md` - Event envelope structure
- `tests/specs/hub.test-spec.md` - Hub test requirements (R1-R7)
- `tests/specs/events.test-spec.md` - Events test requirements (R1-R4)

**Outputs**:
- `src/engine/hub.ts` - Hub implementation
- `src/engine/events.ts` - Event envelope helpers
- Unit tests: `tests/unit/hub.filter.test.ts` (filter matching logic)
- Replay tests: `tests/replay/hub.subscribe.test.ts`, `tests/replay/hub.scoped.test.ts`, etc.
- Fixtures: `tests/fixtures/golden/hub/*.jsonl`
- Authoritative script: `scripts/live/hub-live.ts`

**Conformance Gates**:
- [ ] All Hub test-spec requirements (R1-R7) have passing replay tests
- [ ] Unit tests for pure filter logic pass
- [ ] Replay tests complete in <1s, no network, no writes
- [ ] `scripts/live/hub-live.ts` passes (proves real implementation works)

**Authoritative Script**: `bun scripts/live/hub-live.ts`

**Done Criteria**: Hub can subscribe, emit, filter events. Context envelope is correct. All replay tests pass. Live script proves it works.

---

## Milestone 2: Context Propagation (AsyncLocalStorage)

**Goal**: Implement `scoped()` and `current()` with AsyncLocalStorage semantics.

**Inputs**:
- `docs/spec/hub.md` - Context scoping requirements
- `tests/specs/hub.test-spec.md` - R3: Context Scoping

**Outputs**:
- `src/engine/hub.ts` - `scoped()` and `current()` implementation
- Replay tests: `tests/replay/hub.scoped.test.ts` (enhanced)
- Fixtures: `tests/fixtures/golden/hub/scoped-*.jsonl`
- Authoritative script: `scripts/live/hub-live.ts` (updated)

**Conformance Gates**:
- [ ] `scoped()` propagates context via AsyncLocalStorage
- [ ] Nested scopes merge correctly
- [ ] `current()` returns inherited context
- [ ] Context survives async boundaries
- [ ] Replay tests pass
- [ ] Live script proves it works

**Authoritative Script**: `bun scripts/live/hub-live.ts`

**Done Criteria**: Context propagation works across async boundaries. Events inherit context automatically. All tests pass.

---

## Milestone 3: Harness Lifecycle + Phase/Task Helpers

**Goal**: Implement Harness factory, lifecycle events, phase/task helpers, and attachments.

**Inputs**:
- `docs/spec/harness.md` - Harness protocol
- `tests/specs/harness.test-spec.md` - Harness test requirements (R1-R6)

**Outputs**:
- `src/engine/harness.ts` - Harness implementation
- Replay tests: `tests/replay/harness.*.test.ts`
- Fixtures: `tests/fixtures/golden/harness/*.jsonl`
- Authoritative script: `scripts/live/harness-live.ts`

**Conformance Gates**:
- [ ] Harness factory creates instances correctly
- [ ] Lifecycle events (`harness:start`, `harness:complete`) emit correctly
- [ ] `phase()` and `task()` helpers propagate context
- [ ] Attachments receive hub and can subscribe
- [ ] All replay tests pass
- [ ] Live script proves it works

**Authoritative Script**: `bun scripts/live/harness-live.ts`

**Done Criteria**: Can create harness, run it, see lifecycle events, use phase/task helpers. Attachments work. All tests pass.

---

## Milestone 4: Inbox Routing + RunId Semantics

**Goal**: Implement run-scoped message routing (`sendToRun`) and inbox semantics.

**Inputs**:
- `docs/spec/harness.md` - Inbox routing requirements
- `docs/spec/agent.md` - AgentInbox interface
- `tests/specs/harness.test-spec.md` - R6: Inbox Routing
- `tests/specs/agent.test-spec.md` - R3: Inbox Interface, R6: RunId Uniqueness

**Outputs**:
- `src/engine/harness.ts` - Inbox routing implementation
- `src/engine/inbox.ts` - AgentInbox implementation
- Replay tests: `tests/replay/harness.inbox.test.ts`, `tests/replay/agent.inbox.test.ts`
- Fixtures: `tests/fixtures/golden/harness/inbox-*.jsonl`, `tests/fixtures/golden/agent/inbox-*.jsonl`
- Authoritative script: `scripts/live/harness-live.ts` (updated)

**Conformance Gates**:
- [ ] `sendToRun(runId, message)` routes to correct inbox
- [ ] Multiple concurrent runs have separate inboxes
- [ ] Inbox supports `pop()`, async iteration, `drain()`
- [ ] RunId uniqueness is maintained
- [ ] All replay tests pass
- [ ] Live script proves it works

**Authoritative Script**: `bun scripts/live/harness-live.ts`

**Done Criteria**: Can send messages to specific agent runs. Inbox works correctly. Multiple concurrent runs work independently. All tests pass.

---

## Milestone 5: Flow "Hello World"

**Goal**: Implement minimal Flow engine (YAML parse/validate/toposort/when/bindings) with built-in nodes.

**Inputs**:
- `docs/flow/flow-spec.md` - FlowSpec YAML schema
- `docs/flow/bindings.md` - A3 binding grammar
- `docs/flow/when.md` - WhenExpr grammar
- `docs/flow/execution.md` - Execution semantics
- `tests/specs/flow.test-spec.md` - Flow test requirements (R1-R7)

**Outputs**:
- `src/flow/parser.ts` - YAML parser
- `src/flow/validator.ts` - Zod schema validation
- `src/flow/compiler.ts` - DAG compilation (toposort, edge validation)
- `src/flow/bindings.ts` - A3 binding resolver
- `src/flow/when.ts` - WhenExpr evaluator
- `src/flow/executor.ts` - Sequential scheduler
- `src/flow/nodes/` - Built-in nodes (`echo`, `constant`, `condition.equals`)
- Replay tests: `tests/replay/flow.*.test.ts`
- Fixtures: `tests/fixtures/golden/flow/*.jsonl`
- Authoritative script: `scripts/live/flow-live.ts`

**Conformance Gates**:
- [ ] YAML parsing works (FlowYaml structure)
- [ ] Schema validation catches errors
- [ ] Toposort orders nodes correctly
- [ ] Edges are required (B1 rule enforced)
- [ ] WhenExpr evaluation works (equals, not, and, or)
- [ ] A3 bindings work (strict, optional, default)
- [ ] Flow runs end-to-end with built-in nodes
- [ ] All replay tests pass
- [ ] Live script proves it works

**Authoritative Script**: `bun scripts/live/flow-live.ts`

**Done Criteria**: Can parse YAML, validate, compile DAG, resolve bindings, evaluate when, run flow. Built-in nodes work. All tests pass.

---

## Milestone 6: Provider Adapters (Replay-First)

**Goal**: Add provider adapters (Claude, etc.) behind replay-first infrastructure.

**Inputs**:
- `docs/spec/agent.md` - AgentDefinition contract
- Provider SDKs (e.g., `@anthropic-ai/claude-agent-sdk`)

**Outputs**:
- `src/providers/claude.ts` - Claude adapter
- Replay infrastructure: `src/testing/replay-runner.ts`, `src/testing/fixture-loader.ts`
- Recording infrastructure: `scripts/record-fixture.ts`
- Replay tests: `tests/replay/providers/claude.*.test.ts`
- Fixtures: `tests/fixtures/golden/providers/claude/*.jsonl`
- Authoritative script: `scripts/live/providers/claude-live.ts`

**Conformance Gates**:
- [ ] Provider adapter implements AgentDefinition correctly
- [ ] Replay runner uses fixtures (no network)
- [ ] Recording script is explicit opt-in
- [ ] Fixtures are realistic (captured from real SDK)
- [ ] Replay tests pass (fast, deterministic)
- [ ] Live script proves real SDK works

**Authoritative Script**: `bun scripts/live/providers/claude-live.ts`

**Done Criteria**: Provider adapter works. Replay tests use fixtures. Recording is explicit. Live script proves real SDK integration.

---

## Milestone Dependencies

```
M0 (Scaffolding)
  ↓
M1 (Hub)
  ↓
M2 (Context)
  ↓
M3 (Harness)
  ↓
M4 (Inbox)
  ↓
M5 (Flow)
  ↓
M6 (Providers)
```

**Rule**: Do not advance to next milestone until current milestone's conformance gates pass.

## Key Principles

1. **Vertical slices**: Each milestone delivers working end-to-end functionality
2. **Conformance gates**: Must pass before advancing
3. **Authoritative scripts**: Every milestone has a "prove it works" command
4. **No provider complexity until M6**: Use built-in nodes for Flow testing
5. **Replay-first**: Provider adapters must work with fixtures before live tests
