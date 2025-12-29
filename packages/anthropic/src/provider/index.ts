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

// Event mapper (provider-specific)
export { AnthropicEventMapper } from "./anthropic-event-mapper.js";
// Factory function
export {
	defineAnthropicAgent,
	registerAnthropicProvider,
	resetFactoryContainer,
	setFactoryContainer,
} from "./factory.js";
// Prompt template factory
export { createPromptTemplate, createStaticPrompt } from "./prompt-template.js";

// Type exports
export type {
	AgentHandle,
	// Core types
	AnthropicAgent,
	AnthropicAgentDefinition,
	// Preset types (for presets layer)
	CodingInput,
	CodingOutput,
	ExecuteOptions,
	ExtractVars,
	PlannerInput,
	PlannerOutput,
	PlannerTask,
	PromptTemplate,
	ReviewInput,
	ReviewIssue,
	ReviewOutput,
	StreamOptions,
} from "./types.js";
