import type { ZodSchema } from "zod";
import type { ExecutionContext } from "./context.js";
import type { StreamEvent } from "./events.js";

/**
 * Provider trait: The essence of what an AI provider IS.
 * 
 * This is the core abstraction that all providers must implement.
 * Providers are pure - they don't know about error handling, recording,
 * or runtime integration. Those concerns are handled by the adapter.
 */
export interface ProviderTrait<TInput, TOutput> {
	/** Unique provider type identifier (e.g., "claude.agent", "opencode.agent") */
	readonly type: string;
	
	/** Human-readable display name */
	readonly displayName: string;
	
	/** What this provider can do */
	readonly capabilities: ProviderCapabilities;
	
	/** Schema for input validation */
	readonly inputSchema: ZodSchema<TInput>;
	
	/** Schema for output validation */
	readonly outputSchema: ZodSchema<TOutput>;
	
	/**
	 * Execute the provider.
	 * 
	 * This is a pure async generator that:
	 * - Yields StreamEvents as they occur
	 * - Returns the final output
	 * - Throws on error (adapter will wrap in Result)
	 * 
	 * @param input - Validated provider input
	 * @param ctx - Minimal execution context (signal + emit)
	 * @returns Final output after all events
	 */
	execute(
		input: TInput,
		ctx: ExecutionContext,
	): AsyncGenerator<StreamEvent, TOutput>;
}

/**
 * Capabilities that a provider may have.
 * These are optional features that affect how the runtime uses the provider.
 */
export interface ProviderCapabilities {
	/**
	 * Can the provider stream events?
	 * If true, execute() will yield StreamEvents as they occur.
	 */
	streaming: boolean;
	
	/**
	 * Can the provider pause and resume?
	 * 
	 * Only Claude SDK supports this via sessionId.
	 * Most providers should set this to false.
	 */
	pauseResume: boolean;
	
	/**
	 * Can the provider return structured JSON output?
	 * If true, output may have a structuredOutput field.
	 */
	structuredOutput: boolean;
}
