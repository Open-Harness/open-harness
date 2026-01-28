# Next Iteration: Audit Findings & Design Direction

**Date:** 2026-01-28
**Context:** Post-migration audit of the state-first runtime (impl/codex branch).

---

## Part 1: Audit Findings

### Bugs

#### 1. TUI blanks after completion, process hangs

- **Location:** `apps/cli/src/ui/App.tsx:57-63`, `apps/cli/src/commands/run-tui.tsx:36-38`
- **Behavior:** After `isComplete` becomes true, a 2-second timer fires `onComplete()` which calls `root.unmount()`, destroying the entire React tree. The terminal goes blank. The process hangs because `server.stop()` is never called after unmount.
- **Impact:** In replay mode, all events load instantly from history, so the screen blanks within ~2 seconds of connecting. In live mode, the API call buys time but the blank still occurs.
- **Fix direction:** Don't auto-unmount. Show a "completed" state with the full event feed visible. Let the user quit with `q`/`Escape` which already works (App.tsx:94-97). The `onComplete` callback should trigger process exit, not unmount.

#### 2. WorkflowBanner reads wrong field name

- **Location:** `apps/cli/src/ui/screens/EventFeed.tsx:56`
- **Behavior:** Reads `payload.workflow` but the actual `WorkflowStartedPayload` has `workflowName`. The banner always shows the fallback string "workflow" instead of the actual name like "hello-world".
- **Fix:** Change `payload.workflow` to `payload.workflowName`.

#### 3. Agent events were not persisted to EventStore (FIXED)

- **Location:** `packages/core/src/Next/runtime.ts:242-280`
- **Behavior (before fix):** `executeAgent()` only stored agent events (`agent:started`, `text:delta`, `tool:called`, `tool:result`, `agent:completed`) in memory. Only workflow-level events (`state:updated`, `workflow:started/completed`, `phase:entered/exited`) were persisted via `emitEvent()` which calls `store.append()`.
- **Fix applied:** Added `store.append()` and `bus.publish()` calls for agent events inside `executeAgent()`. Sessions recorded after this fix contain all events (20 vs 4 previously).
- **Consequence:** Any database recorded before this fix only has 4 events. Re-record to get full event set.

### Gaps

#### 4. WorkflowObserver missing granular agent callbacks

The `WorkflowObserver<S>` interface (types.ts:822-833) has:
- `agentStarted`, `agentCompleted` — agent lifecycle
- `streamed` — text and thinking deltas
- `event` — generic catch-all

Missing dedicated callbacks:
- `toolCalled?(info: { agent: string; tool: string; args: unknown }): void`
- `toolResult?(info: { agent: string; tool: string; result: unknown; isError: boolean }): void`

Consumers relying on the observer pattern can't easily react to tool lifecycle events without parsing the generic `event()` callback.

#### 5. SSE race condition on session creation

- **Location:** `packages/server/src/http/Routes.ts:84-118`, `packages/server/src/programs/observeEvents.ts:43-77`
- **Behavior:** POST /sessions forks the workflow fiber, returns sessionId immediately. Client then connects to GET /sessions/:id/events. If events fire between fork and SSE subscribe, they're lost from the live PubSub stream.
- **Mitigation exists:** `?history=true` query parameter loads from EventStore before switching to live. The TUI uses this for replay (`includeHistory: isReplay`), but NOT for live mode.
- **Fix direction:** Always include history on initial SSE connection, or use a sequence-based subscription model.

#### 6. Headless mode doesn't exit cleanly

- **Location:** `apps/cli/src/commands/run.tsx`
- **Behavior:** After workflow completes and SSE emits `[DONE]`, the fetch reader loop exits but the server keeps running. Process hangs and requires Ctrl+C.
- **Fix direction:** After SSE stream ends, call `server.stop()` and `scaffold.dispose()`.

### Verified Working

- **Full pipeline is clean:** Database → Server SSE → Client parsing → EventFeed rendering. No events are filtered or lost at any stage. All event types (`tool:called`, `tool:result`, `text:delta`, `thinking:delta`, `agent:started`, `agent:completed`) pass through unchanged when properly persisted.
- **Live mode (headless):** Records all 20 events to SQLite correctly.
- **Replay mode (headless):** Replays all 20 events identically.
- **TUI rendering:** All components render correctly when events are present — Header, Footer, WorkflowBanner, AgentLifecycle, ToolCall, TextBlock, ThinkingBlock.
- **ProviderRecorder:** Incremental recording (crash-safe) works end-to-end.

---

## Part 2: Feature Gaps

### 7. Replay VCR Controls

Replay mode currently dumps all events instantly with no user control. Needs full VCR implementation:

- **Step controls:** Forward/backward by single event
- **Jump by type:** Next tool call, next agent, next phase, next state update
- **Play/Pause:** Auto-play at configurable speed with pause
- **Timeline scrubber:** Visual position indicator showing current event in timeline
- **Speed control:** 0.5x, 1x, 2x, 5x playback speed
- **Different keybinds:** Replay mode footer should show VCR controls, not live mode keybinds

This is critical for debugging workflow behavior — stepping through agent reasoning, seeing how state evolves at each tool call, understanding phase transitions.

### 8. Additional Provider Support

Currently only AnthropicProvider exists. Need at minimum:
- OpenAI provider (GPT-4o, o1, o3)
- Standardized provider interface for community providers

This is prerequisite for model comparison benchmarking (Part 3).

---

## Part 3: Eval & Benchmark System

### The Core Insight

The scaffold matters, but **the prompt is the biggest leverage point**. Understanding how prompt changes affect agent behavior, quality, and cost is the key to building effective long-running agents. OpenScaffold already records everything — the eval system is a consumer of that recording infrastructure plus a scoring layer.

### Three Layers

#### Layer 1: Debugging (fix what's broken)

What exists: Replay mode, EventStore, TUI.
What's broken: Auto-unmount, field name mismatches, missing VCR controls.
Goal: A developer can replay any session and step through it event by event to understand what happened.

#### Layer 2: Regression Testing (formalize what exists)

What exists: ProviderRecorder with hash-based record/playback.
What's needed: A test harness that records golden runs, commits fixtures to the repo, and replays in CI. If the output changes (different state, different tool calls, different agent behavior), the test fails.

Pattern:
```typescript
// Record once (live mode)
const result = await run(workflow, { input: "Build REST API", mode: "live" })
// Commit result.recording to fixtures/

// Replay in CI (playback mode)
const replayed = await run(workflow, { input: "Build REST API", mode: "playback" })
assert.deepEqual(replayed.state, expectedState)
```

This is already possible with `createTestRuntimeLayer` — it just needs to be documented and formalized.

#### Layer 3: Prompt Engineering Lab (the new thing)

The big idea: Run the same workflow N times with controlled variables and systematically measure the impact of changes.

**Variables to control:**
- Prompt text (the primary lever)
- Model (claude-haiku-4-5, claude-sonnet-4-5, claude-opus-4-5, gpt-4o, etc.)
- Provider (Anthropic, OpenAI, etc.)
- Temperature / sampling parameters
- Workflow structure (phase ordering, agent composition)

**Metrics to capture (from recordings):**
- Task completion (did the workflow reach the terminal state?)
- Output quality (LLM-as-judge scoring)
- Consistency (pass@k across N runs)
- Cost (token usage × model pricing)
- Latency (timestamp deltas from event stream)
- Tool efficiency (number of tool calls, redundant calls)
- Reasoning quality (thinking block analysis)

**What the eval runner looks like:**

```typescript
// Define an eval suite
const suite = eval({
  name: "greeting-prompt-comparison",
  workflow: helloWorldWorkflow,

  // Matrix of variables to test
  matrix: {
    prompt: [promptV1, promptV2, promptV3],
    model: ["claude-haiku-4-5", "claude-sonnet-4-5"],
  },

  // Number of runs per combination
  runs: 10,

  // Scoring functions applied to each recording
  scorers: [
    // Programmatic: check if greeting contains the user's name
    (recording) => recording.finalState.greeting.includes("hello") ? 1 : 0,

    // LLM-as-judge: rate greeting quality 1-5
    llmJudge({
      criteria: "warmth, personalization, and naturalness",
      scale: { 1: "robotic", 3: "adequate", 5: "delightful" },
    }),

    // Built-in: cost, latency, token count
    builtinCost(),
    builtinLatency(),
    builtinTokens(),
  ],
})

// Run and get report
const report = await suite.run()
// report.table() → matrix of scores by prompt × model
// report.compare("promptV1", "promptV2") → statistical diff
// report.export("csv") → for external analysis
```

**Key design decisions:**

1. **Not Vitest bench.** Vitest bench is timing-focused (ops/sec, percentiles). Eval scoring is multi-dimensional (quality, cost, latency, consistency). Different problem, different tool.

2. **Recordings are the dataset.** Every eval run produces a full EventStore recording. Recordings are the ground truth — you can re-score them later with new scoring functions without re-running the workflow.

3. **LLM-as-judge for quality.** Use categorical integer scoring (1-5) with clear rubrics. Decompose into criteria (factual accuracy, tone, completeness). Use chain-of-thought reasoning before scoring. See research on G-Eval pattern.

4. **Prompt is first-class.** The eval runner should make it trivial to swap prompts. The `AgentDef.prompt` function is already a pure function of state — parameterizing it for eval variations should be straightforward.

5. **Statistical rigor.** N≥10 runs per combination. Report mean, standard deviation, and confidence intervals. Use pass@k to measure consistency (a model that passes 9/10 is better than one that passes 10/10 but fails catastrophically on edge cases).

### Industry Landscape (2026)

The research shows convergence around these patterns:

| Pattern | Who Uses It | Our Equivalent |
|---------|-------------|----------------|
| Record-and-replay | Docker Cagent, VCR.py, LangChain | ProviderRecorder |
| Event sourcing / traces | Phoenix, Weave, LangSmith | EventStore |
| LLM-as-judge | Braintrust, DeepEval, everyone | (build on top) |
| Prompt A/B testing | Braintrust, Promptfoo, LangSmith | (build on top) |
| Cost tracking | Langfuse, Portkey, Braintrust | (parse from events) |
| CI integration | Braintrust (GitHub Actions), Promptfoo | (Vitest + playback) |

We already have the hard part (recording infrastructure). The eval layer is scoring + comparison + reporting on top of recordings.

### What NOT to Build

- **Not a SaaS dashboard.** Keep it CLI-first, file-based, Git-friendly.
- **Not Vitest extensions.** Evals aren't tests. Different runner, different reporting.
- **Not mock providers.** Real recordings, real API responses, always.
- **Not a custom tracing system.** EventStore IS the trace system.

---

## Part 4: Priority Order

### Immediate (fix what's broken)

1. Fix TUI blank screen (remove auto-unmount, add proper exit)
2. Fix WorkflowBanner field name mismatch
3. Fix headless mode clean exit
4. Fix SSE race condition (always include history on first connect)

### Short-term (complete the developer experience)

5. Add `toolCalled` and `toolResult` to WorkflowObserver
6. Implement replay VCR controls (step, jump, play/pause, speed)
7. Add OpenAI provider

### Medium-term (eval system)

8. Design eval runner API (suite, matrix, scorers, report)
9. Implement LLM-as-judge scorer
10. Implement built-in scorers (cost, latency, tokens, consistency)
11. Build comparison/reporting layer
12. Add prompt parameterization to AgentDef
