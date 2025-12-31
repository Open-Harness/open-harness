// Flow node packs

import type { NodeRegistry } from "./registry.js";
import { claudeNode } from "./nodes/claude.agent.js";
import { conditionEqualsNode } from "./nodes/condition.equals.js";
import { constantNode } from "./nodes/constant.js";
import { echoNode } from "./nodes/echo.js";

export interface NodePack {
	register(registry: NodeRegistry): void;
}

export const corePack: NodePack = {
	register: (registry) => {
		registry.register(echoNode);
		registry.register(constantNode);
		registry.register(conditionEqualsNode);
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
