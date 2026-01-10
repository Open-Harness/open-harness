/**
 * Simple template engine for agent prompt expansion.
 *
 * Supports Mustache-like syntax for accessing context values:
 * - `{{ state.property }}` - Access harness state
 * - `{{ state.nested.path }}` - Nested property access
 * - `{{ signal.name }}` - Triggering signal name
 * - `{{ signal.payload.x }}` - Signal payload properties
 * - `{{ input }}` - Original input (stringified if object)
 *
 * @example
 * ```ts
 * const template = "Analyze {{ state.ticker }} at ${{ state.price }}"
 * const result = expandTemplate(template, {
 *   state: { ticker: "AAPL", price: 150.25 },
 *   signal: { name: "harness:start", payload: {} },
 *   input: "market data"
 * })
 * // Result: "Analyze AAPL at $150.25"
 * ```
 */

/**
 * Context available during template expansion.
 */
export type TemplateContext = {
	/**
	 * Current harness state.
	 */
	state: Record<string, unknown>;

	/**
	 * Triggering signal.
	 */
	signal: {
		name: string;
		payload: unknown;
	};

	/**
	 * Original input passed to runReactive.
	 */
	input: unknown;
};

/**
 * Pattern for matching template expressions.
 * Matches: {{ path.to.value }}
 * Captures the path without braces or whitespace.
 */
const TEMPLATE_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g;

/**
 * Expand a template string with context values.
 *
 * @param template - Template string with {{ expressions }}
 * @param context - Context containing state, signal, and input
 * @returns Expanded string with all expressions replaced
 *
 * @example
 * ```ts
 * expandTemplate("Hello {{ state.name }}", { state: { name: "World" }, ... })
 * // Returns: "Hello World"
 * ```
 */
export function expandTemplate(
	template: string,
	context: TemplateContext,
): string {
	return template.replace(TEMPLATE_PATTERN, (_match, path: string) => {
		const value = resolvePath(path.trim(), context);
		return formatValue(value);
	});
}

/**
 * Check if a template string contains any expressions.
 *
 * @param template - String to check
 * @returns True if template contains {{ expressions }}
 */
export function hasTemplateExpressions(template: string): boolean {
	return TEMPLATE_PATTERN.test(template);
}

/**
 * Extract all template expression paths from a template.
 *
 * @param template - Template string to parse
 * @returns Array of paths found in template
 *
 * @example
 * ```ts
 * extractPaths("{{ state.a }} and {{ signal.name }}")
 * // Returns: ["state.a", "signal.name"]
 * ```
 */
export function extractPaths(template: string): string[] {
	const paths: string[] = [];
	let match: RegExpExecArray | null;

	// Reset regex state
	const pattern = new RegExp(TEMPLATE_PATTERN.source, "g");

	while ((match = pattern.exec(template)) !== null) {
		const captured = match[1];
		if (captured !== undefined) {
			paths.push(captured.trim());
		}
	}

	return paths;
}

/**
 * Resolve a dot-separated path against the context.
 *
 * @param path - Dot-separated path like "state.user.name"
 * @param context - Context to resolve against
 * @returns Resolved value or undefined if not found
 */
function resolvePath(path: string, context: TemplateContext): unknown {
	const parts = path.split(".");

	// Start with the appropriate root
	const root = parts[0];
	let value: unknown;

	switch (root) {
		case "state":
			value = context.state;
			break;
		case "signal":
			value = context.signal;
			break;
		case "input":
			// Input is a direct value, not nested
			if (parts.length === 1) {
				return context.input;
			}
			// If trying to access input.something, treat input as object
			value = context.input;
			break;
		default:
			// Unknown root - try state as fallback for convenience
			// e.g., {{ ticker }} is shorthand for {{ state.ticker }}
			value = context.state;
			// Don't skip the first part in this case
			return resolveNestedPath(parts, value);
	}

	// Skip the root and resolve the rest
	return resolveNestedPath(parts.slice(1), value);
}

/**
 * Resolve a path array against a value.
 */
function resolveNestedPath(parts: string[], value: unknown): unknown {
	let current = value;

	for (const part of parts) {
		if (current === null || current === undefined) {
			return undefined;
		}

		if (typeof current !== "object") {
			return undefined;
		}

		current = (current as Record<string, unknown>)[part];
	}

	return current;
}

/**
 * Format a value for insertion into the template.
 *
 * @param value - Value to format
 * @returns String representation
 */
function formatValue(value: unknown): string {
	if (value === undefined) {
		return "";
	}

	if (value === null) {
		return "null";
	}

	if (typeof value === "string") {
		return value;
	}

	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}

	if (Array.isArray(value)) {
		return JSON.stringify(value);
	}

	if (typeof value === "object") {
		return JSON.stringify(value);
	}

	return String(value);
}
