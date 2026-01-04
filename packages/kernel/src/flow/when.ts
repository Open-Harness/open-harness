// WhenExpr evaluation - supports both JSONata expressions and YAML AST format
// Implements docs/flow/when.md

import type { WhenExpr, WhenExprAST } from "../protocol/flow.js";
import type { BindingContext } from "./bindings.js";
import { resolveBindingPath } from "./bindings.js";
import { evaluateExpression, type ExpressionContext } from "./expressions.js";

function isDeepEqual(left: unknown, right: unknown): boolean {
	if (left === right) return true;
	try {
		return JSON.stringify(left) === JSON.stringify(right);
	} catch {
		return false;
	}
}

/**
 * Evaluate a YAML AST-style when expression.
 * Used for backward compatibility with existing flows.
 */
function evaluateWhenAST(
	expr: WhenExprAST,
	context: BindingContext,
): boolean {
	if (expr.equals) {
		const resolved = resolveBindingPath(context, expr.equals.var);
		if (!resolved.found) {
			return false;
		}
		return isDeepEqual(resolved.value, expr.equals.value);
	}

	if (expr.not) {
		return !evaluateWhenAST(expr.not, context);
	}

	if (expr.and) {
		return expr.and.every((item) => evaluateWhenAST(item, context));
	}

	if (expr.or) {
		return expr.or.some((item) => evaluateWhenAST(item, context));
	}

	return false;
}

/**
 * Evaluate a when condition.
 *
 * Supports two formats:
 *
 * 1. JSONata expression string (preferred):
 *    ```yaml
 *    when: "$not(reviewer.structuredOutput.passed = true)"
 *    when: "$exists(reviewer) and reviewer.score > 80"
 *    when: "$iteration < $maxIterations"
 *    ```
 *
 * 2. YAML AST format (legacy, for backward compatibility):
 *    ```yaml
 *    when:
 *      not:
 *        equals:
 *          var: reviewer.passed
 *          value: true
 *    ```
 *
 * @param expr - The when expression (string or YAML AST object)
 * @param context - Binding context with node outputs and flow input
 * @returns true if the condition is satisfied, false otherwise
 */
export async function evaluateWhen(
	expr: WhenExpr | undefined,
	context: BindingContext,
): Promise<boolean> {
	// No condition = always true
	if (expr === undefined || expr === null) {
		return true;
	}

	// JSONata expression string
	if (typeof expr === "string") {
		const result = await evaluateExpression(expr, context as ExpressionContext);
		// Coerce result to boolean
		// undefined/null/false/"" -> false
		// everything else -> truthy check
		return Boolean(result);
	}

	// YAML AST format (legacy)
	return evaluateWhenAST(expr, context);
}

/**
 * Synchronous version for backward compatibility.
 * Only works with YAML AST format.
 *
 * @deprecated Use async evaluateWhen instead
 */
export function evaluateWhenSync(
	expr: WhenExpr | undefined,
	context: BindingContext,
): boolean {
	if (expr === undefined || expr === null) {
		return true;
	}

	if (typeof expr === "string") {
		throw new Error(
			"JSONata expression strings require async evaluation. Use evaluateWhen() instead.",
		);
	}

	return evaluateWhenAST(expr, context);
}
