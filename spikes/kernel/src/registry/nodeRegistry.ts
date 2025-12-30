import type { NodeTypeId } from "../workflow/types.js";
import type { NodeTypeDefinition } from "./nodeTypes.js";

/**
 * Planned NodeRegistry.
 *
 * MVP: a simple in-memory registry.
 * Later: plugin loading, namespacing, capability queries, schema export for UI.
 */
export class NodeRegistry {
	private readonly byType = new Map<NodeTypeId, NodeTypeDefinition<any, any>>();

	register<TIn, TOut>(def: NodeTypeDefinition<TIn, TOut>): void {
		if (this.byType.has(def.type)) {
			throw new Error(`Node type already registered: ${def.type}`);
		}
		this.byType.set(def.type, def as NodeTypeDefinition<any, any>);
	}

	get(type: NodeTypeId): NodeTypeDefinition<any, any> {
		const found = this.byType.get(type);
		if (!found) throw new Error(`Unknown node type: ${type}`);
		return found;
	}
}

