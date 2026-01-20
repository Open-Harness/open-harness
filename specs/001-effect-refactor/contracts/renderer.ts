/**
 * Renderer Contracts - Public API Types
 *
 * These interfaces define the public API surface for Renderers.
 * Renderers are pure observers that transform events into output.
 *
 * @module @core-v2/renderer
 */

import type { AnyEvent } from "./event";

/**
 * Event pattern for matching events.
 *
 * @remarks
 * Patterns support wildcards:
 * - `"text:delta"` - Exact match
 * - `"error:*"` - Matches all error events
 * - `"*:completed"` - Matches all completion events
 * - `"*"` - Matches all events
 */
export type EventPattern = string;

/**
 * Render function signature.
 *
 * @typeParam Output - The output type produced by this render function
 *
 * @remarks
 * Render functions:
 * - Are pure observers (cannot modify events or state)
 * - Cannot emit new events
 * - Receive events in real-time as they flow
 */
export type RenderFunction<State = unknown, Output = void> = (
  event: AnyEvent,
  state: State
) => Output;

/**
 * Renderer definition - a collection of render functions for different event patterns.
 *
 * @typeParam State - The workflow state type
 * @typeParam Output - The output type produced by render functions
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
  /** Unique renderer name */
  readonly name: string;

  /** Event patterns this renderer subscribes to */
  readonly patterns: readonly EventPattern[];

  /** The render function */
  render: RenderFunction<State, Output>;
}

/**
 * Renderer with pattern-specific render functions.
 *
 * @remarks
 * Alternative to single `render` function - allows different handlers per pattern.
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

/**
 * Renderer registry - maps renderer names to renderers.
 */
export type RendererRegistry<S> = ReadonlyMap<string, Renderer<S, unknown>>;

// ============================================================================
// Renderer Factory Types
// ============================================================================

/**
 * Options for `createRenderer()` factory function.
 */
export interface CreateRendererOptions<State, Output> {
  /** Unique renderer name */
  readonly name: string;
  /** Pattern-specific render functions */
  readonly renderers: Readonly<Record<EventPattern, RenderFunction<State, Output>>>;
}
