# Feature Design: Interactive Sessions

**Status**: Ready (pending 007-fluent-harness-dx completion)
**Created**: 2025-12-27
**Depends On**: 007-fluent-harness-dx (must complete first)
**Input**: User feedback: "Workflows run for hours. Need to inject messages mid-execution, get user approval, gracefully abort."

## Summary

Add `startSession()` API to harnesses for interactive, long-running workflows. Enables human-in-the-loop approval flows, mid-execution message injection, and graceful abort—while keeping the simple `run()` API unchanged.

## Problem Statement

Current harness execution is fire-and-forget:
- `run()` starts execution and returns a Promise
- No way to inject user messages mid-execution
- No way to pause for user approval
- No graceful abort mechanism
- Doesn't match reality of multi-hour agentic workflows

The Anthropic Agent SDK supports `query(AsyncIterable)` which allows yielding messages dynamically, but this capability isn't exposed to harness users.

## Solution Overview

Introduce `InteractiveSession` as a first-class concept:

```typescript
// Fire-and-forget (unchanged)
const result = await harness.run();

// Interactive session (NEW)
const session = harness.startSession();
session.on('user:prompt', handlePrompt);
session.send('Change of plans...');
const result = await session.complete();
```

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API strategy | New `startSession()` | Keep `run()` simple, clear separation of concerns |
| Session scope | Wraps harness 1:1 | One session = one harness execution, agents share message queue |
| Blocking prompts | `waitForUser()` | Explicit pause points for HITL approval |
| Non-blocking inject | `send()` | Messages queue up, agent processes when ready |
| Lifecycle | Explicit `abort()`, `complete()` | Long-running sessions need deterministic control |

## API Design

### HarnessInstance Extension

```typescript
interface HarnessInstance<TState, TResult> {
  // Existing (unchanged)
  on<E extends HarnessEventType>(type: E, handler: HarnessEventHandler<E>): this;
  run(): Promise<HarnessResult<TState, TResult>>;
  readonly state: TState;

  // NEW
  startSession(): InteractiveSession<TState, TResult>;
}
```

### InteractiveSession Interface

```typescript
interface InteractiveSession<TState, TResult> extends AsyncIterable<SessionEvent> {
  // Event subscription
  on<E extends SessionEventType>(type: E, handler: SessionEventHandler<E>): this;

  // Control methods
  send(message: string): void;                         // Inject user message
  sendTo(agentName: string, message: string): void;    // Target specific agent
  reply(promptId: string, response: UserResponse): void;  // Answer waitForUser()
  abort(reason?: string): void;                        // Graceful shutdown

  // Lifecycle
  readonly status: SessionStatus;
  complete(): Promise<SessionResult<TState, TResult>>;

  // State access
  readonly state: TState;
}

type SessionStatus = 'running' | 'waiting' | 'paused' | 'complete' | 'aborted';

interface SessionResult<TState, TResult> {
  result: TResult;
  state: TState;
  events: SessionEvent[];
  duration: number;
  aborted: boolean;
  abortReason?: string;
}
```

### ExecuteContext Extension

```typescript
interface ExecuteContext<TAgents, TState> {
  // Existing (from 007)
  agents: ResolvedAgents<TAgents>;
  state: TState;
  phase<T>(name: string, fn: () => Promise<T>): Promise<T>;
  task<T>(id: string, fn: () => Promise<T>): Promise<T>;
  emit(type: string, data: Record<string, unknown>): void;
  retry<T>(name: string, fn: () => Promise<T>, opts?: RetryOptions): Promise<T>;
  parallel<T>(name: string, fns: Array<() => Promise<T>>, opts?: ParallelOptions): Promise<T[]>;

  // NEW: Session-aware methods (only when using startSession())
  session?: SessionContext;
}

interface SessionContext {
  // Block until user responds (emits 'user:prompt' event)
  waitForUser(prompt: string, options?: WaitOptions): Promise<UserResponse>;

  // Check for injected messages (non-blocking)
  hasMessages(): boolean;
  readMessages(): InjectedMessage[];

  // Check if abort was requested
  isAborted(): boolean;
}

interface WaitOptions {
  timeout?: number;           // Max wait time in ms
  choices?: string[];         // Present choices to user
  validator?: (input: string) => boolean | string;
}

interface UserResponse {
  content: string;
  choice?: string;
  timestamp: Date;
}

interface InjectedMessage {
  content: string;
  targetAgent?: string;
  timestamp: Date;
}
```

### New Event Types

```typescript
// Session lifecycle events
interface UserPromptEvent {
  type: 'user:prompt';
  promptId: string;
  prompt: string;
  choices?: string[];
  timestamp: Date;
}

interface UserReplyEvent {
  type: 'user:reply';
  promptId: string;
  response: UserResponse;
  timestamp: Date;
}

interface MessageInjectedEvent {
  type: 'message:injected';
  content: string;
  targetAgent?: string;
  timestamp: Date;
}

interface SessionAbortEvent {
  type: 'session:abort';
  reason?: string;
  timestamp: Date;
}

interface SessionCompleteEvent {
  type: 'session:complete';
  result: unknown;
  duration: number;
  timestamp: Date;
}

type SessionEvent =
  | HarnessEvent  // All existing events
  | UserPromptEvent
  | UserReplyEvent
  | MessageInjectedEvent
  | SessionAbortEvent
  | SessionCompleteEvent;
```

## Usage Examples

### Human-in-the-Loop Approval

```typescript
const workflow = defineHarness({
  name: 'code-review',
  agents: { reviewer: ReviewAgent, fixer: FixerAgent },
  state: (input) => ({ code: input.code, issues: [] }),

  run: async ({ agents, state, session }) => {
    state.issues = await agents.reviewer.analyze(state.code);

    if (session && state.issues.length > 0) {
      const response = await session.waitForUser(
        `Found ${state.issues.length} issues. Fix automatically?`,
        { choices: ['Yes', 'No', 'Review each'] }
      );

      if (response.choice === 'Yes') {
        state.code = await agents.fixer.fix(state.code, state.issues);
      }
    }

    return { code: state.code, issues: state.issues };
  },
});

// Usage
const session = workflow.create({ code }).startSession();

session.on('user:prompt', (e) => {
  console.log(`\n⏳ ${e.prompt}`);
  // UI prompts user, then calls session.reply()
});

const result = await session.complete();
```

### Mid-Execution Injection

```typescript
const session = workflow.create({ task }).startSession();

// User can inject messages anytime
process.stdin.on('data', (data) => {
  const input = data.toString().trim();
  if (input === '/stop') {
    session.abort('User requested stop');
  } else {
    session.send(input);
  }
});

// Inside execute, check for messages
run: async ({ agents, state, session }) => {
  for (const task of state.tasks) {
    if (session?.hasMessages()) {
      const messages = session.readMessages();
      // Incorporate feedback into planning
    }

    if (session?.isAborted()) {
      return { partial: true };
    }

    await processTask(task);
  }
}
```

### Event-Driven UI (for-await)

```typescript
const session = workflow.create(input).startSession();

for await (const event of session) {
  switch (event.type) {
    case 'phase:start':
      ui.showPhase(event.name);
      break;
    case 'user:prompt':
      const answer = await ui.prompt(event.prompt, event.choices);
      session.reply(event.promptId, { content: answer });
      break;
    case 'session:complete':
      ui.showResult(event.result);
      break;
  }
}
```

## Implementation Approach

### Core Components

1. **AsyncQueue<T>**: Standard async iterable queue for message injection
2. **InteractiveSessionImpl**: State machine coordinating events and control
3. **SessionContext**: Execute context extension for session-aware code
4. **SDK Integration**: Merge user message queue with agent async iterable

### SDK Integration Pattern

```typescript
class InteractiveSessionImpl<TState, TResult> {
  private messageQueue = new AsyncQueue<ControlMessage>();
  private userPromptResolvers = new Map<string, (r: UserResponse) => void>();

  send(message: string): void {
    this.messageQueue.push({ type: 'user', content: message });
  }

  reply(promptId: string, response: UserResponse): void {
    this.userPromptResolvers.get(promptId)?.(response);
    this.userPromptResolvers.delete(promptId);
  }

  // Context method
  async waitForUser(prompt: string): Promise<UserResponse> {
    const promptId = crypto.randomUUID();
    this.emit('user:prompt', { promptId, prompt });

    return new Promise((resolve) => {
      this.userPromptResolvers.set(promptId, resolve);
    });
  }

  // Feed to SDK's query()
  private async *inputStream(): AsyncIterable<UserMessage> {
    yield { type: 'user', content: this.initialPrompt };

    for await (const msg of this.messageQueue) {
      if (msg.type === 'abort') break;
      yield msg;
    }
  }
}
```

### AsyncQueue Implementation

```typescript
class AsyncQueue<T> implements AsyncIterable<T> {
  private queue: T[] = [];
  private resolvers: Array<(r: IteratorResult<T>) => void> = [];
  private closed = false;

  push(item: T): void {
    if (this.closed) return;
    if (this.resolvers.length > 0) {
      this.resolvers.shift()!({ value: item, done: false });
    } else {
      this.queue.push(item);
    }
  }

  close(): void {
    this.closed = true;
    for (const resolve of this.resolvers) {
      resolve({ value: undefined, done: true });
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    while (!this.closed || this.queue.length > 0) {
      if (this.queue.length > 0) {
        yield this.queue.shift()!;
      } else if (!this.closed) {
        yield await new Promise<T>((resolve) => {
          this.resolvers.push((result) => {
            if (!result.done) resolve(result.value);
          });
        });
      }
    }
  }
}
```

## Complexity Estimate

| Component | Lines | Complexity |
|-----------|-------|------------|
| AsyncQueue<T> | ~50 | Low |
| InteractiveSessionImpl | ~200 | Medium |
| SessionContext | ~80 | Low |
| SDK integration | ~100 | Medium |
| Event types | ~50 | Low |
| Tests | ~300 | Medium |
| **Total** | ~780 | Medium |

## Relationship to 007

This feature **extends** 007-fluent-harness-dx:
- Uses same `defineHarness()` factory
- Extends `HarnessInstance` with `startSession()`
- Extends `ExecuteContext` with optional `session`
- Reuses EventBus for bidirectional pub/sub
- Adds new event types to existing event union

**Must complete 007 first** to have stable foundation.

## Open Questions

1. **Timeout handling**: Should `waitForUser()` have a default timeout? What happens on timeout?
2. **Multiple prompts**: Can multiple `waitForUser()` calls be pending simultaneously?
3. **Replay mode**: How does session replay work? Record user responses?
4. **Agent targeting**: Does `sendTo()` require changes to how agents consume messages?

## Success Criteria

- [ ] `startSession()` returns working InteractiveSession
- [ ] `waitForUser()` blocks execution until reply received
- [ ] `send()` injects messages that agents can read
- [ ] `abort()` gracefully terminates with reason
- [ ] Events flow correctly for UI integration
- [ ] Existing `run()` API unchanged and working
- [ ] Works with replay recordings (TBD how)
