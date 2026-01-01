/**
 * @Monologue Decorator - Automatic narrative generation for agent methods
 *
 * Wraps agent methods to automatically generate narratives from events.
 * Uses closure-scoped state for concurrent isolation.
 *
 * @module monologue/monologue-decorator
 */
import { type IContainer } from "../infra/tokens.js";
import { type MonologueCallback } from "./monologue-service.js";
import type { MonologueConfig, NarrativeAgentName } from "./types.js";
/**
 * Set the container for the Monologue decorator.
 * Called from container.ts after container is created.
 */
export declare function setMonologueContainer(container: IContainer): void;
/**
 * Options for the @Monologue decorator.
 */
export interface MonologueOptions {
    /**
     * Override default configuration for this scope.
     */
    config?: Partial<MonologueConfig>;
    /**
     * Callback for receiving narratives (alternative to EventBus).
     */
    callback?: MonologueCallback;
    /**
     * Session ID provider function.
     * If not provided, uses a generated UUID.
     */
    sessionIdProvider?: (args: unknown[]) => string;
    /**
     * Task ID provider function.
     * If not provided, taskId will be null.
     */
    taskIdProvider?: (args: unknown[]) => string | undefined;
}
/**
 * @Monologue decorator - Enables automatic narrative generation for agent methods.
 *
 * The decorator:
 * 1. Creates closure-scoped buffer state (isolated per call)
 * 2. Subscribes to EventBus for events from this agent scope
 * 3. Buffers events and generates narratives via LLM
 * 4. Final flush on method completion
 * 5. Cleans up subscription in finally block
 *
 * @param scope - Agent name for EventBus filtering and narrative attribution
 * @param options - Optional configuration overrides
 *
 * @example
 * ```typescript
 * class ParserAgent {
 *   @Monologue("Parser")
 *   async parse(input: string, sessionId: string): Promise<ParseResult> {
 *     // Agent work - events are automatically captured
 *     return this.doParsing(input);
 *   }
 * }
 * ```
 */
export declare function Monologue(scope: NarrativeAgentName, options?: MonologueOptions): MethodDecorator;
