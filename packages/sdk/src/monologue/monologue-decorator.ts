/**
 * @Monologue Decorator - Automatic narrative generation for agent methods
 *
 * Wraps agent methods to automatically generate narratives from events.
 * Uses closure-scoped state for concurrent isolation.
 *
 * @module monologue/monologue-decorator
 */

import { type AgentEvent, type IContainer, IEventBusToken, IMonologueLLMToken } from "../infra/tokens.js";
import { createMonologueService, type MonologueCallback } from "./monologue-service.js";
import type { MonologueConfig, NarrativeAgentName } from "./types.js";

// Container is set by setDecoratorContainer() in container.ts
let _container: IContainer | null = null;

/**
 * Set the container for the Monologue decorator.
 * Called from container.ts after container is created.
 */
export function setMonologueContainer(container: IContainer): void {
	_container = container;
}

/**
 * Get the container, throwing if not set.
 */
function getContainer(): IContainer {
	if (!_container) {
		throw new Error("Monologue decorator container not initialized. Call setMonologueContainer() first.");
	}
	return _container;
}

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
export function Monologue(scope: NarrativeAgentName, options?: MonologueOptions): MethodDecorator {
	return (_target: object, _propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
		const original = descriptor.value;

		descriptor.value = async function (...args: unknown[]): Promise<unknown> {
			// Get services from container
			const container = getContainer();
			const eventBus = container.get(IEventBusToken);
			const llm = container.get(IMonologueLLMToken);

			// Generate session ID
			const sessionId = options?.sessionIdProvider?.(args) ?? generateSessionId();
			const taskId = options?.taskIdProvider?.(args);

			// Create callback that publishes to EventBus + user callback
			const callback: MonologueCallback = {
				onNarrative: (entry) => {
					// Publish to EventBus as MONOLOGUE event
					const event: AgentEvent = {
						timestamp: new Date(),
						event_type: "monologue",
						agent_name: entry.agentName,
						content: entry.text,
						session_id: sessionId,
						metadata: {
							taskId: entry.taskId,
							...entry.metadata,
						},
					};
					eventBus.publish(event);

					// Also call user callback if provided
					options?.callback?.onNarrative?.(entry);
				},
				onError: (error, events) => {
					options?.callback?.onError?.(error, events);
				},
			};

			// Create closure-scoped service instance (T022)
			const service = createMonologueService({
				llm,
				config: options?.config,
				scope,
				sessionId,
				taskId,
				callback,
			});

			// Subscribe to EventBus for this agent's events
			const unsubscribe = eventBus.subscribe(async (event: AgentEvent) => {
				// Map SDK AgentEvent to monologue AgentEvent
				const monologueEvent = mapToMonologueEvent(event, scope, sessionId);
				await service.addEvent(monologueEvent);
			});

			try {
				// Execute original method
				const result = await original.apply(this, args);
				return result;
			} finally {
				// T023: Final flush on method completion
				await service.finalFlush();

				// Cleanup subscription
				unsubscribe();
			}
		};

		return descriptor;
	};
}

/**
 * Generate a unique session ID.
 */
function generateSessionId(): string {
	return `monologue-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Map SDK AgentEvent to monologue AgentEvent format.
 */
function mapToMonologueEvent(event: AgentEvent, agentName: string, sessionId: string): import("./types.js").AgentEvent {
	// The SDK AgentEvent has different field names, map them
	return {
		event_type: mapEventType(event.event_type),
		agent_name: agentName,
		session_id: sessionId,
		timestamp: Date.now(),
		payload: mapPayload(event),
	};
}

/**
 * Map SDK event type to monologue event type.
 */
function mapEventType(sdkType: string): import("./types.js").AgentEventType {
	const typeMap: Record<string, import("./types.js").AgentEventType> = {
		tool_call: "tool_call",
		tool_result: "tool_result",
		text: "text",
		thinking: "thinking",
		result: "completion",
		// Note: SDK uses "result" for completion, not "stop"
	};
	return typeMap[sdkType] ?? "text";
}

/**
 * Map SDK event to monologue payload.
 */
function mapPayload(event: AgentEvent): import("./types.js").AgentEventPayload {
	switch (event.event_type) {
		case "tool_call":
			return {
				type: "tool_call",
				tool_name: event.tool_name ?? "unknown",
				tool_input: event.tool_input,
			};
		case "tool_result":
			return {
				type: "tool_result",
				tool_name: event.tool_name ?? "unknown",
				result: event.tool_result, // SDK uses tool_result, not result
				error: event.is_error ? "Tool execution error" : undefined, // Convert boolean to string
			};
		case "thinking":
			return {
				type: "thinking",
				content: event.content ?? "",
			};
		case "result":
			return {
				type: "completion",
				summary: event.content ?? undefined, // Convert null to undefined
			};
		default:
			return {
				type: "text",
				content: event.content ?? "",
			};
	}
}
