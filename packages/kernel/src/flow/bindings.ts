// Flow bindings (A3) - JSONata-powered implementation
// Implements docs/flow/bindings.md
// Backward compatible with legacy {{ ?path }} and {{ path | default: X }} syntax

import {
	evaluateExpression,
	resolveTemplate as resolveExpressionTemplate,
	resolveBindingsDeep,
	type ExpressionContext,
} from "./expressions.js";

export type BindingContext = {
	flow?: { input?: Record<string, unknown> };
	$iteration?: number;
	$first?: boolean;
	$last?: boolean;
	$maxIterations?: number;
	[key: string]: unknown;
};

export interface BindingResolution {
	found: boolean;
	value?: unknown;
}

/**
 * Resolve a simple dot-separated path in the context.
 * Used for backward compatibility with when.ts YAML AST evaluation.
 *
 * @deprecated Use evaluateExpression for new code
 */
export function resolveBindingPath(
	context: BindingContext,
	path: string,
): BindingResolution {
	const segments = path.split(".").filter((segment) => segment.length > 0);
	let current: unknown = context;

	for (const segment of segments) {
		if (current && typeof current === "object" && segment in current) {
			current = (current as Record<string, unknown>)[segment];
		} else {
			return { found: false };
		}
	}

	if (current === null || current === undefined) {
		return { found: false };
	}

	return { found: true, value: current };
}

/**
 * Parse legacy binding syntax and convert to JSONata expression.
 * Handles:
 * - {{ ?path }} → path (with empty string fallback in string context)
 * - {{ path | default: X }} → converts to conditional
 */
function parseLegacyBinding(raw: string): {
	expr: string;
	isOptional: boolean;
	defaultValue?: unknown;
} {
	const parts = raw.split("|").map((part) => part.trim());
	let path = parts[0] ?? "";
	let isOptional = false;

	// Handle optional prefix
	if (path.startsWith("?")) {
		isOptional = true;
		path = path.slice(1).trim();
	}

	// Handle default value
	let defaultValue: unknown;
	const defaultPart = parts.find((part) => part.startsWith("default:"));
	if (defaultPart) {
		const rawDefault = defaultPart.slice("default:".length).trim();
		try {
			defaultValue = JSON.parse(rawDefault);
		} catch {
			throw new Error(`Invalid default JSON literal: ${rawDefault}`);
		}
	}

	return { expr: path, isOptional, defaultValue };
}

/**
 * Detect if a binding expression uses legacy syntax.
 */
function isLegacySyntax(expr: string): boolean {
	return expr.startsWith("?") || expr.includes("| default:");
}

/**
 * Resolve a binding string template, supporting both legacy and JSONata syntax.
 *
 * Legacy syntax (backward compatible):
 * - {{ path }} - required path, throws if missing (OLD BEHAVIOR)
 * - {{ ?path }} - optional, returns empty string if missing
 * - {{ path | default: "value" }} - with default
 *
 * New JSONata syntax:
 * - {{ path }} - returns empty string if missing (NEW - graceful)
 * - {{ $exists(path) ? path : "default" }} - conditional
 * - {{ a & b }} - string concatenation
 * - {{ $not(condition) }} - negation
 *
 * @deprecated Use resolveTemplate from expressions.ts for new code
 */
export async function resolveBindingString(
	template: string,
	context: BindingContext,
): Promise<string> {
	const regex = /\{\{([^}]+)\}\}/g;
	const parts: string[] = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	match = regex.exec(template);
	while (match !== null) {
		// Add text before this match
		if (match.index > lastIndex) {
			parts.push(template.slice(lastIndex, match.index));
		}
		lastIndex = regex.lastIndex;

		const raw = match[1]?.trim() ?? "";

		if (isLegacySyntax(raw)) {
			// Legacy mode: use old parsing logic
			const { expr, isOptional, defaultValue } = parseLegacyBinding(raw);
			const resolution = resolveBindingPath(context, expr);

			if (!resolution.found) {
				if (defaultValue !== undefined) {
					parts.push(String(defaultValue));
				} else if (isOptional) {
					parts.push("");
				} else {
					throw new Error(`Missing binding path: ${expr}`);
				}
			} else {
				parts.push(String(resolution.value));
			}
		} else {
			// New JSONata mode: evaluate expression
			const result = await evaluateExpression(raw, context as ExpressionContext);
			if (result === undefined || result === null) {
				parts.push("");
			} else if (typeof result === "object") {
				parts.push(JSON.stringify(result));
			} else {
				parts.push(String(result));
			}
		}

		match = regex.exec(template);
	}

	// Add remaining text
	if (lastIndex < template.length) {
		parts.push(template.slice(lastIndex));
	}

	return parts.join("");
}

/**
 * Check if a string is a pure binding expression (e.g., "{{ path }}")
 * vs a template with embedded bindings (e.g., "Hello {{ name }}!")
 */
function isPureBinding(template: string): boolean {
	const trimmed = template.trim();
	if (!trimmed.startsWith("{{") || !trimmed.endsWith("}}")) {
		return false;
	}
	// Check there's only one binding in the string
	const matches = trimmed.match(/\{\{[^}]+\}\}/g);
	return matches?.length === 1 && matches[0] === trimmed;
}

/**
 * Resolve a pure binding expression and return the raw value (not stringified).
 * Supports both legacy and JSONata syntax.
 */
async function resolvePureBinding(
	template: string,
	context: BindingContext,
): Promise<unknown> {
	const match = template.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
	if (!match) {
		throw new Error(`Invalid pure binding: ${template}`);
	}

	const raw = match[1]?.trim() ?? "";

	if (isLegacySyntax(raw)) {
		// Legacy mode
		const { expr, isOptional, defaultValue } = parseLegacyBinding(raw);
		const resolution = resolveBindingPath(context, expr);

		if (!resolution.found) {
			if (defaultValue !== undefined) {
				return defaultValue;
			}
			if (isOptional) {
				return undefined;
			}
			throw new Error(`Missing binding path: ${expr}`);
		}
		return resolution.value;
	}

	// New JSONata mode
	return evaluateExpression(raw, context as ExpressionContext);
}

/**
 * Recursively resolve all bindings in a value.
 */
async function resolveValue(
	value: unknown,
	context: BindingContext,
): Promise<unknown> {
	if (typeof value === "string") {
		// If it's a pure binding like "{{ foo }}", return the raw value
		if (isPureBinding(value)) {
			return resolvePureBinding(value, context);
		}
		// Otherwise, treat as a template string
		return resolveBindingString(value, context);
	}
	if (Array.isArray(value)) {
		return Promise.all(value.map((item) => resolveValue(item, context)));
	}
	if (value && typeof value === "object") {
		const result: Record<string, unknown> = {};
		const entries = Object.entries(value);
		const resolved = await Promise.all(
			entries.map(async ([k, v]) => [k, await resolveValue(v, context)] as const),
		);
		for (const [k, v] of resolved) {
			result[k] = v;
		}
		return result;
	}
	return value;
}

/**
 * Resolve all binding templates in an input object.
 * Supports both legacy and new JSONata expression syntax.
 *
 * @param input - Object with potential binding templates
 * @param context - Binding context with node outputs, flow input, etc.
 * @returns Resolved object with all bindings evaluated
 */
export async function resolveBindings<T extends Record<string, unknown>>(
	input: T,
	context: BindingContext,
): Promise<T> {
	return resolveValue(input, context) as Promise<T>;
}

// Re-export expression utilities for new code
export {
	evaluateExpression,
	resolveBindingsDeep,
	type ExpressionContext,
} from "./expressions.js";
