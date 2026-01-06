# Minimal Core Refactoring Plan

Strip core to essentials, move everything else out.

## Core SDK (@open-harness/sdk) Contents

- Core types (`core/types.ts`, `core/events.ts`, `core/state.ts`)
- Runtime engine (`runtime/*` - compiler, executor, scheduler, bindings, expressions)
- Registry system (`registry/`)
- Basic utilities (`core/cancel.ts`)
- In-memory implementations only (`persistence/memory-run-store.ts`)

## Packages to Move Out

Move to separate packages:

- `@open-harness/provider-anthropic` - Claude agent node
- `@open-harness/persistence-sqlite` - SQLite store (Bun-only)
- `@open-harness/transport-websocket` - WebSocket transport (Bun-only)
- `@open-harness/nodes-basic` - constant, echo nodes (or keep in core if truly universal)

## Remove from Core

- `claude.agent.ts` → provider package
- `sqlite-run-store.ts` → persistence package
- `websocket.ts` → transport package
- Node.js imports → use environment-agnostic alternatives (e.g., `crypto.randomUUID()` → `globalThis.crypto.randomUUID()`)

## Benefits

- Core is web-compatible
- Tree-shakeable
- Clear separation of concerns
- Providers can be added independently

**Time estimate:** 4-6 hours

---

# Testing Structure Plan

Drafting a detailed plan showing the structure where each package exports its own test utilities, with shared utilities for providers and persistence.

## Proposed Structure: Each Package Exports Its Own Test Utilities

### Complete Package Structure

```
packages/
├── sdk/                                    # Minimal Core SDK
│   ├── src/
│   │   ├── core/                          # Core types, events, state
│   │   ├── runtime/                       # Runtime engine
│   │   ├── registry/                      # Node registry
│   │   ├── testing/                       # Core test utilities (EXPORTED)
│   │   │   ├── mocks/
│   │   │   │   ├── mock-runtime.ts        # Mock Runtime for testing
│   │   │   │   ├── mock-nodes.ts          # Basic test nodes (constant, echo)
│   │   │   │   └── test-flows.ts          # Helper to create test flows
│   │   │   ├── contracts/
│   │   │   │   └── runtime-contract.ts    # Contract tests for Runtime interface
│   │   │   └── index.ts                   # Export all test utilities
│   │   └── index.ts                       # Main exports + testing exports
│   │
│   └── tests/                             # Core SDK tests
│       ├── unit/                          # Test core runtime, expressions, etc.
│       ├── integration/                   # Test core with basic nodes
│       └── contract/                      # Test core contracts
│
├── provider-anthropic/                    # Anthropic Provider
│   ├── src/
│   │   ├── claude-agent.ts                # Claude node implementation
│   │   ├── testing/                       # Provider test utilities (EXPORTED)
│   │   │   ├── mocks/
│   │   │   │   ├── mock-query.ts          # Mock query for testing
│   │   │   │   └── fixtures.ts            # Fixture helpers
│   │   │   ├── contracts/
│   │   │   │   └── node-contract.ts       # Contract for NodeTypeDefinition
│   │   │   └── index.ts
│   │   └── index.ts                       # Export provider + testing
│   │
│   └── tests/
│       ├── unit/                          # Test provider implementation
│       ├── integration/                   # Test provider with core SDK
│       └── contract/                      # Test provider against contracts
│
├── persistence-sqlite/                    # SQLite Persistence
│   ├── src/
│   │   ├── sqlite-run-store.ts            # SQLite implementation
│   │   ├── testing/                       # Persistence test utilities (EXPORTED)
│   │   │   ├── contracts/
│   │   │   │   └── run-store-contract.ts  # Contract for RunStore interface
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   └── tests/
│       └── contract/                      # Test SQLite against RunStore contract
│
├── persistence-memory/                    # Memory Persistence (or keep in core?)
│   ├── src/
│   │   ├── memory-run-store.ts
│   │   └── index.ts
│   └── tests/
│
├── provider-testing/                      # SHARED: Provider test utilities
│   ├── src/
│   │   ├── contracts/
│   │   │   └── node-contract.ts           # Generic node contract tester
│   │   ├── helpers/
│   │   │   ├── create-test-node.ts
│   │   │   └── node-helpers.ts
│   │   └── index.ts
│   └── package.json                       # @open-harness/provider-testing
│
├── persistence-testing/                  # SHARED: Persistence test utilities
│   ├── src/
│   │   ├── contracts/
│   │   │   └── run-store-contract.ts      # Generic RunStore contract tester
│   │   ├── helpers/
│   │   │   ├── sample-events.ts
│   │   │   └── sample-snapshots.ts
│   │   └── index.ts
│   └── package.json                       # @open-harness/persistence-testing
│
└── ai-sdk/                                # AI SDK Adapter
    ├── src/
    │   └── ... (current structure)
    └── tests/
        └── helpers/                       # Package-specific helpers
            └── mock-runtime.ts            # Uses @open-harness/sdk/testing
```

## Detailed Exports

### 1. Core SDK (@open-harness/sdk)

**Main exports (`src/index.ts`):**

```typescript
// Core runtime
export * from "./core/types.js";
export * from "./core/events.js";
export * from "./core/state.js";
export * from "./runtime/runtime.js";
export * from "./registry/registry.js";
// ... other core exports

// Test utilities (exported for other packages to use)
export * from "./testing/index.js";
```

**Test utilities (`src/testing/index.ts`):**

```typescript
// Mocks
export { MockRuntime } from "./mocks/mock-runtime.js";
export { constantNode, echoNode } from "./mocks/mock-nodes.js";
export { createTestFlow } from "./mocks/test-flows.js";

// Contracts
export { runtimeContract } from "./contracts/runtime-contract.js";

// Helpers
export { sampleRuntimeEvent } from "./helpers/events.js";
```

**Usage in other packages:**

```typescript
// In provider-anthropic tests
import { MockRuntime, createTestFlow } from "@open-harness/sdk/testing";
```

### 2. Provider Testing Package (@open-harness/provider-testing)

**Purpose:** Shared utilities for testing any provider implementation

**Exports (`src/index.ts`):**

```typescript
// Contract tests that work for ANY node provider
export { nodeContract } from "./contracts/node-contract.js";

// Helpers for creating test nodes
export { createTestNode } from "./helpers/create-test-node.js";
export { validateNodeDefinition } from "./helpers/node-helpers.js";
```

**Contract implementation:**

```typescript
// src/contracts/node-contract.ts
export function nodeContract(
  name: string,
  createNode: () => NodeTypeDefinition<unknown, unknown>
) {
  describe(name, () => {
    test("implements NodeTypeDefinition interface", () => {
      const node = createNode();
      expect(node.type).toBeDefined();
      expect(node.run).toBeInstanceOf(Function);
      // ... validate interface
    });

    test("handles input schema validation", () => {
      // Test with valid/invalid inputs
    });

    // ... more contract tests
  });
}
```

**Usage in provider packages:**

```typescript
// packages/provider-anthropic/tests/contract/claude-node.test.ts
import { nodeContract } from "@open-harness/provider-testing";
import { createClaudeNode } from "../../src/index.js";

nodeContract("ClaudeAgentNode", () => createClaudeNode());
```

### 3. Persistence Testing Package (@open-harness/persistence-testing)

**Purpose:** Shared utilities for testing any persistence implementation

**Exports (`src/index.ts`):**

```typescript
// Contract tests for RunStore interface
export { runStoreContract } from "./contracts/run-store-contract.js";

// Sample data for testing
export { sampleRuntimeEvent, sampleRunSnapshot } from "./helpers/samples.js";
```

**Contract implementation:**

```typescript
// src/contracts/run-store-contract.ts
export function runStoreContract(
  name: string,
  createStore: () => {
    store: RunStore;
    cleanup?: () => void;
  }
) {
  describe(name, () => {
    test("appendEvent and loadEvents work correctly", () => {
      const { store, cleanup } = createStore();
      // ... test implementation
      cleanup?.();
    });

    test("saveSnapshot and loadSnapshot work correctly", () => {
      // ... test implementation
    });

    // ... more contract tests
  });
}
```

**Usage in persistence packages:**

```typescript
// packages/persistence-sqlite/tests/contract/sqlite-store.test.ts
import { runStoreContract } from "@open-harness/persistence-testing";
import { SqliteRunStore } from "../../src/index.js";

runStoreContract("SqliteRunStore", () => ({
  store: new SqliteRunStore({ db: new Database(":memory:") }),
  cleanup: () => db.close(),
}));
```

## Test Distribution Strategy

### Core SDK Tests (`packages/sdk/tests/`)

- **Unit tests:** `expressions.test.ts`, `bindings.test.ts`, `when.test.ts`
- **Integration tests:** `simple-flow.test.ts` (uses basic nodes)
- **Contract tests:** `events.test.ts` (validates event structure)

### Provider Package Tests (`packages/provider-anthropic/tests/`)

- **Unit tests:** Test Claude-specific logic (query handling, message transformation)
- **Integration tests:** Test Claude node with real core SDK
- **Contract tests:** Use `@open-harness/provider-testing` to verify NodeTypeDefinition compliance

### Persistence Package Tests (`packages/persistence-sqlite/tests/`)

- **Contract tests:** Use `@open-harness/persistence-testing` to verify RunStore compliance
- **Implementation tests:** Test SQLite-specific features (migrations, transactions)

### AI SDK Tests (`packages/ai-sdk/tests/`)

- **Unit tests:** Transform functions, transport logic
- **Integration tests:** Full transport with MockRuntime from `@open-harness/sdk/testing`

## Package Dependencies

```
@open-harness/sdk
└── (no dependencies on providers/persistence)

@open-harness/provider-anthropic
├── @open-harness/sdk (peer)
└── @open-harness/provider-testing (dev)

@open-harness/persistence-sqlite
├── @open-harness/sdk (peer)
└── @open-harness/persistence-testing (dev)

@open-harness/provider-testing
└── @open-harness/sdk (peer)

@open-harness/persistence-testing
└── @open-harness/sdk (peer)

@open-harness/ai-sdk
├── @open-harness/sdk (peer)
└── @open-harness/sdk/testing (for MockRuntime)
```

## Example: How Tests Work Together

### Provider Package Test

```typescript
// packages/provider-anthropic/tests/contract/claude-node.test.ts
import { nodeContract } from "@open-harness/provider-testing";
import { createClaudeNode } from "../../src/index.js";
import { MockRuntime, createTestFlow } from "@open-harness/sdk/testing";

// Contract test - ensures Claude node implements NodeTypeDefinition correctly
nodeContract("ClaudeAgentNode", () => createClaudeNode());

// Integration test - tests Claude node with core SDK
test("Claude node works with core runtime", async () => {
  const node = createClaudeNode({ queryFn: mockQuery });
  const flow = createTestFlow({ nodes: [{ type: "claude.agent", ... }] });
  const runtime = new MockRuntime();
  // ... test integration
});
```

### Persistence Package Test

```typescript
// packages/persistence-sqlite/tests/contract/sqlite-store.test.ts
import { runStoreContract, sampleRuntimeEvent } from "@open-harness/persistence-testing";
import { SqliteRunStore } from "../../src/index.js";

// Contract test - ensures SQLite store implements RunStore correctly
runStoreContract("SqliteRunStore", () => ({
  store: new SqliteRunStore({ db: new Database(":memory:") }),
  cleanup: () => db.close(),
}));
```

## Benefits

- Each package is self-contained with its own test utilities
- Shared contracts ensure consistency across implementations
- Core SDK exports test utilities for use by other packages
- Provider/persistence packages can be tested independently
- Clear separation: core = runtime, provider-testing = node contracts, persistence-testing = storage contracts

This structure keeps each package independent while providing shared contracts for consistency. Should I create a detailed implementation plan based on this structure?




------


Okay, I think we need to like, maybe write some more docs from a different level from like a higher level higher level docs. Like, what is it that we believe in what is it we were trying to do open harness why open harness waving it as a harness, why open, right? Okay, so what is a harness festival. So, obviously, all of these terms are loosely defined but what we define, what we mean by harness is the code that goes around your agent exists, but it's basically the business logic that defines your agentic workflow system whatever it is your agents business logic basically. Right. So, in the traditional sense, the what people traditionally say when they traditionally talk about harnesses. They just mean like some code that wraps AI provider, like, either, you know, one of the base ones like open AI, or anthropic or like even, even like, like the SDK which abstracts away all other providers. And then it's the tools that you give to your agent the system prompt the guardrails the things that can and can't do right the deterministic code that you wrap around it right for example, in your coding agent, giving it like access to LSP so it knows when it's like writing, you know, coming from that sort of thing. So, that's the, what we mean by harness is an abstraction around an agent SDK, a stateful agent SDK. Right. What do we mean by that. Why do we do that. Well, when you have like so traditionally if you have like a gateway like just a regular API call to anthropic or to open AI, you generally have to wrap your tools manually, the system from manually, you know, and you have to like define your agent. It's like a whole low level thing. Whereas if you use something like the anthropic agent SDK, or the open code SDK, or the any coding agent SDK, you get that coding agents, base agentic abilities for free. Right. So you get great tool calling the ability to like interact with any bash tool, you know, really flexibly system prompt permissions, you know, and you can prototype with them as well because like you're literally just do the work like you can prototype in the actual CLI and then just like programatize your work or whatever you're doing that you like in there, you get uncomfortable. Now here's the problem. Even these SDKs, they're good. They can be, you know, they're relatively high level. They manage stateful. Okay, so what's really different about these is that they manage the stateful. Right. So they have base tools built into them, right have base permissions systems built into them and all that kind of stuff. Right. And they're safe. So you don't have to like they manage their chat, they manage the tools or the history, all of the, like they manage all of that low level agentic stuff. So you don't have to worry about any of them. However, if you build your system around any of these things you still need to, you're tied to that one, like system basically, you still need to build your own like UI stuff around it you need to build like a whole bunch of other stuff around it right just to make that work. So open harness provides a bunch of primitives to make agentic system work, right. These can be single or multi agent systems like a harness can still be a single agent. It can still be like a single agent with all of the programmatic controls that you wrap around it. Right, but it gets really powerful when you start to combine different agents with, like, you know, flows and stuff like that basically but basically that's, that's kind of like the gist of what we're building right.