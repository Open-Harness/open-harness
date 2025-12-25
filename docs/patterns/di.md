# Dependency Injection Patterns

This document covers the DI patterns for Open Harness, implementing [Constitution Principle III: DI Discipline](.specify/memory/constitution.md).

## Core Philosophy

> Internals use Needle DI properly. Externals hide DI behind factories.

**Why?**
- DI enables testability (swap `AnthropicRunner` for `ReplayRunner`)
- DI enables flexibility (add providers without changing agents)
- But DI complexity should NOT leak to users

## Internal Patterns

### 1. Injectable Services

All internal services use the `@injectable()` decorator:

```typescript
import { injectable, inject } from "@needle-di/core";
import { IAgentRunnerToken, IConfigToken } from "./tokens.js";

@injectable()
export class CodingAgent extends BaseAgent {
  constructor(
    runner = inject(IAgentRunnerToken),
    config = inject(IConfigToken),
  ) {
    super("Coder", runner);
    this.config = config;
  }
}
```

### 2. Injection Tokens

Tokens define the abstraction. Never depend on concrete classes directly:

```typescript
// tokens.ts
import { InjectionToken } from "@needle-di/core";

export interface IAgentRunner {
  run(args: RunArgs): Promise<SDKMessage | undefined>;
}

export const IAgentRunnerToken = new InjectionToken<IAgentRunner>("IAgentRunner");

export interface IConfig {
  isReplayMode: boolean;
  recordingsDir: string;
}

export const IConfigToken = new InjectionToken<IConfig>("IConfig");
```

### 3. Composition Root

The composition root (`container.ts`) is the ONLY place where concrete implementations are bound:

```typescript
// container.ts - THE ONLY PLACE implementations are bound
import { Container } from "@needle-di/core";

export function createContainer(options: ContainerOptions = {}): Container {
  const container = new Container();
  const mode = options.mode ?? "live";

  // Infrastructure
  container.bind({ provide: IConfigToken, useValue: config });

  // Runners (mode-dependent)
  container.bind({
    provide: IAgentRunnerToken,
    useClass: mode === "replay" ? ReplayRunner : AnthropicRunner,
  });

  // Agents (use tokens internally)
  container.bind(CodingAgent);
  container.bind(ReviewAgent);

  return container;
}
```

### 4. Optional Dependencies

Use `{ optional: true }` for optional dependencies:

```typescript
@injectable()
export class BaseAgent {
  constructor(
    protected runner = inject(IAgentRunnerToken),
    protected eventBus = inject(IEventBusToken, { optional: true }) ?? null,
  ) {}
}
```

## External Patterns (Public API)

### 1. Factory Functions

Factory functions hide DI from users:

```typescript
// Public API - users don't need to understand DI
export function createAgent(type: "coder" | "reviewer"): BaseAgent {
  const container = getGlobalContainer();
  return container.get(type === "coder" ? CodingAgent : ReviewAgent);
}

// Usage (simple, no DI knowledge needed)
const coder = createAgent("coder");
await coder.execute("Write a function", "session-1");
```

### 2. Config-Based Agents

For custom agents, accept config objects:

```typescript
export function createAgent(config: AgentConfig): BaseAgent {
  const container = getGlobalContainer();
  return new ConfigAgent(config, container.get(IAgentRunnerToken));
}

// Usage
const custom = createAgent({
  name: "MyAgent",
  prompt: "You are {{role}}...",
  state: { role: "Expert" },
});
```

### 3. Workflow Builder

Hide orchestration complexity:

```typescript
export function createWorkflow(config: WorkflowConfig): Workflow {
  const container = getGlobalContainer();
  return new Workflow(config, container);
}

// Usage
const workflow = createWorkflow({
  name: "CodeReview",
  tasks: [{ id: "1", description: "Implement feature" }],
});
await workflow.run();
```

## Test Patterns

### Container Overrides for Testing

```typescript
// Unit test with mock runner
const mockRunner = new MockRunner();
const container = createContainer({ mode: "live" });
container.bind({ provide: IAgentRunnerToken, useValue: mockRunner });

const agent = container.get(CodingAgent);
await agent.execute("test", "session");

expect(mockRunner.callCount).toBe(1);
```

### Test Container Factory

```typescript
export function createTestContainer(
  parent: Container,
  overrides: {
    runner?: IAgentRunner;
    config?: Partial<IConfig>;
  } = {},
): Container {
  const child = parent.createChild();

  if (overrides.runner) {
    child.bind({ provide: IAgentRunnerToken, useValue: overrides.runner });
  }

  if (overrides.config) {
    const baseConfig = parent.get(IConfigToken);
    child.bind({
      provide: IConfigToken,
      useValue: { ...baseConfig, ...overrides.config },
    });
  }

  return child;
}
```

## Anti-Patterns to Avoid

### ❌ Depending on Concrete Classes

```typescript
// BAD - depends on concrete class
@injectable()
export class CodingAgent {
  constructor(private runner = inject(AnthropicRunner)) {} // ❌
}

// GOOD - depends on token (abstraction)
@injectable()
export class CodingAgent {
  constructor(private runner = inject(IAgentRunnerToken)) {} // ✅
}
```

### ❌ Binding Outside Composition Root

```typescript
// BAD - binding in random file
container.bind({ provide: IAgentRunnerToken, useClass: MyRunner }); // ❌

// GOOD - all bindings in container.ts
export function createContainer(): Container {
  container.bind({ provide: IAgentRunnerToken, useClass: MyRunner }); // ✅
}
```

### ❌ Exposing DI to Users

```typescript
// BAD - users need to understand DI
import { container, CodingAgent } from "@openharness/sdk";
const agent = container.get(CodingAgent); // ❌

// GOOD - users use simple factory
import { createAgent } from "@openharness/sdk";
const agent = createAgent("coder"); // ✅
```

### ❌ Circular Dependencies

```typescript
// BAD - circular dependency
@injectable()
class A { constructor(b = inject(B)) {} }

@injectable()
class B { constructor(a = inject(A)) {} } // ❌ Circular!

// GOOD - break the cycle with events or restructure
@injectable()
class A { constructor(eventBus = inject(IEventBusToken)) {} }

@injectable()
class B { constructor(eventBus = inject(IEventBusToken)) {} } // ✅
```

## Key Rules

1. **Tokens for abstraction** — never inject concrete classes
2. **Composition root is sacred** — only `container.ts` binds implementations
3. **Factories for users** — `createAgent()`, `createWorkflow()` hide DI
4. **No circular deps** — restructure or use events
5. **Optional with defaults** — `inject(Token, { optional: true }) ?? fallback`
