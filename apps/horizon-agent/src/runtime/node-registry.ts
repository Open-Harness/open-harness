/**
 * Node Registry Setup for Horizon Agent
 *
 * Registers kernel built-in nodes for the planner/coder/reviewer workflow.
 */

import { claudeNode, constantNode, DefaultNodeRegistry, echoNode, type NodeRegistry } from "@open-harness/kernel";

/**
 * Create a node registry with all nodes required for Horizon Agent.
 *
 * Includes:
 * - claude.agent: Multi-turn Claude agent for planner/coder/reviewer
 * - constant: Static value node
 * - echo: Echo input for debugging
 */
export function createHorizonRegistry(): NodeRegistry {
	const registry = new DefaultNodeRegistry();

	// Core Claude node for AI agents
	registry.register(claudeNode);

	// Utility nodes
	registry.register(constantNode);
	registry.register(echoNode);

	return registry;
}
