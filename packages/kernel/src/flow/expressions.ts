// JSONata expression evaluator for flow bindings
// Replaces custom path-only binding system with full expression support

import jsonata from "jsonata";

/**
 * Context available to expressions during evaluation.
 * Includes flow input, node outputs, and iteration context.
 */
export interface ExpressionContext {
	flow?: { input?: Record<string, unknown> };
	state?: Record<string, unknown>;
	$iteration?: number;
	$first?: boolean;
	$last?: boolean;
	$maxIterations?: number;
	[key: string]: unknown;
}

/**
 * A segment of a parsed template - either literal text or an expression.
 */
export type TemplateSegment =
	| { type: "text"; value: string }
	| { type: "expression"; value: string };

// Cache compiled JSONata expressions for performance
const expressionCache = new Map<string, jsonata.Expression>();

/**
 * Get or compile a JSONata expression.
 * Throws on invalid syntax.
 */
function getCompiledExpression(expr: string): jsonata.Expression {
	let compiled = expressionCache.get(expr);
	if (!compiled) {
		compiled = jsonata(expr);
		expressionCache.set(expr, compiled);
	}
	return compiled;
}

/**
 * Flatten context for JSONata evaluation.
 * JSONata bindings are accessed with $ prefix in expressions, but keys in
 * the bindings object should NOT have the $ prefix.
 * Example: { iteration: 2 } allows access via $iteration in expressions.
 */
function prepareBindings(
	context: ExpressionContext,
): Record<string, unknown> | undefined {
	const bindings: Record<string, unknown> = {};
	let hasBindings = false;

	// Inject iteration context as $ variables (key without $, access with $)
	if (context.$iteration !== undefined) {
		bindings.iteration = context.$iteration;
		hasBindings = true;
	}
	if (context.$first !== undefined) {
		bindings.first = context.$first;
		hasBindings = true;
	}
	if (context.$last !== undefined) {
		bindings.last = context.$last;
		hasBindings = true;
	}
	if (context.$maxIterations !== undefined) {
		bindings.maxIterations = context.$maxIterations;
		hasBindings = true;
	}

	return hasBindings ? bindings : undefined;
}

/**
 * Evaluate a JSONata expression against context.
 *
 * Key behaviors:
 * - Missing paths return undefined (no throw)
 * - Supports all JSONata operators: =, !=, >, <, and, or, $not(), $exists()
 * - Array access: items[0], items[-1], items[status='done']
 * - Ternary: condition ? a : b
 * - String concat: 'prefix' & value
 *
 * @example
 * await evaluateExpression('task.title', context) // Simple path
 * await evaluateExpression('$exists(reviewer)', context) // Existence check
 * await evaluateExpression('reviewer.passed = true', context) // Comparison
 * await evaluateExpression('$not(reviewer.passed)', context) // Negation
 * await evaluateExpression('condition ? "yes" : "no"', context) // Ternary
 */
export async function evaluateExpression(
	expr: string,
	context: ExpressionContext,
): Promise<unknown> {
	try {
		const compiled = getCompiledExpression(expr);
		const bindings = prepareBindings(context);
		return await compiled.evaluate(context, bindings);
	} catch (err) {
		// Check if this is a JSONata error for a missing path
		// JSONata doesn't throw for missing paths, it returns undefined
		// But it does throw for syntax errors
		if (err instanceof Error && err.message.includes("Unknown")) {
			return undefined;
		}
		throw err;
	}
}

/**
 * Parse a template string with {{ expression }} placeholders.
 *
 * @example
 * parseTemplate('Hello {{ name }}!') // [text:'Hello ', expr:'name', text:'!']
 * parseTemplate('{{ obj }}') // [expr:'obj'] - pure binding
 * parseTemplate('No bindings') // [text:'No bindings']
 */
export function parseTemplate(template: string): TemplateSegment[] {
	const segments: TemplateSegment[] = [];
	const regex = /\{\{([^}]+)\}\}/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	match = regex.exec(template);
	while (match !== null) {
		// Add text before this match
		if (match.index > lastIndex) {
			segments.push({
				type: "text",
				value: template.slice(lastIndex, match.index),
			});
		}

		// Add the expression (trimmed)
		const expr = match[1]?.trim() ?? "";
		if (expr) {
			segments.push({ type: "expression", value: expr });
		}

		lastIndex = regex.lastIndex;
		match = regex.exec(template);
	}

	// Add remaining text after last match
	if (lastIndex < template.length) {
		segments.push({
			type: "text",
			value: template.slice(lastIndex),
		});
	}

	return segments;
}

/**
 * Check if a template is a "pure binding" - just {{ expr }} with no surrounding text.
 * Pure bindings preserve their type (return object/array/number, not string).
 */
export function isPureBinding(template: string): boolean {
	const trimmed = template.trim();
	if (!trimmed.startsWith("{{") || !trimmed.endsWith("}}")) {
		return false;
	}
	// Check there's only one binding and it spans the whole string
	const segments = parseTemplate(trimmed);
	return segments.length === 1 && segments[0]?.type === "expression";
}

/**
 * Evaluate a parsed template against context.
 *
 * @param segments - Parsed template segments from parseTemplate()
 * @param context - Evaluation context
 * @returns String result with expressions interpolated
 */
export async function evaluateTemplate(
	segments: TemplateSegment[],
	context: ExpressionContext,
): Promise<string> {
	const parts = await Promise.all(
		segments.map(async (segment) => {
			if (segment.type === "text") {
				return segment.value;
			}
			// Evaluate expression
			const result = await evaluateExpression(segment.value, context);
			// undefined becomes empty string in string interpolation
			if (result === undefined || result === null) {
				return "";
			}
			// Objects/arrays get JSON stringified
			if (typeof result === "object") {
				return JSON.stringify(result);
			}
			return String(result);
		})
	);
	return parts.join("");
}

/**
 * Convenience: parse and evaluate a template in one step.
 *
 * - Pure bindings (just {{ expr }}) preserve type (return object/array/etc.)
 * - Mixed templates return string with interpolation
 * - Missing paths return undefined for pure bindings, empty string in mixed
 *
 * @example
 * await resolveTemplate('{{ task.title }}', ctx) // Returns the title string
 * await resolveTemplate('{{ tasks }}', ctx) // Returns the array (not stringified)
 * await resolveTemplate('Hello {{ name }}!', ctx) // Returns "Hello John!"
 * await resolveTemplate('{{ missing }}', ctx) // Returns undefined
 * await resolveTemplate('Value: {{ missing }}', ctx) // Returns "Value: "
 */
export async function resolveTemplate(
	template: string,
	context: ExpressionContext,
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
 * Recursively resolve all bindings in an object/array/value.
 *
 * @param value - Value to resolve (string templates, arrays, objects)
 * @param context - Evaluation context
 * @returns Resolved value with all {{ }} templates evaluated
 */
export async function resolveBindingsDeep(
	value: unknown,
	context: ExpressionContext,
): Promise<unknown> {
	if (typeof value === "string") {
		return resolveTemplate(value, context);
	}
	if (Array.isArray(value)) {
		return Promise.all(value.map((item) => resolveBindingsDeep(item, context)));
	}
	if (value && typeof value === "object") {
		const result: Record<string, unknown> = {};
		const entries = Object.entries(value);
		const resolvedEntries = await Promise.all(
			entries.map(async ([key, entry]) => [key, await resolveBindingsDeep(entry, context)] as const)
		);
		for (const [key, resolved] of resolvedEntries) {
			result[key] = resolved;
		}
		return result;
	}
	return value;
}

/**
 * Clear the expression cache.
 * Useful for testing or when memory is a concern.
 */
export function clearExpressionCache(): void {
	expressionCache.clear();
}
