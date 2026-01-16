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

// ============================================================================
// Path Segment Types for Bracket Notation (FE-002)
// ============================================================================

/**
 * A segment of a parsed path.
 */
type PathSegment =
	| { type: "property"; name: string }
	| { type: "index"; value: number }
	| { type: "dynamic"; expression: string };

/**
 * Parse a path string with bracket notation into segments.
 *
 * Supports:
 * - Property access: `state.foo.bar`
 * - Array index: `state.items[0]`
 * - Dynamic key: `state.tasks[state.currentId]`
 * - Mixed: `state.tasks[state.currentId].name`
 *
 * @param path - Path string to parse
 * @returns Array of path segments
 */
export function parsePath(path: string): PathSegment[] {
	const segments: PathSegment[] = [];
	let remaining = path;

	while (remaining.length > 0) {
		// Check for bracket notation first
		if (remaining.startsWith("[")) {
			// Find the matching closing bracket (handle nested brackets)
			let depth = 0;
			let endIdx = -1;
			for (let i = 0; i < remaining.length; i++) {
				if (remaining[i] === "[") depth++;
				if (remaining[i] === "]") depth--;
				if (depth === 0) {
					endIdx = i;
					break;
				}
			}

			if (endIdx === -1) {
				// Malformed - no closing bracket, treat rest as property
				segments.push({ type: "property", name: remaining });
				break;
			}

			const inner = remaining.slice(1, endIdx);

			// Is it a number (array index)?
			if (/^\d+$/.test(inner)) {
				segments.push({ type: "index", value: parseInt(inner, 10) });
			} else {
				// It's a dynamic expression
				segments.push({ type: "dynamic", expression: inner });
			}

			remaining = remaining.slice(endIdx + 1);
			// Skip trailing dot if present
			if (remaining.startsWith(".")) {
				remaining = remaining.slice(1);
			}
			continue;
		}

		// Check for property access (until next dot or bracket)
		const propMatch = remaining.match(/^([^.\[]+)/);
		if (propMatch && propMatch[1]) {
			segments.push({ type: "property", name: propMatch[1] });
			remaining = remaining.slice(propMatch[0].length);
			// Skip trailing dot if present
			if (remaining.startsWith(".")) {
				remaining = remaining.slice(1);
			}
			continue;
		}

		// If we get here, something went wrong - break to avoid infinite loop
		break;
	}

	return segments;
}

/**
 * Resolve a path with bracket notation support.
 *
 * @param path - Path string (may include bracket notation)
 * @param context - Template context to resolve against
 * @returns Resolved value or undefined
 */
function resolvePathWithBrackets(
	path: string,
	context: TemplateContext,
): unknown {
	const segments = parsePath(path);
	if (segments.length === 0) return undefined;

	// Determine the root value based on first segment
	const firstSegment = segments[0];
	if (firstSegment?.type !== "property") {
		return undefined;
	}

	const root = firstSegment.name;
	let current: unknown;
	let startIdx = 1;

	switch (root) {
		case "state":
			current = context.state;
			break;
		case "signal":
			current = context.signal;
			break;
		case "input":
			current = context.input;
			break;
		default:
			// Unknown root - try state as fallback for convenience
			// e.g., {{ ticker }} is shorthand for {{ state.ticker }}
			current = context.state;
			startIdx = 0; // Include the first segment
			break;
	}

	// Resolve remaining segments
	for (let i = startIdx; i < segments.length; i++) {
		if (current === null || current === undefined) {
			return undefined;
		}

		const segment = segments[i];
		if (!segment) continue;

		switch (segment.type) {
			case "property":
				if (typeof current !== "object") return undefined;
				current = (current as Record<string, unknown>)[segment.name];
				break;
			case "index":
				if (!Array.isArray(current) && typeof current !== "object")
					return undefined;
				current = (current as Record<string | number, unknown>)[segment.value];
				break;
			case "dynamic": {
				// Recursively resolve the expression to get the key
				const key = resolvePathWithBrackets(segment.expression, context);
				if (typeof key !== "string" && typeof key !== "number") {
					return undefined;
				}
				if (typeof current !== "object" || current === null) {
					return undefined;
				}
				current = (current as Record<string | number, unknown>)[key];
				break;
			}
		}
	}

	return current;
}

/**
 * Resolve a path against the context.
 * Supports both dot notation and bracket notation.
 *
 * @param path - Path string like "state.user.name" or "state.tasks[state.currentId]"
 * @param context - Context to resolve against
 * @returns Resolved value or undefined if not found
 */
function resolvePath(path: string, context: TemplateContext): unknown {
	// Check if path contains bracket notation
	if (path.includes("[")) {
		return resolvePathWithBrackets(path, context);
	}

	// Fast path for simple dot notation (backward compatible)
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
