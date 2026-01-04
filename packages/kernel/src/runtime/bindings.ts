// Async binding resolution using JSONata expressions
// All {{ }} templates are evaluated via JSONata

import {
	type ExpressionContext,
	evaluateExpression,
	evaluateTemplate,
	isPureBinding,
	parseTemplate,
} from "./expressions.js";

/**
 * Context object used to resolve bindings.
 * Re-export ExpressionContext for compatibility.
 */
export type BindingContext = ExpressionContext;

/**
 * Resolve a template string with {{ }} expressions using JSONata.
 *
 * - Pure bindings (just {{ expr }}) preserve type
 * - Mixed templates return string with interpolation
 * - Missing paths return undefined for pure bindings, empty string in mixed
 *
 * @param template - Template string with {{ }} expressions
 * @param context - Binding context
 * @returns Resolved value
 */
export async function resolveBindingString(
	template: string,
	context: BindingContext,
): Promise<unknown> {
	// Fast path: pure binding preserves type
	if (isPureBinding(template)) {
		const segments = parseTemplate(template);
		const expr = segments[0];
		if (expr?.type === "expression") {
			return evaluateExpression(expr.value, context);
		}
	}

	// Mixed template: always returns string
	const segments = parseTemplate(template);
	return evaluateTemplate(segments, context);
}

/**
 * Resolve bindings recursively within an object/array/value.
 *
 * @param input - Input with binding expressions
 * @param context - Binding context
 * @returns Resolved value with all {{ }} templates evaluated
 */
export async function resolveBindings<T extends Record<string, unknown>>(
	input: T,
	context: BindingContext,
): Promise<T> {
	return resolveValue(input, context) as Promise<T>;
}

/**
 * Recursively resolve bindings in any value.
 */
async function resolveValue(
	value: unknown,
	context: BindingContext,
): Promise<unknown> {
	if (typeof value === "string") {
		return resolveBindingString(value, context);
	}
	if (Array.isArray(value)) {
		return Promise.all(value.map((item) => resolveValue(item, context)));
	}
	if (value && typeof value === "object") {
		const result: Record<string, unknown> = {};
		const entries = Object.entries(value);
		const resolvedEntries = await Promise.all(
			entries.map(
				async ([key, entry]) =>
					[key, await resolveValue(entry, context)] as const,
			),
		);
		for (const [key, resolved] of resolvedEntries) {
			result[key] = resolved;
		}
		return result;
	}
	return value;
}
