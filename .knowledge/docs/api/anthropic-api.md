# Anthropic Provider API Reference

## Factory API

### defineAnthropicAgent()

Creates a typed agent with input/output validation.

**Signature**:
```typescript
function defineAnthropicAgent<TInput, TOutput>(
  definition: AnthropicAgentDefinition<TInput, TOutput>
): AnthropicAgent<TInput, TOutput>
```

**Parameters**:
- `definition.name` (string) - Agent identifier for logging/events
- `definition.prompt` (PromptTemplate<TInput> | string) - System prompt template
- `definition.inputSchema` (ZodType<TInput>) - Zod schema for input validation
- `definition.outputSchema` (ZodType<TOutput>) - Zod schema for output validation
- `definition.options` (Partial<Options>?) - Optional Anthropic SDK options (model, maxTokens, etc.)
- `definition.recording` (RecordingOptions?) - Optional recording configuration
- `definition.monologue` (MonologueOptions?) - Optional narrative generation configuration

**Returns**: AnthropicAgent with execute() and stream() methods

**Example**:
```typescript
import { defineAnthropicAgent, createPromptTemplate } from "@openharness/anthropic";
import { z } from "zod";

const MyAgent = defineAnthropicAgent({
  name: "MyAgent",
  prompt: createPromptTemplate("Task: {{task}}"),
  inputSchema: z.object({ task: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  options: {
    model: "claude-sonnet-4-20250514",
    maxTokens: 4096,
  },
});

const output = await MyAgent.execute({ task: "Hello" });
console.log(output.result);
```

---

### createPromptTemplate()

Creates type-safe prompt template with variable extraction.

**Signature**:
```typescript
function createPromptTemplate<S extends string>(
  template: S,
  schema?: ZodType
): PromptTemplate<ExtractVars<S>>
```

**Features**:
- Compile-time type extraction from `{{variable}}` syntax
- Runtime validation of required variables
- Type-safe render() method
- Optional schema for additional validation

**Example**:
```typescript
import { createPromptTemplate } from "@openharness/anthropic";

const template = createPromptTemplate("Hello {{name}}, task: {{task}}");
// TypeScript knows template requires { name: string, task: string }

const rendered = template.render({ name: "Claude", task: "code" });
// "Hello Claude, task: code"
```

**With Schema Validation**:
```typescript
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  task: z.string().min(5),
});

const template = createPromptTemplate("Hello {{name}}, task: {{task}}", schema);
// Validates at runtime that name and task meet schema requirements
```

---

### createStaticPrompt()

Creates prompt without variables.

**Signature**:
```typescript
function createStaticPrompt(text: string): PromptTemplate<Record<string, never>>
```

**Example**:
```typescript
import { createStaticPrompt } from "@openharness/anthropic";

const prompt = createStaticPrompt("You are a helpful assistant");
const rendered = prompt.render({}); // No variables required
```

---

## Types

### AnthropicAgentDefinition<TInput, TOutput>

Agent configuration object.

**Properties**:
```typescript
interface AnthropicAgentDefinition<TInput, TOutput> {
  name: string;
  prompt: PromptTemplate<TInput> | string;
  inputSchema: ZodType<TInput>;
  outputSchema: ZodType<TOutput>;
  options?: Partial<Options>;
  recording?: RecordingOptions;
  monologue?: MonologueOptions;
}
```

---

### AnthropicAgent<TInput, TOutput>

Returned agent interface.

**Methods**:
- `execute(input: TInput, options?: ExecuteOptions<TOutput>): Promise<TOutput>`
  - Execute agent with given input, wait for completion
  - Returns structured output validated against output schema
  - Throws on validation errors or execution failures

- `stream(input: TInput, options?: StreamOptions<TOutput>): AgentHandle<TOutput>`
  - Start agent execution and return handle for streaming control
  - Allows interruption, streaming additional input, and model changes
  - Returns AgentHandle with result promise

**Properties**:
- `name: string` (readonly) - Agent identifier

**Example**:
```typescript
// Execute mode (simple)
const result = await MyAgent.execute({ task: "test" });

// Stream mode (advanced)
const handle = MyAgent.stream({ task: "test" });
handle.interrupt(); // Stop execution
const result = await handle.result; // Wait for final result
```

---

### ExecuteOptions<TOutput>

Runtime execution options.

**Properties**:
```typescript
interface ExecuteOptions<TOutput> {
  callbacks?: IAgentCallbacks<TOutput>;
  sessionId?: string;
  prompt?: PromptTemplate<unknown>;
  timeoutMs?: number;
}
```

- `callbacks` - Event callbacks for progress tracking
- `sessionId` - Session identifier for recording/replay
- `prompt` - Override default prompt for this execution
- `timeoutMs` - Execution timeout in milliseconds

**Example**:
```typescript
import type { IAgentCallbacks } from "@openharness/sdk";

const callbacks: IAgentCallbacks<MyOutput> = {
  onStart: (metadata) => console.log("Agent started:", metadata.agentName),
  onText: (text) => console.log("Text:", text),
  onComplete: (result) => console.log("Done:", result),
};

await MyAgent.execute({ task: "test" }, { callbacks, timeoutMs: 30000 });
```

---

### StreamOptions<TOutput>

Streaming execution options (extends ExecuteOptions).

**Properties**:
```typescript
interface StreamOptions<TOutput> extends ExecuteOptions<TOutput> {
  // All ExecuteOptions plus streaming-specific options (if any)
}
```

---

### AgentHandle<TOutput>

Control handle for streaming execution.

**Methods**:
- `interrupt(): void` - Stop agent execution
- `streamInput(input: string): void` - Send additional input during execution
- `setModel(model: string): void` - Change model mid-execution

**Properties**:
- `result: Promise<TOutput>` - Promise that resolves to final output

**Example**:
```typescript
const handle = MyAgent.stream({ task: "long task" });

// Send additional guidance
handle.streamInput("Please also consider edge cases");

// Change model for better performance
handle.setModel("claude-opus-4-5-20251101");

// Wait for completion
const result = await handle.result;
```

---

### PromptTemplate<TData>

Type-safe prompt template.

**Methods**:
- `render(data: TData): string` - Render template with data

**Properties**:
- `template: string` - Raw template string
- `variables: string[]` - Extracted variable names

**Example**:
```typescript
const template = createPromptTemplate("Hello {{name}}");
console.log(template.variables); // ["name"]
console.log(template.template);  // "Hello {{name}}"

const result = template.render({ name: "World" });
console.log(result); // "Hello World"
```

---

## Provider Internals

### AnthropicEventMapper

Event conversion utility for mapping Anthropic SDK messages to unified event format.

**Methods**:
- `static toUnifiedEvents(msg: SDKMessage, agentName: string): BaseEvent[]`
  - Converts Anthropic-specific SDKMessage to provider-agnostic BaseEvent array
  - Handles all message types: system, assistant, user, result
  - Maps text, thinking, tool calls, and tool results

**Example**:
```typescript
import { AnthropicEventMapper } from "@openharness/anthropic";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

const events = AnthropicEventMapper.toUnifiedEvents(sdkMessage, "MyAgent");
for (const event of events) {
  console.log(event.type, event);
}
```

**Supported Event Types**:
- `agent:start` - Agent initialization
- `agent:text` - Text content from agent
- `agent:thinking` - Extended thinking content
- `agent:tool:start` - Tool call initiated
- `agent:tool:complete` - Tool call completed
- `agent:complete` - Agent execution finished

---

## Presets

### CodingAgent

Pre-configured agent for code generation.

**Input Schema**:
```typescript
{
  task: string; // Required, min 1 character
}
```

**Output Schema**:
```typescript
{
  code: string;
  explanation: string;
  language?: string;
}
```

**Example**:
```typescript
import { CodingAgent } from "@openharness/anthropic/presets";

const result = await CodingAgent.execute({
  task: "Write a function to calculate fibonacci numbers"
});

console.log(result.code);
console.log(result.explanation);
```

---

### ReviewAgent

Pre-configured agent for code review.

**Input Schema**:
```typescript
{
  task: string; // Required, min 1 character
  implementationSummary: string; // Required, min 1 character
}
```

**Output Schema**:
```typescript
{
  issues: ReviewIssue[];
  summary: string;
  approved: boolean;
  suggestions?: string[];
}

interface ReviewIssue {
  severity: "critical" | "medium" | "low";
  description: string;
  location?: string;
}
```

**Example**:
```typescript
import { ReviewAgent } from "@openharness/anthropic/presets";

const result = await ReviewAgent.execute({
  task: "Implement user authentication",
  implementationSummary: "Added JWT-based auth. commit:abc123..."
});

console.log("Approved:", result.approved);
console.log("Issues:", result.issues);
```

---

### PlannerAgent

Pre-configured agent for planning and task breakdown.

**Input Schema**:
```typescript
{
  prd: string; // Required, min 1 character - Product Requirements Document
}
```

**Output Schema**:
```typescript
{
  tasks: PlannerTask[];
  reasoning?: string;
}

interface PlannerTask {
  id: string;
  title: string;
  description: string;
  dependencies: string[];
}
```

**Example**:
```typescript
import { PlannerAgent } from "@openharness/anthropic/presets";

const result = await PlannerAgent.execute({
  prd: "Build a todo list app with user authentication and cloud sync"
});

for (const task of result.tasks) {
  console.log(`${task.id}: ${task.title}`);
  console.log(`  Dependencies: ${task.dependencies.join(", ")}`);
}
```

---

## Container Management

### setFactoryContainer()

Override the default DI container for agent creation.

**Signature**:
```typescript
function setFactoryContainer(container: Container): void
```

**Use Cases**:
- Testing with mock runners
- Custom infrastructure configuration
- Multi-tenant applications

**Example**:
```typescript
import { setFactoryContainer } from "@openharness/anthropic";
import { createTestContainer } from "@openharness/sdk";

const testContainer = createTestContainer({ mode: "replay" });
setFactoryContainer(testContainer);

// Now all agents use test infrastructure
const agent = defineAnthropicAgent({ /* ... */ });
```

---

### resetFactoryContainer()

Reset container to default state.

**Signature**:
```typescript
function resetFactoryContainer(): void
```

**Example**:
```typescript
import { resetFactoryContainer } from "@openharness/anthropic";

afterEach(() => {
  resetFactoryContainer(); // Clean state between tests
});
```

---

## Advanced Usage

### Prompt Override

Override an agent's default prompt at runtime:

```typescript
import { createPromptTemplate } from "@openharness/anthropic";

const customPrompt = createPromptTemplate(`
[EXPERT MODE]
Task: {{task}}

Please provide detailed explanations with examples.
`);

const result = await MyAgent.execute(
  { task: "explain closures" },
  { prompt: customPrompt }
);
```

### Custom Event Handling

Subscribe to all agent events:

```typescript
import type { IAgentCallbacks } from "@openharness/sdk";

const callbacks: IAgentCallbacks<MyOutput> = {
  onStart: (metadata) => {
    console.log("Started:", metadata);
  },
  onText: (text) => {
    process.stdout.write(text);
  },
  onToolCall: (event) => {
    console.log("Tool:", event.toolName, event.input);
  },
  onToolResult: (event) => {
    console.log("Result:", event.result);
  },
  onError: (error) => {
    console.error("Error:", error);
  },
  onComplete: (result) => {
    console.log("Complete:", result);
  },
};

await MyAgent.execute({ task: "test" }, { callbacks });
```

### Recording and Replay

Enable recording for deterministic testing:

```typescript
const agent = defineAnthropicAgent({
  name: "RecordedAgent",
  prompt: createPromptTemplate("Task: {{task}}"),
  inputSchema: z.object({ task: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  recording: {
    enabled: true,
    vaultPath: "./recordings",
  },
});

// First run: records to ./recordings/RecordedAgent/session-{id}.jsonl
await agent.execute({ task: "test" }, { sessionId: "test-session" });

// Replay mode (configured via container):
import { createContainer } from "@openharness/sdk";
const replayContainer = createContainer({
  mode: "replay",
  recordingsDir: "./recordings",
});
setFactoryContainer(replayContainer);

// Subsequent runs: replay from recording
await agent.execute({ task: "test" }, { sessionId: "test-session" });
```

---

## Error Handling

All agent methods can throw these error types:

**ValidationError**: Input or output validation failed
```typescript
try {
  await agent.execute({ task: "" }); // Empty task
} catch (error) {
  if (error.message.includes("Input validation failed")) {
    console.error("Invalid input:", error);
  }
}
```

**ExecutionError**: Agent execution failed
```typescript
try {
  await agent.execute({ task: "test" }, { timeoutMs: 1000 });
} catch (error) {
  if (error.message.includes("timeout")) {
    console.error("Execution timed out");
  }
}
```

---

## Type Safety

The Anthropic provider is fully type-safe:

```typescript
import { defineAnthropicAgent, createPromptTemplate } from "@openharness/anthropic";
import { z } from "zod";

const agent = defineAnthropicAgent({
  name: "TypeSafe",
  prompt: createPromptTemplate("Process: {{data}}"),
  inputSchema: z.object({ data: z.string() }),
  outputSchema: z.object({ processed: z.boolean() }),
});

// ✅ TypeScript enforces correct input type
const result = await agent.execute({ data: "test" });

// ✅ TypeScript knows output structure
result.processed; // boolean

// ❌ TypeScript error: missing required field
await agent.execute({});

// ❌ TypeScript error: wrong field type
await agent.execute({ data: 123 });
```
