# Open Harness Telemetry Specification: Hybrid Architecture

## Document Information
- **Spec Version**: 1.0
- **Architecture**: Hybrid (Pino + Event-Native)
- **Status**: Design Document
- **Target Audience**: Engineering team implementing instrumentation

---

## 1. Overview

### 1.1 Problem Statement

Open Harness is a multi-package agent orchestration framework with the following characteristics:
- Multi-stage execution flow (SDK → event bus → transports → UI)
- Long-running sessions (agent conversations span minutes)
- Distributed across 8+ TypeScript packages
- Existing unified event system (008)
- No structured logging currently

### 1.2 Design Goals

| Goal | Priority | Success Criteria |
|------|----------|------------------|
| End-to-end traceability | P0 | Query full session across all packages |
| Operational visibility | P0 | Answer "what failed and why?" in <5 seconds |
| Agent lifecycle visibility | P0 | Track turns, tokens, responses per session |
| Low overhead | P1 | <5% performance impact |
| Compliance-ready | P1 | PII redaction, configurable retention |
| Incremental adoption | P2 | Can implement package-by-package |

### 1.3 Architecture Philosophy

**Two-Layer Telemetry Strategy:**

1. **Operational Layer (Pino)** - System-level metrics
   - What did the system do? (errors, latency, resources)
   - Infrastructure health, dependency performance
   - Standard log aggregation tooling

2. **Agent Flow Layer (Event System)** - Business-level metrics
   - What did the agent do? (turns, responses, decisions)
   - Session lifecycle, token usage, model interactions
   - Extend existing event system with metadata

**Key Principle:** Don't instrument everything. Instrument **transaction boundaries** and **failure points**. Let the existing event system handle the agent flow naturally.

---

## 2. Core Architecture

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Telemetry Layer                           │
├──────────────────────────┬──────────────────────────────────┤
│  Operational (Pino)      │  Agent Flow (Event System)       │
├──────────────────────────┼──────────────────────────────────┤
│  • Errors                │  • Session start/end            │
│  • Performance           │  • Agent turns                   │
│  • Infrastructure        │  • Token usage                   │
│  • Dependencies          │  • Model requests                │
│  • System health         │  • Response streaming            │
└──────────────────────────┴──────────────────────────────────┘
           │                             │
           ▼                             ▼
┌───────────────────────┐    ┌──────────────────────────┐
│  Session Tracker       │◄───┤  Unified Event Bus       │
│  (AsyncLocalStorage)   │    │  (existing, extended)    │
└───────────────────────┘    └──────────────────────────┘
           │                             │
           ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   Package Consumers                          │
│  • SDK requests          • Transports (HTTP/WebSocket)      │
│  • Event emission        • UI components                    │
│  • State transitions     • Pause/resume logic               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Session Context Propagation

**Requirement:** All telemetry must be traceable to a single agent session.

**Mechanism:** AsyncLocalStorage with session-scoped context.

```typescript
type SessionContext = {
  session_id: string;           // Unique identifier for this agent session
  request_id: string;           // Top-level request (if applicable)
  trace_id: string;             // Distributed trace across packages
  deployment_id: string;         // Environment identifier
  user_id?: string;             // Optional user identifier
  metadata?: Record<string, unknown>; // Extension point for custom context
};

// Context is automatically attached to all telemetry:
// - Pino child loggers inherit context
// - Event bus adds telemetry metadata
// - Errors are enriched with session info
```

**Propagation Rules:**
1. Session starts at **session entry point** (harness, renderer)
2. Context propagates automatically via AsyncLocalStorage
3. Child spans inherit all parent fields
4. Async operations (promises, callbacks) preserve context
5. Package boundaries pass context via headers/events

---

## 3. Operational Layer (Pino)

### 3.1 What Pino Handles

**Scope:** System-level operations and infrastructure interactions.

| Category | What to Instrument | Examples |
|----------|-------------------|----------|
| **Request Boundaries** | Start/end of external requests | SDK API calls, HTTP requests, WebSocket messages |
| **Error Handling** | All error paths, including rethrows | Network errors, validation failures, timeouts |
| **Performance** | Duration of operations with >100ms impact | Model requests, streaming, database operations |
| **Dependencies** | Health and latency of external services | Anthropic API, cache hits/misses, queue operations |
| **System Events** | Startup, shutdown, configuration | Service initialization, feature flag changes |

### 3.2 Canonical Pino Event Schema

**Every Pino event MUST include these fields:**

```typescript
{
  // Required: Traceability
  request_id: string;        // UUID for this request
  session_id: string;        // Agent session UUID
  trace_id: string;          // Distributed trace chain
  timestamp: string;         // ISO-8601
  service: string;           // Package identifier (e.g., "005-monologue-system")
  version: string;           // Package version
  deployment_id: string;     // Environment identifier

  // Required: Operation context
  operation: string;         // What happened (e.g., "sdk_model_request")
  outcome: "success" | "error" | "partial"; // Did it complete?
  duration_ms: number;       // Operation duration (if applicable)

  // Optional: Operational details (context-specific)
  // Example: HTTP request
  http?: {
    method: string;
    path: string;
    status_code: number;
    url?: string;            // Redact sensitive params
  };

  // Example: Model request
  model?: {
    provider: "anthropic";
    model_name: string;
    tokens_used: { input: number; output: number };
    latency_ms: number;
  };

  // Example: Error
  error?: {
    type: string;            // Error class name
    code?: string;           // Provider error code
    message: string;         // Sanitized message
    retriable: boolean;
    provider_code?: string;  // e.g., Anthropic error code
  };

  // Optional: Business context (bridged from session)
  agent?: {
    turn_count: number;
    stream_id?: string;
  };

  // System metadata
  deployment_id: string;
}
```

### 3.3 Pino Integration Points

**Instrument these locations in each package:**

#### 1. SDK Request Wrappers

**Where:** Anywhere SDK methods are called (`@anthropic-ai/sdk`, `@anthropic-ai/claude-agent-sdk`)

**What to wrap:**
```typescript
// BEFORE:
const response = await client.messages.create(params);

// AFTER:
await opsLogger.logOperation(
  "sdk_model_request",
  async () => client.messages.create(params),
  {
    provider: "anthropic",
    model_name: params.model,
    metadata: { max_tokens: params.max_tokens }
  }
);
```

**What this captures:**
- Request/response timing
- Success/failure outcomes
- Token usage
- Error types and codes
- Retry attempts (if applicable)

#### 2. HTTP/WebSocket Boundaries

**Where:** Transport layer (010), WebSocket connections, REST API endpoints

**What to wrap:**
```typescript
// HTTP request middleware (Express/Fastify/Hono)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    opsLogger.info({
      operation: 'http_request',
      duration_ms: Date.now() - start,
      http: {
        method: req.method,
        path: req.path,
        status_code: res.statusCode
      }
    });
  });
  next();
});

// WebSocket events
socket.on('message', async (data) => {
  await opsLogger.logOperation(
    'websocket_message_handling',
    async () => handleMessage(data),
    { message_type: data.type }
  );
});
```

#### 3. Error Boundaries

**Where:** All try/catch blocks, error handlers, rejection handlers

**What to wrap:**
```typescript
try {
  await riskyOperation();
} catch (error) {
  opsLogger.error({
    operation: 'risky_operation',
    outcome: 'error',
    error: {
      type: error.constructor.name,
      message: sanitizeErrorMessage(error.message),
      code: error.code,
      retriable: isRetriableError(error)
    }
  }, 'Operation failed');
  throw error; // Re-throw with telemetry captured
}
```

**Error Classification Rules:**
- **Retriable:** Network timeouts, rate limits, 5xx errors
- **Non-retriable:** Validation errors, 4xx (except 429), auth failures
- **Critical:** Errors that terminate the session

#### 4. Performance-Critical Paths

**Where:** Operations with >100ms typical duration

**What to instrument:**
- Model requests (always)
- Streaming operations (emit milestones)
- Cache lookups (track hit/miss ratios)
- Event bus publish/subscribe operations
- Pause/resume state persistence

```typescript
// Streaming milestones
async function* streamResponse(response) {
  let chunkCount = 0;
  const startTime = Date.now();

  for await (const chunk of response) {
    chunkCount++;
    if (chunkCount % 10 === 0) { // Every 10 chunks
      opsLogger.info({
        operation: 'streaming_progress',
        milestone: 'chunk_received',
        chunk_count: chunkCount,
        elapsed_ms: Date.now() - startTime
      });
    }
    yield chunk;
  }

  opsLogger.info({
    operation: 'streaming_complete',
    total_chunks: chunkCount,
    total_ms: Date.now() - startTime
  });
}
```

#### 5. Infrastructure Dependencies

**Where:** Database, cache, queue, storage operations

**What to instrument:**
```typescript
// Database query wrapper
async function queryDatabase(sql, params) {
  return opsLogger.logOperation(
    'database_query',
    async () => db.execute(sql, params),
    {
      query_type: classifyQuery(sql),
      table: extractTable(sql)
    }
  );
}

// Cache operations
async function cacheGet(key) {
  const start = Date.now();
  const result = await cache.get(key);

  opsLogger.info({
    operation: 'cache_get',
    duration_ms: Date.now() - start,
    outcome: result === null ? 'miss' : 'hit',
    cache: { key: sanitizeKey(key) }
  });

  return result;
}
```

### 3.4 Pino Logger Setup

**Singleton Instance:**
```typescript
import pino from 'pino';

const opsLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  },
  redact: {
    paths: [
      'http.url',           // Don't log full URLs (might have sensitive params)
      'user.id',            // Don't log user IDs (PII)
      'request.body.*',     // Don't log request bodies (might have PII)
      'response.body.*'     // Don't log response bodies (might have PII)
    ],
    remove: true            // Remove redacted fields instead of replacing with "[Redacted]"
  },
  serializers: {
    error: pino.stdSerializers.err
  }
});
```

**Child Logger Pattern (Auto-inherits session context):**
```typescript
function createChildLogger(context: Partial<SessionContext>) {
  return opsLogger.child({
    session_id: context.session_id,
    request_id: context.request_id,
    trace_id: context.trace_id,
    deployment_id: context.deployment_id,
    service: getCurrentServiceName(),
    version: getCurrentServiceVersion()
  });
}
```

**Helper Method for Operation Logging:**
```typescript
async function logOperation<T>(
  operationName: string,
  fn: () => Promise<T>,
  metadata: Record<string, unknown> = {}
): Promise<T> {
  const request_id = generateUUID();
  const startTime = Date.now();

  const logger = createChildLogger(sessionContext.get());

  try {
    const result = await fn();

    logger.info({
      request_id,
      operation: operationName,
      outcome: 'success',
      duration_ms: Date.now() - startTime,
      ...metadata
    });

    return result;
  } catch (error) {
    logger.error({
      request_id,
      operation: operationName,
      outcome: 'error',
      duration_ms: Date.now() - startTime,
      error: {
        type: error.constructor.name,
        message: sanitizeErrorMessage(error.message),
        code: error.code,
        retriable: isRetriableError(error)
      },
      ...metadata
    }, 'Operation failed');

    throw error;
  }
}
```

---

## 4. Agent Flow Layer (Event System)

### 4.1 What Event System Handles

**Scope:** Agent lifecycle and business logic.

**Principle:** The event system is ALREADY the primary telemetry for agent behavior. Don't duplicate it—extend it.

**What to add:**
1. **Telemetry metadata** on existing events
2. **New summary events** at transaction boundaries
3. **Session lifecycle events** (start, pause, resume, end)

### 4.2 Event Telemetry Metadata

**Every event emitted MUST include telemetry metadata:**

```typescript
// Extend existing event types
interface BaseEvent {
  type: string;           // Existing: event type
  timestamp: string;      // Existing: ISO-8601
  data: unknown;          // Existing: event payload

  // NEW: Telemetry metadata
  telemetry: {
    session_id: string;        // From session context
    operation: string;        // What this event represents
    sequence?: number;        // Event order in session
    duration_ms?: number;     // Time since previous event
    metadata?: Record<string, unknown>; // Extension point
  };
}
```

**How to attach telemetry:**

```typescript
// In event bus emit method:
eventBus.emit(event: Event) {
  const enrichedEvent = {
    ...event,
    telemetry: {
      session_id: sessionContext.get().session_id,
      operation: inferOperationFromEventType(event.type),
      timestamp: new Date().toISOString()
    }
  };

  // Existing event distribution logic
  distributeEvent(enrichedEvent);
}
```

### 4.3 New Event Types for Telemetry

#### Session Lifecycle Events

```typescript
type SessionStartEvent = {
  type: 'session_start',
  data: {
    session_id: string;
    model: string;
    max_tokens?: number;
    temperature?: number;
    system_prompt?: string;  // Fingerprint only
  },
  telemetry: TelemetryMetadata;
};

type SessionEndEvent = {
  type: 'session_end',
  data: {
    session_id: string;
    outcome: 'completed' | 'aborted' | 'error' | 'timeout';
    duration_ms: number;
    total_turns: number;
    total_tokens: { input: number; output: number };
    errors: Array<{
      type: string;
      turn: number;
      message: string;
    }>;
  },
  telemetry: TelemetryMetadata;
};

type SessionPauseEvent = {
  type: 'session_pause',
  data: {
    session_id: string;
    reason: 'user_action' | 'error' | 'timeout';
    state_checkpoint?: string; // Reference to persisted state
  },
  telemetry: TelemetryMetadata;
};

type SessionResumeEvent = {
  type: 'session_resume',
  data: {
    session_id: string;
    state_checkpoint?: string;
    elapsed_since_pause_ms: number;
  },
  telemetry: TelemetryMetadata;
};
```

#### Transaction Summary Events

```typescript
type TurnSummaryEvent = {
  type: 'turn_summary',
  data: {
    session_id: string;
    turn_number: number;
    user_message: {
      content_preview: string;  // First 100 chars
      token_count: number;
    };
    assistant_response: {
      content_preview: string;  // First 100 chars
      token_count: number;
      streaming_duration_ms: number;
    };
    model_request: {
      provider: string;
      model_name: string;
      latency_ms: number;
      tokens_used: { input: number; output: number };
    };
    outcome: 'success' | 'error' | 'interrupted';
  },
  telemetry: TelemetryMetadata;
};

type ModelRequestSummaryEvent = {
  type: 'model_request_summary',
  data: {
    session_id: string;
    turn_number: number;
    provider: 'anthropic';
    model_name: string;
    tokens_used: { input: number; output: number };
    latency_ms: number;
    retry_count: number;
    outcome: 'success' | 'error';
    error?: {
      type: string;
      code: string;
      retriable: boolean;
    };
  },
  telemetry: TelemetryMetadata;
};
```

### 4.4 When to Emit Telemetry Events

**Rule of thumb:** Emit a summary event at **transaction boundaries**.

| Transaction | Boundary Event | When to Emit |
|-------------|----------------|--------------|
| Session | `session_start` | First event when agent initializes |
| Turn | `turn_summary` | After user message + assistant response complete |
| Model request | `model_request_summary` | After SDK response fully received |
| Pause | `session_pause` | Before persisting state |
| Resume | `session_resume` | After loading persisted state |
| Session | `session_end` | When session terminates (any reason) |

**Example: Turn Transaction Flow**

```typescript
async function executeTurn(userMessage: string) {
  // 1. User message received (existing event)
  eventBus.emit(new UserMessageEvent({ content: userMessage }));

  // 2. Prepare model request (existing events)
  const request = await prepareRequest(userMessage);

  // 3. Execute model request (Pino handles operational telemetry)
  let modelResponse;
  try {
    modelResponse = await opsLogger.logOperation(
      'sdk_model_request',
      async () => sdkClient.messages.create(request),
      { model_name: request.model }
    );
  } catch (error) {
    // 4. Model request failed (summary event)
    eventBus.emit(new ModelRequestSummaryEvent({
      outcome: 'error',
      error: { type: error.name, code: error.code, retriable: isRetriable(error) }
    }));
    throw error;
  }

  // 5. Stream response (existing events + milestones)
  await streamResponse(modelResponse);

  // 6. Turn complete (summary event)
  eventBus.emit(new TurnSummaryEvent({
    user_message: { content_preview: userMessage.slice(0, 100), token_count: ... },
    assistant_response: { content_preview: responseText.slice(0, 100), ... },
    model_request: { provider: 'anthropic', model_name: request.model, ... },
    outcome: 'success'
  }));
}
```

### 4.5 Event System Extensions

**Don't restructure the event bus. Just add:**

1. **Telemetry metadata injection** (in emit method)
2. **New event type definitions** (summary events)
3. **Session tracker integration** (auto-increment sequence numbers)

**Example: Minimal Event Bus Extension**

```typescript
class UnifiedEventBus {
  private sessionTracker: SessionTracker;
  private sequenceNumber = 0;

  emit(event: Event) {
    // Inject telemetry metadata
    const enrichedEvent = {
      ...event,
      telemetry: {
        session_id: this.sessionTracker.get().session_id,
        operation: inferOperation(event.type),
        sequence: this.sequenceNumber++,
        timestamp: new Date().toISOString()
      }
    };

    // Existing event distribution (don't change this!)
    this.distributeToHandlers(enrichedEvent);

    // Optional: Forward to external telemetry system
    if (this.telemetryTransport) {
      this.telemetryTransport.send(enrichedEvent);
    }
  }
}
```

---

## 5. Session Tracker

### 5.1 Responsibility

Central coordination point for:
- Session lifecycle (start, end, pause, resume)
- Context propagation (AsyncLocalStorage)
- Session-scoped metrics accumulation
- Telemetry bridge (connects Pino + Event System)

### 5.2 Session Tracker Interface

```typescript
class SessionTracker {
  // Lifecycle
  start(options: { session_id?: string; metadata?: Record<string, unknown> }): void;
  end(reason: 'completed' | 'aborted' | 'error' | 'timeout'): void;
  pause(reason: string): void;
  resume(state_checkpoint?: string): void;

  // Context access
  get(): SessionContext;
  getSessionId(): string;

  // Metrics accumulation
  recordTurn(): void;
  recordTokens(tokens: { input: number; output: number }): void;
  recordError(error: Error, turn?: number): void;

  // Summary generation
  getSummary(): SessionSummary;
}
```

### 5.3 Session Lifecycle Flow

```
┌───────────────────────────────────────────────────────────────┐
│  Session Start (harness/renderer entry point)                  │
├───────────────────────────────────────────────────────────────┤
│  sessionTracker.start({                                        │
│    session_id: generateUUID(),                                 │
│    metadata: { user_id?, environment? }                        │
│  });                                                            │
│                                                                 │
│  eventBus.emit(new SessionStartEvent({ ... }));                │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│  Agent Execution (turns, streaming, etc.)                      │
├───────────────────────────────────────────────────────────────┤
│  • Context auto-propagates via AsyncLocalStorage               │
│  • Pino child loggers auto-inherit session_id                  │
│  • Event bus auto-injects telemetry metadata                   │
│  • SessionTracker accumulates metrics (turns, tokens)          │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│  Session Pause (user action, timeout, etc.)                    │
├───────────────────────────────────────────────────────────────┤
│  sessionTracker.pause(reason);                                 │
│  // State persists to filesystem                              │
│  eventBus.emit(new SessionPauseEvent({ ... }));                │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│  Session Resume (load persisted state)                         │
├───────────────────────────────────────────────────────────────┤
│  sessionTracker.resume(state_checkpoint);                     │
│  eventBus.emit(new SessionResumeEvent({ ... }));               │
│  // Continue execution...                                      │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│  Session End (any termination reason)                         │
├───────────────────────────────────────────────────────────────┤
│  sessionTracker.end(reason);                                   │
│  const summary = sessionTracker.getSummary();                 │
│  eventBus.emit(new SessionEndEvent(summary));                 │
└───────────────────────────────────────────────────────────────┘
```

### 5.4 Metrics Accumulation

**SessionTracker accumulates these metrics:**

```typescript
interface SessionSummary {
  session_id: string;
  start_time: string;        // ISO-8601
  end_time: string;          // ISO-8601
  duration_ms: number;

  // Agent metrics (from event system)
  total_turns: number;
  total_tokens: {
    input: number;
    output: number;
  };

  // Operational metrics (from Pino)
  model_requests: {
    count: number;
    total_latency_ms: number;
    error_count: number;
    retry_count: number;
  };

  errors: Array<{
    type: string;
    message: string;
    turn?: number;
    operation: string;
  }>;

  outcome: 'completed' | 'aborted' | 'error' | 'timeout';
  deployment_id: string;
  metadata: Record<string, unknown>;
}
```

**Accumulation logic:**

```typescript
class SessionTracker {
  private metrics = {
    turns: 0,
    tokens: { input: 0, output: 0 },
    modelRequests: { count: 0, totalLatency: 0, errorCount: 0, retryCount: 0 },
    errors: [] as Error[]
  };

  recordTokens(tokens: { input: number; output: number }) {
    this.metrics.tokens.input += tokens.input;
    this.metrics.tokens.output += tokens.output;
  }

  recordError(error: Error, turn?: number) {
    this.metrics.errors.push({
      type: error.constructor.name,
      message: error.message,
      turn,
      operation: getCurrentOperationName() // From Pino event
    });
  }

  getSummary(): SessionSummary {
    return {
      session_id: this.getSessionId(),
      start_time: this.startTime.toISOString(),
      end_time: new Date().toISOString(),
      duration_ms: Date.now() - this.startTime.getTime(),

      total_turns: this.metrics.turns,
      total_tokens: this.metrics.tokens,

      model_requests: {
        count: this.metrics.modelRequests.count,
        total_latency_ms: this.metrics.modelRequests.totalLatency,
        error_count: this.metrics.modelRequests.errorCount,
        retry_count: this.metrics.modelRequests.retryCount
      },

      errors: this.metrics.errors.map(e => ({
        type: e.type,
        message: sanitizeMessage(e.message),
        turn: e.turn,
        operation: e.operation
      })),

      outcome: this.determineOutcome(),
      deployment_id: process.env.DEPLOYMENT_ID || 'unknown',
      metadata: this.sessionMetadata
    };
  }
}
```

---

## 6. Integration Points: What to Wrap

### 6.1 Package-Level Responsibilities

| Package | Pino Instrumentation | Event Extensions |
|---------|---------------------|-----------------|
| **Entry Points** (003, 007) | Session start/end, UI events | Session lifecycle events |
| **SDK Requests** (013, 005) | All SDK method calls, error paths | Model request summaries |
| **Event System** (008) | Event bus publish/subscribe performance | Telemetry metadata injection |
| **Transports** (010) | HTTP/WebSocket boundaries | Transport-specific events |
| **Pause/Resume** (016) | State persistence operations | Session pause/resume events |
| **Test Infra** (004, 009) | Replay timing, fixture loading | N/A (tests verify telemetry) |

### 6.2 Component-Level Wrapping

#### 1. Session Entry Points

**Where:** Harness initialization, renderer startup

**Wrap:**
```typescript
// Session start
sessionTracker.start({
  session_id: generateUUID(),
  metadata: { user_id?: string, environment?: string }
});

opsLogger.info({
  operation: 'session_start',
  outcome: 'success'
}, 'Agent session started');

eventBus.emit(new SessionStartEvent({ ... }));
```

**Captures:**
- Session initiation
- Initial configuration
- User identification (if applicable)

---

#### 2. SDK Request Layer

**Where:** All `@anthropic-ai/sdk` method invocations

**Wrap EVERY SDK method call:**
```typescript
// Model requests
const response = await opsLogger.logOperation(
  'sdk_model_request',
  async () => sdkClient.messages.create(params),
  {
    model_name: params.model,
    stream: params.stream,
    metadata: { max_tokens: params.max_tokens }
  }
);

// Streaming operations
for await (const chunk of response) {
  // Existing streaming events
  eventBus.emit(new TextDeltaEvent({ content: chunk.delta.text }));

  // Milestone telemetry (every N chunks)
  if (chunkCount % 10 === 0) {
    opsLogger.info({
      operation: 'streaming_progress',
      milestone: 'chunk_received',
      chunk_count: chunkCount
    });
  }
}

// Summary after complete
eventBus.emit(new ModelRequestSummaryEvent({
  tokens_used: response.usage,
  latency_ms: Date.now() - startTime,
  outcome: 'success'
}));
```

**Captures:**
- All model requests (non-streaming and streaming)
- Token usage
- Latency
- Errors (rate limits, auth, network)
- Retry attempts

---

#### 3. Event System

**Where:** Event bus `emit()` and `subscribe()` methods

**Wrap:**
```typescript
class UnifiedEventBus {
  emit(event: Event) {
    // Inject telemetry
    const enriched = {
      ...event,
      telemetry: {
        session_id: sessionTracker.getSessionId(),
        operation: inferOperation(event.type),
        sequence: this.sequenceNumber++,
        timestamp: new Date().toISOString()
      }
    };

    // Existing distribution logic (DON'T CHANGE)
    this.distribute(enriched);
  }

  subscribe(pattern: string, handler: EventHandler) {
    // Wrap handler to capture performance
    return this.subscribers.add({
      pattern,
      handler: async (event) => {
        await opsLogger.logOperation(
          'event_handler_execution',
          async () => handler(event),
          { event_type: event.type, pattern }
        );
      }
    });
  }
}
```

**Captures:**
- Event throughput (events/second)
- Handler latency
- Subscription patterns
- Event type distribution

---

#### 4. Transport Layer

**Where:** HTTP requests, WebSocket connections

**Wrap:**
```typescript
// HTTP middleware
app.use(async (req, res, next) => {
  const startTime = Date.now();

  // Attach request metadata to session context
  sessionContext.set({
    request_id: generateUUID(),
    ...sessionContext.get()
  });

  res.on('finish', () => {
    opsLogger.info({
      operation: 'http_request',
      duration_ms: Date.now() - startTime,
      http: {
        method: req.method,
        path: req.path,
        status_code: res.statusCode
      }
    });
  });

  next();
});

// WebSocket
socket.on('message', async (data) => {
  await opsLogger.logOperation(
    'websocket_message_handling',
    async () => handleMessage(data),
    { message_type: data.type }
  );
});
```

**Captures:**
- Request/response timing
- Error rates (4xx, 5xx)
- WebSocket message latency
- Connection lifecycle

---

#### 5. Pause/Resume State Persistence

**Where:** State serialization, file I/O

**Wrap:**
```typescript
// Pause
async function pauseSession(sessionId: string, reason: string) {
  sessionTracker.pause(reason);

  await opsLogger.logOperation(
    'state_persistence',
    async () => {
      const state = await serializeState(sessionId);
      await fs.writeFile(`sessions/${sessionId}.json`, state);
      return state;
    },
    { session_id: sessionId, state_size_bytes: state.length }
  );

  eventBus.emit(new SessionPauseEvent({ session_id: sessionId, reason }));
}

// Resume
async function resumeSession(sessionId: string, statePath: string) {
  await opsLogger.logOperation(
    'state_loading',
    async () => {
      const state = await fs.readFile(statePath, 'utf-8');
      return deserializeState(state);
    },
    { session_id: sessionId, state_path: statePath }
  );

  sessionTracker.resume(statePath);
  eventBus.emit(new SessionResumeEvent({ session_id: sessionId }));
}
```

**Captures:**
- Persistence latency
- File size (state size)
- Persistence errors
- Load/restore performance

---

#### 6. Error Boundaries

**Where:** All try/catch blocks, error handlers

**Wrap:**
```typescript
async function executeWithTelemetry<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await opsLogger.logOperation(operation, fn, context);
  } catch (error) {
    // Record error in session tracker
    sessionTracker.recordError(error, getCurrentTurnNumber());

    // Pino already logged the error in logOperation

    // Decide whether to continue or abort
    if (isFatalError(error)) {
      sessionTracker.end('error');
      eventBus.emit(new SessionEndEvent({
        outcome: 'error',
        errors: [error]
      }));
    }

    throw error;
  }
}
```

**Captures:**
- Error rates by type
- Error locations (operation names)
- Error handling decisions (retry vs abort)
- Session termination causes

---

## 7. Compliance and Data Privacy

### 7.1 PII Redaction

**Principle:** Never log user-provided content in Pino. Log only metadata.

**Redaction Rules:**

| Field Type | Redaction Strategy |
|------------|-------------------|
| User messages | Never log in Pino (use event content fingerprint) |
| Assistant responses | Never log in Pino |
| System prompts | Log fingerprint only (hash of content) |
| API keys/tokens | Always redact fully |
| User IDs | Redact unless explicitly allowed by policy |
| URLs | Redact query parameters |
| Headers | Redact Authorization, Cookie, Set-Cookie |

**Pino Redaction Configuration:**
```typescript
const redact = {
  paths: [
    'request.body.*',           // All request bodies
    'response.body.*',          // All response bodies
    'user.id',                  // User IDs
    'user.email',               // User emails
    'user.name',                // User names
    'http.url',                 // Full URLs
    'headers.authorization',    // Auth headers
    'headers.cookie',           // Cookies
    'api_key',                  // API keys
    'token',                    // Tokens
    'system_prompt',            // System prompts
    'user_message.*',           // User messages
    'assistant_response.*'      // Assistant responses
  ],
  remove: true  // Remove instead of replacing with "[Redacted]"
};
```

**Event System Content:**
- Events CAN contain full content (they're business events, not logs)
- Configure event transport with sampling/redaction for external systems
- For compliance, add a `content_redacted` flag to summary events:

```typescript
type TurnSummaryEvent = {
  type: 'turn_summary',
  data: {
    session_id: string;
    user_message: {
      content_preview: string;  // First 100 chars, no PII concern
      token_count: number;
    };
    assistant_response: {
      content_preview: string;
      token_count: number;
    };
    // Optional: Full content for internal use (not sent to external telemetry)
    full_content?: {
      user_message: string;
      assistant_response: string;
    }
  },
  telemetry: TelemetryMetadata;
};
```

---

### 7.2 Sampling Strategy

**Principle:** Sample operational telemetry for cost control. Never sample agent flow telemetry (it's business-critical).

| Event Type | Sampling Strategy | Rationale |
|------------|-------------------|-----------|
| Pino - Debug logs | 1% sampling | High volume, low value |
| Pino - Info logs (routine) | 10% sampling | Medium volume |
| Pino - Warn logs | 50% sampling | Important but lower frequency |
| Pino - Error logs | 100% sampling | Critical for debugging |
| Events - Session lifecycle | 100% sampling | Business metrics |
| Events - Turn summaries | 100% sampling | Token usage, analytics |
| Events - Streaming milestones | 10% sampling | High frequency |

**Sampling Implementation:**
```typescript
function shouldSample(level: string, operation: string): boolean {
  if (level === 'error') return true;  // Never sample errors

  const samplingRates = {
    debug: 0.01,
    info: 0.10,
    warn: 0.50
  };

  const rate = samplingRates[level] ?? 1.0;
  return Math.random() < rate;
}

// In logger
logger.info = (data, msg) => {
  if (shouldSample('info', data.operation)) {
    baseLogger.info(data, msg);
  }
};
```

---

### 7.3 Data Retention

**Principle:** Define retention policies per data category.

| Data Type | Retention Period | Rationale |
|-----------|-----------------|-----------|
| Pino logs (operational) | 30 days | Operational monitoring |
| Event logs (agent flow) | 365 days | Analytics, debugging |
| Session summaries | 365 days | Business metrics |
| Full content (if captured) | 30 days, then delete | Compliance |

**Retention Implementation:**
```typescript
// Add retention metadata to all events
interface TelemetryMetadata {
  session_id: string;
  operation: string;
  retention_days: number;  // Auto-expire after this period
  data_category: 'operational' | 'agent_flow' | 'sensitive';
}
```

---

## 8. Query Patterns: What Questions Does This Answer?

### 8.1 Operational Queries (Pino)

| Question | How to Query |
|----------|--------------|
| "Which operations are failing most often?" | `| where outcome == "error" | count by operation | sort desc` |
| "What's the latency distribution for model requests?" | `| where operation == "sdk_model_request" | stats(duration_ms)` |
| "Are there any 5xx errors from Anthropic API?" | `| where error.code startsWith "5" | count` |
| "What's the cache hit ratio?" | `| where operation == "cache_get" | count by outcome` |
| "Which sessions had the most errors?" | `| where outcome == "error" | count by session_id | sort desc` |

---

### 8.2 Agent Flow Queries (Event System)

| Question | How to Query |
|----------|--------------|
| "What's the average tokens per turn for this session?" | `| where type == "turn_summary" | avg(total_tokens)` |
| "Which sessions were abandoned mid-turn?" | `| where type == "session_end" and outcome == "aborted"` |
| "What's the most common error type in sessions?" | `| where type == "session_end" | count by errors[].type` |
| "How long do sessions typically last?" | `| where type == "session_end" | stats(duration_ms)` |
| "Which model has the best latency?" | `| where type == "model_request_summary" | avg(latency_ms) by model_name` |

---

### 8.3 Cross-System Queries (Pino + Events)

| Question | How to Query |
|----------|--------------|
| "Why did this session fail?" | 1. Get session_id from `session_end` event<br>2. Query all Pino logs for that session_id<br>3. Correlate errors with turns |
| "Which operation is causing timeouts?" | 1. Query `session_end` events with outcome="timeout"<br>2. Join with Pino logs by session_id<br>3. Identify last operation before timeout |
| "What's the end-to-end latency of a turn?" | 1. Get `turn_summary` event for turn N<br>2. Query Pino logs for model request timing<br>3. Add streaming duration from events |

---

## 9. Testing Strategy

### 9.1 Test Principles

1. **Don't mock telemetry** - Test with real Pino and event system
2. **Verify correctness** - Assert telemetry fields are present and accurate
3. **Golden recordings** - Record expected telemetry output for regression testing
4. **Performance tests** - Verify <5% overhead

---

### 9.2 Test Categories

#### Unit Tests

**Test telemetry emission in isolation:**

```typescript
test('logOperation emits Pino event with required fields', async () => {
  const mockLogger = createMockLogger();
  const spy = jest.spyOn(mockLogger, 'info');

  await logOperation('test_operation', async () => {
    await Promise.resolve('result');
  }, { metadata_field: 'value' });

  expect(spy).toHaveBeenCalledWith(
    expect.objectContaining({
      session_id: expect.any(String),
      operation: 'test_operation',
      outcome: 'success',
      duration_ms: expect.any(Number),
      metadata_field: 'value'
    })
  );
});
```

---

#### Integration Tests

**Test session-level telemetry across components:**

```typescript
test('session end emits summary with accumulated metrics', async () => {
  const sessionTracker = new SessionTracker();
  sessionTracker.start();

  // Simulate turns
  sessionTracker.recordTurn();
  sessionTracker.recordTokens({ input: 100, output: 200 });
  sessionTracker.recordTokens({ input: 150, output: 300 });

  sessionTracker.end('completed');

  const summary = sessionTracker.getSummary();

  expect(summary.total_turns).toBe(1);
  expect(summary.total_tokens).toEqual({ input: 250, output: 500 });
  expect(summary.outcome).toBe('completed');
});
```

---

#### Golden Recording Tests

**Record expected telemetry output and verify against it:**

```typescript
test('telemetry matches golden recording', async () => {
  const telemetry = captureTelemetry(() => {
    // Execute scenario
  });

  const expected = readGoldenRecording('telemetry/session-success.json');

  expect(telemetry.pinoLogs).toMatchGolden(expected.pinoLogs);
  expect(telemetry.events).toMatchGolden(expected.events);
});
```

**Recording script:**

```typescript
// scripts/record-telemetry.ts
async function recordGoldenTelemetry(scenario: string) {
  const recorder = new TelemetryRecorder();

  await recorder.start();
  await runScenario(scenario);
  const output = await recorder.stop();

  await fs.writeFile(
    `tests/telemetry/fixtures/${scenario}.json`,
    JSON.stringify(output, null, 2)
  );
}
```

---

#### Performance Tests

**Verify overhead <5%:**

```typescript
test('telemetry overhead is less than 5%', async () => {
  const withoutTelemetry = await measureTime(() => {
    // Run scenario without telemetry
  });

  const withTelemetry = await measureTime(() => {
    // Run scenario with telemetry
  });

  const overhead = (withTelemetry - withoutTelemetry) / withoutTelemetry;
  expect(overhead).toBeLessThan(0.05);  // <5%
});
```

---

## 10. Migration Strategy

### 10.1 Incremental Rollout

**Phase 1: Foundation (Week 1)**
- Add Pino dependency
- Implement `SessionTracker` class
- Set up AsyncLocalStorage context propagation
- Create telemetry utilities (`logOperation`, child logger pattern)
- Tests: Unit tests for foundation

**Phase 2: Entry Points (Week 2)**
- Instrument session entry points (harness, renderer)
- Add session start/end events
- Validate session context propagation
- Tests: Integration tests with mock sessions

**Phase 3: SDK Requests (Week 3)**
- Wrap all SDK method calls with `logOperation`
- Add model request summary events
- Test with golden recordings of real SDK responses
- Tests: Live integration tests (require auth)

**Phase 4: Event System (Week 4)**
- Extend event bus with telemetry metadata injection
- Add summary events (turn, model request, session)
- Test event enrichment
- Tests: Verify metadata on all emitted events

**Phase 5: Transport Layer (Week 5)**
- Instrument HTTP/WebSocket boundaries
- Add request/response telemetry
- Test with real HTTP traffic
- Tests: Load tests with telemetry enabled

**Phase 6: Pause/Resume (Week 6)**
- Instrument state persistence operations
- Add session pause/resume events
- Test state recovery with telemetry intact
- Tests: Pause/resume integration tests

**Phase 7: Error Boundaries (Week 7)**
- Wrap all error paths with telemetry
- Add error classification logic
- Test error handling and recovery
- Tests: Error injection tests

**Phase 8: Validation (Week 8)**
- Run full test suite with telemetry enabled
- Measure performance overhead
- Validate query patterns work as expected
- Fix any issues

**Phase 9: Production Readiness (Week 9)**
- Configure log aggregation (Datadog, Loki, etc.)
- Set up alerts (error rate spikes, latency increases)
- Document query patterns for operators
- Train team on debugging with telemetry

---

### 10.2 Rollback Plan

**If issues arise:**
1. **Feature flag** telemetry: Add `TELEMETRY_ENABLED=false` to disable
2. **Graceful degradation:** If Pino fails to log, don't crash the session
3. **Sampling override:** Increase sampling rates to reduce load
4. **Hotfix:** Rollback to previous version without telemetry

**Feature flag pattern:**
```typescript
const TELEMETRY_ENABLED = process.env.TELEMETRY_ENABLED !== 'false';

function logOperation<T>(...): Promise<T> {
  if (!TELEMETRY_ENABLED) {
    return fn();  // Skip telemetry entirely
  }

  // Normal telemetry logic
}
```

---

### 10.3 Migration Checklist

- [ ] Add Pino dependency to all packages
- [ ] Implement SessionTracker class
- [ ] Set up AsyncLocalStorage context propagation
- [ ] Create telemetry utility functions
- [ ] Write unit tests for telemetry utilities
- [ ] Instrument session entry points
- [ ] Add session start/end events
- [ ] Write integration tests for session lifecycle
- [ ] Wrap all SDK method calls
- [ ] Add model request summary events
- [ ] Record golden fixtures for SDK responses
- [ ] Write integration tests with real SDK
- [ ] Extend event bus with telemetry metadata
- [ ] Add summary events
- [ ] Write tests for event enrichment
- [ ] Instrument HTTP/WebSocket boundaries
- [ ] Write transport-level tests
- [ ] Instrument pause/resume state persistence
- [ ] Write pause/resume integration tests
- [ ] Wrap all error paths
- [ ] Write error injection tests
- [ ] Run full test suite with telemetry
- [ ] Measure performance overhead
- [ ] Configure log aggregation
- [ ] Set up alerts and dashboards
- [ ] Document query patterns
- [ ] Train team on telemetry debugging
- [ ] Roll out to production with feature flag
- [ ] Monitor for issues
- [ ] Gradually increase sampling rates

---

## 11. Success Criteria

### 11.1 Technical Success

| Criterion | Target | How to Measure |
|-----------|--------|----------------|
| **Query latency** | <5 seconds to answer "what happened in session X?" | Test query performance |
| **Performance overhead** | <5% impact on agent execution | Measure before/after |
| **Test coverage** | >90% of instrumentation paths | Code coverage report |
| **Error tracking** | 100% of errors logged with context | Review error logs |
| **Session traceability** | 100% of sessions traceable end-to-end | Sample query sessions |

---

### 11.2 Business Success

| Criterion | Target | How to Measure |
|-----------|--------|----------------|
| **Debug time reduction** | Reduce session debugging time by 50% | Survey team members |
| **Incident response time** | Identify root cause within 5 minutes | Test incident scenarios |
| **Visibility** | Answer "what's wrong with this session?" in <10 seconds | Query performance tests |

---

## 12. Open Questions and Risks

### 12.1 Open Questions

1. **Log aggregation platform:** Which platform to use? (Datadog, Loki, Splunk?)
2. **Retention policy:** What are the compliance requirements for data retention?
3. **PII policy:** Are user messages considered PII? Need legal review.
4. **Sampling rates:** Are the proposed sampling rates appropriate for traffic volume?
5. **Cost projection:** What's the expected cost of log aggregation?

---

### 12.2 Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Log volume explosion** | Medium | High | Aggressive sampling, redaction, retention policies |
| **Performance regression** | Low | High | Feature flag, performance tests, gradual rollout |
| **PII leakage in logs** | Low | High | PII redaction rules, compliance review, automated scanning |
| **Context propagation failures** | Medium | Medium | Comprehensive tests, fallback to session_id only |
| **Team adoption** | Low | Medium | Training, documentation, examples |

---

## 13. Appendices

### Appendix A: Example Query Scenarios

**Scenario 1: Debugging a Failed Session**

```bash
# 1. Find the session ID
grep "session_start" telemetry.log | grep "user@example.com" | tail -1

# 2. Get session summary
grep "session_end" telemetry.log | grep "<session_id>"

# 3. Find errors in the session
grep "<session_id>" telemetry.log | grep "outcome: \"error\""

# 4. Check model request performance
grep "sdk_model_request" telemetry.log | grep "<session_id>" | jq '.duration_ms'
```

**Scenario 2: Investigating High Latency**

```bash
# Find slow model requests
grep "sdk_model_request" telemetry.log | jq 'select(.duration_ms > 5000)'

# Group by model
grep "sdk_model_request" telemetry.log | jq 'group_by(.model_name) | map({model: .[0].model_name, avg_lat: map(.duration_ms) | add / length})'
```

---

### Appendix B: Configuration Reference

**Environment Variables:**

```bash
# Enable/disable telemetry
TELEMETRY_ENABLED=true

# Pino log level
LOG_LEVEL=info

# Sampling rates
TELEMETRY_SAMPLING_DEBUG=0.01
TELEMETRY_SAMPLING_INFO=0.10
TELEMETRY_SAMPLING_WARN=0.50

# Deployment identifier
DEPLOYMENT_ID=prod-abc123

# Log aggregation endpoint
TELEMETRY_ENDPOINT=https://logs.example.com/ingest

# PII redaction
TELEMETRY_REDACT_PII=true
TELEMETRY_RETENTION_DAYS_OPERATIONAL=30
TELEMETRY_RETENTION_DAYS_AGENT_FLOW=365
```

**Package Dependencies:**

```json
{
  "dependencies": {
    "pino": "^9.0.0",
    "pino-pretty": "^11.0.0"
  },
  "devDependencies": {
    "@types/pino": "^8.0.0"
  }
}
```

---

### Appendix C: Event Type Reference

**Existing Event Types (008):**
- `user_message` - User input to agent
- `text_delta` - Streaming response chunk
- `tool_use` - Agent invokes a tool
- `tool_result` - Tool execution result
- `error` - Error occurred
- ... (existing event types)

**New Event Types (Telemetry):**
- `session_start` - Session initialization
- `session_end` - Session termination
- `session_pause` - Session paused
- `session_resume` - Session resumed
- `turn_summary` - Turn completed
- `model_request_summary` - Model request completed

---

## Document Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-06 | opencode | Initial specification |