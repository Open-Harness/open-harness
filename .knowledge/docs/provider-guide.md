# Provider Creation Guide

Complete guide for building new Open Harness provider packages (Gemini, Codex, OpenCode, etc.)

## Table of Contents

1. [Overview](#overview)
2. [Package Setup](#1-package-setup)
3. [Implement IAgentRunner](#2-implement-iagentrunner)
4. [Create Event Mapper](#3-create-event-mapper)
5. [Build Factory API](#4-build-factory-api)
6. [Create Internal Agent](#5-create-internal-agent)
7. [Build Presets](#6-build-presets)
8. [Testing Strategy](#7-testing-strategy)
9. [Documentation](#8-documentation)
10. [Publishing](#9-publishing)

---

## Overview

### Provider Architecture

Providers follow a layered architecture:

```
@openharness/{provider}/
├── src/
│   ├── provider/           # Factory API (user-facing)
│   │   ├── factory.ts      # defineAgent() function
│   │   ├── types.ts        # Type definitions
│   │   ├── prompt-template.ts
│   │   ├── internal-agent.ts
│   │   └── {provider}-event-mapper.ts
│   ├── infra/              # Infrastructure
│   │   ├── runner/         # IAgentRunner implementation
│   │   └── recording/      # Recording/replay
│   ├── presets/            # Pre-built agents
│   └── index.ts            # Main export
├── tests/
│   ├── unit/
│   ├── integration/
│   └── helpers/
└── package.json
```

### Key Concepts

- **IAgentRunner**: Adapts provider SDK to generic interface
- **Event Mapper**: Converts provider messages → BaseEvent
- **Factory API**: Type-safe agent creation
- **Internal Agent**: Execution orchestration
- **Presets**: Ready-to-use agents

---

## 1. Package Setup

### 1.1 Initialize Package

```bash
mkdir -p packages/gemini
cd packages/gemini
bun init -y
```

### 1.2 Package.json

```json
{
  "name": "@openharness/gemini",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./presets": {
      "import": "./dist/presets/index.js",
      "types": "./dist/presets/index.d.ts"
    },
    "./provider": {
      "import": "./dist/provider/index.js",
      "types": "./dist/provider/index.d.ts"
    },
    "./runner": {
      "import": "./dist/infra/runner/index.js",
      "types": "./dist/infra/runner/index.d.ts"
    }
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc -p tsconfig.build.json",
    "test": "bun test"
  },
  "dependencies": {
    "@needle-di/core": "workspace:*",
    "@openharness/sdk": "workspace:*",
    "@google/generative-ai": "^0.21.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.6.0"
  },
  "peerDependencies": {
    "@openharness/sdk": "^0.1.0"
  }
}
```

### 1.3 TypeScript Configuration

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["bun-types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**tsconfig.build.json**:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "removeComments": true
  }
}
```

### 1.4 Directory Structure

```bash
mkdir -p src/{provider,infra/runner,presets}
mkdir -p tests/{unit,integration,helpers}
```

---

## 2. Implement IAgentRunner

The runner adapts your provider's SDK to the generic IAgentRunner interface.

### 2.1 Create Runner Implementation

**File**: `src/infra/runner/gemini-runner.ts`

```typescript
/**
 * Gemini Runner - Implements IAgentRunner for Google Generative AI SDK
 *
 * Key Responsibilities:
 * 1. Convert generic options → Gemini-specific options
 * 2. Call Gemini SDK with streaming
 * 3. Convert Gemini messages → GenericMessage
 * 4. Fire callbacks for each message
 */

import { injectable } from "@needle-di/core";
import OpenAI from "openai";
import type {
  GenericMessage,
  GenericRunnerOptions,
  IAgentRunner,
  RunnerCallbacks,
} from "@openharness/sdk";

/**
 * OpenAI-specific options (extends GenericRunnerOptions)
 */
export interface OpenAIOptions extends GenericRunnerOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: OpenAI.ChatCompletionTool[];
}

@injectable()
export class OpenAIRunner implements IAgentRunner {
  private client: OpenAI;

  constructor() {
    // Initialize OpenAI client
    // In production, read API key from env or config
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Execute agent with OpenAI SDK
   */
  async run(args: {
    prompt: string;
    options: GenericRunnerOptions;
    callbacks?: RunnerCallbacks;
  }): Promise<GenericMessage | undefined> {
    // Cast to OpenAI-specific options
    const opts = args.options as OpenAIOptions;

    try {
      // Create chat completion stream
      const stream = await this.client.chat.completions.create({
        model: opts.model || "gpt-4",
        messages: [{ role: "system", content: args.prompt }],
        temperature: opts.temperature || 0.7,
        max_tokens: opts.maxTokens || 4096,
        tools: opts.tools,
        stream: true,
      });

      // Accumulate response
      let fullContent = "";
      let lastMessage: GenericMessage | undefined;

      // Process stream
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          fullContent += delta.content;

          // Create GenericMessage for this chunk
          const msg: GenericMessage = {
            type: "assistant",
            subtype: "delta",
            message: {
              role: "assistant",
              content: [{ type: "text", text: delta.content }],
            },
          };

          // Fire callback
          if (args.callbacks?.onMessage) {
            args.callbacks.onMessage(msg);
          }

          lastMessage = msg;
        }

        // Handle tool calls
        if (delta?.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            const toolMsg: GenericMessage = {
              type: "assistant",
              subtype: "tool_call",
              message: {
                role: "assistant",
                content: [
                  {
                    type: "tool_use",
                    id: toolCall.id!,
                    name: toolCall.function!.name,
                    input: JSON.parse(toolCall.function!.arguments || "{}"),
                  },
                ],
              },
            };

            if (args.callbacks?.onMessage) {
              args.callbacks.onMessage(toolMsg);
            }

            lastMessage = toolMsg;
          }
        }
      }

      // Final result message
      const resultMsg: GenericMessage = {
        type: "result",
        subtype: "success",
        structured_output: {
          content: fullContent,
        },
      };

      if (args.callbacks?.onMessage) {
        args.callbacks.onMessage(resultMsg);
      }

      return resultMsg;
    } catch (error) {
      // Error message
      const errorMsg: GenericMessage = {
        type: "result",
        subtype: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };

      if (args.callbacks?.onMessage) {
        args.callbacks.onMessage(errorMsg);
      }

      throw error;
    }
  }
}
```

### 2.2 Create Type Definitions

**File**: `src/infra/runner/models.ts`

```typescript
/**
 * OpenAI-specific type definitions
 */

import type OpenAI from "openai";

/**
 * OpenAI message types mapped to GenericMessage format
 */
export type OpenAIChatMessage = OpenAI.ChatCompletionMessage;
export type OpenAIStreamChunk = OpenAI.ChatCompletionChunk;

/**
 * Tool definition for OpenAI function calling
 */
export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}
```

### 2.3 Export from Runner Index

**File**: `src/infra/runner/index.ts`

```typescript
/**
 * Runner Infrastructure Exports
 */

export { OpenAIRunner } from "./openai-runner.js";
export type { OpenAIOptions } from "./openai-runner.js";
export type { OpenAIChatMessage, OpenAIStreamChunk, OpenAITool } from "./models.js";
```

---

## 3. Create Event Mapper

The event mapper converts provider-specific messages to the unified BaseEvent format.

### 3.1 Implement Event Mapper

**File**: `src/provider/openai-event-mapper.ts`

```typescript
/**
 * OpenAI Event Mapper - Provider-specific event conversion
 *
 * Converts OpenAI SDK messages to unified BaseEvent format.
 * This pattern ensures type safety at the provider boundary.
 *
 * @example Future providers follow same pattern
 * ```typescript
 * // @openharness/gemini/src/provider/gemini-event-mapper.ts
 * export class GeminiEventMapper {
 *   static toUnifiedEvents(msg: GeminiMessage, agentName: string): BaseEvent[]
 * }
 * ```
 */

import type { GenericMessage, BaseEvent } from "@openharness/sdk";

/**
 * OpenAI-specific message structure
 * (In reality, import from 'openai' package)
 */
interface OpenAIMessage {
  type: "assistant" | "user" | "system" | "result";
  subtype?: "delta" | "tool_call" | "success" | "error";
  message?: {
    role: string;
    content: Array<{
      type: "text" | "tool_use";
      text?: string;
      name?: string;
      input?: unknown;
    }>;
  };
  structured_output?: unknown;
  error?: string;
}

export class OpenAIEventMapper {
  /**
   * Convert OpenAI GenericMessage to provider-agnostic BaseEvent[]
   *
   * @param msg - OpenAI message (cast from GenericMessage)
   * @param agentName - Agent identifier for event context
   * @returns Array of BaseEvents
   */
  static toUnifiedEvents(msg: OpenAIMessage, agentName: string): BaseEvent[] {
    const events: BaseEvent[] = [];

    switch (msg.type) {
      case "system":
        // System initialization
        if (msg.subtype === "init") {
          events.push({
            type: "agent:start",
            agentName,
          });
        }
        break;

      case "assistant":
        // Assistant messages (text, tool calls)
        if (msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === "text" && block.text) {
              events.push({
                type: "agent:text",
                content: block.text,
              });
            } else if (block.type === "tool_use") {
              events.push({
                type: "agent:tool:start",
                toolName: block.name || "unknown",
                input: block.input,
              });
            }
          }
        }
        break;

      case "user":
        // User messages (usually tool results)
        if (msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === "tool_result") {
              events.push({
                type: "agent:tool:complete",
                toolName: "unknown", // OpenAI doesn't track tool name in result
                result: block,
                isError: false,
              });
            }
          }
        }
        break;

      case "result":
        // Final result or error
        events.push({
          type: "agent:complete",
          agentName,
          success: msg.subtype === "success",
        });
        break;
    }

    return events;
  }
}
```

### 3.2 Usage Pattern

The event mapper is used in the internal agent with a type guard (no casting):

```typescript
// In internal-agent.ts
import { GeminiEventMapper } from "./gemini-event-mapper.js";
import type { GeminiMessage } from "./gemini-event-mapper.js";

// Type guard validates message structure
private isGeminiMessage(msg: GenericMessage): msg is GeminiMessage {
  return msg && typeof msg === 'object' && 'type' in msg;
}

private handleMessage(msg: GenericMessage) {
  if (!this.isGeminiMessage(msg)) {
    console.warn('Received non-Gemini message in Gemini agent', msg);
    return;
  }

  // TypeScript now knows msg is GeminiMessage - no cast needed
  const events = GeminiEventMapper.toUnifiedEvents(msg, this.name);

  for (const event of events) {
    this.unifiedBus.emit(event, { agent: { name: this.name } });
  }
}
```

**Key Pattern**:
- Type guard makes intent explicit and validates at runtime
- No `as unknown as` casts - TypeScript narrows the type automatically
- Returns early on malformed messages instead of crashing
- Runtime safety without sacrificing type safety

---

## 4. Build Factory API

The factory API provides type-safe agent creation.

### 4.1 Create Prompt Template System

**File**: `src/provider/prompt-template.ts`

```typescript
/**
 * Prompt Template System - Type-safe template rendering
 */

import type { ZodType } from "zod";

/**
 * Extract variable names from template string
 * "Hello {{name}}" → { name: string }
 */
export type ExtractVars<S extends string> =
  S extends `${infer _Start}{{${infer Var}}}${infer Rest}`
    ? { [K in Var | keyof ExtractVars<Rest>]: string }
    : Record<string, never>;

/**
 * Prompt template with variable extraction
 */
export interface PromptTemplate<TData = Record<string, string>> {
  template: string;
  variables: string[];
  schema?: ZodType<TData>;
  render(data: TData): string;
}

/**
 * Create type-safe prompt template
 *
 * @example
 * const template = createPromptTemplate("Hello {{name}}, task: {{task}}");
 * // TypeScript infers: PromptTemplate<{ name: string, task: string }>
 */
export function createPromptTemplate<S extends string>(
  template: S,
  schema?: ZodType,
): PromptTemplate<ExtractVars<S>> {
  // Extract variables from template
  const variables: string[] = [];
  const regex = /\{\{(\w+)\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return {
    template,
    variables,
    schema,
    render(data: ExtractVars<S>): string {
      // Validate against schema if provided
      if (schema) {
        schema.parse(data);
      }

      // Replace variables
      let result = template;
      for (const [key, value] of Object.entries(data)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
      }

      return result;
    },
  };
}

/**
 * Create static prompt (no variables)
 */
export function createStaticPrompt(text: string): PromptTemplate<Record<string, never>> {
  return {
    template: text,
    variables: [],
    render: () => text,
  };
}
```

### 4.2 Define Types

**File**: `src/provider/types.ts`

```typescript
/**
 * Provider Type Definitions
 */

import type { ZodType } from "zod";
import type { IAgentCallbacks } from "@openharness/sdk";
import type { PromptTemplate } from "./prompt-template.js";
import type { OpenAIOptions } from "../infra/runner/openai-runner.js";

/**
 * Agent definition for factory
 */
export interface OpenAIAgentDefinition<TInput, TOutput> {
  name: string;
  prompt: PromptTemplate<TInput> | string;
  inputSchema: ZodType<TInput>;
  outputSchema: ZodType<TOutput>;
  options?: Partial<OpenAIOptions>;
}

/**
 * Created agent interface
 */
export interface OpenAIAgent<TInput, TOutput> {
  readonly name: string;
  execute(input: TInput, options?: ExecuteOptions<TOutput>): Promise<TOutput>;
  stream(input: TInput, options?: StreamOptions<TOutput>): AgentHandle<TOutput>;
}

/**
 * Execution options
 */
export interface ExecuteOptions<TOutput> {
  callbacks?: IAgentCallbacks<TOutput>;
  sessionId?: string;
  prompt?: PromptTemplate<unknown>;
  timeoutMs?: number;
}

/**
 * Streaming options
 */
export interface StreamOptions<TOutput> extends ExecuteOptions<TOutput> {}

/**
 * Agent handle for streaming
 */
export interface AgentHandle<TOutput> {
  readonly result: Promise<TOutput>;
  interrupt(): void;
  streamInput(input: string): void;
  setModel(model: string): void;
}
```

### 4.3 Implement Factory Function

**File**: `src/provider/factory.ts`

```typescript
/**
 * Agent Factory - Provider-specific agent creation
 */

import type { Container } from "@needle-di/core";
import { IAgentRunnerToken, createContainer } from "@openharness/sdk";
import type {
  OpenAIAgent,
  OpenAIAgentDefinition,
  ExecuteOptions,
  StreamOptions,
  AgentHandle,
} from "./types.js";
import { InternalOpenAIAgent } from "./internal-agent.js";
import { createPromptTemplate, createStaticPrompt } from "./prompt-template.js";
import { OpenAIRunner } from "../infra/runner/openai-runner.js";

/**
 * Global container for dependency injection
 */
let factoryContainer: Container | null = null;

function getFactoryContainer(): Container {
  if (!factoryContainer) {
    factoryContainer = createContainer({ mode: "live" });

    // Bind OpenAI-specific runner
    factoryContainer.bind({
      provide: IAgentRunnerToken,
      useClass: OpenAIRunner,
    });
  }

  return factoryContainer;
}

/**
 * Override container (useful for testing)
 */
export function setFactoryContainer(container: Container): void {
  factoryContainer = container;
}

/**
 * Reset container to default
 */
export function resetFactoryContainer(): void {
  factoryContainer = null;
}

/**
 * Define an OpenAI agent with type-safe input/output
 *
 * @example
 * const MyAgent = defineOpenAIAgent({
 *   name: "MyAgent",
 *   prompt: createPromptTemplate("Task: {{task}}"),
 *   inputSchema: z.object({ task: z.string() }),
 *   outputSchema: z.object({ result: z.string() }),
 * });
 */
export function defineOpenAIAgent<TInput, TOutput>(
  definition: OpenAIAgentDefinition<TInput, TOutput>,
): OpenAIAgent<TInput, TOutput> {
  const container = getFactoryContainer();

  // Convert string prompt to template
  const promptTemplate =
    typeof definition.prompt === "string"
      ? createStaticPrompt(definition.prompt)
      : definition.prompt;

  // Create internal agent (lazy initialization)
  let internalAgent: InternalOpenAIAgent<TInput, TOutput> | null = null;

  function getInternalAgent(): InternalOpenAIAgent<TInput, TOutput> {
    if (!internalAgent) {
      internalAgent = new InternalOpenAIAgent(
        definition.name,
        promptTemplate,
        definition.inputSchema,
        definition.outputSchema,
        definition.options || {},
        container,
      );
    }
    return internalAgent;
  }

  // Return agent interface
  return {
    name: definition.name,

    async execute(input: TInput, options?: ExecuteOptions<TOutput>): Promise<TOutput> {
      return getInternalAgent().execute(input, options);
    },

    stream(input: TInput, options?: StreamOptions<TOutput>): AgentHandle<TOutput> {
      return getInternalAgent().stream(input, options);
    },
  };
}
```

---

## 5. Create Internal Agent

The internal agent orchestrates execution.

### 5.1 Implement Internal Agent

**File**: `src/provider/internal-agent.ts`

```typescript
/**
 * Internal Agent - Execution orchestration
 *
 * Responsibilities:
 * 1. Validate input against schema
 * 2. Render prompt template with input data
 * 3. Execute via IAgentRunner
 * 4. Parse structured output
 * 5. Emit unified events via UnifiedEventBus
 * 6. Validate output against schema
 */

import type { Container } from "@needle-di/core";
import type { ZodType } from "zod";
import type {
  IAgentRunner,
  IAgentCallbacks,
  GenericMessage,
  IUnifiedEventBus,
} from "@openharness/sdk";
import { IAgentRunnerToken, IUnifiedEventBusToken } from "@openharness/sdk";
import type {
  ExecuteOptions,
  StreamOptions,
  AgentHandle,
  PromptTemplate,
} from "./types.js";
import type { OpenAIOptions } from "../infra/runner/openai-runner.js";
import { OpenAIEventMapper } from "./openai-event-mapper.js";

export class InternalOpenAIAgent<TInput, TOutput> {
  private runner: IAgentRunner;
  private unifiedBus: IUnifiedEventBus | null = null;

  constructor(
    public readonly name: string,
    private prompt: PromptTemplate<TInput>,
    private inputSchema: ZodType<TInput>,
    private outputSchema: ZodType<TOutput>,
    private defaultOptions: Partial<OpenAIOptions>,
    container: Container,
  ) {
    // Get runner from container
    this.runner = container.get(IAgentRunnerToken);

    // Get unified event bus (optional)
    try {
      this.unifiedBus = container.get(IUnifiedEventBusToken);
    } catch {
      // No unified bus available
    }
  }

  /**
   * Execute agent and wait for completion
   */
  async execute(input: TInput, options?: ExecuteOptions<TOutput>): Promise<TOutput> {
    // 1. Validate input
    const validatedInput = this.validateInput(input);

    // 2. Render prompt (use override or default)
    const promptToUse = options?.prompt || this.prompt;
    const renderedPrompt = promptToUse.render(validatedInput as never);

    // 3. Execute via runner
    const result = await this.runner.run({
      prompt: renderedPrompt,
      options: { ...this.defaultOptions, ...options },
      callbacks: {
        onMessage: (msg) => this.handleMessage(msg, options?.callbacks),
      },
    });

    // 4. Parse structured output
    if (!result?.structured_output) {
      throw new Error("No structured output from runner");
    }

    // 5. Validate output
    return this.validateOutput(result.structured_output);
  }

  /**
   * Start streaming execution
   */
  stream(input: TInput, options?: StreamOptions<TOutput>): AgentHandle<TOutput> {
    const validatedInput = this.validateInput(input);
    const promptToUse = options?.prompt || this.prompt;
    const renderedPrompt = promptToUse.render(validatedInput as never);

    // Start execution in background
    const resultPromise = this.runner.run({
      prompt: renderedPrompt,
      options: { ...this.defaultOptions, ...options },
      callbacks: {
        onMessage: (msg) => this.handleMessage(msg, options?.callbacks),
      },
    });

    // Return control handle
    return {
      result: resultPromise.then((result) => {
        if (!result?.structured_output) {
          throw new Error("No structured output from runner");
        }
        return this.validateOutput(result.structured_output);
      }),

      interrupt() {
        // Implement interruption logic
      },

      streamInput(input: string) {
        // Implement streaming additional input
      },

      setModel(model: string) {
        // Implement model change
      },
    };
  }

  /**
   * Validate input against schema
   */
  private validateInput(input: TInput): TInput {
    try {
      return this.inputSchema.parse(input);
    } catch (error) {
      throw new Error(`Input validation failed: ${error}`);
    }
  }

  /**
   * Validate output against schema
   */
  private validateOutput(output: unknown): TOutput {
    try {
      return this.outputSchema.parse(output);
    } catch (error) {
      throw new Error(`Output validation failed: ${error}`);
    }
  }

  /**
   * Handle messages from runner
   */
  private handleMessage<TOut>(msg: GenericMessage, callbacks?: IAgentCallbacks<TOut>): void {
    // Emit to unified event bus
    if (this.unifiedBus) {
      // SAFETY: We're in provider-specific code.
      // The GenericMessage is guaranteed to be OpenAIMessage.
      const openaiMsg = msg as unknown as import("./openai-event-mapper.js").OpenAIMessage;
      const events = OpenAIEventMapper.toUnifiedEvents(openaiMsg, this.name);

      for (const event of events) {
        try {
          this.unifiedBus.emit(event, { agent: { name: this.name } });
        } catch {
          // Silently ignore bus errors
        }
      }
    }

    // Fire user callbacks
    if (callbacks?.onText && msg.type === "assistant") {
      // Extract text content
      const text = msg.message?.content?.[0]?.text;
      if (text) {
        callbacks.onText(text);
      }
    }
  }
}
```

---

## 6. Build Presets

Create pre-configured agents for common use cases.

### 6.1 Create Preset Agents

**File**: `src/presets/coding-agent.ts`

```typescript
/**
 * Coding Agent Preset
 *
 * Pre-configured agent for code generation tasks.
 */

import { z } from "zod";
import { defineOpenAIAgent } from "../provider/factory.js";
import { createPromptTemplate } from "../provider/prompt-template.js";

/**
 * Input schema
 */
export const CodingInputSchema = z.object({
  task: z.string().min(1, "Task description required"),
});

export type CodingInput = z.infer<typeof CodingInputSchema>;

/**
 * Output schema
 */
export const CodingOutputSchema = z.object({
  code: z.string(),
  explanation: z.string(),
  language: z.string().optional(),
});

export type CodingOutput = z.infer<typeof CodingOutputSchema>;

/**
 * Prompt template
 */
export const CodingPromptTemplate = createPromptTemplate(`
You are an expert software engineer. Generate clean, well-documented code.

Task: {{task}}

Provide:
1. The code implementation
2. A clear explanation of how it works
3. The programming language used

Return as JSON:
{
  "code": "...",
  "explanation": "...",
  "language": "..."
}
`);

/**
 * Pre-configured Coding Agent
 */
export const CodingAgent = defineOpenAIAgent({
  name: "CodingAgent",
  prompt: CodingPromptTemplate,
  inputSchema: CodingInputSchema,
  outputSchema: CodingOutputSchema,
  options: {
    model: "gpt-4",
    temperature: 0.7,
  },
});
```

### 6.2 Export Presets

**File**: `src/presets/index.ts`

```typescript
/**
 * Preset Agents - Ready-to-use configurations
 */

export { CodingAgent, CodingInputSchema, CodingOutputSchema, CodingPromptTemplate } from "./coding-agent.js";
export type { CodingInput, CodingOutput } from "./coding-agent.js";

// Add more presets:
// export { ReviewAgent, ... } from "./review-agent.js";
// export { PlannerAgent, ... } from "./planner-agent.js";
```

---

## 7. Testing Strategy

### 7.1 Create Test Container Helper

**File**: `tests/helpers/test-container.ts`

```typescript
/**
 * Test Container Helper
 *
 * Creates configured DI container for tests with mock runner.
 */

import { Container } from "@needle-di/core";
import type { GenericMessage, IAgentRunner, RunnerCallbacks } from "@openharness/sdk";
import { IAgentRunnerToken, IConfigToken, IUnifiedEventBusToken, UnifiedEventBus } from "@openharness/sdk";

/**
 * Mock runner for tests
 */
export class MockAgentRunner implements IAgentRunner {
  lastPrompt?: string;
  lastOptions?: unknown;
  mockResult: GenericMessage = {
    type: "result",
    subtype: "success",
    structured_output: { result: "mock result" },
  } as unknown as GenericMessage;

  async run(args: {
    prompt: string;
    options: unknown;
    callbacks?: RunnerCallbacks;
  }): Promise<GenericMessage | undefined> {
    this.lastPrompt = args.prompt;
    this.lastOptions = args.options;

    if (args.callbacks?.onMessage) {
      args.callbacks.onMessage(this.mockResult);
    }

    return this.mockResult;
  }
}

/**
 * Create test container
 */
export function createTestContainer(): { container: Container; mockRunner: MockAgentRunner } {
  const container = new Container();
  const mockRunner = new MockAgentRunner();

  container.bind({
    provide: IConfigToken,
    useValue: { isReplayMode: false, recordingsDir: "./test-recordings" },
  });

  container.bind({
    provide: IAgentRunnerToken,
    useValue: mockRunner,
  });

  container.bind({
    provide: IUnifiedEventBusToken,
    useFactory: () => new UnifiedEventBus(),
  });

  return { container, mockRunner };
}
```

### 7.2 Unit Tests Example

**File**: `tests/unit/factory.test.ts`

```typescript
import { beforeEach, describe, expect, test } from "bun:test";
import { z } from "zod";
import { defineOpenAIAgent, resetFactoryContainer, setFactoryContainer } from "../../src/provider/factory.js";
import { createPromptTemplate } from "../../src/provider/prompt-template.js";
import { createTestContainer } from "../helpers/test-container.js";

describe("defineOpenAIAgent", () => {
  beforeEach(() => {
    resetFactoryContainer();
  });

  test("creates agent with name, execute, and stream", () => {
    const { container } = createTestContainer();
    setFactoryContainer(container);

    const agent = defineOpenAIAgent({
      name: "TestAgent",
      prompt: createPromptTemplate("Task: {{task}}"),
      inputSchema: z.object({ task: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    expect(agent.name).toBe("TestAgent");
    expect(typeof agent.execute).toBe("function");
    expect(typeof agent.stream).toBe("function");
  });

  test("validates input and throws on invalid", async () => {
    const { container } = createTestContainer();
    setFactoryContainer(container);

    const agent = defineOpenAIAgent({
      name: "ValidatorAgent",
      prompt: "test",
      inputSchema: z.object({ task: z.string().min(1) }),
      outputSchema: z.object({ result: z.string() }),
    });

    await expect(agent.execute({ task: "" })).rejects.toThrow("Input validation failed");
  });
});
```

### 7.3 Integration Tests Example

**File**: `tests/integration/presets.test.ts`

```typescript
import { beforeEach, describe, expect, test } from "bun:test";
import { CodingAgent } from "../../src/presets/index.js";
import { resetFactoryContainer, setFactoryContainer } from "../../src/provider/factory.js";
import { createTestContainer } from "../helpers/test-container.js";

describe("CodingAgent", () => {
  beforeEach(() => {
    resetFactoryContainer();
  });

  test("executes with typed input and output", async () => {
    const { container, mockRunner } = createTestContainer();
    setFactoryContainer(container);

    mockRunner.mockResult = {
      type: "result",
      subtype: "success",
      structured_output: {
        code: "function add(a, b) { return a + b; }",
        explanation: "Simple addition function",
        language: "javascript",
      },
    } as unknown as any;

    const result = await CodingAgent.execute({
      task: "Write an addition function",
    });

    expect(result.code).toContain("function");
    expect(result.explanation).toBeDefined();
  });
});
```

---

## 8. Documentation

### 8.1 Create README.md

See [Anthropic README](../../packages/anthropic/README.md) as template.

### 8.2 Create API Reference

See [Anthropic API Reference](./anthropic-api.md) as template.

---

## 9. Publishing

### 9.1 Pre-publish Checklist

- [ ] All tests pass
- [ ] Type checking clean
- [ ] Linting clean
- [ ] README complete
- [ ] API reference complete
- [ ] Version bumped in package.json
- [ ] CHANGELOG.md updated

### 9.2 Build and Publish

```bash
# Build
bun run build

# Verify dist/ contents
ls -la dist/

# Publish (if using npm registry)
npm publish --access public

# Or link locally for testing
npm link
```

### 9.3 Verify Installation

```bash
# In a test project
npm install @openharness/openai

# Test import
cat > test.ts <<EOF
import { defineOpenAIAgent, createPromptTemplate } from "@openharness/openai";
import { z } from "zod";

const agent = defineOpenAIAgent({
  name: "Test",
  prompt: createPromptTemplate("Say: {{message}}"),
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ result: z.string() }),
});

const result = await agent.execute({ message: "Hello" });
console.log(result);
EOF

bun test.ts
```

---

## Complete Example

**Full working example** combining all components:

```typescript
// src/index.ts - Full provider implementation
import { defineOpenAIAgent } from "./provider/factory.js";
import { createPromptTemplate } from "./provider/prompt-template.js";
import { z } from "zod";

// Define agent
export const TranslatorAgent = defineOpenAIAgent({
  name: "TranslatorAgent",
  prompt: createPromptTemplate(`
    Translate the following text to {{targetLanguage}}:

    {{text}}

    Return JSON: { "translated": "...", "confidence": 0.0-1.0 }
  `),
  inputSchema: z.object({
    text: z.string().min(1),
    targetLanguage: z.string(),
  }),
  outputSchema: z.object({
    translated: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  options: {
    model: "gpt-4",
    temperature: 0.3,
  },
});

// Usage
const result = await TranslatorAgent.execute({
  text: "Hello, world!",
  targetLanguage: "Spanish",
});

console.log(result.translated); // "¡Hola, mundo!"
console.log(result.confidence);  // 0.95
```

---

## Summary

**Key Patterns Established**:

1. **IAgentRunner**: Adapts provider SDK → generic interface
2. **Event Mapper**: Provider messages → BaseEvent (in provider layer)
3. **Factory API**: Type-safe agent creation with Zod validation
4. **Internal Agent**: Orchestrates execution + event emission
5. **Presets**: Pre-built agents for common tasks
6. **Test Infrastructure**: Mock container + test helpers

**Next Steps**:
- Implement your provider following this guide
- Add provider-specific features (tools, streaming modes, etc.)
- Create comprehensive tests
- Document API surface
- Publish package

**Questions?**
See [Anthropic implementation](../../packages/anthropic/src) as reference.
