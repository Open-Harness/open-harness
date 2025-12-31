# Spec: Flow-Only Architecture (Collapse Harness + Flow)

**Status**: Draft
**Date**: 2025-12-31

## Summary
Unify execution into a single Flow runtime that preserves existing harness semantics (phases, tasks, runId boundaries, event context, inbox routing) while simplifying abstractions. Flow becomes the only orchestration model; harness-specific APIs are removed or wrapped by Flow.

This spec is grounded in the existing mental model:
- **Each agent invocation is a fresh run** (new `runId`).
- **Scope** is maintained by phase/task contexts, not by reusing agent runs.
- **Context passing is explicit** via inputs/outputs/state.

---

## Goals
- Collapse dual execution modes into a single **Flow runtime**.
- Preserve harness semantics: phases, tasks, run lifecycle, and event context.
- Ensure **every agent run is injectable** (inbox always available for agent nodes).
- Enable **edge-level dynamic routing** with explicit control nodes.
- Provide a **complete node catalog** suitable for “n8n for agents.”

## Non-goals
- No UI/visual editor in this phase.
- No new providers beyond adapting existing ones to the agent runtime.
- No breaking changes to Flow YAML beyond required routing enhancements.

---

## Core Mental Model
- **sessionId**: identifies a flow run.
- **phase**: logical grouping (emitted by runtime).
- **task**: node execution scope (task id = node id).
- **runId**: **fresh per agent invocation**, even within the same task.

This preserves the harness behavior: multiple agents can run in the same task scope while still getting distinct runIds.

---

## Execution Semantics

### Lifecycle
- `harness:start` emitted at run start.
- `phase:start` emitted for the flow phase (default: “Run Flow”).
- `task:start` emitted per node execution.
- `agent:start/complete` emitted per agent invocation.
- `harness:complete` emitted on completion (success/failure).

### Injection & Inbox
- **All agent nodes receive an inbox**, always.
- `sendToRun(runId, message)` injects into a specific agent run.
- `sendTo(nodeId, message)` routes to the latest active run for that node (convenience).

### Context Passing
- Inputs are explicit via bindings.
- Outputs are explicit in node outputs.
- No implicit agent memory between runs unless passed in.

---

## Flow Policies

### FlowPolicy (global)
- `failFast` (default: true): stop flow on first unhandled failure.

### NodePolicy (per node)
- `timeoutMs`: enforce timeout for node execution.
- `retry`: `{ maxAttempts, backoffMs? }`.
- `continueOnError`: allow flow to proceed even if this node fails.

**Implementation**: Policy logic must be enforced in the Flow runtime (not just schema validation).

---

## Flow Control

### Edge-Level `when`
Edges support `when` conditions evaluated against binding context. This enables dynamic routing without duplicating `when` on every node.

### Control Nodes (explicit)
Control nodes define routing structure in the graph (n8n-like):
- `control.switch`
- `control.if`
- `control.merge`
- `control.foreach`
- `control.loop`
- `control.wait`
- `control.gate`
- `control.subflow`
- `control.fail`
- `control.noop`

---

## Node Catalog (v1)

### A) Control Nodes
- `control.switch`
- `control.if`
- `control.merge`
- `control.foreach`
- `control.loop`
- `control.wait`
- `control.gate`
- `control.subflow`
- `control.fail`
- `control.noop`

### B) Agent Nodes (stateful, tool-enabled, streaming)
- `agent.run` (generic agent with full config)
- `agent.plan`
- `agent.classify`
- `agent.coder`
- `agent.reviewer`
- `agent.summarize`

All agent nodes:
- Always receive inbox.
- Emit `agent:*` and `agent:tool:*` events.
- Support streaming (`agent:text`).

### C) Data / Transform
- `data.map`
- `data.filter`
- `data.reduce`
- `data.merge`
- `data.pick`
- `data.set`
- `data.json.parse`
- `data.json.stringify`
- `data.template`
- `data.validate`

### D) System / Runtime
- `system.log`
- `system.metrics`
- `system.cache.get`
- `system.cache.set`
- `system.state.get`
- `system.state.set`

### Channels (not nodes)
Channels are interfaces to a running flow (console, voice, websocket, etc.). They attach to the runtime and are **not** declared as nodes in FlowSpec.

---

## Provider Standardization

### Remove `unstable_v2_prompt`
- Provider nodes must not call `unstable_v2_prompt`.
- Use **stateful agent runner** for all agent nodes.

### Config Pass-through
- `NodeSpec.config` must be passed to agent runner.
- Allowlist or schema-validate full Anthropic SDK config.
- Preserve tool configuration, model selection, sampling parameters, and metadata.

---

## FlowSpec Changes

### Edge Schema
Add `when?: WhenExpr` to edges (reuses existing `when` DSL):
```yaml
edges:
  - from: route
    to: bugFlow
    when:
      equals:
        var: route.route
        value: bug
```

### Node Spec
- Keep existing `NodePolicy`.
- Add `config` pass-through for agent nodes.

---

## Implementation Plan (High Level)
1. Introduce `FlowRuntime` that owns Hub + lifecycle + inbox routing.
2. Implement `FlowPolicy` + `NodePolicy` in runtime.
3. Add edge-level `when` in schema + executor.
4. Standardize agent nodes on stateful runner and inbox.
5. Remove or wrap harness APIs to Flow runtime.
6. Update tests/fixtures for run lifecycle and inbox routing.

---

## Implementation Plan (Detailed)

### Phase 1: FlowRuntime + Lifecycle
- Add `packages/kernel/src/flow/runtime.ts`:
  - Owns `HubImpl`, session context, inbox map, and run lifecycle.
  - Emits `harness:*`, `phase:*`, `task:*` events.
  - Returns `FlowRunResult` with events, duration, status.
- Export runtime from `packages/kernel/src/flow/index.ts` and `packages/kernel/src/index.ts`.
- Deprecate `packages/kernel/src/engine/harness.ts` (leave in place temporarily, but FlowRuntime becomes canonical).

### Phase 2: Edge-level `when`
- Update `packages/kernel/src/protocol/flow.ts`:
  - `Edge` gains `when?: WhenExpr`.
- Update `packages/kernel/src/flow/validator.ts`:
  - `EdgeSchema` accepts `when` using `WhenExprSchema`.
- Update `packages/kernel/src/flow/compiler.ts`:
  - Preserve edge `when` in compiled adjacency.
- Update `packages/kernel/src/flow/executor.ts` (or move logic into runtime):
  - Evaluate edge conditions after upstream node completion.
  - Mark edges as `fired` or `skipped` based on `when`.
  - Node readiness rules:
    - All incoming edges resolved.
    - At least one incoming edge fired (unless node has zero inputs).
    - `control.merge` can override with `mode: all|any`.

### Phase 3: Policy Enforcement
- Implement in FlowRuntime:
  - `timeoutMs`: wrap node execution with a timer.
  - `retry`: `maxAttempts` + `backoffMs` (with jitter optional).
  - `continueOnError`: record failure in outputs and continue.
  - `failFast`: stop on first unhandled error.
- Add helper utilities:
  - `withTimeout(promise, ms)`
  - `retry(fn, policy)`

### Phase 4: Agent Node Standardization
- Define agent capability flag:
  - `NodeCapabilities.isAgent?: boolean`
  - When true: runtime always creates inbox and assigns runId.
- Update existing nodes:
  - `packages/kernel/src/flow/nodes/anthropic.ts`:
    - Replace `unstable_v2_prompt` usage.
    - Call stateful agent runner.
  - `packages/kernel/src/providers/anthropic.ts`:
    - Use stateful agent execution.
    - Pass full config from `NodeSpec.config`.
- Ensure agent nodes emit `agent:*` and `agent:tool:*` events.

### Phase 5: Harness Collapse
- Update exports to promote FlowRuntime as primary API.
- Remove or wrap `HarnessInstance` to call FlowRuntime internally.
- Remove legacy harness fixtures/tests once parity is verified.

### Phase 6: Tests + Fixtures
- Add new replay fixtures for Flow runtime:
  - `flow/run-lifecycle`
  - `flow/inbox-routing`
  - `flow/policy-timeout`
  - `flow/policy-retry`
  - `flow/edge-when`
- Add unit tests for:
  - Edge-level `when` evaluation.
  - Retry/backoff behavior.
  - Inbox injection targeting runId and nodeId.

---

## Risks
- Concurrency and merge semantics may require careful design.
- Provider migration may affect event output and streaming behavior.
- Edge-level routing requires schema and runtime changes.

---

## Success Criteria
- Flow runs emit full lifecycle events with correct contexts.
- Any running agent can receive injected messages by `runId`.
- Agent tool events are visible in the hub for all agent nodes.
- Edge-level routing works for multi-branch flows.
- Harness APIs removed or thinly wrapped by Flow with no loss of behavior.

---

## Appendix A: Node Schemas (v1)

### A1) Control Nodes

**control.switch**\n
Input:\n
- `value: unknown`\n
- `cases: Array<{ when: WhenExpr; route: string }>`\n
Output:\n
- `{ route: string; value: unknown }`\n
\n
**control.if**\n
Input:\n
- `condition: WhenExpr`\n
Output:\n
- `{ condition: boolean }`\n
\n
**control.merge**\n
Input:\n
- `mode: \"all\" | \"any\"` (default: `all`)\n
Output:\n
- `{ merged: true }`\n
\n
**control.foreach**\n
Input:\n
- `list: unknown[]`\n
- `as?: string` (default: `item`)\n
Output (per iteration):\n
- `{ item: unknown; index: number; count: number }`\n
\n
**control.loop**\n
Input:\n
- `while: WhenExpr`\n
- `maxIterations?: number`\n
Output:\n
- `{ iteration: number }`\n
\n
**control.wait**\n
Input:\n
- `ms?: number`\n
- `until?: string` (event name)\n
Output:\n
- `{ waitedMs: number }`\n
\n
**control.gate**\n
Input:\n
- `prompt: string`\n
- `choices?: string[]`\n
- `allowText?: boolean`\n
Output:\n
- `{ response: { content: string; choice?: string } }`\n
\n
**control.subflow**\n
Input:\n
- `name: string`\n
- `input?: Record<string, unknown>`\n
Output:\n
- `{ outputs: Record<string, unknown> }`\n
\n
**control.fail**\n
Input:\n
- `message: string`\n
Output:\n
- none (throws)\n
\n
**control.noop**\n
Input:\n
- `value?: unknown`\n
Output:\n
- `{ value?: unknown }`\n

### A2) Agent Nodes

All agent nodes:\n
- Capabilities: `{ isAgent: true, supportsInbox: true, isStreaming: true }`\n
- Input/output schemas are agent-specific but follow the pattern below.\n
\n
**agent.run** (generic)\n
Input:\n
- `input: unknown`\n
- `tools?: string[]`\n
- `system?: string`\n
- `model?: string`\n
- `metadata?: Record<string, unknown>`\n
Output:\n
- `{ result: unknown }`\n
\n
**agent.plan / agent.classify / agent.coder / agent.reviewer / agent.summarize**\n
Input:\n
- `input: unknown` (agent-specific)\n
Output:\n
- `{ result: unknown }` (agent-specific)\n

### A3) Data / Transform

**data.map**\n
Input: `{ list: unknown[]; template?: string }`\n
Output: `{ list: unknown[] }`\n
\n
**data.filter**\n
Input: `{ list: unknown[]; when: WhenExpr }`\n
Output: `{ list: unknown[] }`\n
\n
**data.reduce**\n
Input: `{ list: unknown[]; initial?: unknown }`\n
Output: `{ value: unknown }`\n
\n
**data.merge**\n
Input: `{ objects: Record<string, unknown>[] }`\n
Output: `{ object: Record<string, unknown> }`\n
\n
**data.pick**\n
Input: `{ object: Record<string, unknown>; keys: string[] }`\n
Output: `{ object: Record<string, unknown> }`\n
\n
**data.set**\n
Input: `{ object: Record<string, unknown>; path: string; value: unknown }`\n
Output: `{ object: Record<string, unknown> }`\n
\n
**data.json.parse**\n
Input: `{ text: string }`\n
Output: `{ value: unknown }`\n
\n
**data.json.stringify**\n
Input: `{ value: unknown }`\n
Output: `{ text: string }`\n
\n
**data.template**\n
Input: `{ template: string; values?: Record<string, unknown> }`\n
Output: `{ text: string }`\n
\n
**data.validate**\n
Input: `{ value: unknown; schema: string }`\n
Output: `{ valid: boolean; errors?: string[] }`\n

### A4) System / Runtime

**system.log**\n
Input: `{ level: \"debug\"|\"info\"|\"warn\"|\"error\"; message: string }`\n
Output: `{ ok: true }`\n
\n
**system.metrics**\n
Input: `{ name: string; value: number; tags?: Record<string,string> }`\n
Output: `{ ok: true }`\n
\n
**system.cache.get**\n
Input: `{ key: string }`\n
Output: `{ value?: unknown }`\n
\n
**system.cache.set**\n
Input: `{ key: string; value: unknown; ttlMs?: number }`\n
Output: `{ ok: true }`\n
\n
**system.state.get**\n
Input: `{ key: string }`\n
Output: `{ value?: unknown }`\n
\n
**system.state.set**\n
Input: `{ key: string; value: unknown }`\n
Output: `{ ok: true }`\n

---

## Appendix B: Flow Runtime Interface

```ts
export interface FlowRunnerOptions {
  sessionId?: string;
  input?: Record<string, unknown>;
  channels?: ChannelDefinition<any>[];
  policy?: FlowPolicy;
}

export interface FlowRunResult {
  outputs: Record<string, unknown>;
  events: EnrichedEvent[];
  durationMs: number;
  status: HubStatus;
}

export interface FlowInstance extends Hub {
  attach(channel: ChannelDefinition<any>): this;
  startSession(): this;
  run(): Promise<FlowRunResult>;
}

export function createFlowRunner(
  flow: FlowYaml,
  registry: NodeRegistry,
  options?: FlowRunnerOptions,
): FlowInstance;
```

---

## Appendix C: Runtime Pseudocode

```ts
function createFlowRunner(flow, registry, options): FlowInstance {
  const hub = new HubImpl(options.sessionId ?? `flow-${Date.now()}`);
  const instance = new FlowInstanceImpl(hub, flow, registry, options);
  return instance;
}

async function runFlow(flow, registry, hub, options): FlowRunResult {
  const start = Date.now();
  const events: EnrichedEvent[] = [];
  const outputs: Record<string, unknown> = {};
  const runInboxes = new Map<string, AgentInbox>();
  const nodeRunIndex = new Map<string, string>(); // nodeId -> latest runId

  const unsubscribe = hub.subscribe(\"*\", (event) => events.push(event));

  hub.setStatus(\"running\");
  hub.emit({ type: \"harness:start\", name: flow.flow.name });

  await hub.scoped({ phase: { name: \"Run Flow\" } }, async () => {
    const compiled = compileFlow(flow);
    const edges = buildEdgeState(compiled);

    for (const node of compiled.order) {
      if (!isNodeReady(node, edges, outputs)) continue;

      await hub.scoped({ task: { id: node.id } }, async () => {
        hub.emit({ type: \"task:start\", taskId: node.id });

        const input = resolveBindings(node.input, { flow: { input: flow.flow.input }, ...outputs });
        const def = registry.get(node.type);

        const runId = createRunId(node.id);
        nodeRunIndex.set(node.id, runId);

        const inbox = def.capabilities?.isAgent ? new AgentInboxImpl() : undefined;
        if (inbox) runInboxes.set(runId, inbox);

        const execute = () => def.run({ hub, runId, inbox }, input);
        const result = await withPolicy(execute, node.policy, flow.flow.policy);

        outputs[node.id] = result;
        hub.emit({ type: \"task:complete\", taskId: node.id, result });

        resolveOutgoingEdges(node.id, result, edges, outputs);
      });
    }
  });

  hub.emit({ type: \"harness:complete\", success: true, durationMs: Date.now() - start });
  hub.setStatus(\"complete\");
  unsubscribe();

  return { outputs, events, durationMs: Date.now() - start, status: hub.status };
}
```
## Recommendations (Do Now)

These are the immediate documentation-level decisions to lock before implementation:

1. **Adopt FlowRuntime as canonical runtime** (Harness deprecated).\n
2. **Edge-level routing**: `when` moves to edges, readiness rules defined.\n
3. **Policy enforcement**: FlowPolicy + NodePolicy are runtime behaviors.\n
4. **Agent standardization**: all agent nodes are stateful, injectable, and emit tool events.\n
5. **Channels are external**: attached at runtime, not declared in FlowSpec.\n
6. **Canonical node catalog** published and versioned.\n

## Approved Utility Libraries

Use small, focused libraries for runtime mechanics (not workflow semantics):

- `p-timeout` for timeout enforcement
- `p-retry` for retry/backoff
- `p-limit` for parallel scheduling (optional)

## Spec Readiness (Do We Have Detailed Specs?)

**Short answer**: We have **draft specs** for the overall architecture, routing, runtime, and node catalog in this spec folder, but we **do not yet have fully detailed, test-ready specs** for several critical behaviors.

### What is already specified (draft-level)
- FlowRuntime lifecycle + inbox routing\n
- Edge-level `when` routing semantics\n
- Policy types (FlowPolicy / NodePolicy)\n
- Node catalog + baseline schemas\n
- Channel attachment semantics (outside FlowSpec)\n

### What is still missing for implementation-grade detail
1. **Edge readiness algorithm** (exact state machine):\n
   - How to track fired/skipped edges across parallel execution.\n
   - Merge semantics for `control.merge` in both `all` and `any` modes.\n
2. **Error marker schema** for `continueOnError`:\n
   - Standard output shape (e.g., `{ error, failed, output? }`).\n
3. **Retry + timeout precedence**:\n
   - Order of operations and how timeouts interact with retries.\n
4. **Agent config pass-through**:\n
   - Allowed config surface and validation schema.\n
5. **Streaming event contract**:\n
   - Required events and minimal guarantees for streaming nodes.\n
6. **Integration node definitions** (if included):\n
   - Exact schemas and behavior for optional nodes (`http.request`, `file.read`, etc.).\n
7. **Channel lifecycle contract**:\n
   - Ordering of onStart/onComplete hooks and error handling.\n

### Recommendation
Before any code changes, we should add a **“Spec Detail Pack”** containing:\n
- Edge readiness algorithm (step-by-step)\n
- Policy enforcement rules with examples\n
- Error marker schema\n
- Agent config validation schema\n
- Streaming event requirements\n

## Testing Requirements (Must Follow Canonical Test Spec Format)

All new components introduced by this refactor **must** have `.test-spec.md` files following the canonical template from:\n
- `packages/kernel/docs/testing/test-spec-template.md`\n
\n
A copy is included here for convenience:\n
- `specs/ready/015-flow-only-architecture/testing/test-spec-template.md`\n
\n
Initial test specs required:\n
- `flow-runtime.test-spec.md`\n
- `edge-routing.test-spec.md`\n
- `policy-enforcement.test-spec.md`\n
- `agent-nodes.test-spec.md`\n
