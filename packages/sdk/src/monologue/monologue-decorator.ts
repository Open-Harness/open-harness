/**
 * @Monologue Decorator - Automatic narrative generation for agent methods
 *
 * Wraps agent methods to automatically generate narratives from events.
 * Uses closure-scoped state for concurrent isolation.
 *
 * @module monologue/monologue-decorator
 */

import { type IContainer, IMonologueLLMToken, IUnifiedEventBusToken } from "../infra/tokens.js";
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
			const eventBus = container.get(IUnifiedEventBusToken);
			const llm = container.get(IMonologueLLMToken);

			// Generate session ID
			const sessionId = options?.sessionIdProvider?.(args) ?? generateSessionId();
			const taskId = options?.taskIdProvider?.(args);

			// Create callback that publishes to UnifiedEventBus + user callback
			const callback: MonologueCallback = {
				onNarrative: (entry) => {
					// Publish to UnifiedEventBus as narrative event
					const event = {
						type: "narrative" as const,
						text: entry.text,
						importance: "normal" as const,
						agentName: entry.agentName,
					};
					eventBus.emit(event, {
						agent: { name: entry.agentName },
						task: entry.taskId ? { id: entry.taskId } : undefined,
					});

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

			// Subscribe to UnifiedEventBus for this agent's events
			const unsubscribe = eventBus.subscribe(async (enrichedEvent) => {
				// Only process agent events for this scope
				if (!enrichedEvent.event.type.startsWith("agent:")) return;
				if (enrichedEvent.context.agent?.name !== scope) return;

				// Map UnifiedEvent to monologue AgentEvent
				const monologueEvent = mapUnifiedEventToMonologue(enrichedEvent, scope, sessionId);
				if (monologueEvent) {
					await service.addEvent(monologueEvent);
				}
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
 * Map UnifiedEvent (BaseEvent) to monologue AgentEvent format.
 */
function mapUnifiedEventToMonologue(
	enrichedEvent: import("../infra/unified-events/types.js").EnrichedEvent,
	agentName: string,
	sessionId: string,
): import("./types.js").AgentEvent | null {
	const event = enrichedEvent.event;

	// Map unified event types to monologue event types
	let eventType: import("./types.js").AgentEventType;
	let payload: import("./types.js").AgentEventPayload;

	switch (event.type) {
		case "agent:text":
			eventType = "text";
			payload = {
				type: "text",
				content: (event as import("../infra/unified-events/types.js").AgentTextEvent).content,
			};
			break;

		case "agent:thinking":
			eventType = "thinking";
			payload = {
				type: "thinking",
				content: (event as import("../infra/unified-events/types.js").AgentThinkingEvent).content,
			};
			break;

		case "agent:tool:start": {
			eventType = "tool_call";
			const toolStartEvent = event as import("../infra/unified-events/types.js").AgentToolStartEvent;
			payload = {
				type: "tool_call",
				tool_name: toolStartEvent.toolName,
				tool_input: toolStartEvent.input,
			};
			break;
		}

		case "agent:tool:complete": {
			eventType = "tool_result";
			const toolCompleteEvent = event as import("../infra/unified-events/types.js").AgentToolCompleteEvent;
			payload = {
				type: "tool_result",
				tool_name: toolCompleteEvent.toolName || "unknown",
				result: toolCompleteEvent.result,
				error: toolCompleteEvent.isError ? "Tool execution error" : undefined,
			};
			break;
		}

		case "agent:complete":
			eventType = "completion";
			payload = {
				type: "completion",
				summary: undefined,
			};
			break;

		default:
			// Ignore other event types (harness, phase, task, etc.)
			return null;
	}

	return {
		event_type: eventType,
		agent_name: agentName,
		session_id: sessionId,
		timestamp: Date.now(),
		payload,
	};
}
