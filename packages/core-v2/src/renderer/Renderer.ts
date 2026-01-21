/**
 * Renderer - Pure Observer Pattern for Event Rendering
 *
 * Renderers are pure observers that transform events into output (e.g., terminal,
 * UI, logs). They cannot modify events or state, and cannot emit new events.
 *
 * Key constraints (FR-018, FR-019):
 * - Renderers MUST be pure observers
 * - Renderers MUST NOT emit new events
 * - Renderers MUST NOT modify state
 *
 * @module @core-v2/renderer
 */

import type { AnyEvent } from "../event/Event.js";

// ============================================================================
// Event Pattern Types
// ============================================================================

/**
 * Event pattern for matching events.
 *
 * @remarks
 * Patterns support wildcards (FR-020):
 * - `"text:delta"` - Exact match
 * - `"error:*"` - Wildcard suffix (matches all error events)
 * - `"*:completed"` - Wildcard prefix (matches all completion events)
 * - `"*"` - Catch-all (matches all events)
 *
 * @example
 * ```typescript
 * const patterns: EventPattern[] = [
 *   "text:delta",      // Exact match
 *   "error:*",         // All error events
 *   "*:completed",     // All completion events
 *   "*",               // All events
 * ];
 * ```
 */
export type EventPattern = string;

// ============================================================================
// Render Function Types
// ============================================================================

/**
 * Render function signature.
 *
 * @typeParam State - The workflow state type
 * @typeParam Output - The output type produced by this render function
 *
 * @remarks
 * Render functions:
 * - Are pure observers (cannot modify events or state)
 * - Cannot emit new events
 * - Receive events in real-time as they flow
 * - Return value is discarded (render functions are for side effects like logging/display)
 */
export type RenderFunction<State = unknown, Output = void> = (
	event: Readonly<AnyEvent>,
	state: Readonly<State>,
) => Output;

// ============================================================================
// Renderer Interface
// ============================================================================

/**
 * Renderer definition - a pure observer that receives events.
 *
 * @typeParam State - The workflow state type
 * @typeParam Output - The output type produced by render functions
 *
 * @remarks
 * Renderers are pure observers (FR-018):
 * - They CANNOT modify events or state
 * - They CANNOT emit new events (FR-019)
 * - They receive events as they flow, enabling real-time output (FR-021)
 *
 * @example
 * ```typescript
 * const terminalRenderer: Renderer<ChatState, void> = {
 *   name: "terminal",
 *   patterns: ["text:delta", "error:*", "agent:started"],
 *
 *   render: (event, state) => {
 *     switch (event.name) {
 *       case "text:delta":
 *         process.stdout.write(event.payload.delta);
 *         break;
 *       case "agent:started":
 *         console.log(`[${event.payload.agentName}] Starting...`);
 *         break;
 *     }
 *   },
 * };
 * ```
 */
export interface Renderer<State = unknown, Output = void> {
	/** Unique renderer name for identification */
	readonly name: string;

	/** Event patterns this renderer subscribes to */
	readonly patterns: readonly EventPattern[];

	/** The render function called for matching events */
	render: RenderFunction<State, Output>;
}

// ============================================================================
// Multi-Renderer Interface
// ============================================================================

/**
 * Renderer with pattern-specific render functions.
 *
 * @typeParam State - The workflow state type
 * @typeParam Output - The output type produced by render functions
 *
 * @remarks
 * Alternative to single `render` function - allows different handlers per pattern.
 * This is the preferred pattern when different events need different rendering logic.
 *
 * @example
 * ```typescript
 * const renderer = createRenderer({
 *   name: "multi",
 *   renderers: {
 *     "text:delta": (event, state) => process.stdout.write(event.payload.delta),
 *     "error:*": (event, state) => console.error(event.payload.message),
 *   },
 * });
 * ```
 */
export interface MultiRenderer<State = unknown, Output = void> {
	/** Unique renderer name */
	readonly name: string;

	/** Map of patterns to render functions */
	readonly renderers: Readonly<Record<EventPattern, RenderFunction<State, Output>>>;
}

// ============================================================================
// Renderer Registry
// ============================================================================

/**
 * Renderer registry - maps renderer names to renderers.
 */
export type RendererRegistry<S> = ReadonlyMap<string, Renderer<S, unknown>>;

// ============================================================================
// Pattern Matching Utilities
// ============================================================================

/**
 * Checks if an event name matches a pattern.
 *
 * @param eventName - The event name to check (e.g., "error:network")
 * @param pattern - The pattern to match against (e.g., "error:*")
 * @returns true if the event name matches the pattern
 *
 * @remarks
 * Pattern matching rules (FR-020):
 * - Exact match: `"text:delta"` matches only `"text:delta"`
 * - Wildcard suffix: `"error:*"` matches `"error:network"`, `"error:timeout"`, etc.
 * - Wildcard prefix: `"*:completed"` matches `"agent:completed"`, `"tool:completed"`, etc.
 * - Catch-all: `"*"` matches everything
 *
 * @example
 * ```typescript
 * matchesPattern("error:network", "error:*");     // true
 * matchesPattern("agent:completed", "*:completed"); // true
 * matchesPattern("text:delta", "text:delta");      // true
 * matchesPattern("text:delta", "text:complete");   // false
 * matchesPattern("anything", "*");                  // true
 * ```
 */
export function matchesPattern(eventName: string, pattern: EventPattern): boolean {
	// Catch-all pattern matches everything
	if (pattern === "*") {
		return true;
	}

	// Wildcard suffix (e.g., "error:*")
	if (pattern.endsWith(":*")) {
		const prefix = pattern.slice(0, -1); // Remove the "*", keep the ":"
		return eventName.startsWith(prefix);
	}

	// Wildcard prefix (e.g., "*:completed")
	if (pattern.startsWith("*:")) {
		const suffix = pattern.slice(1); // Remove the "*", keep the ":"
		return eventName.endsWith(suffix);
	}

	// Exact match
	return eventName === pattern;
}

/**
 * Checks if an event name matches any of the given patterns.
 *
 * @param eventName - The event name to check
 * @param patterns - Array of patterns to match against
 * @returns true if the event name matches at least one pattern
 *
 * @example
 * ```typescript
 * matchesAnyPattern("error:network", ["text:*", "error:*"]);  // true
 * matchesAnyPattern("user:input", ["text:*", "error:*"]);     // false
 * ```
 */
export function matchesAnyPattern(eventName: string, patterns: readonly EventPattern[]): boolean {
	return patterns.some((pattern) => matchesPattern(eventName, pattern));
}

/**
 * Finds all patterns that match a given event name.
 *
 * @param eventName - The event name to check
 * @param patterns - Array of patterns to match against
 * @returns Array of matching patterns (may be empty)
 *
 * @example
 * ```typescript
 * findMatchingPatterns("agent:completed", ["*", "agent:*", "*:completed"]);
 * // Returns: ["*", "agent:*", "*:completed"]
 * ```
 */
export function findMatchingPatterns(eventName: string, patterns: readonly EventPattern[]): EventPattern[] {
	return patterns.filter((pattern) => matchesPattern(eventName, pattern));
}

// ============================================================================
// Renderer Factory Types
// ============================================================================

/**
 * Options for `createRenderer()` factory function.
 *
 * @typeParam State - The workflow state type
 * @typeParam Output - The output type produced by render functions
 */
export interface CreateRendererOptions<State, Output = void> {
	/** Unique renderer name */
	readonly name: string;
	/** Pattern-specific render functions */
	readonly renderers: Readonly<Record<EventPattern, RenderFunction<State, Output>>>;
}

// ============================================================================
// Renderer Factory
// ============================================================================

/**
 * Creates a renderer from pattern-specific render functions.
 *
 * @typeParam State - The workflow state type
 * @typeParam Output - The output type produced by render functions
 *
 * @param options - Renderer configuration with pattern-specific render functions
 * @returns A Renderer instance that dispatches to the appropriate render function
 *
 * @remarks
 * This factory creates a Renderer that:
 * - Extracts patterns from the `renderers` map keys
 * - Dispatches events to the matching render function(s)
 * - Skips events that don't match any pattern
 *
 * The render function will be called for each matching pattern (not just the first).
 *
 * @example
 * ```typescript
 * const renderer = createRenderer<ChatState>({
 *   name: "terminal",
 *   renderers: {
 *     "text:delta": (event, state) => {
 *       process.stdout.write((event.payload as { delta: string }).delta);
 *     },
 *     "error:*": (event, state) => {
 *       console.error("Error:", (event.payload as { message: string }).message);
 *     },
 *     "*:completed": (event, state) => {
 *       console.log("Completed:", event.name);
 *     },
 *   },
 * });
 * ```
 */
export function createRenderer<State = unknown, Output = void>(
	options: CreateRendererOptions<State, Output>,
): Renderer<State, Output> {
	const { name, renderers } = options;

	// Extract patterns from the renderers map
	const patterns = Object.keys(renderers) as EventPattern[];

	// Create the dispatch render function
	const render: RenderFunction<State, Output> = (event, state) => {
		// Find all matching patterns for this event
		const matchingPatterns = findMatchingPatterns(event.name, patterns);

		// Call each matching render function
		// Note: We return the result of the last matching render function
		// (most specific patterns should be listed last if order matters)
		let lastResult: Output = undefined as Output;

		for (const pattern of matchingPatterns) {
			const renderFn = renderers[pattern];
			if (renderFn) {
				lastResult = renderFn(event, state);
			}
		}

		return lastResult;
	};

	return {
		name,
		patterns,
		render,
	};
}

// ============================================================================
// Renderer Registry Factory
// ============================================================================

/**
 * Creates a renderer registry from an array of renderers.
 *
 * @param renderers - Array of renderers to register
 * @returns A RendererRegistry map
 * @throws Error if duplicate renderer names are detected
 *
 * @example
 * ```typescript
 * const registry = createRendererRegistry([
 *   terminalRenderer,
 *   logRenderer,
 *   debugRenderer,
 * ]);
 * ```
 */
export function createRendererRegistry<S>(renderers: readonly Renderer<S, unknown>[]): RendererRegistry<S> {
	const registry = new Map<string, Renderer<S, unknown>>();

	for (const renderer of renderers) {
		if (registry.has(renderer.name)) {
			throw new Error(`Duplicate renderer name: "${renderer.name}"`);
		}
		registry.set(renderer.name, renderer);
	}

	return registry;
}

// ============================================================================
// Renderer Execution
// ============================================================================

/**
 * Calls all matching renderers for an event.
 *
 * @param event - The event to render
 * @param state - Current workflow state
 * @param renderers - Array of renderers to check
 * @returns void (renderers are for side effects)
 *
 * @remarks
 * This function:
 * - Checks each renderer's patterns against the event name
 * - Calls the render function for all matching renderers
 * - Does NOT modify the event or state (renderers are pure observers)
 *
 * @example
 * ```typescript
 * // Called by WorkflowRuntime for each event
 * renderEvent(event, state, registeredRenderers);
 * ```
 */
export function renderEvent<S>(event: AnyEvent, state: S, renderers: readonly Renderer<S, unknown>[]): void {
	for (const renderer of renderers) {
		// Check if this renderer matches the event
		if (matchesAnyPattern(event.name, renderer.patterns)) {
			// Call the render function (pass readonly event and state)
			renderer.render(event, state);
		}
	}
}

/**
 * Calls all matching renderers asynchronously (returns immediately, renderers run in parallel).
 *
 * @param event - The event to render
 * @param state - Current workflow state
 * @param renderers - Array of renderers to check
 *
 * @remarks
 * This is the async version for non-blocking rendering.
 * Used when rendering should not block event processing (FR-004).
 *
 * @example
 * ```typescript
 * // Fire-and-forget rendering
 * void renderEventAsync(event, state, renderers);
 * ```
 */
export function renderEventAsync<S>(event: AnyEvent, state: S, renderers: readonly Renderer<S, unknown>[]): void {
	// Run renderers in parallel using microtask
	for (const renderer of renderers) {
		if (matchesAnyPattern(event.name, renderer.patterns)) {
			// Schedule render function to run asynchronously
			queueMicrotask(() => {
				try {
					renderer.render(event, state);
				} catch {
					// Swallow renderer errors - they should not affect event processing
					// In production, you might want to log this
				}
			});
		}
	}
}
