// Flow node registry
// Implements docs/flow/registry.md

import type { NodeTypeDefinition } from "../protocol/flow.js";

export class NodeRegistry {
	private readonly registry = new Map<
		string,
		NodeTypeDefinition<unknown, unknown>
	>();

	register<TIn, TOut>(def: NodeTypeDefinition<TIn, TOut>): void {
		this.registry.set(def.type, def as NodeTypeDefinition<unknown, unknown>);
	}

	get(type: string): NodeTypeDefinition<unknown, unknown> {
		const def = this.registry.get(type);
		if (!def) {
			throw new Error(`Unknown node type: ${type}`);
		}
		return def;
	}

	has(type: string): boolean {
		return this.registry.has(type);
	}

	list(): string[] {
		return [...this.registry.keys()];
	}
}
