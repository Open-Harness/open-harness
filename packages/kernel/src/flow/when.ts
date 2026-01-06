// WhenExpr evaluation
// Implements docs/flow/when.md

import type { WhenExpr } from "../protocol/flow.js";
import type { BindingContext } from "./bindings.js";
import { resolveBindingPath } from "./bindings.js";

function isDeepEqual(left: unknown, right: unknown): boolean {
	if (left === right) return true;
	try {
		return JSON.stringify(left) === JSON.stringify(right);
	} catch {
		return false;
	}
}

export function evaluateWhen(
	expr: WhenExpr | undefined,
	context: BindingContext,
): boolean {
	if (!expr) return true;

	if (expr.equals) {
		const resolved = resolveBindingPath(context, expr.equals.var);
		if (!resolved.found) {
			return false;
		}
		return isDeepEqual(resolved.value, expr.equals.value);
	}

	if (expr.not) {
		return !evaluateWhen(expr.not, context);
	}

	if (expr.and) {
		return expr.and.every((item) => evaluateWhen(item, context));
	}

	if (expr.or) {
		return expr.or.some((item) => evaluateWhen(item, context));
	}

	return false;
}
