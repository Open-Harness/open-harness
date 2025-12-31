# Data Model: Transport Architecture

**Feature**: 010-transport-architecture
**Date**: 2025-12-27

## Overview

This document defines the data structures for the Transport Architecture. All types extend the existing event system from 008-unified-event-system.

## Core Entities

### Transport

Bidirectional communication channel interface. HarnessInstance implements this directly.

```typescript
interface Transport extends AsyncIterable<EnrichedEvent> {
  // Events (out) - Harness → Consumer
  subscribe(listener: EventListener): Unsubscribe;
  subscribe(filter: EventFilter, listener: EventListener): Unsubscribe;
  [Symbol.asyncIterator](): AsyncIterator<EnrichedEvent>;

  // Commands (in) - Consumer → Harness
  send(message: string): void;
  sendTo(agent: string, message: string): void;
  reply(promptId: string, response: UserResponse): void;
  abort(reason?: string): void;

  // Status
  readonly status: TransportStatus;
  readonly sessionActive: boolean;
}

type TransportStatus = 'idle' | 'running' | 'complete' | 'aborted';
```

**Relationships**:
- Extends `AsyncIterable<EnrichedEvent>` for async iteration
- Contains status state machine
- Implemented by `HarnessInstance`

### Attachment

Function that connects to a transport and optionally returns cleanup.

```typescript
type Attachment = (transport: Transport) => Cleanup;

type Cleanup = void | (() => void) | (() => Promise<void>);
```

**Validation Rules**:
- Must be a function
- May return void, sync cleanup function, or async cleanup function
- Receives full Transport access

### UserResponse

Response from user prompts.

```typescript
interface UserResponse {
  content: string;
  choice?: string;
  timestamp: Date;
}
```

**Validation Rules**:
- `content` is required, non-empty string
- `choice` is optional, used when choices were presented
- `timestamp` is auto-set if not provided

### InjectedMessage

Message injected via `transport.send()`.

```typescript
interface InjectedMessage {
  content: string;
  agent?: string;     // Target agent (if sendTo used)
  timestamp: Date;
}
```

### SessionContext

Runtime context for interactive workflows.

```typescript
interface SessionContext {
  waitForUser(prompt: string, options?: WaitOptions): Promise<UserResponse>;
  hasMessages(): boolean;
  readMessages(): InjectedMessage[];
  isAborted(): boolean;
}

interface WaitOptions {
  timeout?: number;      // ms, undefined = block indefinitely
  choices?: string[];    // Predefined choices to present
  validator?: (input: string) => boolean | string;  // Custom validation
}
```

**State Transitions**:
- `waitForUser()` emits `user:prompt` event and blocks
- `transport.reply()` resolves the pending promise
- `isAborted()` reflects abort controller state

### AsyncQueue<T>

FIFO queue for message injection with async consumption.

```typescript
interface AsyncQueue<T> {
  push(item: T): void;
  pop(): Promise<T>;        // Blocks until item available
  tryPop(): T | undefined;  // Non-blocking
  peek(): T | undefined;
  readonly length: number;
  readonly isEmpty: boolean;
  clear(): void;
}
```

**Relationships**:
- Used for `InjectedMessage` queue in HarnessInstance
- Used for pending prompt responses

## Event Types (Extensions)

### Session Events

New events for interactive sessions:

```typescript
interface SessionPromptEvent extends BaseEvent {
  type: 'user:prompt';
  promptId: string;
  prompt: string;
  choices?: string[];
}

interface SessionReplyEvent extends BaseEvent {
  type: 'user:reply';
  promptId: string;
  response: UserResponse;
}

interface SessionAbortEvent extends BaseEvent {
  type: 'session:abort';
  reason?: string;
}
```

### Harness Lifecycle Events

Augmented harness events:

```typescript
interface HarnessStartEvent extends BaseEvent {
  type: 'harness:start';
  name: string;
  sessionMode: boolean;  // NEW: indicates if interactive
}

interface HarnessCompleteEvent extends BaseEvent {
  type: 'harness:complete';
  status: 'success' | 'aborted';  // NEW: aborted status
  duration: number;
}
```

## State Machines

### TransportStatus

```
idle ──run()──▶ running ──complete──▶ complete
  │                │
  │                └──abort()──▶ aborted
  │
  └──attach() still allowed
```

**Transitions**:
- `idle` → `running`: When `run()` or `complete()` called
- `running` → `complete`: Normal completion
- `running` → `aborted`: When `abort()` called
- `attach()` only allowed in `idle` state

### Attachment Lifecycle

```
attach() called
    │
    ▼
attachment(transport) executed
    │
    ▼
cleanup function stored (if returned)
    │
    ▼
[harness executes]
    │
    ▼
cleanup() called (in reverse registration order)
```

## Relationships Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    HarnessInstance                       │
│                  implements Transport                    │
├─────────────────────────────────────────────────────────┤
│  status: TransportStatus                                │
│  sessionActive: boolean                                 │
│  attachments: Array<{attachment, cleanup}>              │
│  messageQueue: AsyncQueue<InjectedMessage>              │
│  promptResolvers: Map<string, Resolver>                 │
│  abortController: AbortController                       │
├─────────────────────────────────────────────────────────┤
│  attach(attachment: Attachment): this                   │
│  subscribe(filter?, listener): Unsubscribe              │
│  send(message): void                                    │
│  sendTo(agent, message): void                           │
│  reply(promptId, response): void                        │
│  abort(reason?): void                                   │
│  run(): Promise<HarnessResult>                          │
│  startSession(): this                                   │
│  complete(): Promise<HarnessResult>                     │
└─────────────────────────────────────────────────────────┘
           │
           │ provides to ExecuteContext
           ▼
┌─────────────────────────────────────────────────────────┐
│                   SessionContext                         │
│             (only when sessionActive=true)               │
├─────────────────────────────────────────────────────────┤
│  waitForUser(prompt, options): Promise<UserResponse>    │
│  hasMessages(): boolean                                 │
│  readMessages(): InjectedMessage[]                      │
│  isAborted(): boolean                                   │
└─────────────────────────────────────────────────────────┘
```

## Index Key Fields

| Entity | Key Field | Uniqueness |
|--------|-----------|------------|
| EnrichedEvent | id | UUID, globally unique |
| SessionPromptEvent | promptId | UUID, unique per session |
| InjectedMessage | timestamp | Monotonic within session |
