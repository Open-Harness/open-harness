import type { WhenExpr } from "../core/types.js";
import type { BindingContext } from "./bindings.js";

/**
 * Evaluate a WhenExpr against a binding context.
 * @param expr - Expression to evaluate.
 * @param context - Binding context.
 * @returns True if expression passes.
 */
export declare function evaluateWhen(
  expr: WhenExpr | undefined,
  context: BindingContext,
): boolean;
