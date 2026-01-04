// Flow node packs

import {
	claudeNode,
	conditionEqualsNode,
	constantNode,
	controlForeachNode,
	echoNode,
} from "./nodes/index.js";
import type { NodeRegistry } from "./registry.js";

export interface NodePack {
	register(registry: NodeRegistry): void;
}

export const corePack: NodePack = {
	register: (registry) => {
		registry.register(echoNode);
		registry.register(constantNode);
		registry.register(conditionEqualsNode);
		registry.register(controlForeachNode);
	},
};

export const claudePack: NodePack = {
	register: (registry) => {
		registry.register(claudeNode);
	},
};

export function registerNodePacks(
	registry: NodeRegistry,
	packs: NodePack[],
): void {
	for (const pack of packs) {
		pack.register(registry);
	}
}
