# Implementation Tasks: Vercel AI SDK Adapter

**Branch**: `001-vercel-ai-adapter` | **Date**: 2025-01-05  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Task Status Legend

- `[ ]` - Not started
- `[>]` - In progress
- `[X]` - Complete
- `[~]` - Blocked/Skipped

---

## Phase 3: Package Setup & Infrastructure

### Task 3.1: Create Package Structure

**Priority**: P1 | **Estimated Time**: 20 minutes

Create the new `packages/ai-sdk/` package with basic configuration.

**Files to Create**:
- `packages/ai-sdk/package.json`
- `packages/ai-sdk/tsconfig.json`
- `packages/ai-sdk/tsconfig.build.json`
- `packages/ai-sdk/biome.json`
- `packages/ai-sdk/README.md`
- `packages/ai-sdk/src/index.ts` (empty barrel file)

**Package.json Configuration**:
```json
{
  "name": "@open-harness/ai-sdk",
  "version": "0.1.0-alpha.1",
  "type": "module",
  "private": false,
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "bun run build:types && bun run build:bundle",
    "build:types": "tsc --project tsconfig.build.json",
    "build:bundle": "bun build src/index.ts --outdir dist --format esm --target=bun --sourcemap=external",
    "lint": "biome check . --write",
    "lint:fix": "biome check . --write",
    "typecheck": "tsc --noEmit",
    "test": "bun test tests/unit tests/integration",
    "test:unit": "bun test tests/unit",
    "test:integration": "bun test tests/integration",
    "test:watch": "bun test --watch"
  },
  "devDependencies": {
    "@biomejs/biome": "2.3.10",
    "@types/bun": "latest",
    "@types/node": "^22"
  },
  "peerDependencies": {
    "@open-harness/sdk": "workspace:*",
    "ai": "^6.0.9",
    "typescript": "^5"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "engines": {
    "bun": ">=1.0.0"
  }
}
```

**Biome.json Configuration**:
```json
{
  "$schema": "https://biomejs.dev/schemas/2.3.10/schema.json",
  "root": false,
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": true,
    "includes": ["**", "!node_modules", "!dist", "!build"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "indentWidth": 2
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "lineWidth": 120
    }
  },
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  }
}
```

**Acceptance Criteria**:
- [ ] Package has correct name: `@open-harness/ai-sdk`
- [ ] TypeScript strict mode enabled
- [ ] Peer dependencies: `@open-harness/sdk`, `ai` (v6.0.9+)
- [ ] Dev dependencies: `@biomejs/biome`, `@types/node`, `@types/bun`
- [ ] Biome configuration matches monorepo standards
- [ ] Scripts include: build, lint, typecheck, test
- [ ] Package builds without errors: `bun run build`

**Dependencies**: None

**Verification**:
```bash
cd packages/ai-sdk
bun install
bun run typecheck  # Should pass with no errors
bun run lint       # Should pass with no errors
```

---

### Task 3.2: Add Test Infrastructure

**Priority**: P1 | **Estimated Time**: 10 minutes

Set up test directories and configuration.

**Files to Create**:
- `packages/ai-sdk/tests/unit/transforms.test.ts` (empty)
- `packages/ai-sdk/tests/integration/transport.test.ts` (empty)

**Files to Modify**:
- `packages/ai-sdk/package.json` - Add test scripts

**Acceptance Criteria**:
- [ ] `bun run test` command works (runs bun:test)
- [ ] Test files are discovered by test runner
- [ ] Can import from `src/` in test files

**Dependencies**: Task 3.1

**Verification**:
```bash
bun run test  # Should run (0 tests) without errors
```

---

## Phase 4: Core Transform Functions

### Task 4.1: Implement PartTracker

**Priority**: P1 | **Estimated Time**: 15 minutes

Create the minimal state tracker for detecting first deltas.

**Files to Create**:
- `packages/ai-sdk/src/transforms.ts`

**Implementation**:
```typescript
export interface PartTracker {
  textStarted: boolean;
  reasoningStarted: boolean;
}

export function createPartTracker(): PartTracker {
  return {
    textStarted: false,
    reasoningStarted: false,
  };
}
```

**Acceptance Criteria**:
- [ ] `createPartTracker()` returns object with correct shape
- [ ] Exported from `src/index.ts`
- [ ] Type-checks without errors

**Dependencies**: Task 3.1

**Verification**:
```bash
bun run typecheck
```

---

### Task 4.2: Implement Text Transform

**Priority**: P1 | **Estimated Time**: 30 minutes

Transform `agent:text:delta` and `agent:text` events to text chunks.

**Files to Modify**:
- `packages/ai-sdk/src/transforms.ts`

**Implementation**:
- Function: `transformTextEvent(event, tracker, messageId): UIMessageChunk[]`
- On first `agent:text:delta`: emit `[text-start, text-delta]`, set `tracker.textStarted = true`
- On subsequent `agent:text:delta`: emit `[text-delta]`
- On `agent:text` (complete): emit `[text-end]`

**Acceptance Criteria**:
- [ ] First delta emits both start and delta chunks
- [ ] Subsequent deltas emit only delta chunks
- [ ] Complete event emits end chunk
- [ ] All chunks include correct message ID
- [ ] Unit tests pass (see Task 5.1)

**Dependencies**: Task 4.1

**Test Cases**:
```typescript
// First delta
const tracker = createPartTracker();
const chunks = transformTextEvent(
  { type: 'agent:text:delta', delta: 'Hello' },
  tracker,
  'msg-1'
);
expect(chunks).toEqual([
  { type: 'text-start', id: 'msg-1' },
  { type: 'text-delta', id: 'msg-1', delta: 'Hello' },
]);
expect(tracker.textStarted).toBe(true);

// Subsequent delta
const chunks2 = transformTextEvent(
  { type: 'agent:text:delta', delta: ' world' },
  tracker,
  'msg-1'
);
expect(chunks2).toEqual([
  { type: 'text-delta', id: 'msg-1', delta: ' world' },
]);
```

---

### Task 4.3: Implement Reasoning Transform

**Priority**: P2 | **Estimated Time**: 30 minutes

Transform `agent:thinking:delta` and `agent:thinking` events to reasoning chunks.

**Files to Modify**:
- `packages/ai-sdk/src/transforms.ts`

**Implementation**:
- Function: `transformReasoningEvent(event, tracker, messageId, options): UIMessageChunk[]`
- Check `options.sendReasoning` - return `[]` if false
- On first `agent:thinking:delta`: emit `[reasoning-start, reasoning-delta]`, set `tracker.reasoningStarted = true`
- On subsequent `agent:thinking:delta`: emit `[reasoning-delta]`
- On `agent:thinking` (complete): emit `[reasoning-end]`

**Acceptance Criteria**:
- [ ] First delta emits both start and delta chunks
- [ ] Subsequent deltas emit only delta chunks
- [ ] Complete event emits end chunk
- [ ] Returns empty array when `sendReasoning: false`
- [ ] Unit tests pass

**Dependencies**: Task 4.1

---

### Task 4.4: Implement Tool Transform

**Priority**: P2 | **Estimated Time**: 30 minutes

Transform `agent:tool` events to tool invocation chunks.

**Files to Modify**:
- `packages/ai-sdk/src/transforms.ts`

**Implementation**:
- Function: `transformToolEvent(event, messageId): UIMessageChunk[]`
- Extract `toolName`, `toolInput`, `toolOutput` from event
- Generate `toolCallId` (can use `toolName` or hash)
- Emit `[tool-input-available, tool-output-available]`
- If error field present, emit error state instead

**Acceptance Criteria**:
- [ ] Emits both input-available and output-available chunks
- [ ] Tool call ID is unique and consistent
- [ ] Handles tool errors correctly
- [ ] Unit tests pass

**Dependencies**: Task 4.1

**Test Cases**:
```typescript
const chunks = transformToolEvent(
  {
    type: 'agent:tool',
    toolName: 'search',
    toolInput: { query: 'test' },
    toolOutput: { results: [] },
  },
  'msg-1'
);
expect(chunks).toEqual([
  {
    type: 'tool-input-available',
    toolCallId: expect.any(String),
    toolName: 'search',
    input: { query: 'test' },
  },
  {
    type: 'tool-output-available',
    toolCallId: expect.any(String),
    output: { results: [] },
  },
]);
```

---

### Task 4.5: Implement Step Marker Transform

**Priority**: P2 | **Estimated Time**: 15 minutes

Transform `node:start` events to step-start chunks.

**Files to Modify**:
- `packages/ai-sdk/src/transforms.ts`

**Implementation**:
- Function: `transformStepEvent(event, options): UIMessageChunk[]`
- Check `options.sendStepMarkers` - return `[]` if false
- On `node:start`: emit `[{ type: 'step-start' }]`

**Acceptance Criteria**:
- [ ] Emits step-start chunk for node:start events
- [ ] Returns empty array when `sendStepMarkers: false`
- [ ] Unit tests pass

**Dependencies**: Task 4.1

---

### Task 4.6: Implement Error Transform

**Priority**: P1 | **Estimated Time**: 15 minutes

Transform error events to error chunks.

**Files to Modify**:
- `packages/ai-sdk/src/transforms.ts`

**Implementation**:
- Function: `transformErrorEvent(event): UIMessageChunk[]`
- Extract error message from `agent:error`, `node:error`, `agent:aborted`
- Emit `[{ type: 'error', errorText: message }]`

**Acceptance Criteria**:
- [ ] Emits error chunk with user-friendly message
- [ ] Handles missing error messages gracefully
- [ ] Unit tests pass

**Dependencies**: Task 4.1

---

### Task 4.7: Implement Main Transform Router

**Priority**: P1 | **Estimated Time**: 20 minutes

Create the main transform function that routes events to specific transforms.

**Files to Modify**:
- `packages/ai-sdk/src/transforms.ts`

**Implementation**:
- Function: `transformEvent(event, tracker, messageId, options): UIMessageChunk[]`
- Switch on `event.type`
- Route to appropriate transform function
- Return empty array for unmapped events

**Acceptance Criteria**:
- [ ] Routes all event types correctly
- [ ] Returns empty array for unknown events
- [ ] Exported from `src/index.ts`
- [ ] Type-checks without errors

**Dependencies**: Tasks 4.2, 4.3, 4.4, 4.5, 4.6

**Implementation Sketch**:
```typescript
export function transformEvent(
  event: RuntimeEvent,
  tracker: PartTracker,
  messageId: string,
  options: Required<OpenHarnessChatTransportOptions>
): UIMessageChunk[] {
  switch (event.type) {
    case 'agent:text:delta':
    case 'agent:text':
      return transformTextEvent(event, tracker, messageId);
    case 'agent:thinking:delta':
    case 'agent:thinking':
      return transformReasoningEvent(event, tracker, messageId, options);
    case 'agent:tool':
      return transformToolEvent(event, messageId);
    case 'node:start':
      return transformStepEvent(event, options);
    case 'agent:error':
    case 'node:error':
    case 'agent:aborted':
      return transformErrorEvent(event);
    default:
      return [];
  }
}
```

---

## Phase 5: Unit Tests for Transforms

### Task 5.1: Test Text Transform

**Priority**: P1 | **Estimated Time**: 30 minutes

Write comprehensive unit tests for text transform.

**Files to Modify**:
- `packages/ai-sdk/tests/unit/transforms.test.ts`

**Test Cases**:
- [ ] First delta emits start + delta
- [ ] Subsequent deltas emit only delta
- [ ] Complete event emits end
- [ ] Message ID is preserved across chunks
- [ ] Tracker state is updated correctly

**Dependencies**: Task 4.2

**Verification**:
```bash
bun test tests/unit/transforms.test.ts
```

---

### Task 5.2: Test Reasoning Transform

**Priority**: P2 | **Estimated Time**: 30 minutes

Write comprehensive unit tests for reasoning transform.

**Files to Modify**:
- `packages/ai-sdk/tests/unit/transforms.test.ts`

**Test Cases**:
- [ ] First delta emits start + delta
- [ ] Subsequent deltas emit only delta
- [ ] Complete event emits end
- [ ] Returns empty when `sendReasoning: false`
- [ ] Tracker state is updated correctly

**Dependencies**: Task 4.3

---

### Task 5.3: Test Tool Transform

**Priority**: P2 | **Estimated Time**: 30 minutes

Write comprehensive unit tests for tool transform.

**Files to Modify**:
- `packages/ai-sdk/tests/unit/transforms.test.ts`

**Test Cases**:
- [ ] Emits input-available and output-available
- [ ] Tool call IDs are consistent
- [ ] Handles tool errors
- [ ] Handles missing output gracefully

**Dependencies**: Task 4.4

---

### Task 5.4: Test Step Marker Transform

**Priority**: P2 | **Estimated Time**: 15 minutes

Write unit tests for step marker transform.

**Files to Modify**:
- `packages/ai-sdk/tests/unit/transforms.test.ts`

**Test Cases**:
- [ ] Emits step-start for node:start
- [ ] Returns empty when `sendStepMarkers: false`

**Dependencies**: Task 4.5

---

### Task 5.5: Test Error Transform

**Priority**: P1 | **Estimated Time**: 15 minutes

Write unit tests for error transform.

**Files to Modify**:
- `packages/ai-sdk/tests/unit/transforms.test.ts`

**Test Cases**:
- [ ] Emits error chunk with correct message
- [ ] Handles different error event types
- [ ] Handles missing error messages

**Dependencies**: Task 4.6

---

## Phase 6: Transport Implementation

### Task 6.1: Implement Transport Class Structure

**Priority**: P1 | **Estimated Time**: 30 minutes

Create the OpenHarnessChatTransport class skeleton.

**Files to Create**:
- `packages/ai-sdk/src/transport.ts`

**Implementation**:
```typescript
import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai';
import type { Runtime } from '@open-harness/sdk';
import type { OpenHarnessChatTransportOptions } from './types';

export class OpenHarnessChatTransport implements ChatTransport<UIMessage> {
  private runtime: Runtime;
  private options: Required<OpenHarnessChatTransportOptions>;

  constructor(
    runtime: Runtime,
    options?: OpenHarnessChatTransportOptions
  ) {
    this.runtime = runtime;
    this.options = {
      sendReasoning: options?.sendReasoning ?? true,
      sendStepMarkers: options?.sendStepMarkers ?? true,
      sendFlowMetadata: options?.sendFlowMetadata ?? false,
      sendNodeOutputs: options?.sendNodeOutputs ?? false,
      generateMessageId: options?.generateMessageId ?? crypto.randomUUID,
    };
  }

  async sendMessages(options: {
    trigger: 'submit-message' | 'regenerate-message';
    chatId: string;
    messageId: string | undefined;
    messages: UIMessage[];
    abortSignal: AbortSignal;
  }): Promise<ReadableStream<UIMessageChunk>> {
    // TODO: Implement
    throw new Error('Not implemented');
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null;
  }
}
```

**Acceptance Criteria**:
- [ ] Class implements ChatTransport interface
- [ ] Constructor accepts runtime and options
- [ ] Options have correct defaults
- [ ] Exported from `src/index.ts`
- [ ] Type-checks without errors

**Dependencies**: Task 3.1

---

### Task 6.2: Implement sendMessages - Message Extraction

**Priority**: P1 | **Estimated Time**: 20 minutes

Extract the last user message from messages array.

**Files to Modify**:
- `packages/ai-sdk/src/transport.ts`

**Implementation**:
- Find last message with `role: 'user'`
- Extract text content from message parts
- Handle case where no user message exists

**Acceptance Criteria**:
- [ ] Correctly extracts last user message
- [ ] Handles empty messages array
- [ ] Handles messages with no text parts
- [ ] Returns appropriate error for invalid input

**Dependencies**: Task 6.1

---

### Task 6.3: Implement sendMessages - Stream Creation

**Priority**: P1 | **Estimated Time**: 45 minutes

Create the ReadableStream that transforms runtime events to chunks.

**Files to Modify**:
- `packages/ai-sdk/src/transport.ts`

**Implementation**:
```typescript
async sendMessages(options: { ... }): Promise<ReadableStream<UIMessageChunk>> {
  const { messages, abortSignal } = options;
  const messageId = this.options.generateMessageId();
  
  // Extract user message
  const lastUserMessage = messages.findLast(m => m.role === 'user');
  if (!lastUserMessage) {
    throw new Error('No user message found');
  }
  const textPart = lastUserMessage.parts.find(p => p.type === 'text');
  if (!textPart) {
    throw new Error('User message has no text content');
  }

  return new ReadableStream<UIMessageChunk>({
    start: async (controller) => {
      const tracker = createPartTracker();
      
      // Subscribe to runtime events
      const unsubscribe = this.runtime.onEvent((event) => {
        const chunks = transformEvent(event, tracker, messageId, this.options);
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        
        // Close stream on terminal events
        if (
          event.type === 'agent:complete' ||
          event.type === 'agent:paused' ||
          event.type === 'agent:aborted'
        ) {
          controller.close();
          unsubscribe();
        }
      });
      
      // Handle abort
      abortSignal?.addEventListener('abort', () => {
        controller.close();
        unsubscribe();
      });
      
      // Dispatch message to runtime
      this.runtime.dispatch({
        type: 'send',
        runId: crypto.randomUUID(),
        message: textPart.text,
      });
    },
  });
}
```

**Acceptance Criteria**:
- [ ] Creates ReadableStream correctly
- [ ] Subscribes to runtime events
- [ ] Transforms events to chunks
- [ ] Closes stream on terminal events
- [ ] Handles abort signal
- [ ] Unsubscribes on close

**Dependencies**: Tasks 6.2, 4.7

---

### Task 6.4: Add Error Handling to Transport

**Priority**: P1 | **Estimated Time**: 20 minutes

Add robust error handling to transport.

**Files to Modify**:
- `packages/ai-sdk/src/transport.ts`

**Implementation**:
- Wrap runtime.dispatch in try-catch
- Emit error chunk on dispatch failure
- Handle runtime not ready state
- Log errors for debugging

**Acceptance Criteria**:
- [ ] Dispatch errors emit error chunks
- [ ] Stream closes gracefully on errors
- [ ] Errors are logged for debugging
- [ ] No unhandled promise rejections

**Dependencies**: Task 6.3

---

## Phase 7: Integration Tests

### Task 7.1: Create Mock Runtime

**Priority**: P1 | **Estimated Time**: 30 minutes

Create a mock runtime for integration testing.

**Files to Create**:
- `packages/ai-sdk/tests/helpers/mock-runtime.ts`

**Implementation**:
- Implement minimal Runtime interface
- Support `onEvent()` subscription
- Support `dispatch()` command
- Provide helper to emit test events

**Acceptance Criteria**:
- [ ] Implements Runtime interface
- [ ] Can emit events to subscribers
- [ ] Can capture dispatch calls
- [ ] Easy to use in tests

**Dependencies**: Task 6.3

---

### Task 7.2: Test Full Text Streaming Flow

**Priority**: P1 | **Estimated Time**: 30 minutes

Test complete text streaming from user message to assistant response.

**Files to Modify**:
- `packages/ai-sdk/tests/integration/transport.test.ts`

**Test Scenario**:
1. Create transport with mock runtime
2. Call sendMessages with user message
3. Mock runtime emits: `agent:start`, multiple `agent:text:delta`, `agent:text`, `agent:complete`
4. Verify chunks are emitted in correct order
5. Verify stream closes

**Acceptance Criteria**:
- [ ] User message is dispatched to runtime
- [ ] Text chunks are emitted correctly
- [ ] Stream closes on agent:complete
- [ ] No memory leaks (unsubscribe called)

**Dependencies**: Tasks 7.1, 6.3

---

### Task 7.3: Test Tool Call Flow

**Priority**: P2 | **Estimated Time**: 30 minutes

Test tool invocation from start to finish.

**Files to Modify**:
- `packages/ai-sdk/tests/integration/transport.test.ts`

**Test Scenario**:
1. Create transport with mock runtime
2. Call sendMessages
3. Mock runtime emits: `agent:start`, `agent:tool` (with input+output), `agent:complete`
4. Verify tool chunks are emitted correctly

**Acceptance Criteria**:
- [ ] Tool input-available chunk emitted
- [ ] Tool output-available chunk emitted
- [ ] Tool call IDs match
- [ ] Stream closes correctly

**Dependencies**: Tasks 7.1, 6.3

---

### Task 7.4: Test Multi-Step Flow

**Priority**: P2 | **Estimated Time**: 30 minutes

Test multi-node flow with step markers.

**Files to Modify**:
- `packages/ai-sdk/tests/integration/transport.test.ts`

**Test Scenario**:
1. Create transport with `sendStepMarkers: true`
2. Call sendMessages
3. Mock runtime emits: `node:start` (node1), `agent:text:delta`, `node:start` (node2), `agent:text:delta`, `agent:complete`
4. Verify step-start chunks appear at node boundaries

**Acceptance Criteria**:
- [ ] Step-start chunks emitted for each node:start
- [ ] Text chunks appear after step markers
- [ ] Order is preserved

**Dependencies**: Tasks 7.1, 6.3

---

### Task 7.5: Test Abort Handling

**Priority**: P1 | **Estimated Time**: 20 minutes

Test stream abortion via AbortSignal.

**Files to Modify**:
- `packages/ai-sdk/tests/integration/transport.test.ts`

**Test Scenario**:
1. Create transport
2. Call sendMessages with AbortController
3. Start emitting events
4. Abort mid-stream
5. Verify stream closes and unsubscribe is called

**Acceptance Criteria**:
- [ ] Stream closes on abort
- [ ] Runtime unsubscribe is called
- [ ] No more chunks emitted after abort

**Dependencies**: Tasks 7.1, 6.3

---

### Task 7.6: Test Error Scenarios

**Priority**: P1 | **Estimated Time**: 30 minutes

Test various error conditions.

**Files to Modify**:
- `packages/ai-sdk/tests/integration/transport.test.ts`

**Test Scenarios**:
- [ ] No user message in messages array
- [ ] User message with no text part
- [ ] Runtime dispatch throws error
- [ ] Runtime emits agent:error event
- [ ] Runtime emits agent:aborted event

**Acceptance Criteria**:
- [ ] Errors emit error chunks
- [ ] Stream closes gracefully
- [ ] No unhandled rejections

**Dependencies**: Tasks 7.1, 6.4

---

## Phase 8: Demo Application

### Task 8.1: Create Demo Page Structure

**Priority**: P2 | **Estimated Time**: 20 minutes

Set up the demo page in apps/ui.

**Files to Create**:
- `apps/ui/src/app/demo/page.tsx`
- `apps/ui/src/app/demo/layout.tsx` (if needed)

**Implementation**:
- Basic Next.js page component
- Import useChat from ai
- Import OpenHarnessChatTransport

**Acceptance Criteria**:
- [ ] Page renders without errors
- [ ] Can navigate to /demo
- [ ] No build errors

**Dependencies**: Task 6.3

---

### Task 8.2: Create Demo Flow

**Priority**: P2 | **Estimated Time**: 15 minutes

Create a simple flow for the demo.

**Files to Create**:
- `apps/ui/flows/demo-chat.yaml` (or inline in page)

**Implementation**:
```yaml
name: demo-chat
nodes:
  - id: assistant
    type: claude.agent
    input:
      prompt: "{{ flow.input.message }}"
      systemPrompt: "You are a helpful assistant."
edges: []
```

**Acceptance Criteria**:
- [ ] Flow is valid YAML
- [ ] Flow can be parsed by SDK
- [ ] Agent responds to messages

**Dependencies**: None

---

### Task 8.3: Implement Chat UI

**Priority**: P2 | **Estimated Time**: 45 minutes

Build the chat interface using useChat hook.

**Files to Modify**:
- `apps/ui/src/app/demo/page.tsx`

**Implementation**:
- Use `useChat()` with OpenHarnessChatTransport
- Render messages with parts
- Handle text, reasoning, and tool parts
- Add input form

**Acceptance Criteria**:
- [ ] Messages display correctly
- [ ] Streaming text updates in real-time
- [ ] Input form submits messages
- [ ] Loading states work
- [ ] UI is responsive

**Dependencies**: Tasks 8.1, 8.2, 6.3

**Reference**: See `quickstart.md` for example implementation

---

### Task 8.4: Add Tool Visualization

**Priority**: P3 | **Estimated Time**: 30 minutes

Display tool calls in the demo UI.

**Files to Modify**:
- `apps/ui/src/app/demo/page.tsx`

**Implementation**:
- Detect tool parts in message
- Render tool name, input, output
- Show tool state (loading, complete, error)

**Acceptance Criteria**:
- [ ] Tool calls are visible
- [ ] Input and output are formatted nicely
- [ ] Tool state is clear

**Dependencies**: Task 8.3

---

### Task 8.5: Add Reasoning Display

**Priority**: P3 | **Estimated Time**: 20 minutes

Display extended thinking in the demo UI.

**Files to Modify**:
- `apps/ui/src/app/demo/page.tsx`

**Implementation**:
- Detect reasoning parts
- Render in collapsible details element
- Style differently from regular text

**Acceptance Criteria**:
- [ ] Reasoning is visible
- [ ] Can be collapsed/expanded
- [ ] Streams in real-time

**Dependencies**: Task 8.3

---

## Phase 9: Documentation & Polish

### Task 9.1: Write Package README

**Priority**: P1 | **Estimated Time**: 30 minutes

Document the package usage.

**Files to Modify**:
- `packages/ai-sdk/README.md`

**Content**:
- Installation instructions
- Basic usage example
- Configuration options
- Link to full docs

**Acceptance Criteria**:
- [ ] README is clear and concise
- [ ] Code examples work
- [ ] Links are valid

**Dependencies**: Task 6.3

**Reference**: Use `quickstart.md` as basis

---

### Task 9.2: Add JSDoc Comments

**Priority**: P2 | **Estimated Time**: 30 minutes

Add comprehensive JSDoc to all public APIs.

**Files to Modify**:
- `packages/ai-sdk/src/transport.ts`
- `packages/ai-sdk/src/transforms.ts`

**Acceptance Criteria**:
- [ ] All exported functions have JSDoc
- [ ] All exported types have JSDoc
- [ ] Examples included where helpful
- [ ] TypeDoc can generate docs

**Dependencies**: Task 6.3

---

### Task 9.3: Add Type Exports

**Priority**: P1 | **Estimated Time**: 15 minutes

Export all public types from index.ts.

**Files to Modify**:
- `packages/ai-sdk/src/index.ts`

**Implementation**:
```typescript
// Transport
export { OpenHarnessChatTransport } from './transport';
export type {
  OpenHarnessChatTransportOptions,
  IOpenHarnessChatTransport,
} from './transport';

// Transforms
export { transformEvent, createPartTracker } from './transforms';
export type { PartTracker, TransformFunction } from './transforms';

// Custom data types
export type {
  OpenHarnessDataTypes,
  FlowStatusData,
  NodeOutputData,
} from './types';
```

**Acceptance Criteria**:
- [ ] All public APIs are exported
- [ ] No internal APIs are exported
- [ ] Types can be imported by consumers

**Dependencies**: Tasks 6.3, 4.7

---

### Task 9.4: Verify Monorepo Integration

**Priority**: P1 | **Estimated Time**: 10 minutes

Verify the new package is properly integrated with the monorepo tooling.

**Verification Steps**:

1. **Workspace Recognition**: The package should already be recognized via `workspaces: ["packages/*"]` in root `package.json`

2. **Turbo Tasks**: Verify turbo.json already has the required tasks:
   - `build` - with `dependsOn: ["^build"]`
   - `lint` - with `dependsOn: ["^lint"]`
   - `test` - with `dependsOn: ["^test"]`
   - `typecheck` - with `dependsOn: ["^typecheck"]`

3. **Run from Root**:
```bash
# From repository root
turbo lint --filter=@open-harness/ai-sdk
turbo typecheck --filter=@open-harness/ai-sdk
turbo test --filter=@open-harness/ai-sdk
turbo build --filter=@open-harness/ai-sdk
```

**Acceptance Criteria**:
- [ ] Package is recognized by bun workspaces
- [ ] `turbo lint` runs biome check on the package
- [ ] `turbo typecheck` runs tsc on the package
- [ ] `turbo test` runs bun test on the package
- [ ] `turbo build` builds the package
- [ ] All turbo tasks complete successfully

**Dependencies**: Task 3.1

**Note**: No modifications to root `package.json` or `turbo.json` should be needed - the existing workspace glob pattern and turbo task definitions already cover this package.

---

## Phase 10: Final Validation

### Task 10.1: Run All Quality Gates

**Priority**: P1 | **Estimated Time**: 10 minutes

Verify all quality gates pass.

**Verification (from package directory)**:
```bash
cd packages/ai-sdk
bun run test        # All tests should pass
bun run typecheck   # No type errors
bun run lint        # No lint errors (biome check)
```

**Verification (from repository root)**:
```bash
# Run via turbo for proper caching
turbo test --filter=@open-harness/ai-sdk
turbo typecheck --filter=@open-harness/ai-sdk
turbo lint --filter=@open-harness/ai-sdk
turbo build --filter=@open-harness/ai-sdk
```

**Acceptance Criteria**:
- [ ] All unit tests pass (tests/unit/)
- [ ] All integration tests pass (tests/integration/)
- [ ] TypeScript compiles without errors
- [ ] Biome linting passes with no errors
- [ ] Package builds successfully
- [ ] Test coverage > 80%
- [ ] All turbo tasks complete successfully

**Dependencies**: All test tasks (5.x, 7.x)

---

### Task 10.2: Test Demo Application

**Priority**: P1 | **Estimated Time**: 15 minutes

Manually test the demo application.

**Verification**:
```bash
cd apps/ui
bun run dev
# Navigate to http://localhost:3000/demo
```

**Test Scenarios**:
- [ ] Send a simple message, verify response streams
- [ ] Send a message that triggers tool use
- [ ] Verify reasoning displays (if enabled)
- [ ] Test abort by navigating away mid-stream
- [ ] Test error handling (invalid input)

**Dependencies**: Tasks 8.3, 8.4, 8.5

---

### Task 10.3: Verify Critical File Paths

**Priority**: P1 | **Estimated Time**: 5 minutes

Ensure all required files exist.

**Files to Verify**:
- [ ] `packages/ai-sdk/package.json`
- [ ] `packages/ai-sdk/src/index.ts`
- [ ] `packages/ai-sdk/src/transport.ts`
- [ ] `packages/ai-sdk/src/transforms.ts`
- [ ] `packages/ai-sdk/tests/unit/transforms.test.ts`
- [ ] `packages/ai-sdk/tests/integration/transport.test.ts`
- [ ] `apps/ui/src/app/demo/page.tsx`

**Dependencies**: All implementation tasks

---

### Task 10.4: Update Feature Spec Status

**Priority**: P1 | **Estimated Time**: 5 minutes

Mark the feature as complete.

**Files to Modify**:
- `specs/001-vercel-ai-adapter/spec.md` - Update status to "Complete"
- `specs/001-vercel-ai-adapter/plan.md` - Check off verification gates

**Acceptance Criteria**:
- [ ] All verification gates checked
- [ ] Status updated
- [ ] Completion date added

**Dependencies**: Tasks 10.1, 10.2, 10.3

---

## Summary

**Total Tasks**: 46  
**Estimated Total Time**: ~13 hours

**Critical Path** (must complete in order):
1. Phase 3: Package Setup (Tasks 3.1, 3.2)
2. Phase 4: Core Transforms (Tasks 4.1-4.7)
3. Phase 6: Transport (Tasks 6.1-6.4)
4. Phase 7: Integration Tests (Tasks 7.1-7.6)
5. Phase 10: Final Validation (Tasks 10.1-10.4)

**Parallel Work** (can be done independently):
- Phase 5: Unit Tests (while implementing Phase 4)
- Phase 8: Demo App (after Phase 6 complete)
- Phase 9: Documentation (after Phase 6 complete)

**Priority Breakdown**:
- P1 (Critical): 28 tasks - Must complete for feature to work
- P2 (Important): 14 tasks - Enhances functionality
- P3 (Nice-to-have): 4 tasks - Polish and advanced features

**Next Steps**:
1. Start with Task 3.1 (Package Setup)
2. Work through Phase 4 (Core Transforms) with parallel unit tests (Phase 5)
3. Implement Phase 6 (Transport)
4. Run integration tests (Phase 7)
5. Build demo (Phase 8) and docs (Phase 9)
6. Final validation (Phase 10)
