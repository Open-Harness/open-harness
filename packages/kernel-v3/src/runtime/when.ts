import type { WhenExpr } from "../core/types.js";
import type { BindingContext } from "./bindings.js";

export declare function evaluateWhen(
  expr: WhenExpr | undefined,
  context: BindingContext,
): boolean;
