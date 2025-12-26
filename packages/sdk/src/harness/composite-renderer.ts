/**
 * CompositeRenderer - Dispatches events to multiple renderers
 *
 * Allows a single harness to output to multiple targets simultaneously
 * (e.g., console + file + UI).
 *
 * @module harness/composite-renderer
 */

import type { HarnessEvent } from "./event-protocol.js";
import type { IHarnessRenderer, RendererConfig } from "./renderer-interface.js";
import type { HarnessSummary, ParsedTask } from "./task-harness-types.js";

/**
 * CompositeRenderer - Fans out events to multiple child renderers.
 *
 * All child renderers receive the same events in registration order.
 * Errors in individual renderers are isolated and logged, not propagated.
 *
 * @example
 * ```typescript
 * const composite = new CompositeRenderer()
 *   .add(new ConsoleRenderer())
 *   .add(new FileRenderer('output.log'));
 *
 * harness.setRenderer(composite);
 * ```
 */
export class CompositeRenderer implements IHarnessRenderer {
	private renderers: IHarnessRenderer[] = [];
	private initialized = false;

	/**
	 * Add a renderer to the composite.
	 *
	 * @param renderer - The renderer to add
	 * @returns this (for chaining)
	 */
	add(renderer: IHarnessRenderer): this {
		if (this.initialized) {
			console.warn("CompositeRenderer: Cannot add renderer after initialization");
			return this;
		}
		this.renderers.push(renderer);
		return this;
	}

	/**
	 * Remove a renderer from the composite.
	 *
	 * @param renderer - The renderer to remove
	 * @returns true if removed, false if not found
	 */
	remove(renderer: IHarnessRenderer): boolean {
		const index = this.renderers.indexOf(renderer);
		if (index >= 0) {
			this.renderers.splice(index, 1);
			return true;
		}
		return false;
	}

	/**
	 * Get the number of registered renderers.
	 */
	get count(): number {
		return this.renderers.length;
	}

	/**
	 * Check if any renderers are registered.
	 */
	get isEmpty(): boolean {
		return this.renderers.length === 0;
	}

	// =========================================================================
	// IHarnessRenderer Implementation
	// =========================================================================

	async initialize(tasks: ParsedTask[], config: RendererConfig): Promise<void> {
		this.initialized = true;

		// Initialize all renderers, catching errors to avoid breaking the run
		const results = await Promise.allSettled(
			this.renderers.map((r) => Promise.resolve(r.initialize(tasks, config))),
		);

		// Log any failures
		for (const [index, result] of results.entries()) {
			if (result.status === "rejected") {
				console.error(`CompositeRenderer: Renderer ${index} failed to initialize:`, result.reason);
			}
		}
	}

	handleEvent(event: HarnessEvent): void {
		// Dispatch to all renderers, catching errors
		for (const [index, renderer] of this.renderers.entries()) {
			try {
				renderer.handleEvent(event);
			} catch (error) {
				console.error(`CompositeRenderer: Renderer ${index} failed to handle event:`, error);
			}
		}
	}

	async finalize(summary: HarnessSummary): Promise<void> {
		// Finalize all renderers, catching errors
		const results = await Promise.allSettled(
			this.renderers.map((r) => Promise.resolve(r.finalize(summary))),
		);

		// Log any failures
		for (const [index, result] of results.entries()) {
			if (result.status === "rejected") {
				console.error(`CompositeRenderer: Renderer ${index} failed to finalize:`, result.reason);
			}
		}

		this.initialized = false;
	}
}
