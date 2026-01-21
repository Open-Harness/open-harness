/**
 * Renderer Module - Public Exports
 *
 * Re-exports consumer-facing types for event rendering.
 * Renderers are pure observers that transform events into output.
 *
 * @module @core-v2/renderer
 */

// Types
export type {
	CreateRendererOptions,
	EventPattern,
	MultiRenderer,
	Renderer,
	RendererRegistry,
	RenderFunction,
} from "./Renderer.js";
// Factory functions
// Pattern matching utilities
// Rendering execution
export {
	createRenderer,
	createRendererRegistry,
	findMatchingPatterns,
	matchesAnyPattern,
	matchesPattern,
	renderEvent,
	renderEventAsync,
} from "./Renderer.js";
