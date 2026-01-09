// WhenExpr evaluation - supports both JSONata strings and structured AST format

import { ok } from "neverthrow";
import type { WhenExpr, WhenExprAST } from "../../state/index.js";
import type { BindingContext } from "./bindings.js";
import type { ExpressionResult } from "./errors.js";
import { type ExpressionContext, evaluateExpression, evaluateExpressionResult } from "./expressions.js";

function isDeepEqual(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	try {
		return JSON.stringify(left) === JSON.stringify(right);
	} catch {
		return false;
	}
}

/**
 * Evaluate a structured YAML AST-style when expression.
 * Uses JSONata internally for path resolution.
 */
async function evaluateWhenAST(expr: WhenExprAST, context: BindingContext): Promise<boolean> {
	if ("equals" in expr) {
		// Use JSONata to resolve the variable path
		const resolved = await evaluateExpression(expr.equals.var, context as ExpressionContext);
		if (resolved === undefined) {
			return false;
		}
		return isDeepEqual(resolved, expr.equals.value);
	}

	if ("not" in expr) {
		return !(await evaluateWhenAST(expr.not, context));
	}

	if ("and" in expr) {
		for (const item of expr.and) {
			if (!(await evaluateWhenAST(item, context))) {
				return false;
			}
		}
		return true;
	}

	if ("or" in expr) {
		for (const item of expr.or) {
			if (await evaluateWhenAST(item, context)) {
				return true;
			}
		}
		return false;
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
 *    when: "status = 'success'"
 *    when: "$exists(reviewer) and reviewer.score > 80"
 *    when: "$iteration < $maxIterations"
 *    ```
 *
 * 2. Structured AST format:
 *    ```yaml
 *    when:
 *      equals:
 *        var: status
 *        value: success
 *    ```
 *
 * @param expr - The when expression (string or structured object)
 * @param context - Binding context with node outputs and flow input
 * @returns true if the condition is satisfied, false otherwise
 */
export async function evaluateWhen(expr: WhenExpr | undefined, context: BindingContext): Promise<boolean> {
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

	// Structured AST format
	return evaluateWhenAST(expr, context);
}

/**
 * Internal Result-based AST evaluator (returns Result<boolean, ExpressionError>).
 * Used internally for error handling patterns.
 *
 * @internal
 */
async function evaluateWhenASTResult(expr: WhenExprAST, context: BindingContext): Promise<ExpressionResult<boolean>> {
	if ("equals" in expr) {
		const resolved = await evaluateExpressionResult(expr.equals.var, context as ExpressionContext);
		if (resolved.isErr()) {
			return resolved as ExpressionResult<boolean>;
		}
		if (resolved.value === undefined) {
			return ok(false);
		}
		return ok(isDeepEqual(resolved.value, expr.equals.value));
	}

	if ("not" in expr) {
		const result = await evaluateWhenASTResult(expr.not, context);
		if (result.isErr()) {
			return result;
		}
		return ok(!result.value);
	}

	if ("and" in expr) {
		for (const item of expr.and) {
			const result = await evaluateWhenASTResult(item, context);
			if (result.isErr()) {
				return result;
			}
			if (!result.value) {
				return ok(false);
			}
		}
		return ok(true);
	}

	if ("or" in expr) {
		for (const item of expr.or) {
			const result = await evaluateWhenASTResult(item, context);
			if (result.isErr()) {
				return result;
			}
			if (result.value) {
				return ok(true);
			}
		}
		return ok(false);
	}

	return ok(false);
}

/**
 * Internal Result-based when evaluator (returns Result<boolean, ExpressionError>).
 * Used internally for error handling patterns.
 *
 * @internal
 */
export async function evaluateWhenResult(
	expr: WhenExpr | undefined,
	context: BindingContext,
): Promise<ExpressionResult<boolean>> {
	// No condition = always true
	if (expr === undefined || expr === null) {
		return ok(true);
	}

	// JSONata expression string
	if (typeof expr === "string") {
		const result = await evaluateExpressionResult(expr, context as ExpressionContext);
		if (result.isErr()) {
			return result as ExpressionResult<boolean>;
		}
		// Coerce result to boolean
		return ok(Boolean(result.value));
	}

	// Structured AST format
	return evaluateWhenASTResult(expr, context);
}
