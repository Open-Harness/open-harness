# Change Outline: V2 SDK Migration

**Date**: 2026-01-01
**Scope**: Phase 4 unblock + architectural simplification

---

## Summary of Changes

### Removals (Less Code)
- Delete `AgentInbox` interface
- Delete `AgentInboxImpl` class
- Delete `InjectedMessage` type
- Delete `promptStream()` function
- Delete `messageStream()` function
- Remove inbox-related code from executor

### Additions
- Add `session:message` event type
- Add V2 SDK integration in provider
- Add message subscription pattern in agent nodes

### Modifications
- `sendToRun()` implementation changes
- `AgentExecuteContext` simplifies
- Claude provider complete rewrite
- `claude.agent` node rewrite

---

## Detailed Change Map

### 1. Spec Documents

#### `specs/ready/015-flow-only-architecture/spec.md`

**Line 152** - Remove prohibition:
```diff
- - **Prohibited**: any `unstable_v2_*` APIs.
+ - **Required**: Use `unstable_v2_createSession()` and session-based send/receive pattern.
```

**Lines 154-157** - Update async iterable section:
```diff
- ### Async iterable input (agent nodes)
- - Agent nodes must accept async-iterable prompts for multi-turn support.
- - The prompt stream must yield initial messages, then yield new user messages from `AgentInbox`.
- - Streaming must use the SDK `SDKUserMessage` shape (see Flow Runtime doc).
+ ### Session-based multi-turn (agent nodes)
+ - Agent nodes use V2 SDK session pattern.
+ - Each turn is a `session.send()` followed by consuming `session.receive()`.
+ - Multi-turn: agent subscribes to Hub events for `session:message` with matching `runId`.
+ - No async iterable input required.
```

**Lines 165-168** - Update termination rules:
```diff
- ### Multi-turn termination rules
- - Session-like agent nodes must stop on any of:
-   - `maxTurns`
-   - explicit close of the prompt stream (e.g., `inbox.close()`)
- - Flow runtime must never hang awaiting inbox input.
+ ### Multi-turn termination rules
+ - Session-like agent nodes terminate when:
+   - No more `session:message` events arrive within timeout
+   - `session.close()` is called explicitly
+   - SDK `maxTurns` limit is reached
+ - Agent unsubscribes from Hub on completion (no hanging).
```

#### `specs/ready/015-flow-only-architecture/manifest.md`

**Lines 206-211** (Phase 4 Deliverables) - Update:
```diff
- Deliverables
-   - Claude adapter using `@anthropic-ai/claude-agent-sdk` query()
-   - Async prompt stream with inbox injection
+ Deliverables
+   - Claude adapter using V2 SDK: `unstable_v2_createSession()`
+   - Session-based send/receive pattern
    - Agent event emission (`agent:*`, `agent:tool:*`)
    - Unit + replay tests + fixtures
    - Live script: `scripts/live/flow-agent-nodes-live.ts`
    - Tutorials: Lesson 06 (PromptFile + Claude) and Lesson 09 (Multi-Turn)
```

**Lines 222-225** (Phase 4 Acceptance) - Update:
```diff
- Acceptance Criteria
-   - Agent nodes always receive inbox
-   - runId fresh per invocation
-   - Multi-turn termination rules enforced
+ Acceptance Criteria
+   - Agent nodes use V2 session pattern
+   - runId fresh per invocation
+   - Multi-turn via Hub event subscription
+   - Clean session termination (no hangs)
    - Lessons 06 and 09 pass
```

---

### 2. Protocol Layer

#### `packages/kernel/src/protocol/agent.ts`

**Remove** AgentInbox interface:
```diff
- export interface AgentInbox extends AsyncIterable<InjectedMessage> {
-   pop(): Promise<InjectedMessage>;
-   drain(): InjectedMessage[];
-   close(): void;
- }
-
- export interface InjectedMessage {
-   content: string;
-   timestamp: Date;
- }
```

**Simplify** AgentExecuteContext:
```diff
  export interface AgentExecuteContext {
    hub: Hub;
-   inbox: AgentInbox;
    runId: string;
  }
```

#### `packages/kernel/src/protocol/events.ts`

**Add** session:message event type if not present:
```typescript
export interface SessionMessageEvent {
  type: "session:message";
  content: string;
  runId?: string;      // Target specific agent run
  agentName?: string;  // Target by agent name
}
```

---

### 3. Engine Layer

#### `packages/kernel/src/engine/inbox.ts`

**DELETE ENTIRE FILE**

#### `packages/kernel/src/engine/index.ts`

**Remove** inbox exports:
```diff
  export * from "./hub.ts";
  export * from "./events.ts";
- export * from "./inbox.ts";
```

#### `packages/kernel/src/engine/hub.ts`

**Modify** sendToRun to emit event:
```diff
  sendToRun(runId: string, message: string): void {
    if (!this._sessionActive) return;
-   // Old: push to inbox map
-   this._inboxes.get(runId)?.push(message);
+   // New: emit event
+   this.emit({
+     type: "session:message",
+     content: message,
+     runId,
+   });
  }
```

**Remove** inbox map if present:
```diff
- private readonly _inboxes = new Map<string, AgentInboxImpl>();
```

---

### 4. Provider Layer

#### `packages/kernel/src/providers/claude.ts`

**COMPLETE REWRITE**

Before (V1 pattern):
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

async function* messageStream(...): AsyncGenerator<SDKUserMessage> {
  for (const message of messages) {
    yield toUserMessage(message, sessionId);
  }
}

const queryStream = query({
  prompt: messageStream(...),
  options: mergedOptions,
});
```

After (V2 pattern):
```typescript
import {
  unstable_v2_createSession,
  unstable_v2_resumeSession
} from "@anthropic-ai/claude-agent-sdk";

export function createClaudeAgent(options?: ClaudeAgentAdapterOptions): AgentDefinition<ClaudeAgentInput, ClaudeAgentOutput> {
  return {
    name: "claude",
    async execute(input, ctx) {
      // Create or resume session
      const session = input.resumeSessionId
        ? unstable_v2_resumeSession(input.resumeSessionId, mergedOptions)
        : unstable_v2_createSession(mergedOptions);

      try {
        // Initial turn
        await session.send(input.prompt);
        const result = await processReceive(session, ctx.hub);

        // Multi-turn: subscribe to session:message events
        if (input.multiTurn) {
          const unsubscribe = ctx.hub.subscribe(
            `session:message`,
            async (event) => {
              if (event.runId === ctx.runId) {
                await session.send(event.content);
                await processReceive(session, ctx.hub);
              }
            }
          );

          // Wait for completion signal or timeout
          await waitForCompletion(ctx, input.timeout);
          unsubscribe();
        }

        return result;
      } finally {
        session.close();
      }
    }
  };
}

async function processReceive(session: Session, hub: Hub): Promise<ClaudeAgentOutput> {
  let result: ClaudeAgentOutput;

  for await (const msg of session.receive()) {
    // Emit appropriate events
    if (msg.type === "assistant") {
      hub.emit({ type: "agent:text", text: extractText(msg) });
    }
    if (msg.type === "result") {
      result = toOutput(msg);
    }
  }

  return result!;
}
```

---

### 5. Flow Layer

#### `packages/kernel/src/flow/nodes/claude.agent.ts`

**Modify** to use new provider pattern:
```diff
  export const claudeAgentNode: NodeTypeDefinition<ClaudeAgentInput, ClaudeAgentOutput> = {
    type: "claude.agent",
    inputSchema: ClaudeAgentInputSchema,
    outputSchema: ClaudeAgentOutputSchema,
    capabilities: {
      isStreaming: true,
-     supportsInbox: false,  // Was incorrectly false
+     supportsMultiTurn: true,
    },
    async run(ctx, input) {
      const agent = createClaudeAgent(options);
      return await agent.execute(input, {
        hub: ctx.hub,
-       inbox: ctx.inbox ?? new AgentInboxImpl(),
        runId: ctx.runId,
      });
    },
  };
```

#### `packages/kernel/src/flow/executor.ts`

**Remove** inbox creation:
```diff
  async function runNode(node: NodeSpec, def: NodeTypeDefinition, ctx: FlowExecutionContext, ...) {
    const runId = createRunId(node.id);
-   const inbox = def.capabilities?.supportsInbox ? new AgentInboxImpl() : undefined;
-   if (inbox) runInboxes.set(runId, inbox);

    const result = await def.run({
      hub: ctx.hub,
      runId,
-     inbox,
    }, input);

    return result;
  }
```

---

### 6. Documentation

#### `packages/kernel/docs/spec/agent.md`

**REWRITE** sections 39-101

New content:
```markdown
## Execute context

\`\`\`typescript
interface AgentExecuteContext {
  hub: Hub;
  runId: string;
}
\`\`\`

### `hub`

The hub for emitting events and subscribing to messages.

### `runId`

Unique ID for this agent execution. Used for:
- Emitting agent events with proper context
- Subscribing to `session:message` events targeted at this run

## Multi-turn pattern (V2 SDK)

Multi-turn agents use the session-based send/receive pattern:

\`\`\`typescript
import { unstable_v2_createSession } from "@anthropic-ai/claude-agent-sdk";

async function execute(input: AgentInput, ctx: AgentExecuteContext): Promise<AgentOutput> {
  const session = unstable_v2_createSession({ model: input.model });

  try {
    // Initial turn
    await session.send(input.prompt);
    await emitResponses(session, ctx.hub);

    // Listen for injected messages
    const unsub = ctx.hub.subscribe("session:message", async (event) => {
      if (event.runId === ctx.runId) {
        await session.send(event.content);
        await emitResponses(session, ctx.hub);
      }
    });

    // Wait for completion
    await waitForDone();
    unsub();

    return result;
  } finally {
    session.close();
  }
}
\`\`\`

## Message injection

External code (channels, tests) injects messages via Hub:

\`\`\`typescript
hub.sendToRun(runId, "user message");
\`\`\`

This emits a `session:message` event. The agent's subscription receives it.

## Key invariants

1. **Agents emit events via hub**
2. **Messages arrive via hub events** (no separate inbox)
3. **runId is the routing key** for targeted messages
4. **Sessions are V2 SDK sessions** with send/receive pattern
```

#### `packages/kernel/docs/spec/hub.md`

**Modify** sendToRun documentation (lines 77-80):
```diff
  ### `sendToRun(runId, message)`

- **Correct** run-scoped injection when multiple agent runs may be active. The `runId` is provided by `agent:start` / `agent:complete` events. Emits `session:message` with `runId`.
+ Run-scoped message injection. Emits a `session:message` event with the `runId`.
+ Agents subscribe to this event type to receive injected messages.
+
+ \`\`\`typescript
+ // Implementation
+ sendToRun(runId: string, message: string): void {
+   this.emit({ type: "session:message", content: message, runId });
+ }
+ \`\`\`
```

---

### 7. Tutorials

#### `specs/ready/015-flow-only-architecture/tutorials/lesson-09-claude-multiturn.tutorial-spec.md`

**REWRITE** for V2 pattern - expected output and test assertions need updating.

Key changes:
- No `inbox.close()` references
- Uses `session.send()`/`session.receive()` pattern
- `sendToRun` still works (emits event now)
- Clean termination via session close

#### `specs/ready/015-flow-only-architecture/tutorials/lesson-06-promptfile-claude.tutorial-spec.md`

**REVIEW** - may need minor updates for V2 if it uses Claude provider directly.

---

### 8. Tests

#### Files to update

| Test File | Changes |
|-----------|---------|
| `tests/unit/inbox.test.ts` | DELETE |
| `tests/replay/providers/claude.agent.test.ts` | Update for V2 pattern |
| `tests/fixtures/golden/flow/*` | May need new fixtures for V2 |

#### New test coverage needed

- V2 session create/close
- Multi-turn via Hub subscription
- sendToRun → event emission
- Clean termination without hangs

---

## Implementation Checklist

### Phase A: Spec Updates (Do First)
- [ ] Update spec.md: Remove V2 prohibition
- [ ] Update spec.md: Document session pattern
- [ ] Update spec.md: Remove inbox references
- [ ] Update manifest.md: Phase 4 deliverables
- [ ] Update agent.md: Rewrite for V2
- [ ] Update hub.md: Document event-based sendToRun

### Phase B: Core Changes
- [ ] Modify hub.ts: sendToRun emits event
- [ ] Add session:message event type
- [ ] Simplify AgentExecuteContext (remove inbox)
- [ ] Delete inbox.ts

### Phase C: Provider Rewrite
- [ ] Rewrite providers/claude.ts for V2
- [ ] Update claude.agent node
- [ ] Update executor (remove inbox creation)

### Phase D: Test Updates
- [ ] Delete inbox tests
- [ ] Add V2 session tests
- [ ] Update Claude agent tests
- [ ] Create new replay fixtures

### Phase E: Tutorial Validation
- [ ] Rewrite lesson-09 spec
- [ ] Review lesson-06 spec
- [ ] Run tutorial gates
- [ ] Verify no hangs

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| V2 API instability | Accept for now; wrap if patterns break |
| Event ordering | Test thoroughly with replay fixtures |
| Memory leaks (unsubscribe) | Always unsubscribe in finally blocks |
| OpenCode compatibility | Verify OpenCode can use same Hub pattern |

---

## Success Criteria

1. **Lessons 06 and 09 pass** with new implementation
2. **No hangs** on multi-turn termination
3. **Less code** than before (inbox deleted)
4. **Single mental model** - everything is Hub events
5. **External API unchanged** - sendToRun still works
