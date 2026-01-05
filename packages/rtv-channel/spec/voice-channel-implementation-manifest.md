# Voice Channel Production Plan (Manifest)

This is the end-to-end implementation plan to make the voice channel production‑grade, with automated testing that does **not** require Anthropic nodes or a full flow. Each phase includes a concrete integration, concrete tests, and a handoff checklist that runs lint + typecheck.

---

## Goals

- Production‑grade voice channel as a **generic workflow interface**.
- Push‑to‑talk MVP (no VAD exposed by channel).
- Explicit state model + reducer strategy.
- Tool surface derived from **Hub commands** (no invented APIs).
- Automated validation with **real integration** (no fake WS), plus optional live OpenAI tests.
- Documentation + tutorials so others can build channels.

## Non‑Goals (for MVP)

- VAD mode UI (kept in transport class only).
- Full flow orchestration with external provider nodes.
- Complex tool‑call orchestration (only surface tool events + hub commands).

---

## Testing Options Without Full Flow

### Chosen: Option B — Real FlowSpec + Custom Mock Node (60s runs)
We will run a **real FlowSpec** through the Flow runtime with a **custom node type** (mock agent) that emits realistic agent events over **~60 seconds** per run.

**What’s real:**
- FlowSpec parsing + validation
- Flow runtime execution
- Hub event envelopes
- Channel attachments

**What’s simulated:**
- The model/provider (mock agent emits realistic events and timing)

**Behavior contract (every run):**
- Emits `agent:thinking`, `agent:text`, `agent:tool:start`, `agent:tool:complete`
- Emits in a 60s timeline (staggered, async, realistic pacing)
- Includes tasks + phases so UI can render progress

### Supplement: Live Realtime Validation (OpenAI)
Run a **live** script that connects to the Realtime API, sends a tiny PCM sample, and asserts assistant audio/text arrives. This is the closest to production behavior.

**Use when:** API key is available and you want true end‑to‑end confirmation.

---

## Phase 0 — Baseline & Spec Alignment

**Objective:** Lock MVP scope, state model, and tool surface in docs before code changes.

Tasks
- [ ] Confirm push‑to‑talk only in channel (VAD remains in transport class).
- [ ] Define the canonical **VoiceChannelState** in docs (derived from `voice-channel-architecture.md`).
- [ ] Define the **tool surface** in docs as a wrapper over Hub commands.
- [ ] Add a short “State Strategy” section to voice channel docs.

Concrete integration
- [ ] Add a “state reducer example” snippet to docs using real event types.

Concrete test
- [ ] Add/verify a doc‑only example for state transitions (phase/task/agent events).

Handoff checklist
- [ ] `cd packages/rtv-channel && bun run lint`
- [ ] `cd packages/rtv-channel && bun run typecheck`
- [ ] `cd packages/rtv-channel && bun test`

---

## Phase 1 — State Model + Reducer (Code)

**Objective:** Implement state model and reducer logic in code (deterministic, testable).

Tasks
- [ ] Create `src/channel/state.ts` with `VoiceChannelState` type.
- [ ] Implement `reduceVoiceState(state, event)` reducer.
- [ ] Implement rolling window + summary strategy (trim + summarize).
- [ ] Add explicit mapping from `agent:*`, `phase:*`, `task:*`, `session:*`, `voice:*`.

Concrete integration
- [ ] Provide a small runner that feeds a real sequence of events into the reducer.

Concrete test
- [ ] Unit tests for reducer transitions (no WS, no OpenAI, pure logic).

Handoff checklist
- [ ] `cd packages/rtv-channel && bun run lint`
- [ ] `cd packages/rtv-channel && bun run typecheck`
- [ ] `cd packages/rtv-channel && bun test`

---

## Phase 2 — Channel Wiring + Tools

**Objective:** Wire reducer into channels and expose a minimal tool surface.

Tasks
- [ ] Create `createChannelTools(hub, getState)` that exposes Hub commands + state getter.
- [ ] Update `ConsoleVoiceChannel` to render from reduced state rather than raw events.
- [ ] Update `RealtimeVoiceChannel` to emit status events derived from reducer + service state.
- [ ] Ensure `voice:*` events include the curated status line.

Concrete integration
- [ ] Attach both channels to a hub and verify:
  - Reducer updates state on workflow events
  - UI reflects run/phase/task/agent updates
  - Tools call into Hub (send/reply/abort)

Concrete test
- [ ] Integration test that attaches both channels to a **real Hub** (see Phase 3).

Handoff checklist
- [ ] `cd packages/rtv-channel && bun run lint`
- [ ] `cd packages/rtv-channel && bun run typecheck`
- [ ] `cd packages/rtv-channel && bun test`

---

## Phase 3 — Real FlowSpec + Mock Agent Node (No Anthropic Nodes)

**Objective:** Run a **real flow** through the Flow runtime using a custom mock agent node that emits realistic events over ~60s.

### Draft Design — FlowSpec + Mock Node

**FlowSpec (voice‑mock flow):**
- `name`: `voice-mock`
- `nodes`:
  - `phase_boot` (mock.phase) — emits `phase:start`/`phase:complete`
  - `task_prepare` (mock.task) — emits `task:start`/`task:complete`
  - `agent_main` (mock.agent) — emits agent text/thinking/tool events
  - `task_finalize` (mock.task) — emits `task:start`/`task:complete`
  - `phase_wrap` (mock.phase) — emits `phase:start`/`phase:complete`
- `edges`:
  - `phase_boot → task_prepare → agent_main → task_finalize → phase_wrap`

**Mock Node Types:**

1) `mock.phase`
```ts
input: { name: string; durationMs: number }
behavior:
  emit phase:start(name)
  wait durationMs
  emit phase:complete(name)
```

2) `mock.task`
```ts
input: { id: string; label: string; durationMs: number }
behavior:
  emit task:start(taskId=id)
  wait durationMs
  emit task:complete(taskId=id)
```

3) `mock.agent`
```ts
input: {
  agentName: string;
  runId: string;
  timeline: Array<{
    atMs: number;
    type: "thinking" | "text" | "tool_start" | "tool_complete";
    content?: string;
    toolName?: string;
    payload?: unknown;
  }>;
}
behavior:
  emit agent:start(agentName, runId)
  for each timeline entry:
    wait (atMs - elapsed)
    emit event:
      - agent:thinking { content }
      - agent:text { content }
      - agent:tool:start { toolName, input: payload }
      - agent:tool:complete { toolName, result: payload }
  emit agent:complete { agentName, success: true, runId }
```

**Timeline (60s, deterministic, every run):**
- 0s: agent:start
- 2s: agent:thinking (“Planning next steps…”)
- 6s: agent:tool:start (toolName: `search_events`, input: `{ query: "recent tasks" }`)
- 10s: agent:tool:complete (result: `{ hits: 3 }`)
- 16s: agent:thinking (“Interpreting results…")
- 24s: agent:text (“Found 3 relevant items, drafting response.”)
- 36s: agent:tool:start (toolName: `summarize_recent`, input: `{ window: 25 }`)
- 40s: agent:tool:complete (result: `{ summary: "Condensed summary…" }`)
- 52s: agent:text (“Summary ready. Awaiting confirmation.”)
- 60s: agent:complete

**Notes:**
- All events include deterministic timestamps (based on start time + offset).
- The mock agent emits tool events **every run**.
- The flow includes explicit phase/task events to exercise UI state changes.

Tasks
- [ ] Create a `mock.agent` NodeType that emits:
  - `agent:thinking`, `agent:text`
  - `agent:tool:start`, `agent:tool:complete`
  - paced over ~60s (deterministic schedule per run)
- [ ] Create a FlowSpec that includes:
  - phases and tasks (async delays)
  - the `mock.agent` node
  - a realistic sequence of events for the voice UI to render
- [ ] Attach both channels and verify:
  - UI state changes over time
  - voice events emitted (status + notices)
  - tool events appear in the stream every run

Concrete integration
- [ ] `scripts/integration/voice-flow-mock.ts` that runs FlowRuntime with the custom node.

Concrete test
- [ ] `bun run scripts/integration/voice-flow-mock.ts` (60s run, no network).

Handoff checklist
- [ ] `cd packages/rtv-channel && bun run lint`
- [ ] `cd packages/rtv-channel && bun run typecheck`
- [ ] `cd packages/rtv-channel && bun test`

---

## Phase 4 — Live Realtime Validation (OpenAI)

**Objective:** Validate real OpenAI Realtime behavior end‑to‑end.

Tasks
- [ ] Add `scripts/live/voice-realtime-live.ts`:
  - Connects to OpenAI Realtime WS
  - Sends fixed PCM sample (from file)
  - Waits for assistant audio/text
  - Fails with timeout if none received
- [ ] Add `voice-realtime.pcm` fixture (>= 100ms of PCM16LE)

Concrete integration
- [ ] `OPENAI_API_KEY=... bun run scripts/live/voice-realtime-live.ts`

Concrete test
- [ ] Live test passes and logs summary.

Handoff checklist
- [ ] `cd packages/rtv-channel && bun run lint`
- [ ] `cd packages/rtv-channel && bun run typecheck`
- [ ] `cd packages/rtv-channel && bun test`
- [ ] (manual) live script passes with real key

---

## Phase 5 — Documentation & Tutorials

**Objective:** Make it easy for others to build channels and connectors.

Tasks
- [ ] Update `spec/voice-channel.md` with:
  - Channel purpose
  - State model
  - Tool surface
- [ ] Expand `spec/channel-tutorial.md` with:
  - “Build your own channel” step‑by‑step
  - “Testing your channel” section
- [ ] Add `spec/testing-voice-channel.md` with test tiers:
  - Unit (reducer)
  - Integration (kernel harness)
  - Live (OpenAI)

Concrete integration
- [ ] Document the integration script usage and expected output.

Concrete test
- [ ] Run all scripts once and capture success criteria in docs.

Handoff checklist
- [ ] `cd packages/rtv-channel && bun run lint`
- [ ] `cd packages/rtv-channel && bun run typecheck`
- [ ] `cd packages/rtv-channel && bun test`

---

## Phase 6 — Stability & Regression

**Objective:** Make regression testing fast and repeatable.

Tasks
- [ ] Add `bun run test:integration` script to execute harness integration.
- [ ] Add `bun run test:live` script (optional, requires key).
- [ ] Set timeouts for all tests (<= 30s for live).

Concrete integration
- [ ] CI‑style run of unit + integration suite without network.

Concrete test
- [ ] All local tests pass with no manual intervention.

Handoff checklist
- [ ] `cd packages/rtv-channel && bun run lint`
- [ ] `cd packages/rtv-channel && bun run typecheck`
- [ ] `cd packages/rtv-channel && bun test`

---

## Final Acceptance Criteria

- Voice channel integrates with a real Hub and a scripted workflow event stream.
- UI reflects workflow state via curated reducer.
- Tool surface is defined and maps only to Hub commands.
- Live Realtime validation passes with real audio.
- Docs/tutorials make it easy to build a new channel.
