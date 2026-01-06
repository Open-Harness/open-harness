# @open-harness/sdk

Core SDK for Open Harness - event-driven workflow orchestration for multi-agent AI systems.

## Purpose

The core SDK provides the foundational runtime engine, event system, state management, and workflow orchestration capabilities. All other packages depend on this core.

## Key Components

### Core (`src/core/`)
- **`types.ts`** - Core type definitions (FlowDefinition, NodeTypeDefinition, etc.)
- **`events.ts`** - Runtime event system (RuntimeEvent, RuntimeCommand, event types)
- **`state.ts`** - State management utilities
- **`cancel.ts`** - Cancellation support

### Runtime (`src/runtime/`)
- **`runtime.ts`** - Main Runtime interface and InMemoryStateStore implementation
- **`compiler.ts`** - Flow compilation (parseFlowYaml, validate flow structure)
- **`executor.ts`** - Node execution engine
- **`scheduler.ts`** - Execution scheduling and ordering
- **`bindings.ts`** - JSONata expression evaluation and data binding
- **`expressions.ts`** - Expression parsing and evaluation
- **`when.ts`** - Conditional logic (when expressions)
- **`snapshot.ts`** - RunSnapshot type and state snapshots

### Registry (`src/registry/`)
- **`registry.ts`** - NodeRegistry interface and DefaultNodeRegistry implementation
- Manages node type definitions and node creation

### Harness (`src/harness/`)
- **`harness.ts`** - High-level Harness API (createHarness, runFlow)
- Convenience wrapper around runtime for common use cases

### Persistence (`src/persistence/`)
- **`run-store.ts`** - RunStore interface for persistence
- **`memory-run-store.ts`** - In-memory implementation (for testing/development)

### Testing (`src/testing/`)
- **`mocks/mock-runtime.ts`** - MockRuntime for testing
- **`mocks/test-flows.ts`** - Helpers for creating test flows
- **`contracts/runtime-contract.ts`** - Contract tests for runtime implementations
- **`helpers/events.ts`** - Event helper functions
- **`index.ts`** - Exports all testing utilities (used by other packages)

### Transport (`src/transport/`)
- **`websocket.ts`** - WebSocket transport interface (implementation moved to @open-harness/transport-websocket)

### Nodes (`src/nodes/`)
- **`index.ts`** - Re-exports basic nodes from @open-harness/nodes-basic

## Architecture

The SDK follows an event-driven architecture:
1. **Flow Definition** - YAML/JSON workflow definition
2. **Compilation** - Flow is compiled into executable graph
3. **Execution** - Runtime executes nodes, emits events, manages state
4. **Events** - All state changes emit events (node:start, node:done, agent:text:delta, etc.)
5. **State** - RunSnapshot captures complete state at any point

## Key Interfaces

- **`Runtime`** - Core runtime interface (onEvent, dispatch, run, getSnapshot)
- **`RunStore`** - Persistence interface (saveSnapshot, getSnapshot, appendEvent, loadEvents)
- **`NodeTypeDefinition`** - Node implementation interface (type, run function, schemas)
- **`NodeRegistry`** - Node registration and lookup

## Usage

```typescript
import { createHarness, parseFlowYaml } from "@open-harness/sdk";

const flow = parseFlowYaml(flowYaml);
const harness = createHarness({ flow });

// Subscribe to events
harness.runtime.onEvent((event) => {
  console.log(event.type, event);
});

// Run the flow
const snapshot = await harness.runtime.run({ input: { topic: "AI" } });
```

## Dependencies

- **Peer dependencies**: TypeScript only
- **No runtime dependencies** - Core is dependency-free for maximum compatibility
- Uses standard Web APIs (crypto, etc.) for portability

## Testing

The SDK exports testing utilities for use by other packages:
- `MockRuntime` - Mock runtime for testing transports/consumers
- `createTestFlow` - Helper to create test flows
- `runtimeContract` - Contract tests for runtime implementations
