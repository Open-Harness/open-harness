import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { NodeTypeDefinition } from "../registry/registry.js";
import type { UnifiedAgentMessage } from "./adapters/agent-sdk-adapter.js";
import { OpenCodeSDKAdapter } from "./adapters/opencode-sdk-adapter.js";
import type { AgentInput, AgentMessageInput, AgentNodeOptions, AgentOutput } from "./agent-base.js";
import { createAgentNode } from "./agent-base.js";

/**
 * Extended options for OpenCode agent that support file-based schema references.
 * - outputSchemaFile: Path to a JSON Schema file (resolved relative to cwd)
 * - outputFormat: Inline schema (SDK native format)
 */
export interface OpenCodeAgentExtendedOptions {
	/** Simple model identifier (e.g., "claude-3-5-sonnet") */
	model?: string;
	/** Provider-specific model selection */
	providerID?: string;
	/** Provider-specific model identifier */
	modelID?: string;
	/** Session ID for resuming conversations */
	resume?: string;
	/** Path to JSON Schema file for structured output. Resolved relative to cwd. */
	outputSchemaFile?: string;
	/** Inline JSON Schema for structured output (SDK native format). */
	outputFormat?: { type: "json_schema"; schema: Record<string, unknown> };
}

/**
 * OpenCode message input (matches Claude message input format).
 */
export type OpenCodeMessageInput = AgentMessageInput;

/**
 * OpenCode agent input (matches Claude agent input format).
 */
export interface OpenCodeAgentInput {
	prompt?: string;
	messages?: OpenCodeMessageInput[];
	/** SDK options with extended support for outputSchemaFile */
	options?: OpenCodeAgentExtendedOptions;
}

/**
 * OpenCode agent output (matches Claude agent output format).
 */
export interface OpenCodeAgentOutput extends AgentOutput {
	// Matches ClaudeAgentOutput exactly
}

/**
 * Options for creating an OpenCode agent node.
 */
export interface OpenCodeNodeOptions extends AgentNodeOptions {
	/** Base URL for OpenCode server (defaults to http://127.0.0.1:4096) */
	baseUrl?: string;
}

const OpenCodeMessageSchema = z
	.union([
		z.string(),
		z
			.object({
				message: z.record(z.string(), z.unknown()).optional(),
				content: z.string().optional(),
				parentToolUseId: z.string().nullable().optional(),
				isSynthetic: z.boolean().optional(),
				toolUseResult: z.unknown().optional(),
			})
			.refine((value) => value.message || value.content, {
				message: "OpenCode message input must include message or content",
			}),
	])
	.describe("OpenCode user message input");

const OpenCodeAgentInputSchema = z
	.object({
		prompt: z.string().optional(),
		messages: z.array(OpenCodeMessageSchema).optional(),
		options: z.unknown().optional(),
	})
	.refine((value) => (value.prompt && !value.messages) || (!value.prompt && value.messages), {
		message: "Provide exactly one of prompt or messages",
	});

const OpenCodeAgentOutputSchema = z.object({
	text: z.string().optional(), // Optional when paused=true
	structuredOutput: z.unknown().optional(),
	usage: z.unknown().optional(),
	modelUsage: z.unknown().optional(),
	totalCostUsd: z.number().optional(),
	durationMs: z.number().optional(),
	sessionId: z.string().optional(),
	numTurns: z.number().optional(),
	paused: z.boolean().optional(),
});

/**
 * Resolve outputSchemaFile to outputFormat if provided.
 * Priority: outputFormat > outputSchemaFile
 * @internal Exported for testing only
 */
export function resolveOpenCodeOutputSchema(
	options?: OpenCodeAgentExtendedOptions,
): { type: "json_schema"; schema: Record<string, unknown> } | undefined {
	if (!options) return undefined;

	// If outputFormat is already provided (inline schema), use it directly
	if (options.outputFormat) {
		return options.outputFormat;
	}

	// If outputSchemaFile is provided, load and convert
	if (options.outputSchemaFile) {
		const resolvedPath = resolve(process.cwd(), options.outputSchemaFile);

		if (!existsSync(resolvedPath)) {
			throw new Error(`outputSchemaFile not found: ${resolvedPath}`);
		}

		try {
			const schemaContent = readFileSync(resolvedPath, "utf-8");
			const schema = JSON.parse(schemaContent) as Record<string, unknown>;

			return {
				type: "json_schema",
				schema,
			};
		} catch (error) {
			throw new Error(
				`Failed to load outputSchemaFile: ${resolvedPath}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	// No schema specified
	return undefined;
}

/**
 * Create an OpenCode agent node definition.
 */
export function createOpenCodeNode(
	options: OpenCodeNodeOptions = {},
): NodeTypeDefinition<OpenCodeAgentInput, OpenCodeAgentOutput> {
	const adapter = new OpenCodeSDKAdapter(options.baseUrl);

	const baseNode = createAgentNode(adapter, "opencode.agent", {
		replay: options.replay
			? (input: AgentInput) => {
					const openCodeInput = input as OpenCodeAgentInput;
					const result = options.replay!(openCodeInput);
					return result;
				}
			: undefined,
		record: options.record
			? (call: { nodeId: string; input: AgentInput; output: AgentOutput; events: UnifiedAgentMessage[] }) => {
					const openCodeInput = call.input as OpenCodeAgentInput;
					const openCodeOutput = call.output as OpenCodeAgentOutput;
					options.record!({
						nodeId: call.nodeId,
						input: openCodeInput,
						output: openCodeOutput,
						events: call.events,
					});
				}
			: undefined,
	});

	return {
		...baseNode,
		inputSchema: OpenCodeAgentInputSchema,
		outputSchema: OpenCodeAgentOutputSchema,
	};
}

/**
 * Pre-created OpenCode node instance.
 */
export const opencodeNode = createOpenCodeNode();
