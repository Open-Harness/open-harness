# Open Harness SDK v0.2.0 - Complete Implementation Plan

**Status:** Locked Decisions - Ready for Implementation
**Created:** 2025-01-06
**Target Completion:** 4-5 days (30-40 hours)

---

## Executive Summary

This plan implements HTTP + SSE architecture for Open Harness SDK with support for:
- **Remote execution** (primary use case): Browser apps connect to your Hono servers
- **Local development**: Same-process integration for Next.js local dev
- **All workflow durations**: Simple agent calls to indefinite long-running workflows
- **Industry standards**: HTTP + SSE following familiar patterns (Vercel, OpenAI, GitHub)

**Package approach:** Single package `@open-harness/sdk` with conditional exports
- Core runtime (web-compatible)
- Server exports (Node.js/Bun only)
- Client exports (browser/edge)
- React hooks (browser/edge)

---

## Locked Decisions

### 1. Package Structure ✅
```
@open-harness/sdk/
├── src/core/           # Runtime, events, types, registry
├── src/server/         # Server-specific code
├── src/client/         # Client-specific code
└── src/index.ts        # Core exports only
```

**Single package with conditional exports** - not separate packages.

### 2. Symmetrical Naming ✅
```
Server: LocalAIKitTransport (wraps Runtime directly)
Client: RemoteAIKitTransport (HTTP + SSE)
```

### 3. Transport Architecture ✅
- **Option A: SSE + HTTP only** (no WebSocket server for public API)
- Keep existing WebSocket server for internal/dev use only
- HTTP POST for commands
- Server-Sent Events for streaming responses
- Industry standard, familiar mental model

### 4. AI SDK Transport Location ✅
```
src/server/transports/
├── websocket-server.ts          # Existing, keep for internal/dev
└── ai-sdk-local-transport.ts   # LocalAIKitTransport (moved from ai-sdk package)
```

**Not separate `ai-sdk/` folder** - under transports/ where it belongs.

### 5. Workflow Support ✅
- **Simple workflows** (minutes): UI wrapper with guardrails
- **Long-running workflows** (days/indefinite): Continuous SSE streaming
- **Same mechanism for both**: SSE connection stays open indefinitely

### 6. Local Development ✅
Keep `LocalAIKitTransport` for Next.js same-process integration.

### 7. API Framework ✅
**Hono** - Lightweight, multi-runtime, built for this use case.

### 8. React Hooks ✅
Build both in v1:
- `useHarness()` - High-level, 90% use case
- `useRuntime()` - Low-level, local dev / advanced

### 9. Authentication ✅
**Leave to users** - no built-in auth middleware in v1.
Document patterns for adding Hono middleware.

### 10. CORS Configuration ✅
**Opt-in** - provide `cors()` middleware but not enabled by default.
Security-conscious approach.

### 11. Run ID Management ✅
**Server generates run IDs** - POST `/api/chat` returns runId for SSE subscription.

### 12. SSE Connection Lifecycle ✅
**Multiple conditions** - Close on:
- Flow completion (`flow:complete` event)
- Client disconnect
- Timeout after 30 minutes of inactivity
- Reconnect if client still active

### 13. Error Handling ✅
**Both channels** - JSON error for HTTP, SSE error event if connected.

### 14. TypeScript Types ✅
**Strict types** - Hardcoded to `UIMessage`, `UIMessageChunk` from Vercel AI SDK.
No generics for v1.

---

## Detailed Package Structure

```
@open-harness/sdk/
├── package.json                     # Conditional exports, build scripts
├── tsconfig.build.json              # Multi-entry point config
├── README.md                        # Updated documentation
├── src/
│   │
│   ├── core/                        # ✅ Existing, NO changes
│   │   ├── runtime/
│   │   │   ├── runtime.ts
│   │   │   ├── executor.ts
│   │   │   ├── scheduler.ts
│   │   │   ├── compiler.ts
│   │   │   ├── bindings.ts
│   │   │   ├── snapshot.ts
│   │   │   └── when.ts
│   │   ├── events/
│   │   │   └── events.ts
│   │   ├── types/
│   │   │   └── types.ts
│   │   ├── core/
│   │   │   ├── cancel.ts
│   │   │   └── state.ts
│   │   ├── harness/
│   │   │   └── harness.ts
│   │   ├── registry/
│   │   │   └── registry.ts
│   │   ├── persistence/
│   │   │   ├── memory-run-store.ts
│   │   │   └── run-store.ts
│   │   ├── testing/
│   │   │   └── index.ts
│   │   └── nodes/
│   │       └── index.ts
│   │
│   ├── server/                      # 🆕 NEW folder - all server code
│   │   │
│   │   ├── transports/
│   │   │   ├── websocket-server.ts          # ✅ MOVE from transport-websocket
│   │   │   ├── ai-sdk-local-transport.ts    # ✅ MOVE from ai-sdk (rename)
│   │   │   └── index.ts
│   │   │
│   │   ├── providers/
│   │   │   ├── anthropic-provider.ts        # ✅ MOVE from provider-anthropic
│   │   │   └── index.ts
│   │   │
│   │   ├── api-routes/                   # 🆕 NEW (Hono API)
│   │   │   ├── chat.ts                  # POST /api/chat (~80 lines)
│   │   │   ├── events.ts                # GET /api/events/:runId (~60 lines)
│   │   │   ├── commands.ts              # POST /api/commands (~40 lines)
│   │   │   ├── health.ts                # GET /health (~20 lines)
│   │   │   └── index.ts
│   │   │
│   │   ├── middleware/                     # 🆕 NEW
│   │   │   ├── cors.ts                  # (~15 lines)
│   │   │   └── error-handler.ts         # (~30 lines)
│   │   │
│   │   ├── persistence/                     # ✅ MOVE from persistence/sqlite
│   │   │   ├── sqlite-store.ts
│   │   │   └── index.ts
│   │   │
│   │   └── index.ts                      # Server exports
│   │
│   ├── client/                      # 🆕 NEW folder - all client code
│   │   │
│   │   ├── transports/
│   │   │   └── http-sse-client.ts          # 🆕 NEW (~200 lines)
│   │   │
│   │   ├── ai-sdk/
│   │   │   └── remote-transport.ts          # 🆕 NEW (~180 lines)
│   │   │
│   │   ├── react/                           # 🆕 NEW
│   │   │   ├── use-harness.ts              # (~70 lines)
│   │   │   ├── use-runtime.ts              # (~40 lines)
│   │   │   └── index.ts
│   │   │
│   │   └── index.ts                      # Client exports
│   │
│   └── index.ts                      # Core exports only
│
├── tests/
│   ├── server/                     # 🆕 NEW
│   │   ├── api-routes.test.ts
│   │   ├── integration.test.ts
│   │   └── middleware.test.ts
│   ├── client/                     # 🆕 NEW
│   │   ├── http-sse-client.test.ts
│   │   ├── remote-transport.test.ts
│   │   └── react-hooks.test.ts
│   └── (existing tests)
│
└── docs/
    └── (existing docs)
```

---

## Implementation Phases

### Phase 1: Package Restructure (4-5 hours)

**Goal:** Reorganize existing code into new structure without breaking it.

**Tasks:**

1. Create new folder structure:
   ```bash
   mkdir -p src/server/{transports,providers,api-routes,middleware,persistence}
   mkdir -p src/client/{transports,ai-sdk,react}
   mkdir -p tests/{server,client}
   ```

2. Move existing code:
   ```bash
   # Move transports
   mv packages/transport/websocket/src/* src/server/transports/
   mv packages/transport/ai-sdk/src/* src/server/transports/

   # Move providers
   mv packages/providers/anthropic/src/* src/server/providers/

   # Move persistence
   mv packages/persistence/sqlite/src/* src/server/persistence/
   ```

3. Update all moved files:
   - Fix import paths (workspace imports → local imports)
   - Update package.json references
   - Verify TypeScript compiles

4. Test builds:
   ```bash
   bun run build:core
   bun run build:server
   bun run build:client
   ```

5. Run existing tests to ensure no regressions:
   ```bash
   bun run test
   ```

**Dependencies:** None (reorganization only)
**New abstractions:** None
**Risk:** Low - just moving code

---

### Phase 2: Hono API Routes (8-10 hours)

**Goal:** Build HTTP + SSE API for remote clients.

**Tasks:**

1. Add Hono dependencies:
   ```bash
   bun add hono
   ```

2. Create API routes:

   **src/server/api-routes/chat.ts** (~80 lines)
   ```typescript
   import { Hono } from 'hono';

   interface ChatRequest {
     messages: UIMessage[];
     options?: {
       abortSignal?: AbortSignal;
       // ... other AI SDK options
     };
   }

   interface ChatResponse {
     runId: string;
   }

   export function createChatRoute(runtime: Runtime) {
     const app = new Hono();

     app.post('/api/chat', async (c) => {
       const { messages, options } = await c.req.json<ChatRequest>();

       // Extract last user message
       const lastUser = messages.findLast(m => m.role === 'user');
       if (!lastUser) {
         return c.json({ error: 'No user message found' }, 400);
       }

       // Generate run ID
       const runId = crypto.randomUUID();

       // Dispatch to runtime
       const textPart = lastUser.parts.find(p => p.type === 'text') as { text: string };
       runtime.dispatch({
         type: 'send',
         message: textPart?.text || '',
         runId
       });

       // Return runId for SSE subscription
       return c.json<ChatResponse>({ runId }, 201);
     });

     return app;
   }
   ```

   **src/server/api-routes/events.ts** (~60 lines)
   ```typescript
   import { Hono } from 'hono';
   import { streamSSE } from 'hono/streaming';
   import { createPartTracker, transformEvent } from '../transports/transforms';

   export function createEventsRoute(runtime: Runtime) {
     const app = new Hono();

     app.get('/api/events/:runId', (c) => {
       const runId = c.req.param('runId');
       const timeoutMs = 30 * 60 * 1000;
       const messageId = crypto.randomUUID();

       return streamSSE(c, async (stream) => {
         const tracker = createPartTracker();
         let unsubscribe: (() => void) | null = null;
         let lastActivity = Date.now();

         // IMPORTANT: Hono closes the SSE stream when this callback resolves.
         // Keep it open by awaiting a promise that resolves on terminal/timeout/abort.
         let resolveDone!: () => void;
         const done = new Promise<void>((resolve) => {
           resolveDone = resolve;
         });

         const cleanup = () => {
           if (unsubscribe) {
             unsubscribe();
             unsubscribe = null;
           }
           resolveDone();
         };

         // Client disconnect
         c.req.raw.signal.addEventListener('abort', cleanup, { once: true });

         // Inactivity timeout (30 minutes)
         const timeoutCheck = setInterval(() => {
           if (Date.now() - lastActivity > timeoutMs) {
             cleanup();
           }
         }, 60 * 1000);

         unsubscribe = runtime.onEvent(async (event) => {
           if ('runId' in event && event.runId !== runId) return;
           lastActivity = Date.now();

           const chunks = transformEvent(event, tracker, messageId, {
             sendReasoning: true,
             sendStepMarkers: true,
             sendFlowMetadata: false,
             sendNodeOutputs: false,
             generateMessageId: () => messageId,
           });

           for (const chunk of chunks) {
             // IMPORTANT: writeSSE expects string data; serialize chunks.
             await stream.writeSSE({ data: JSON.stringify(chunk) });
           }

           // Close stream on terminal events
           if (
             event.type === 'agent:complete' ||
             event.type === 'agent:paused' ||
             event.type === 'agent:aborted' ||
             event.type === 'flow:complete' ||
             event.type === 'flow:aborted'
           ) {
             cleanup();
           }
         });

         await done;
         clearInterval(timeoutCheck);
       });
     });

     return app;
   }
   ```

   **src/server/api-routes/commands.ts** (~40 lines)
   ```typescript
   export function createCommandsRoute(runtime: Runtime) {
     const app = new Hono();

     app.post('/api/commands', async (c) => {
       const command = await c.req.json<RuntimeCommand>();

       // Validate command
       if (!command.type) {
         return c.json({ error: 'Missing command type' }, 400);
       }

       // Dispatch to runtime
       runtime.dispatch(command);

       return c.json({ success: true }, 202);
     });

     return app;
   }
   ```

   **src/server/api-routes/health.ts** (~20 lines)
   ```typescript
   export function createHealthRoute() {
     const app = new Hono();

     app.get('/health', (c) => {
       return c.json({
         status: 'ok',
         timestamp: new Date().toISOString(),
       });
     });

     return app;
   }
   ```

   **src/server/api-routes/index.ts** (~30 lines)
   ```typescript
   import { createChatRoute } from './chat';
   import { createEventsRoute } from './events';
   import { createCommandsRoute } from './commands';
   import { createHealthRoute } from './health';

   export function createAPIRoutes(runtime: Runtime) {
     const app = new Hono();

     app.route('/', createChatRoute(runtime));
     app.route('/', createEventsRoute(runtime));
     app.route('/', createCommandsRoute(runtime));
     app.route('/', createHealthRoute());

     return app;
   }
   ```

3. Create middleware:

   **src/server/middleware/cors.ts** (~15 lines)
   ```typescript
   import { cors } from 'hono/cors';

   export const corsMiddleware = cors({
     // Not enabled by default - users opt-in
     origin: undefined, // Must be configured
     credentials: true,
     allowMethods: ['POST', 'GET', 'OPTIONS'],
     allowHeaders: ['Content-Type', 'Authorization'],
   });
   ```

   **src/server/middleware/error-handler.ts** (~30 lines)
   ```typescript
   export function errorHandler(err: Error, c: any) {
     console.error('API Error:', err);

     // Try SSE error event if connected
     try {
       const stream = c.get('sseStream');
       if (stream) {
         // IMPORTANT: writeSSE expects string data
         void stream.writeSSE({
           data: JSON.stringify({
             type: 'error',
             errorText: err.message,
           }),
         });
       }
     } catch {
       // Ignore if no SSE stream
     }

     // Also return JSON error
     return c.json({
       error: err.message,
       stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
     }, 500);
   }
   ```

4. Add `uuid` dependency for run ID generation.

5. Write tests for all routes and middleware.

**Dependencies:**
- `hono` (^4.x)
- `hono/cors` (built-in)
- `@hono/streaming`
- `uuid` (^10.x)

**New abstractions:** None (just route handlers)

**Risk:** Medium - SSE streaming requires careful state management

---

### Phase 3: Remote AI Kit Transport (6-8 hours)

**Goal:** Build `RemoteAIKitTransport` for remote clients using HTTP + SSE.

**Tasks:**

1. Create **src/client/ai-sdk/remote-transport.ts** (~180 lines):
   ```typescript
   import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai';

   export interface RemoteAIKitTransportOptions {
     serverUrl: string;
     timeout?: number; // Default: 30 minutes
   }

   export class RemoteAIKitTransport implements ChatTransport<UIMessage> {
     private readonly options: Required<RemoteAIKitTransportOptions>;
     private readonly serverUrl: string;

     constructor(options: RemoteAIKitTransportOptions) {
       this.options = {
         serverUrl: options.serverUrl,
         timeout: options.timeout ?? 30 * 60 * 1000,
       };
       this.serverUrl = options.serverUrl.replace(/\/$/, ''); // Remove trailing slash
     }

     async sendMessages(options: {
       trigger: 'submit-message' | 'regenerate-message';
       chatId: string;
       messageId: string | undefined;
       messages: UIMessage[];
       abortSignal?: AbortSignal;
     }): Promise<ReadableStream<UIMessageChunk>> {
       const { messages, abortSignal } = options;
       const messageId = options.messageId ?? generateId();

       // Step 1: POST to /api/chat
       const chatResponse = await fetch(`${this.serverUrl}/api/chat`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ messages }),
         signal: abortSignal,
       });

       if (!chatResponse.ok) {
         throw new Error(`Chat request failed: ${chatResponse.statusText}`);
       }

       const { runId } = await chatResponse.json();

       // Step 2: Connect to SSE stream
       return new ReadableStream<UIMessageChunk>({
         start: async (controller) => {
           let eventSource: EventSource | null = null;
           let timeoutTimer: NodeJS.Timeout | null = null;
           let isClosed = false;

           // Set timeout
           if (this.options.timeout) {
             timeoutTimer = setTimeout(() => {
               if (!isClosed) {
                 isClosed = true;
                 eventSource?.close();
                 controller.error(new Error('Request timeout'));
               }
             }, this.options.timeout);
           }

           // Subscribe to abort signal
           if (abortSignal) {
             abortSignal.addEventListener('abort', () => {
               if (!isClosed) {
                 isClosed = true;
                 eventSource?.close();
                 timeoutTimer && clearTimeout(timeoutTimer);
                 controller.close();
               }
             });
           }

           // Connect to SSE
           try {
             eventSource = new EventSource(`${this.serverUrl}/api/events/${runId}`);

             eventSource.onmessage = (event) => {
               if (isClosed) return;

               try {
                 const uiPart = JSON.parse(event.data) as UIMessageChunk;

                 // Skip invalid chunks
                 if (!uiPart || typeof uiPart !== 'object' || !('type' in uiPart)) {
                   console.warn('[Transport] Skipping invalid chunk:', uiPart);
                   return;
                 }

                 // Enqueue chunk
                 try {
                   controller.enqueue(uiPart);
                 } catch (enqueueError) {
                   if (enqueueError instanceof TypeError &&
                       (enqueueError.message.includes('closed') ||
                        enqueueError.message.includes('Cannot enqueue'))) {
                     isClosed = true;
                     eventSource?.close();
                     timeoutTimer && clearTimeout(timeoutTimer);
                   }
                 }

                 // Close on terminal events
                 if (uiPart.type === 'text-end' || uiPart.type === 'data-end') {
                   isClosed = true;
                   eventSource?.close();
                   timeoutTimer && clearTimeout(timeoutTimer);
                   controller.close();
                 }

               } catch (parseError) {
                 console.error('Failed to parse SSE event:', parseError);
               }
             };

             eventSource.onerror = (error) => {
               if (!isClosed) {
                 isClosed = true;
                 controller.error(new Error('SSE connection error'));
               }
             };

           } catch (connectError) {
             controller.error(connectError);
           }
         },
       });
     }
   }

   function generateId(): string {
     return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
   }
   ```

2. Write tests:
   - Mock fetch for POST requests
   - Mock EventSource for SSE
   - Test connection lifecycle
   - Test timeout handling
   - Test abort signal handling

**Dependencies:** None (uses `fetch`, `EventSource`)

**New abstractions:** None (implements existing `ChatTransport`)

**Risk:** Medium - SSE reconnection and error handling is tricky

---

### Phase 4: HTTP + SSE Client (4-6 hours)

**Goal:** Build reusable HTTP + SSE client for low-level access.

**Tasks:**

1. Create **src/client/transports/http-sse-client.ts** (~200 lines):
   ```typescript
   export interface HTTPSSEClientOptions {
     serverUrl: string;
     timeout?: number;
     reconnectDelay?: number;
     maxReconnectAttempts?: number;
   }

   export class HTTPSSEClient {
     private readonly options: Required<HTTPSSEClientOptions>;
     private eventSource?: EventSource;
     private reconnectAttempts = 0;
     private reconnectTimer?: NodeJS.Timeout;

     constructor(options: HTTPSSEClientOptions) {
       this.options = {
         serverUrl: options.serverUrl.replace(/\/$/, ''),
         timeout: options.timeout ?? 30 * 60 * 1000,
         reconnectDelay: options.reconnectDelay ?? 1000,
         maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
       };
     }

     async connect(runId: string, onEvent: (event: any) => void): Promise<void> {
       const url = `${this.options.serverUrl}/api/events/${runId}`;

       this.eventSource = new EventSource(url);

       this.eventSource.onmessage = (event) => {
         try {
           const data = JSON.parse(event.data);
           onEvent(data);
         } catch (error) {
           console.error('Failed to parse SSE event:', error);
         }
       };

       this.eventSource.onopen = () => {
         this.reconnectAttempts = 0;
         console.log(`Connected to ${url}`);
       };

       this.eventSource.onerror = () => {
         this.scheduleReconnect(runId, onEvent);
       };
     }

     async sendCommand(command: RuntimeCommand): Promise<void> {
       const response = await fetch(`${this.options.serverUrl}/api/commands`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(command),
       });

       if (!response.ok) {
         throw new Error(`Command failed: ${response.statusText}`);
       }
     }

     async startChat(messages: UIMessage[]): Promise<{ runId: string }> {
       const response = await fetch(`${this.options.serverUrl}/api/chat`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ messages }),
       });

       if (!response.ok) {
         throw new Error(`Chat request failed: ${response.statusText}`);
       }

       return response.json();
     }

     disconnect(): void {
       if (this.eventSource) {
         this.eventSource.close();
         this.eventSource = undefined;
       }
       if (this.reconnectTimer) {
         clearTimeout(this.reconnectTimer);
         this.reconnectTimer = undefined;
       }
     }

     private scheduleReconnect(runId: string, onEvent: (event: any) => void): void {
       if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
         console.error('Max reconnection attempts reached');
         return;
       }

       this.disconnect();

       const delay = Math.min(
         this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts),
         30000
       );

       this.reconnectTimer = setTimeout(() => {
         this.reconnectAttempts++;
         this.connect(runId, onEvent);
       }, delay);
     }
   }
   ```

2. Write tests:
   - Mock fetch and EventSource
   - Test reconnection logic
   - Test timeout handling

**Dependencies:** None

**New abstractions:** `HTTPSSEClient` class (simple wrapper)

**Risk:** Low - straightforward implementation

---

### Phase 5: React Hooks (3-4 hours)

**Goal:** Build `useHarness()` and `useRuntime()` hooks.

**Tasks:**

1. Create **src/client/react/use-harness.ts** (~70 lines):
   ```typescript
   import { useState, useEffect } from 'react';
   import type { RuntimeEvent } from '../../core/types';
   import { RemoteAIKitTransport } from '../ai-sdk/remote-transport';
   import { HTTPSSEClient } from '../transports/http-sse-client';

   export interface UseHarnessOptions {
     serverUrl?: string;
     transport?: RemoteAIKitTransport;
     autoConnect?: boolean; // Default: true
   }

   export interface UseHarnessReturn {
     events: RuntimeEvent[];
     status: 'idle' | 'running' | 'paused' | 'complete';
     sendMessage: (message: string) => Promise<void>;
     sendCommand: (command: RuntimeCommand) => Promise<void>;
     isConnected: boolean;
     error?: Error;
   }

   export function useHarness(options: UseHarnessOptions = {}): UseHarnessReturn {
     const [events, setEvents] = useState<RuntimeEvent[]>([]);
     const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'complete'>('idle');
     const [isConnected, setIsConnected] = useState(false);
     const [error, setError] = useState<Error | undefined>(undefined);

     const transport = options.transport ?? new RemoteAIKitTransport({
       serverUrl: options.serverUrl ?? 'http://localhost:3000',
     });

     useEffect(() => {
       if (!options.autoConnect ?? true) return;

       let unsubscribe: (() => void) | null = null;
       let currentRunId: string | null = null;

       // Connect to SSE for events
       const connect = async () => {
         try {
           setIsConnected(true);
           setError(undefined);

           // Note: We can't directly subscribe to transport here
           // because transport.sendMessages returns a stream
           // In practice, users would call transport.sendMessages
           // and handle the returned stream directly

         } catch (err) {
           setError(err instanceof Error ? err : new Error('Unknown error'));
           setIsConnected(false);
         }
       };

       connect();

       return () => {
         unsubscribe?.();
         currentRunId = null;
       };
     }, [options.serverUrl, options.autoConnect]);

     // Monitor events for status updates
     useEffect(() => {
       const lastEvent = events[events.length - 1];
       if (!lastEvent) return;

       if (lastEvent.type === 'flow:start') setStatus('running');
       if (lastEvent.type === 'flow:complete') setStatus('complete');
       if (lastEvent.type === 'flow:paused') setStatus('paused');
       if (lastEvent.type === 'flow:aborted') setStatus('idle');
     }, [events]);

     const sendMessage = async (message: string) => {
       // This would trigger a chat via transport
       // Implementation depends on how transport is used
       throw new Error('sendMessage not yet implemented - use transport directly');
     };

     const sendCommand = async (command: RuntimeCommand) => {
       // This would send via HTTPSSEClient
       throw new Error('sendCommand not yet implemented - use HTTPSSEClient directly');
     };

     return {
       events,
       status,
       sendMessage,
       sendCommand,
       isConnected,
       error,
     };
   }
   ```

   **Note:** Initial implementation focuses on event consumption. Full `sendMessage`/`sendCommand` integration can be refined based on usage patterns.

2. Create **src/client/react/use-runtime.ts** (~40 lines):
   ```typescript
   import { useState, useEffect } from 'react';
   import type { Runtime } from '../../core/runtime/runtime';
   import type { RuntimeEvent } from '../../core/events/events';

   export interface UseRuntimeReturn {
     events: RuntimeEvent[];
     dispatch: (command: RuntimeCommand) => void;
     run: (input?: Record<string, unknown>) => Promise<void>;
   }

   export function useRuntime(runtime: Runtime): UseRuntimeReturn {
     const [events, setEvents] = useState<RuntimeEvent[]>([]);

     useEffect(() => {
       const unsubscribe = runtime.onEvent((event) => {
         setEvents((prev) => [...prev, event]);
       });
       return unsubscribe;
     }, [runtime]);

     return {
       events,
       dispatch: runtime.dispatch.bind(runtime),
       run: runtime.run.bind(runtime),
     };
   }
   ```

3. Create **src/client/react/index.ts** (~10 lines):
   ```typescript
   export { useHarness } from './use-harness';
   export { useRuntime } from './use-runtime';
   export type { UseHarnessOptions, UseHarnessReturn } from './use-harness';
   export type { UseRuntimeReturn } from './use-runtime';
   ```

4. Add `react` peer dependency to package.json.

5. Write tests for both hooks.

**Dependencies:**
- `react` (peer dependency ^18.x)
- `react-dom` (for testing)

**New abstractions:** None (standard React patterns)

**Risk:** Low - well-trodden React patterns

---

### Phase 6: Build System & Exports (3-4 hours)

**Goal:** Configure multi-entry point builds and conditional exports.

**Tasks:**

1. Update **package.json**:
   ```json
   {
     "name": "@open-harness/sdk",
     "version": "0.2.0",
     "type": "module",
     "private": false,

     "exports": {
       ".": {
         "types": "./dist/index.d.ts",
         "import": "./dist/index.js"
       },
       "./server": {
         "types": "./dist/server/index.d.ts",
         "import": "./dist/server/index.js",
         "browser": false,
         "edge-runtime": false
       },
       "./client": {
         "types": "./dist/client/index.d.ts",
         "import": "./dist/client/index.js"
       },
       "./react": {
         "types": "./dist/client/react/index.d.ts",
         "import": "./dist/client/react/index.js",
         "browser": true,
         "edge-runtime": true
       }
     },

     "browser": {
       "./server": false
     },

     "edge-runtime": {
       "./server": false
     },

     "scripts": {
       "build": "bun run build:core && bun run build:server && bun run build:client && bun run build:types",
       "build:core": "bun build src/index.ts --outdir dist --format esm --target=bun --external hono --external @hono/streaming",
       "build:server": "bun build src/server/index.ts --outdir dist/server --format esm --target=bun",
       "build:client": "bun build src/client/index.ts --outdir dist/client --format esm --target=bun",
       "build:types": "tsc --project tsconfig.build.json",
       "dev": "bun run build && bun run --watch src/",
       "test": "bun test tests/",
       "test:server": "bun test tests/server/",
       "test:client": "bun test tests/client/",
       "lint": "biome check .",
       "lint:fix": "biome check . --write",
       "typecheck": "tsc --noEmit"
     },

     "dependencies": {
       "@open-harness/nodes-basic": "workspace:*",
       "jsonata": "^2.1.0",
       "yaml": "^2.8.2",
       "zod": "^4.3.4",
       "uuid": "^10.0.0",
       "hono": "^4.0.0",
       // CORS is built into hono (import { cors } from 'hono/cors')
       "@hono/streaming": "^1.0.0"
     },

     "devDependencies": {
       "@biomejs/biome": "2.3.10",
       "@types/bun": "latest",
       "@types/node": "^22",
       "@types/uuid": "^10.0.0",
       "typescript": "^5"
     },

     "peerDependencies": {
       "react": "^18.0.0",
       "typescript": "^5"
     },

     "files": [
       "dist",
       "README.md",
       "LICENSE"
     ],

     "publishConfig": {
       "access": "public"
     }
   }
   ```

2. Update **tsconfig.build.json**:
   ```json
   {
     "extends": "./tsconfig.json",
     "compilerOptions": {
       "noEmit": false,
       "emitDeclarationOnly": true,
       "declaration": true,
       "declarationMap": true,
       "outDir": "./dist",
       "moduleResolution": "node",
       "allowImportingTsExtensions": false
     },
     "include": [
       "src/**/*",
       "src/server/**/*",
       "src/client/**/*",
       "src/client/react/**/*"
     ],
     "exclude": [
       "node_modules",
       "dist",
       "tests",
       "scripts",
       "**/*.test.ts",
       "**/*.spec.ts"
     ]
   }
   ```

3. Create index files:
   ```typescript
   // src/server/index.ts
   export { WebSocketServerTransport } from './transports/websocket-server';
   export { LocalAIKitTransport } from './transports/ai-sdk-local-transport';
   export { createAnthropicProvider } from './providers/anthropic-provider';
   export { SQLiteRunStore } from './persistence/sqlite-store';
   export { createAPIRoutes } from './api-routes';
   ```

   ```typescript
   // src/client/index.ts
   export { HTTPSSEClient } from './transports/http-sse-client';
   export { RemoteAIKitTransport } from './ai-sdk/remote-transport';
   export { useHarness, useRuntime } from './react';
   ```

4. Test builds for all entry points:
   ```bash
   bun run build:core    # Should produce dist/index.js
   bun run build:server  # Should produce dist/server/index.js
   bun run build:client  # Should produce dist/client/index.js
   bun run build:types   # Should produce .d.ts files
   ```

5. Test imports from each export:
   ```typescript
   // Test core import
   import { Runtime } from '@open-harness/sdk';

   // Test server import
   import { LocalAIKitTransport } from '@open-harness/sdk/server';

   // Test client import
   import { RemoteAIKitTransport } from '@open-harness/sdk/client';

   // Test react import
   import { useHarness } from '@open-harness/sdk/react';
   ```

**Dependencies:** None (configuration only)

**New abstractions:** None

**Risk:** Medium - build system complexity

---

### Phase 7: Documentation & Migration (2-3 hours)

**Goal:** Update all documentation for new architecture.

**Tasks:**

1. Update **README.md**:
   ```markdown
   # @open-harness/sdk

   Event-driven workflow orchestration for multi-agent AI systems.

   ## Installation

   ```bash
   bun add @open-harness/sdk
   ```

   ## Quick Start

   ### Browser / Edge Runtime (Remote)

   For browser and edge deployments connecting to Open Harness servers:

   ```typescript
   import { RemoteAIKitTransport } from '@open-harness/sdk/client';
   import { useChat } from 'ai/react';

   const transport = new RemoteAIKitTransport({
     serverUrl: 'https://api.open-harness.dev',
   });

   function MyChat() {
     const { messages, input, handleSubmit } = useChat({
       api: '/api/chat',  // Uses transport under the hood
     });

     return (
       <div>
         {messages.map(m => <div>{m.role}: {m.content}</div>)}
         <input value={input} onChange={handleSubmit} />
       </div>
     );
   }
   ```

   ### Node.js / Bun Server

   For running Open Harness servers:

   ```typescript
   import { createRuntime } from '@open-harness/sdk';
   import { createAPIRoutes, createAnthropicProvider } from '@open-harness/sdk/server';
   import { Hono } from 'hono';

   const runtime = createRuntime({
     flow: { /* ... */ },
     registry: createDefaultRegistry(),
   });

   const app = createAPIRoutes(runtime);

   // Start server
   Bun.serve({
     fetch: app.fetch,
     port: 3000,
   });
   ```

   ### Local Development (Next.js)

   For same-process development:

   ```typescript
   import { createRuntime } from '@open-harness/sdk';
   import { LocalAIKitTransport } from '@open-harness/sdk/server';
   import { useChat } from 'ai/react';

   const runtime = createRuntime({ /* ... */ });
   const transport = new LocalAIKitTransport(runtime);

   // useChat connects directly via transport
   ```

   ## Platform Compatibility

   | Feature | Browser/Edge | Node.js/Bun |
   |---------|--------------|--------------|
   | Runtime engine | ✅ | ✅ |
   | Remote transport (HTTP + SSE) | ✅ | ✅ |
   | Local transport | ✅ | ✅ |
   | Anthropic provider | ❌ | ✅ |
   | SQLite persistence | ❌ | ✅ |
   | React hooks | ✅ | ✅ |

   ## Architecture

   ### Communication Flow

   **Remote Execution:**
   1. Client POSTs to `/api/chat`
   2. Server generates run ID
   3. Server starts flow execution
   4. Client connects to `/api/events/:runId` via SSE
   5. Server streams events back via SSE
   6. Client renders events in real-time

   **Local Development:**
   1. Runtime runs in same process as Next.js
   2. LocalAIKitTransport wraps Runtime directly
   3. No HTTP/SSE needed
   4. Direct function calls between components

   ## Documentation

   - 📚 [Full Documentation](https://docs.open-harness.dev)
   - 🚀 [Browser Quickstart](https://docs.open-harness.dev/docs/guides/browser)
   - 🖥️ [Server Quickstart](https://docs.open-harness.dev/docs/guides/server)
   - ⚛️ [React Integration](https://docs.open-harness.dev/docs/guides/react)
   ```

2. Create **MIGRATION.md**:
   ```markdown
   # Migration Guide: v0.1.0 → v0.2.0

   ## Breaking Changes

   ### Package Structure Changes

   **v0.1.0:**
   ```typescript
   import { WebSocketTransport } from '@open-harness/transport-websocket';
   import { createClaudeNode } from '@open-harness/provider-anthropic';
   import { SQLiteRunStore } from '@open-harness/persistence-sqlite';
   ```

   **v0.2.0:**
   ```typescript
   // All imports from single package
   import { WebSocketServerTransport } from '@open-harness/sdk/server';
   import { createAnthropicProvider } from '@open-harness/sdk/server';
   import { SQLiteRunStore } from '@open-harness/sdk/server';
   ```

   ### Remote Client Changes

   **v0.1.0:**
   ```typescript
   // Used WebSocket directly
   import { createHarness } from '@open-harness/sdk';
   const harness = createHarness({
     transport: { websocket: { port: 3000 } },
   });
   ```

   **v0.2.0:**
   ```typescript
   // Use RemoteAIKitTransport with HTTP + SSE
   import { RemoteAIKitTransport } from '@open-harness/sdk/client';
   const transport = new RemoteAIKitTransport({
     serverUrl: 'https://api.open-harness.dev',
   });
   ```

   ### React Hook Changes

   **v0.1.0:** No React hooks

   **v0.2.0:**
   ```typescript
   import { useHarness, useRuntime } from '@open-harness/sdk/react';
   ```

   ## New Features

   - ✅ Remote execution via HTTP + SSE
   - ✅ React hooks (`useHarness`, `useRuntime`)
   - ✅ Server-generated run IDs
   - ✅ SSE connection lifecycle management
   - ✅ Hono API framework integration
   - ✅ CORS middleware (opt-in)
   ```

3. Update API documentation in docs site.

**Dependencies:** None

**New abstractions:** None

**Risk:** Low - documentation only

---

## New Code Summary

| Component | Lines | Type | New Abstractions |
|-----------|--------|-------|------------------|
| Hono API routes | ~230 | CREATE | ❌ None |
| Hono middleware | ~45 | CREATE | ❌ None |
| Remote AI Kit Transport | ~180 | CREATE | ❌ None |
| HTTP + SSE Client | ~200 | CREATE | HTTPTClient, SSEClient |
| React Hooks | ~120 | CREATE | ❌ None |
| Build config | ~100 | UPDATE | ❌ None |
| Documentation | ~300 | UPDATE | ❌ None |
| **TOTAL** | **~1,175** | | **2 minor abstractions** |

---

## Testing Strategy

### Unit Tests
- All new components with mocked dependencies
- Cover happy paths and error paths
- Test reconnection logic

### Integration Tests
- Client POST → Server dispatch → Runtime execution
- SSE streaming → Client receives
- WebSocket fallback (if needed)
- Timeout and disconnect handling

### E2E Tests
- Full flow execution from browser to server
- Long-running workflow test (simulate 10+ minutes)
- Multiple concurrent connections

### Performance Tests
- SSE connection overhead
- Memory usage with long-running connections
- Event serialization/deserialization overhead

---

## Dependencies

### Runtime Dependencies (new in v0.2.0)
```
hono                 ^4.0.0      # HTTP framework
hono/cors           (built-in)  # CORS support
@hono/streaming      ^1.0.0      # SSE support
uuid                 ^10.0.0      # Run ID generation
```

### Peer Dependencies
```
react                ^18.0.0     # React hooks (optional)
typescript           ^5.0.0       # TypeScript support
```

### Existing Dependencies (unchanged)
```
jsonata              ^2.1.0
yaml                 ^2.8.2
zod                  ^4.3.4
@open-harness/nodes-basic  workspace:*  (will be internalized)
```

---

## Risk Assessment

### High Risk Items

1. **SSE Connection Stability** (Medium risk)
   - Mitigation: Reconnection logic with exponential backoff
   - Test with flaky network conditions

2. **Run ID Collision** (Low risk)
   - Mitigation: UUID v4 for run IDs
   - Server single source of truth

3. **Memory Leaks with Long Connections** (Medium risk)
   - Mitigation: Proper cleanup in useEffect
   - Timeout inactive connections

### Medium Risk Items

1. **Build System Complexity** (Medium risk)
   - Mitigation: Extensive testing of build targets
   - Keep build scripts simple

2. **TypeScript Types Across Boundaries** (Low risk)
   - Mitigation: Shared types in core/
   - Strict mode enabled

3. **React Hook Cleanup** (Low risk)
   - Mitigation: Standard React patterns
   - Tests for cleanup

---

## Estimated Timeline

| Phase | Time | Dependencies | Risk |
|--------|-------|--------------|-------|
| Phase 1: Restructure | 4-5 hours | None | Low |
| Phase 2: Hono API | 8-10 hours | Phase 1 | Medium |
| Phase 3: Remote Transport | 6-8 hours | Phase 2 | Medium |
| Phase 4: HTTP/SSE Client | 4-6 hours | Phase 2 | Low |
| Phase 5: React Hooks | 3-4 hours | Phase 4 | Low |
| Phase 6: Build System | 3-4 hours | Phase 1 | Medium |
| Phase 7: Documentation | 2-3 hours | Phase 6 | Low |
| **TOTAL** | **30-40 hours** | **~4-5 days** | |

---

## Success Criteria

Phase is complete when:

1. ✅ All existing tests pass (no regressions)
2. ✅ New tests for server routes pass
3. ✅ New tests for client components pass
4. ✅ Build produces all entry points (core, server, client, react)
5. ✅ Conditional exports work in bundlers
6. ✅ Integration test passes: Browser → HTTP → Server → Runtime → SSE → Browser
7. ✅ Documentation updated with all new patterns
8. ✅ Package can be published to npm

---

## Open Questions / Decisions Deferred

1. **Rate Limiting:** Should server implement rate limiting? → Defer to v0.3.0

2. **Compression:** Should SSE events be compressed? → Defer to v0.3.0

3. **WebSocket Fallback:** Should client fall back to WebSocket if SSE fails? → Defer to user feedback

4. **Authentication:** What auth schemes to support? → User provides their own middleware

5. **Observability:** Metrics and tracing? → Defer to v0.3.0

---

## Appendix: Reference Implementations

### Example Server Setup

```typescript
import { createRuntime, createDefaultRegistry } from '@open-harness/sdk';
import { createAPIRoutes, createAnthropicProvider } from '@open-harness/sdk/server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Setup runtime
const provider = createAnthropicProvider();
const registry = createDefaultRegistry();
registry.register(provider);

const runtime = createRuntime({
  flow: myFlow,
  registry,
});

// Setup Hono app
const app = createAPIRoutes(runtime);

// Optional: Add CORS (users configure)
// app.use(cors({ origin: 'https://myapp.com' }));

// Optional: Add custom middleware
// app.use(async (c, next) => {
//   // Auth logic here
//   await next();
// });

// Start server
Bun.serve({
  fetch: app.fetch,
  port: 3000,
});
```

### Example Client Setup

```typescript
import { RemoteAIKitTransport } from '@open-harness/sdk/client';
import { useChat } from 'ai/react';

const transport = new RemoteAIKitTransport({
  serverUrl: 'https://api.open-harness.dev',
});

function ChatApp() {
  const { messages, input, handleSubmit, isLoading } = useChat({
    api: '/api/chat',  // Custom route that uses transport
  });

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>
          {m.role}: {(m.parts[0] as any).text}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} />
        <button disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
```

---

**Document Version:** 1.0
**Last Updated:** 2025-01-06
**Status:** ✅ Locked Decisions - Ready for Implementation
