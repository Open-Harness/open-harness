/**
 * Centralized render utility for example output.
 *
 * All examples use this single render object for user-facing output.
 * Infrastructure logging (tool:call, agent:start, etc.) happens
 * automatically via Pino through the logging option in runReactive.
 *
 * Benefits:
 * - Single source of truth for output formatting
 * - Easy to swap rendering (e.g., to Listr2 for TUI)
 * - No scattered console.log calls in examples
 * - Clear separation: render = user-facing, logger = infrastructure
 */

/**
 * Render utility for example output.
 *
 * @example
 * ```ts
 * import { render } from "../lib/render.js";
 *
 * render.banner("Trading Agent Example", "Demonstrating parallel execution.");
 * render.section("Results");
 * render.metric("Duration", `${result.metrics.durationMs}ms`);
 * render.state(result.state);
 * ```
 */
export const render = {
	/**
	 * Display a banner with optional subtitle.
	 */
	banner: (title: string, subtitle?: string) => {
		console.log(`\n=== ${title} ===\n`);
		if (subtitle) {
			console.log(`${subtitle}\n`);
		}
	},

	/**
	 * Display a section header.
	 */
	section: (title: string) => {
		console.log(`\n=== ${title} ===\n`);
	},

	/**
	 * Display a labeled metric.
	 */
	metric: (label: string, value: unknown) => {
		console.log(`${label}: ${value}`);
	},

	/**
	 * Display a list of items.
	 */
	list: (items: string[]) => {
		for (const item of items) {
			console.log(`  - ${item}`);
		}
	},

	/**
	 * Display JSON data with pretty formatting.
	 */
	json: (obj: unknown) => {
		console.log(JSON.stringify(obj, null, 2));
	},

	/**
	 * Display a state object with key-value pairs.
	 * Skips null values for cleaner output.
	 */
	state: (obj: Record<string, unknown>) => {
		for (const [key, value] of Object.entries(obj)) {
			if (value !== null && value !== undefined) {
				console.log(`  ${key}: ${JSON.stringify(value)}`);
			}
		}
	},

	/**
	 * Display an empty line.
	 */
	blank: () => {
		console.log();
	},

	/**
	 * Display a plain message.
	 */
	text: (message: string) => {
		console.log(message);
	},

	/**
	 * Display an error message.
	 */
	error: (message: string) => {
		console.error(`ERROR: ${message}`);
	},
};
