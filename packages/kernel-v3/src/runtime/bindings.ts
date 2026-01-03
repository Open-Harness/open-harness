/**
 * Context object used to resolve bindings.
 */
export type BindingContext = {
	flow?: { input?: Record<string, unknown> };
	[key: string]: unknown;
};

/** Result of resolving a binding path. */
export type BindingResolution = {
	found: boolean;
	value?: unknown;
};

/**
 * Resolve a dotted path (e.g., "flow.input.foo") within a context.
 * @param context - Binding context.
 * @param path - Dotted path string.
 * @returns Binding resolution result.
 */
export declare function resolveBindingPath(
	context: BindingContext,
	path: string,
): BindingResolution;

/**
 * Resolve a template string with {{ }} expressions.
 * @param template - Template string.
 * @param context - Binding context.
 * @returns Resolved string.
 */
export declare function resolveBindingString(
	template: string,
	context: BindingContext,
): string;

/**
 * Resolve bindings recursively within an object.
 * @param input - Input object with binding expressions.
 * @param context - Binding context.
 * @returns Resolved object.
 */
export declare function resolveBindings<T extends Record<string, unknown>>(
	input: T,
	context: BindingContext,
): T;
