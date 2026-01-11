import type { RuntimeCommand } from "./events.js";

/**
 * Runtime state mutation operation.
 *
 * @property {"set"|"merge"} op - Patch operation.
 * @property {string} path - Path to update.
 * @property {unknown} value - Value to set/merge.
 */
export type StatePatch =
	| { op: "set"; path: string; value: unknown }
	| { op: "merge"; path: string; value: Record<string, unknown> };

/**
 * Flow state store available to node execution and runtime.
 */
export interface StateStore {
	/**
	 * Read a value by path.
	 * @param path - Path to read.
	 * @returns The stored value or undefined.
	 */
	get(path: string): unknown;
	/**
	 * Write a value by path.
	 * @param path - Path to write.
	 * @param value - Value to write.
	 */
	set(path: string, value: unknown): void;
	/**
	 * Apply a patch operation to the state.
	 * @param patch - Patch to apply.
	 */
	patch(patch: StatePatch): void;
	/**
	 * Return a full snapshot of current state.
	 * @returns Snapshot object.
	 */
	snapshot(): Record<string, unknown>;
}

// CommandInbox removed - no longer needed
// Messages are passed directly in provider input
// For multi-turn: use session IDs and multiple calls
// For HITL: use human.input node type (workflow-level)
