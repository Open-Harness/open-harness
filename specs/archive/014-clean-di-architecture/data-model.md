# Data Model: Clean DI Architecture

**Feature**: 014-clean-di-architecture
**Purpose**: Define all types, interfaces, and entities involved in the builder pattern refactoring

## Core Entities

### AnthropicAgentDefinition<TInput, TOutput>

**Purpose**: Plain configuration object returned by `defineAnthropicAgent()`. Contains all information needed to construct an executable agent.

**Properties**:
- `name: string` - Agent identifier (e.g., "PlannerAgent")
- `prompt: PromptTemplate<TInput>` - Template for rendering prompts with input data
- `inputSchema: z.ZodSchema<TInput>` - Zod schema for validating input
- `outputSchema: z.ZodSchema<TOutput>` - Zod schema for parsing LLM output

**Validation Rules**:
- `name` must be non-empty string
- `prompt` must have variables matching `inputSchema` fields
- `inputSchema` and `outputSchema` must be valid Zod schemas

**Serialization**: **YES** - All fields are serializable (schemas convert to JSON schema)

**Example**:
```typescript
const PlannerAgentDefinition: AnthropicAgentDefinition<PlannerInput, PlannerOutput> = {
  name: "PlannerAgent",
  prompt: PlannerPromptTemplate,
  inputSchema: PlannerInputSchema,
  outputSchema: PlannerOutputSchema,
};
```

---

### ExecutableAgent<TInput, TOutput>

**Purpose**: Object returned by `AgentBuilder.build()` that can execute and stream agent interactions.

**Methods**:
- `execute(input: TInput, options?: ExecuteOptions<TOutput>): Promise<TOutput>`
  - Validates input, renders prompt, calls runner, parses output
  - Throws if validation fails or execution errors
- `stream(input: TInput, options?: StreamOptions<TOutput>): AgentHandle<TOutput>`
  - Same as execute but returns handle for streaming
  - Allows consuming chunks as they arrive

**State**: Stateless - constructed fresh for each build() call

**Dependencies**: Uses injected `IAgentRunner` and `IUnifiedEventBus` from builder

**Example**:
```typescript
const agent: ExecutableAgent<PlannerInput, PlannerOutput> = builder.build(PlannerAgentDefinition);
const result = await agent.execute({ prd: "Build TODO app" });
```

---

### AgentBuilder (Injectable Service)

**Purpose**: Injectable service that constructs `ExecutableAgent` instances from `AnthropicAgentDefinition` configurations.

**Dependencies**:
- `IAgentRunnerToken` - Injected LLM runner (AnthropicRunner)
- `IUnifiedEventBusToken` - Injected event bus for emitting agent lifecycle events

**Methods**:
- `build<TIn, TOut>(definition: AnthropicAgentDefinition<TIn, TOut>): ExecutableAgent<TIn, TOut>`
  - Validates definition structure
  - Creates internal agent using injected dependencies
  - Returns executable with execute/stream methods

**Lifecycle**: Singleton per container (standard @injectable behavior)

**Testing**: Can be tested with mock runner and bus without real infrastructure

**Example**:
```typescript
@injectable()
class AgentBuilder {
  constructor(
    private runner = inject(IAgentRunnerToken),
    private bus = inject(IUnifiedEventBusToken),
  ) {}

  build<TIn, TOut>(definition: AnthropicAgentDefinition<TIn, TOut>): ExecutableAgent<TIn, TOut> {
    return {
      execute: async (input, options) => {
        // Validate, render, run, parse
        const validated = definition.inputSchema.parse(input);
        const prompt = definition.prompt.render(validated);
        const result = await this.runner.run(prompt, definition.outputSchema);
        return result;
      },
      stream: (input, options) => {
        // Similar but streaming
      },
    };
  }
}
```

---

### ExecuteOptions<TOutput>

**Purpose**: Options passed to `execute()` or `executeAgent()` for customizing execution behavior.

**Properties**:
- `container?: Container` - Optional custom container for DI (mainly for testing)
- `channel?: IChannel` - Optional channel for receiving progress events
- `recording?: RecordingOptions` - Optional recording configuration
- `monologue?: MonologueOptions` - Optional monologue configuration
- `prompt?: PromptTemplate<...>` - Optional prompt override (replaces definition's prompt)

**Defaults**:
- If `container` not provided, helpers create temporary container
- If `channel` not provided, no channel events emitted
- Recording/monologue off by default

**Example**:
```typescript
const result = await executeAgent(PlannerAgent,
  { prd: "Build TODO app" },
  {
    channel: new ConsoleChannel(),
    container: testContainer, // Use mock dependencies
  }
);
```

---

### StreamOptions<TOutput>

**Purpose**: Options passed to `stream()` or `streamAgent()` for streaming execution.

**Properties**: Same as `ExecuteOptions` (they share the same structure)

**Example**:
```typescript
const handle = streamAgent(PlannerAgent,
  { prd: "Build TODO app" },
  { channel: new ConsoleChannel() }
);

for await (const chunk of handle) {
  console.log(chunk);
}
```

---

### AgentHandle<TOutput>

**Purpose**: Handle returned from streaming execution, provides chunk iteration and cancellation.

**Properties**:
- `[Symbol.asyncIterator](): AsyncIterator<string>` - Iterate over response chunks
- `cancel(): void` - Cancel the streaming request

**Lifecycle**: Destroyed when iteration completes or cancelled

**Example**:
```typescript
const handle = await agent.stream({ prd: "..." });

for await (const chunk of handle) {
  process.stdout.write(chunk);
}

// Or cancel early
setTimeout(() => handle.cancel(), 5000);
```

---

### PromptTemplate<TData>

**Purpose**: Template string with typed variables for rendering prompts.

**Properties**:
- `template: string` - Template with `{{variable}}` placeholders
- `render(data: TData): string` - Render template with data
- `validate?(data: TData): void` - Optional validation before render

**Type Safety**: `TData` inferred from template variables

**Example**:
```typescript
const template: PromptTemplate<{ prd: string }> = createPromptTemplate(`
You are a planner. Break down this PRD:

{{prd}}

Return a list of tasks.
`);

const rendered = template.render({ prd: "Build TODO app" });
```

---

## Type Relationships

```
defineAnthropicAgent()
  ↓ returns
AnthropicAgentDefinition<TIn, TOut>
  ↓ passed to
AgentBuilder.build()
  ↓ returns
ExecutableAgent<TIn, TOut>
  ↓ has methods
execute(input, options?) → Promise<TOut>
stream(input, options?) → AgentHandle<TOut>
```

## State Transitions

### Agent Lifecycle

```
1. Definition Created
   defineAnthropicAgent() → AnthropicAgentDefinition (plain object)

2. Agent Built
   builder.build(definition) → ExecutableAgent (has methods)

3. Execution Started
   agent.execute(input) → validates → renders → runs → parses

4. Result Returned
   Promise<TOutput> resolved with typed output
```

### Container Lifecycle (Harness)

```
1. Harness Defined
   defineHarness({ agents: {...} }) → creates closure with config

2. Harness Instance Created
   Harness.create(input) → creates container, binds infrastructure

3. Agents Resolved
   For each agent definition → builder.build(def) → ExecutableAgent

4. Workflow Executes
   Phases run, agents execute, state mutates

5. Harness Completes
   Container can be garbage collected (no shared state)
```

### Container Lifecycle (Standalone)

```
1. Execute Agent Called
   executeAgent(definition, input, options?)

2. Container Created
   options?.container ?? createContainer() + registerAnthropicProvider()

3. Builder Resolved
   container.get(AgentBuilder)

4. Agent Built
   builder.build(definition) → ExecutableAgent

5. Agent Executed
   agent.execute(input) → result

6. Container Discarded
   No references kept, GC collects
```

## Validation Rules

### Agent Definition Validation

```typescript
function validateDefinition(def: AnthropicAgentDefinition<any, any>): void {
  if (!def.name || typeof def.name !== 'string') {
    throw new Error("Agent definition must have a non-empty name");
  }

  if (!def.prompt || typeof def.prompt.render !== 'function') {
    throw new Error("Agent definition must have a valid prompt template");
  }

  if (!def.inputSchema || !def.outputSchema) {
    throw new Error("Agent definition must have input and output schemas");
  }
}
```

### Input Validation (at execution)

```typescript
async function execute<TIn, TOut>(
  definition: AnthropicAgentDefinition<TIn, TOut>,
  input: TIn,
): Promise<TOut> {
  // Validate input against schema
  const validated = definition.inputSchema.parse(input);
  // If parse throws, Zod error bubbles up to caller

  // ... rest of execution
}
```

## Serialization

### What's Serializable

✅ `AnthropicAgentDefinition` - Plain object with schemas
✅ Agent input/output data - Standard JSON types
✅ Zod schemas - Can convert to JSON Schema

### What's NOT Serializable

❌ `ExecutableAgent` - Has methods (functions not serializable)
❌ `AgentBuilder` - Injectable service with dependencies
❌ `Container` - DI container with internal state
❌ `AgentHandle` - Async iterator with cancellation logic

**Use Case**: Agent definitions can be stored, transmitted, or validated separately from execution.

## Constraints

### Immutability

- `AnthropicAgentDefinition` - Immutable after creation (frozen in production)
- `ExecutableAgent` - Stateless, safe to call multiple times
- `PromptTemplate` - Immutable template string

### Dependency Direction

```
User Code
  ↓ uses
AnthropicAgentDefinition (config)
  ↓ consumed by
AgentBuilder (framework/infrastructure)
  ↓ depends on
IAgentRunner, IUnifiedEventBus (infrastructure interfaces)
```

**Rule**: User code never sees builder or container. Only definitions and helpers.

### Type Safety

- `TInput` and `TOutput` flow through entire chain
- Compiler enforces schema matches template variables
- No `any` types in public API

---

## Example: Full Flow

```typescript
// 1. Define agent (user code, pure config)
export const PlannerAgent = defineAnthropicAgent({
  name: "PlannerAgent",
  prompt: createPromptTemplate(`Break down: {{prd}}`),
  inputSchema: z.object({ prd: z.string() }),
  outputSchema: z.object({ tasks: z.array(TaskSchema) }),
});

// 2. Standalone execution (helper creates container internally)
const result = await executeAgent(PlannerAgent, { prd: "Build app" });

// 3. Harness execution (harness creates container, uses builder)
const Harness = defineHarness({
  agents: { planner: PlannerAgent }, // Just pass definition
  run: async ({ agents }) => {
    // agents.planner is ExecutableAgent (built by harness)
    const plan = await agents.planner.execute({ prd: "..." });
  },
});

// 4. Test with mocks (pass custom container)
const testContainer = createContainer();
testContainer.bind({ provide: IAgentRunnerToken, useValue: mockRunner });
const result = await executeAgent(PlannerAgent, { prd: "..." }, { container: testContainer });
```
