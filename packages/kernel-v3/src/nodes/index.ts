/**
 * Built-in node definitions.
 */

import { claudeNode, createClaudeNode } from "./claude.agent.js";
import { constantNode } from "./constant.js";
import { echoNode } from "./echo.js";

// Re-export individual nodes
export { claudeNode, createClaudeNode, constantNode, echoNode };

/**
 * All built-in nodes - registered automatically by Flow builder.
 * Use this to quickly register all standard nodes:
 *
 * @example
 * ```ts
 * const registry = new DefaultNodeRegistry();
 * builtinNodes.forEach(n => registry.register(n));
 * ```
 */
export const builtinNodes = [claudeNode, constantNode, echoNode] as const;
