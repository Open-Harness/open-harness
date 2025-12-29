/**
 * @openharness/anthropic
 *
 * Anthropic/Claude provider implementation for the Open Harness SDK.
 *
 * ## Factory API
 *
 * Use `defineAnthropicAgent()` to create custom agents:
 *
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
 * const result = await MyAgent.execute({ task: "Hello" });
 * ```
 *
 * ## Preset Agents
 *
 * Pre-built agents available from `@openharness/anthropic/presets`:
 * - `CodingAgent` - Code generation and implementation
 * - `ReviewAgent` - Code review and validation
 * - `PlannerAgent` - Planning and task breakdown
 *
 * @module @openharness/anthropic
 */

// ============================================================================
// Factory API
// ============================================================================

// Factory API Types
export type {
	AgentHandle,
	AnthropicAgent,
	AnthropicAgentDefinition,
	// Preset types
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
} from "./provider/index.js";
export {
	// Event mapper (provider-specific)
	AnthropicEventMapper,
	// Prompt template factory
	createPromptTemplate,
	createStaticPrompt,
	// Factory function
	defineAnthropicAgent,
	// Container utilities (for testing)
	resetFactoryContainer,
	setFactoryContainer,
} from "./provider/index.js";

// ============================================================================
// Runner
// ============================================================================

export { AnthropicRunner } from "./infra/runner/anthropic-runner.js";
export {
	type AgentEvent,
	type CodingResult,
	CodingResultSchema,
	CodingResultSdkSchema,
	type CompactData,
	EventType,
	EventTypeConst,
	type JSONSchemaFormat,
	type SessionResult,
	type StatusData,
	zodToSdkSchema,
} from "./infra/runner/models.js";

// ============================================================================
// Recording
// ============================================================================

export {
	type IContainer,
	Record,
	setDecoratorContainer,
	setRecordingFactoryToken,
} from "./infra/recording/decorators.js";
export { Recorder, RecordingFactory } from "./infra/recording/recording-factory.js";
export { ReplayRunner } from "./infra/recording/replay-runner.js";
export type {
	IRecorder,
	IRecordingFactory,
	IVault,
	IVaultSession,
	RecordedSession,
} from "./infra/recording/types.js";
export { Vault } from "./infra/recording/vault.js";

// ============================================================================
// Monologue
// ============================================================================

export { AnthropicMonologueLLM } from "./infra/monologue/anthropic-llm.js";
