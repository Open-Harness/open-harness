/**
 * Unified Event System - Contract Definitions
 *
 * These interfaces define the public API for the unified event system.
 * Implementation should adhere to these contracts exactly.
 *
 * @module unified-event-system/contracts
 */

// ============================================================================
// CONTEXT TYPES (FR-003)
// ============================================================================

/**
 * Phase scope metadata.
 */
export interface PhaseContext {
	/** Phase name (e.g., "Planning", "Implementation") */
	name: string;
	/** Optional phase number (1-indexed) */
	number?: number;
}

/**
 * Task scope metadata.
 */
export interface TaskContext {
	/** Task identifier (e.g., "T003") */
	id: string;
	/** Optional task description */
	description?: string;
}

/**
 * Agent scope metadata.
 */
export interface AgentContext {
	/** Agent name (e.g., "CodingAgent", "ReviewAgent") */
	name: string;
	/** Optional agent type (e.g., "anthropic", "openai") */
	type?: string;
}

/**
 * Full event context with all scope levels.
 * Propagated via AsyncLocalStorage.
 */
export interface EventContext {
	/** Session identifier (UUID), set at bus creation */
	sessionId: string;
	/** Optional phase scope */
	phase?: PhaseContext;
	/** Optional task scope */
	task?: TaskContext;
	/** Optional agent scope */
	agent?: AgentContext;
}

// ============================================================================
// BASE EVENT TYPES (FR-004)
// ============================================================================

/**
 * Base interface for all events.
 */
export interface BaseEventPayload {
	/** Discriminator for event type */
	type: string;
}

// --- Workflow Events ---

export interface HarnessStartEvent extends BaseEventPayload {
	type: "harness:start";
	sessionId: string;
	mode: "live" | "replay";
	taskCount: number;
}

export interface HarnessCompleteEvent extends BaseEventPayload {
	type: "harness:complete";
	success: boolean;
	tasksCompleted: number;
	tasksFailed: number;
	duration: number;
}

export interface PhaseStartEvent extends BaseEventPayload {
	type: "phase:start";
	name: string;
	phaseNumber?: number;
}

export interface PhaseCompleteEvent extends BaseEventPayload {
	type: "phase:complete";
	name: string;
	phaseNumber?: number;
}

export interface TaskStartEvent extends BaseEventPayload {
	type: "task:start";
	taskId: string;
}

export interface TaskCompleteEvent extends BaseEventPayload {
	type: "task:complete";
	taskId: string;
	result?: unknown;
}

export interface TaskFailedEvent extends BaseEventPayload {
	type: "task:failed";
	taskId: string;
	error: string;
	stack?: string;
}

// --- Agent Events ---

export interface AgentStartEvent extends BaseEventPayload {
	type: "agent:start";
	agentName: string;
}

export interface AgentThinkingEvent extends BaseEventPayload {
	type: "agent:thinking";
	content: string;
}

export interface AgentTextEvent extends BaseEventPayload {
	type: "agent:text";
	content: string;
}

export interface AgentToolStartEvent extends BaseEventPayload {
	type: "agent:tool:start";
	toolName: string;
	input: unknown;
}

export interface AgentToolCompleteEvent extends BaseEventPayload {
	type: "agent:tool:complete";
	toolName: string;
	result: unknown;
	isError?: boolean;
}

export interface AgentCompleteEvent extends BaseEventPayload {
	type: "agent:complete";
	agentName: string;
	success: boolean;
}

// --- Narrative Events ---

export type NarrativeImportance = "critical" | "important" | "detailed";

export interface NarrativeEvent extends BaseEventPayload {
	type: "narrative";
	text: string;
	importance: NarrativeImportance;
}

// --- Session Events (Future) ---

export interface SessionPromptEvent extends BaseEventPayload {
	type: "session:prompt";
	prompt: string;
}

export interface SessionReplyEvent extends BaseEventPayload {
	type: "session:reply";
	reply: string;
}

export interface SessionAbortEvent extends BaseEventPayload {
	type: "session:abort";
	reason: string;
}

// --- Extension Pattern ---

export interface ExtensionEvent extends BaseEventPayload {
	type: string;
	[key: string]: unknown;
}

/**
 * Union of all known event types.
 */
export type BaseEvent =
	| HarnessStartEvent
	| HarnessCompleteEvent
	| PhaseStartEvent
	| PhaseCompleteEvent
	| TaskStartEvent
	| TaskCompleteEvent
	| TaskFailedEvent
	| AgentStartEvent
	| AgentThinkingEvent
	| AgentTextEvent
	| AgentToolStartEvent
	| AgentToolCompleteEvent
	| AgentCompleteEvent
	| NarrativeEvent
	| SessionPromptEvent
	| SessionReplyEvent
	| SessionAbortEvent
	| ExtensionEvent;

// ============================================================================
// ENRICHED EVENT (FR-002)
// ============================================================================

/**
 * Enriched event wrapper with metadata.
 */
export interface EnrichedEvent<T extends BaseEventPayload = BaseEvent> {
	/** Unique event identifier (UUID) */
	id: string;
	/** When event was emitted */
	timestamp: Date;
	/** Inherited + override context */
	context: EventContext;
	/** Original event payload */
	event: T;
}

// ============================================================================
// UNIFIED EVENT BUS (FR-001)
// ============================================================================

/**
 * Event listener callback type.
 */
export type UnifiedEventListener<T extends BaseEventPayload = BaseEvent> = (
	event: EnrichedEvent<T>,
) => void | Promise<void>;

/**
 * Unsubscribe function returned by subscribe().
 */
export type Unsubscribe = () => void;

/**
 * Event filter - string pattern or array of patterns.
 * Supports: '*' (all), 'task:*' (prefix), exact match.
 */
export type EventFilter = string | string[];

/**
 * Unified Event Bus interface.
 * Central event infrastructure with AsyncLocalStorage context propagation.
 */
export interface IUnifiedEventBus {
	/**
	 * Execute function within a context scope.
	 * Context survives async boundaries via AsyncLocalStorage.
	 *
	 * @param context - Partial context to add/override
	 * @param fn - Function to execute within scope
	 * @returns Function result
	 */
	scoped<T>(context: Partial<EventContext>, fn: () => T | Promise<T>): T | Promise<T>;

	/**
	 * Emit an event with auto-attached context.
	 *
	 * @param event - Event to emit
	 * @param override - Optional context override (merged with inherited)
	 */
	emit(event: BaseEvent, override?: Partial<EventContext>): void;

	/**
	 * Subscribe to events with optional filter.
	 *
	 * @param filter - Event type pattern(s). Default: '*' (all)
	 * @param listener - Callback for matching events
	 * @returns Unsubscribe function
	 */
	subscribe(listener: UnifiedEventListener): Unsubscribe;
	subscribe(filter: EventFilter, listener: UnifiedEventListener): Unsubscribe;

	/**
	 * Get current context from AsyncLocalStorage.
	 *
	 * @returns Current EventContext (minimal if no scope active)
	 */
	current(): EventContext;

	/**
	 * Remove all subscribers.
	 */
	clear(): void;

	/**
	 * Get number of active subscribers.
	 */
	readonly subscriberCount: number;
}

// ============================================================================
// RENDERER SYSTEM (FR-005)
// ============================================================================

/**
 * Spinner control interface.
 */
export interface Spinner {
	/** Update spinner text */
	update(text: string): void;
	/** Stop spinner with success state */
	succeed(text?: string): void;
	/** Stop spinner with failure state */
	fail(text?: string): void;
	/** Stop spinner without state indicator */
	stop(): void;
}

/**
 * Render output helpers.
 */
export interface RenderOutput {
	/** Write a line to output */
	line(text: string): void;
	/** Update an existing line by ID */
	update(lineId: string, text: string): void;
	/** Show spinner with text */
	spinner(text: string): Spinner;
	/** Show progress bar */
	progress(current: number, total: number, label?: string): void;
	/** Clear output */
	clear(): void;
	/** Add blank line */
	newline(): void;
}

/**
 * Renderer configuration.
 */
export interface RendererConfig {
	/** Verbosity level */
	verbosity: "minimal" | "normal" | "verbose";
	/** Enable colors in output */
	colors: boolean;
	/** Enable Unicode symbols */
	unicode: boolean;
}

/**
 * Context passed to event handlers.
 */
export interface RenderContext<TState> {
	/** Mutable renderer state */
	state: TState;
	/** Current event being handled */
	event: EnrichedEvent<BaseEvent>;
	/** Emit custom events */
	emit: (type: string, data: Record<string, unknown>) => void;
	/** Renderer configuration */
	config: RendererConfig;
	/** Terminal output helpers */
	output: RenderOutput;
}

/**
 * Event handler function type.
 */
export type EventHandler<TState> = (context: RenderContext<TState>) => void | Promise<void>;

/**
 * Renderer definition for defineRenderer() factory.
 */
export interface RendererDefinition<TState> {
	/** Renderer name */
	name: string;
	/** Initial state factory (called fresh on each attach) */
	state?: () => TState;
	/** Event handlers by type pattern */
	on: Record<string, EventHandler<TState>>;
	/** Called when harness starts */
	onStart?: (context: RenderContext<TState>) => void | Promise<void>;
	/** Called when harness completes */
	onComplete?: (context: RenderContext<TState>) => void | Promise<void>;
}

/**
 * Unified renderer interface.
 */
export interface IUnifiedRenderer {
	/** Renderer name */
	readonly name: string;
	/** Connect to event bus */
	attach(bus: IUnifiedEventBus): void;
	/** Disconnect from event bus */
	detach(): void;
}

/**
 * Factory function to create a renderer from definition.
 *
 * @param definition - Renderer configuration
 * @returns Renderer instance
 */
export type DefineRenderer = <TState>(definition: RendererDefinition<TState>) => IUnifiedRenderer;

// ============================================================================
// DI TOKEN
// ============================================================================

/**
 * Symbol token for DI injection.
 * Use with @inject(IUnifiedEventBusToken)
 */
export const IUnifiedEventBusToken = Symbol("IUnifiedEventBus");

// ============================================================================
// TYPE GUARDS
// ============================================================================

/** Check if event is a workflow event (harness/phase/task) */
export function isWorkflowEvent(
	event: BaseEvent,
): event is
	| HarnessStartEvent
	| HarnessCompleteEvent
	| PhaseStartEvent
	| PhaseCompleteEvent
	| TaskStartEvent
	| TaskCompleteEvent
	| TaskFailedEvent {
	return event.type.startsWith("harness:") || event.type.startsWith("phase:") || event.type.startsWith("task:");
}

/** Check if event is an agent event */
export function isAgentEvent(
	event: BaseEvent,
): event is
	| AgentStartEvent
	| AgentThinkingEvent
	| AgentTextEvent
	| AgentToolStartEvent
	| AgentToolCompleteEvent
	| AgentCompleteEvent {
	return event.type.startsWith("agent:");
}

/** Check if event is a narrative event */
export function isNarrativeEvent(event: BaseEvent): event is NarrativeEvent {
	return event.type === "narrative";
}

/** Check if event is a session event */
export function isSessionEvent(event: BaseEvent): event is SessionPromptEvent | SessionReplyEvent | SessionAbortEvent {
	return event.type.startsWith("session:");
}

// ============================================================================
// FILTER MATCHING
// ============================================================================

/**
 * Check if event type matches a filter pattern.
 *
 * @param eventType - Event type string (e.g., "task:start")
 * @param filter - Filter pattern(s)
 * @returns True if matches
 */
export function matchesFilter(eventType: string, filter: EventFilter): boolean {
	const patterns = Array.isArray(filter) ? filter : [filter];

	return patterns.some((pattern) => {
		// Wildcard matches all
		if (pattern === "*") return true;

		// Prefix match (e.g., "task:*" matches "task:start")
		if (pattern.endsWith("*")) {
			return eventType.startsWith(pattern.slice(0, -1));
		}

		// Exact match
		return eventType === pattern;
	});
}
