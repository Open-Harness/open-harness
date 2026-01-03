import type { WhenExpr } from "../core/types.js";
import type { BindingContext } from "./bindings.js";
import { resolveBindingPath } from "./bindings.js";

/**
 * Evaluate a WhenExpr against a binding context.
 * @param expr - Expression to evaluate.
 * @param context - Binding context.
 * @returns True if expression passes.
 */
export function evaluateWhen(
	expr: WhenExpr | undefined,
	context: BindingContext,
): boolean {
	if (!expr) return true;

	if ("equals" in expr) {
		const resolved = resolveBindingPath(context, expr.equals.var);
		if (!resolved.found) return false;
		return isDeepEqual(resolved.value, expr.equals.value);
	}

	if ("not" in expr) {
		return !evaluateWhen(expr.not, context);
	}

	if ("and" in expr) {
		return expr.and.every((entry) => evaluateWhen(entry, context));
	}

	if ("or" in expr) {
		return expr.or.some((entry) => evaluateWhen(entry, context));
	}

	return false;
}

function isDeepEqual(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	try {
		return JSON.stringify(left) === JSON.stringify(right);
	} catch {
		return false;
	}
}
