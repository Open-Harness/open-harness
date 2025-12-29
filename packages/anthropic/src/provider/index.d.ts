/**
 * Provider Layer - Anthropic Agent Factory API
 *
 * This module exports the public API for creating typed Anthropic agents.
 *
 * @example
 * ```typescript
 * import { defineAnthropicAgent, createPromptTemplate } from "@openharness/anthropic";
 * import { z } from "zod";
 *
 * const MyAgent = defineAnthropicAgent({
 *   name: "MyAgent",
 *   prompt: createPromptTemplate("Task: {{task}}"),
 *   inputSchema: z.object({ task: z.string() }),
 *   outputSchema: z.object({ result: z.string() }),
 * });
 *
 * const output = await MyAgent.execute({ task: "Hello" });
 * ```
 *
 * @module provider
 */
export { AnthropicEventMapper } from "./anthropic-event-mapper.js";
export { AgentBuilder } from "./builder.js";
export { defineAnthropicAgent, registerAnthropicProvider } from "./factory.js";
export { executeAgent, streamAgent } from "./helpers.js";
export { createPromptTemplate, createStaticPrompt } from "./prompt-template.js";
export type { AgentHandle, AnthropicAgent, AnthropicAgentDefinition, ExecutableAgent, CodingInput, CodingOutput, ExecuteOptions, ExtractVars, PlannerInput, PlannerOutput, PlannerTask, PromptTemplate, ReviewInput, ReviewIssue, ReviewOutput, StreamOptions, } from "./types.js";
