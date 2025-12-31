# Protocol Types (Authoritative)

This document contains the authoritative TypeScript interfaces for the kernel + flow protocol.

These types should match `src/protocol/*.ts` exactly.

## Events

```typescript
// Context (hierarchical)
interface EventContext {
  sessionId: string;
  phase?: { name: string; number?: number };
  task?: { id: string };
  agent?: { name: string; type?: string };
}

// Base event payloads
type WorkflowEvents =
  | { type: "harness:start"; name: string }
  | { type: "harness:complete"; success: boolean; durationMs: number }
  | { type: "phase:start"; name: string; phaseNumber?: number }
  | { type: "phase:complete"; name: string; phaseNumber?: number }
  | { type: "phase:failed"; name: string; error: string; stack?: string; phaseNumber?: number }
  | { type: "task:start"; taskId: string }
  | { type: "task:complete"; taskId: string; result?: unknown }
  | { type: "task:failed"; taskId: string; error: string; stack?: string };

type AgentEvents =
  | { type: "agent:start"; agentName: string; runId: string }
  | { type: "agent:thinking"; content: string; runId?: string }
  | { type: "agent:text"; content: string; runId?: string }
  | { type: "agent:tool:start"; toolName: string; input?: unknown; runId?: string }
  | { type: "agent:tool:complete"; toolName: string; result?: unknown; isError?: boolean; runId?: string }
  | { type: "agent:complete"; agentName: string; success: boolean; runId: string };

type SessionMessageEvent = {
  type: "session:message";
  content: string;
  agentName?: string;
  runId?: string;
};

type SessionPromptEvent = {
  type: "session:prompt";
  promptId: string;
  prompt: string;
  choices?: string[];
  allowText?: boolean;
};

type SessionReplyEvent = { type: "session:reply"; promptId: string; content: string; choice?: string };
type SessionAbortEvent = { type: "session:abort"; reason?: string };
type NarrativeEvent = { type: "narrative"; text: string; importance?: "low" | "normal" | "high" };
type ExtensionEvent = { type: string; [k: string]: unknown };

type BaseEvent =
  | WorkflowEvents
  | AgentEvents
  | SessionMessageEvent
  | SessionPromptEvent
  | SessionReplyEvent
  | SessionAbortEvent
  | NarrativeEvent
  | ExtensionEvent;

// Enriched envelope
interface EnrichedEvent<T extends BaseEvent = BaseEvent> {
  id: string;
  timestamp: Date;
  context: EventContext;
  event: T;
}

// Filtering
type EventFilter = "*" | string | string[];
type EventListener<T extends BaseEvent = BaseEvent> = (event: EnrichedEvent<T>) => void | Promise<void>;
type Unsubscribe = () => void;
```

## Hub

```typescript
type HubStatus = "idle" | "running" | "complete" | "aborted";

interface UserResponse {
  content: string;
  choice?: string;
  timestamp: Date;
}

interface Hub extends AsyncIterable<EnrichedEvent> {
  // Events out
  subscribe(listener: EventListener): Unsubscribe;
  subscribe(filter: EventFilter, listener: EventListener): Unsubscribe;
  emit(event: BaseEvent, override?: Partial<EventContext>): void;
  scoped<T>(context: Partial<EventContext>, fn: () => T | Promise<T>): T | Promise<T>;
  current(): EventContext;

  // Commands in (bidirectional)
  send(message: string): void;
  sendTo(agent: string, message: string): void;
  sendToRun(runId: string, message: string): void;
  reply(promptId: string, response: UserResponse): void;
  abort(reason?: string): void;

  // Status
  readonly status: HubStatus;
  readonly sessionActive: boolean;
}
```

## Harness (deprecated)

```typescript
type Cleanup = void | (() => void) | (() => Promise<void>);
type Attachment = (hub: Hub) => Cleanup;

interface SessionContext {
  waitForUser(prompt: string, options?: { choices?: string[]; allowText?: boolean }): Promise<UserResponse>;
  hasMessages(): boolean;
  readMessages(): Array<{ content: string; agent?: string; timestamp: Date }>;
  isAborted(): boolean;
}

interface ExecuteContext<TAgentDefs extends Record<string, AgentDefinition>, TState> {
  agents: ExecutableAgents<TAgentDefs>;
  state: TState;
  hub: Hub;
  phase: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
  task: <T>(id: string, fn: () => Promise<T>) => Promise<T>;
  emit: (event: BaseEvent) => void;
  session?: SessionContext;
}

interface HarnessResult<TState, TResult> {
  result: TResult;
  state: TState;
  events: EnrichedEvent[];
  durationMs: number;
  status: HubStatus;
}

interface HarnessInstance<TState, TResult> extends Hub {
  readonly state: TState;
  attach(attachment: Attachment): this;
  startSession(): this;
  run(): Promise<HarnessResult<TState, TResult>>;
}

interface HarnessFactory<TInput, TState, TResult> {
  create(input: TInput): HarnessInstance<TState, TResult>;
}
```

## Agent

```typescript
interface InjectedMessage {
  content: string;
  timestamp: Date;
}

interface AgentInbox extends AsyncIterable<InjectedMessage> {
  pop(): Promise<InjectedMessage>;
  drain(): InjectedMessage[];
  close(): void;
}

interface AgentExecuteContext {
  hub: Hub;
  inbox: AgentInbox;
  runId: string;
}

interface AgentDefinition<TIn = unknown, TOut = unknown> {
  name: string;
  emitsStartComplete?: boolean;
  execute(input: TIn, ctx: AgentExecuteContext): Promise<TOut>;
}

interface ExecutableAgent<TIn = unknown, TOut = unknown> {
  name: string;
  execute(input: TIn): Promise<TOut>;
}
```

## Channel

```typescript
interface ChannelContext<TState> {
  hub: Hub;
  state: TState;
  event: EnrichedEvent<BaseEvent>;
  emit: (event: BaseEvent) => void;
}

type ChannelHandler<TState> = (ctx: ChannelContext<TState>) => void | Promise<void>;

interface ChannelDefinition<TState> {
  name: string;
  state?: () => TState;
  onStart?: (ctx: { hub: Hub; state: TState; emit: (event: BaseEvent) => void }) => void | Promise<void>;
  onComplete?: (ctx: { hub: Hub; state: TState; emit: (event: BaseEvent) => void }) => void | Promise<void>;
  on: Record<string, ChannelHandler<TState>>;
}
```

## Flow

```typescript
type NodeId = string;
type NodeTypeId = string;

interface FlowSpec {
  name: string;
  version?: number;
  description?: string;
  input?: Record<string, unknown>;
  nodePacks?: string[];
  policy?: FlowPolicy;
}

interface FlowPolicy {
  failFast?: boolean;
}

interface WhenExpr {
  equals?: { var: string; value: unknown };
  not?: WhenExpr;
  and?: WhenExpr[];
  or?: WhenExpr[];
}

interface RetryPolicy {
  maxAttempts: number;
  backoffMs?: number;
}

interface NodePolicy {
  timeoutMs?: number;
  retry?: RetryPolicy;
  continueOnError?: boolean;
}

interface NodeSpec {
  id: NodeId;
  type: NodeTypeId;
  input: Record<string, unknown>;
  config?: Record<string, unknown>;
  when?: WhenExpr;
  policy?: NodePolicy;
}

interface Edge {
  from: NodeId;
  to: NodeId;
  when?: WhenExpr;
}

interface FlowYaml {
  flow: FlowSpec;
  nodes: NodeSpec[];
  edges: Edge[];
}

interface NodeCapabilities {
  isStreaming?: boolean;
  supportsInbox?: boolean;
  isLongLived?: boolean;
  isAgent?: boolean;
}

interface NodeRunContext {
  hub: Hub;
  runId: string;
  inbox?: AgentInbox;
}

interface NodeTypeDefinition<TIn, TOut> {
  type: string;
  inputSchema: ZodSchema<TIn>;
  outputSchema: ZodSchema<TOut>;
  capabilities?: NodeCapabilities;
  run(ctx: NodeRunContext, input: TIn): Promise<TOut>;
}
```

## Flow Runtime

```typescript
interface FlowRunnerOptions {
  sessionId?: string;
  input?: Record<string, unknown>;
  channels?: ChannelDefinition<any>[];
  policy?: FlowPolicy;
}

interface FlowRunResult {
  outputs: Record<string, unknown>;
  events: EnrichedEvent[];
  durationMs: number;
  status: HubStatus;
}

interface FlowInstance extends Hub {
  attach(channel: ChannelDefinition<any>): this;
  startSession(): this;
  run(): Promise<FlowRunResult>;
}
```
