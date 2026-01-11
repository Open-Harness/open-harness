import { err, ok, type Result } from "neverthrow";
import type { NodeRunContext, NodeTypeDefinition } from "../nodes/registry.js";
import type { ExecutionContext } from "./context.js";
import { ProviderError, type ProviderErrorCode, toProviderError, wrapProviderThrow } from "./errors.js";
import type { StreamEvent } from "./events.js";
import type { ProviderTrait } from "./trait.js";

/**
 * Convert a ProviderTrait into a NodeTypeDefinition.
 *
 * This adapter:
 * - Validates input/output against schemas
 * - Wraps execution in Result types
 * - Maps StreamEvents to RuntimeEvents
 * - Handles abort signals
 * - Converts errors to ProviderErrors
 *
 * @param trait - Provider trait to adapt
 * @returns NodeTypeDefinition with Result-based API
 *
 * @example
 * const claudeNode = toNodeDefinition(claudeTrait);
 * registry.register(claudeNode);
 */
export function toNodeDefinition<I, O>(trait: ProviderTrait<I, O>): NodeTypeDefinition<I, Result<O, ProviderError>> {
	return {
		type: trait.type,
		inputSchema: trait.inputSchema,
		outputSchema: trait.outputSchema,
		capabilities: {
			streaming: trait.capabilities.streaming,
			// Note: multiTurn/pause-resume is handled at workflow level
			// via session IDs in provider input/output, not as a capability
		},
		run: async (ctx: NodeRunContext, input: I) => {
			// Step 1: Validate input
			const validationResult = wrapProviderThrow("VALIDATION_ERROR", () => trait.inputSchema.parse(input));

			if (validationResult.isErr()) {
				return err(validationResult.error);
			}

			const validatedInput = validationResult.value;

			// Step 2: Create execution context
			const execCtx: ExecutionContext = {
				signal: ctx.signal,
				emit: (event: StreamEvent) => {
					// Map StreamEvent to RuntimeEventPayload
					emitRuntimeEvent(ctx, event);
				},
			};

			// Step 3: Execute provider
			try {
				const generator = trait.execute(validatedInput, execCtx);
				let output: O | undefined;

				// Consume all events from generator
				for await (const event of generator) {
					// Events are emitted via ctx.emit in the generator
					// We just need to consume them
					if (ctx.signal.aborted) {
						throw new Error("Aborted");
					}
				}

				// Get the return value (final output)
				const result = await generator.next();
				if (result.done) {
					output = result.value;
				}

				if (!output) {
					return err(new ProviderError("QUERY_FAILED", "Provider returned no output"));
				}

				// Step 4: Validate output
				const outputValidation = wrapProviderThrow("VALIDATION_ERROR", () => trait.outputSchema.parse(output));

				if (outputValidation.isErr()) {
					return err(outputValidation.error);
				}

				return ok(outputValidation.value);
			} catch (error) {
				// Check if aborted
				if (error instanceof Error && error.name === "AbortError") {
					return err(new ProviderError("ABORT", "Operation was aborted"));
				}

				if (ctx.signal.aborted) {
					return err(new ProviderError("ABORT", "Operation was aborted"));
				}

				// Convert to ProviderError
				const code: ProviderErrorCode = determineErrorCode(error);
				return err(toProviderError(error, code));
			}
		},
	};
}

/**
 * Map a StreamEvent to RuntimeEventPayload and emit.
 *
 * @internal
 */
function emitRuntimeEvent(ctx: NodeRunContext, event: StreamEvent): void {
	switch (event.type) {
		case "text":
			if (event.delta) {
				ctx.emit({
					type: "agent:text:delta",
					nodeId: ctx.nodeId,
					runId: ctx.runId,
					content: event.content,
				});
			} else {
				ctx.emit({
					type: "agent:text",
					nodeId: ctx.nodeId,
					runId: ctx.runId,
					content: event.content,
				});
			}
			break;

		case "thinking":
			if (event.delta) {
				ctx.emit({
					type: "agent:thinking:delta",
					nodeId: ctx.nodeId,
					runId: ctx.runId,
					content: event.content,
				});
			} else {
				ctx.emit({
					type: "agent:thinking",
					nodeId: ctx.nodeId,
					runId: ctx.runId,
					content: event.content,
				});
			}
			break;

		case "tool":
			ctx.emit({
				type: "agent:tool",
				nodeId: ctx.nodeId,
				runId: ctx.runId,
				toolName: event.name,
				toolInput: event.phase === "start" ? event.data : undefined,
				toolOutput: event.phase === "complete" ? event.data : undefined,
				error: event.error,
			});
			break;

		case "error":
			ctx.emit({
				type: "agent:error",
				nodeId: ctx.nodeId,
				runId: ctx.runId,
				errorType: event.code,
				message: event.message,
			});
			break;
	}
}

/**
 * Determine error code from caught error.
 *
 * @internal
 */
function determineErrorCode(error: unknown): ProviderErrorCode {
	if (error instanceof Error) {
		if (error.name === "AbortError") return "ABORT";
		if (error.name === "TimeoutError") return "TIMEOUT";
		if (error.message.includes("permission")) return "PERMISSION_DENIED";
		if (error.message.includes("validation")) return "VALIDATION_ERROR";
	}

	return "QUERY_FAILED";
}
