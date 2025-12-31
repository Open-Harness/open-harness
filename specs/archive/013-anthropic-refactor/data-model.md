# Data Model: Anthropic Package Architecture Refactor

**Branch**: `013-anthropic-refactor` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)

---

## Core Entities

### AnthropicAgentDefinition<TInput, TOutput>

Agent configuration passed to the factory.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Unique agent identifier (e.g., "CodingAgent") |
| `prompt` | `PromptTemplate<TInput> \| string` | Yes | Template or static string |
| `inputSchema` | `ZodType<TInput>` | Yes | Validates input, provides template variables |
| `outputSchema` | `ZodType<TOutput>` | Yes | Validates structured output from LLM |
| `options` | `Partial<SDKOptions>` | No | SDK options passthrough (model, maxTokens, etc.) |
| `recording` | `RecordingOptions` | No | Recording configuration for replay |
| `monologue` | `MonologueOptions` | No | Monologue configuration |

```typescript
interface AnthropicAgentDefinition<TInput, TOutput> {
  name: string;
  prompt: PromptTemplate<TInput> | string;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  options?: Partial<Options>;
  recording?: {
    enabled?: boolean;
    vaultPath?: string;
  };
  monologue?: {
    enabled?: boolean;
    scope?: string;
  };
}
```

### PromptTemplate<TData>

Type-safe prompt template with compile-time variable validation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `template` | `string` | Yes | Template string with `{{variable}}` placeholders |
| `render` | `(data: TData) => string` | Yes | Returns interpolated prompt |
| `validate` | `(data: unknown) => data is TData` | No | Optional runtime validation |

```typescript
type ExtractVars<S extends string> =
  S extends `${string}{{${infer Var}}}${infer Rest}`
    ? Var | ExtractVars<Rest>
    : never;

interface PromptTemplate<TData> {
  template: string;
  render(data: TData): string;
  validate?(data: unknown): data is TData;
}
```

### AnthropicAgent<TInput, TOutput>

The agent object returned by `defineAnthropicAgent()`.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Agent identifier (readonly) |
| `execute` | `(input: TInput, options?: ExecuteOptions<TOutput>) => Promise<TOutput>` | Run agent and return typed output |
| `stream` | `(input: TInput, options?: StreamOptions<TOutput>) => AgentHandle<TOutput>` | Run agent with streaming handle |

```typescript
interface AnthropicAgent<TInput, TOutput> {
  readonly name: string;
  execute(input: TInput, options?: ExecuteOptions<TOutput>): Promise<TOutput>;
  stream(input: TInput, options?: StreamOptions<TOutput>): AgentHandle<TOutput>;
}
```

### ExecuteOptions<TOutput>

Options for `.execute()` method.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `callbacks` | `IAgentCallbacks<TOutput>` | No | Event callbacks |
| `sessionId` | `string` | No | Session identifier (auto-generated if omitted) |
| `prompt` | `PromptTemplate<TInput>` | No | Override prompt template |
| `timeoutMs` | `number` | No | Execution timeout |

### AgentHandle<TOutput>

Handle returned by `.stream()` for interaction control.

| Field | Type | Description |
|-------|------|-------------|
| `interrupt` | `() => void` | Cancel agent execution |
| `streamInput` | `(input: string) => void` | Inject additional input mid-execution |
| `setModel` | `(model: string) => void` | Change model mid-execution |
| `result` | `Promise<TOutput>` | Final result promise |

---

## Infrastructure Entities (Internal)

### InternalAnthropicAgent

Internal class that implements the actual agent logic. **NOT EXPORTED**.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Agent identifier |
| `runner` | `IAgentRunner` | Injected runner (from DI container) |
| `unifiedBus` | `IUnifiedEventBus \| null` | Injected event bus (optional) |

```typescript
// Internal - NOT exported
@injectable()
class InternalAnthropicAgent {
  constructor(
    public readonly name: string,
    protected runner: IAgentRunner = inject(IAgentRunnerToken),
    protected unifiedBus: IUnifiedEventBus | null = inject(IUnifiedEventBusToken, { optional: true }) ?? null,
  ) {}

  async run<TOutput>(prompt: string, sessionId: string, options?: AgentRunOptions<TOutput>): Promise<TOutput>;
}
```

---

## Preset Entities

### CodingAgentInput

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `task` | `string` | Yes | Coding task description |

```typescript
const CodingInputSchema = z.object({
  task: z.string().min(1, "Task is required"),
});
type CodingInput = z.infer<typeof CodingInputSchema>;
```

### CodingAgentOutput

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | `string` | Yes | Generated code |
| `explanation` | `string` | No | Code explanation |
| `language` | `string` | No | Programming language |

```typescript
const CodingOutputSchema = z.object({
  code: z.string(),
  explanation: z.string().optional(),
  language: z.string().optional(),
});
type CodingOutput = z.infer<typeof CodingOutputSchema>;
```

### ReviewAgentInput

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `task` | `string` | Yes | Review task description |
| `implementationSummary` | `string` | Yes | Summary of code to review |

### PlannerAgentInput

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prd` | `string` | Yes | Product requirements document |

---

## Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Code                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  defineAnthropicAgent({                                          │
│    name: "MyCoder",                                              │
│    prompt: codingPrompt,                                         │
│    inputSchema: CodingInputSchema,         AnthropicAgentDefinition
│    outputSchema: CodingOutputSchema        ─────────────────────►
│  })                                                              │
│     │                                                            │
│     ▼                                                            │
│  agent.execute({ task: "..." })             AnthropicAgent       │
│     │                                       ◄───────────────────  │
└─────┼───────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Factory (provider/)                         │
├─────────────────────────────────────────────────────────────────┤
│  • Creates/gets singleton DI container                           │
│  • Registers InternalAnthropicAgent                              │
│  • Wires IAgentRunner, IUnifiedEventBus                          │
│  • Wraps with recording/monologue if enabled                     │
│  • Returns AnthropicAgent<TInput, TOutput>                       │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Infrastructure (infra/)                       │
├─────────────────────────────────────────────────────────────────┤
│  AnthropicRunner ←── IAgentRunner                                │
│  IUnifiedEventBus (event propagation)                            │
│  RecordingFactory (replay support)                               │
│  MonologueLLM (self-reflection)                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## State Transitions

### Agent Execution Flow

```
IDLE ──[execute(input)]──► VALIDATING ──[schema ok]──► RUNNING ──[complete]──► COMPLETED
                               │                           │
                               ▼                           ▼
                           [validation error]          [timeout/error]
                               │                           │
                               ▼                           ▼
                            FAILED                      FAILED
```

### Recording State

```
DISABLED ──[recording.enabled=true]──► CAPTURING ──[execute completes]──► STORED
                                            │
                                            ▼ [replay mode]
                                        REPLAYING ──[replay completes]──► VERIFIED
```

---

## Validation Rules

| Entity | Field | Rule |
|--------|-------|------|
| AnthropicAgentDefinition | name | Non-empty string, unique per container |
| AnthropicAgentDefinition | inputSchema | Valid Zod schema |
| AnthropicAgentDefinition | outputSchema | Valid Zod schema |
| PromptTemplate | template | Contains at least one `{{variable}}` or is non-empty string |
| CodingAgentInput | task | Non-empty string (min 1 char) |

---

**Last Updated**: 2025-12-28
