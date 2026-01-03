/**
 * Flow UI Types
 *
 * Types for the ReactFlow-based flow editor.
 * Bridges kernel protocol types with ReactFlow types.
 */

import type { Edge, Node } from "@xyflow/react";

/** WebSocket connection states */
export type ConnectionStatus = "disconnected" | "connecting" | "connected";

/** Node execution states for visualization */
export type NodeExecutionState = "idle" | "running" | "complete" | "error" | "skipped";

/** Flow node data extending ReactFlow Node */
export interface FlowNodeData extends Record<string, unknown> {
	/** Node type from registry */
	nodeType: string;
	/** Display label */
	label: string;
	/** Node configuration */
	config?: Record<string, unknown>;
	/** Current execution state */
	executionState: NodeExecutionState;
	/** Last execution output (if complete) */
	lastOutput?: unknown;
	/** Last error message (if error) */
	lastError?: string;
	/** Execution duration in ms */
	durationMs?: number;
	/** Optional icon for display */
	icon?: string;
	/** Optional color for node */
	color?: string;
}

/** Custom node type for ReactFlow */
export type FlowNode = Node<FlowNodeData, "custom">;

/** Custom edge type for ReactFlow */
export interface FlowEdge extends Edge {
	/** Optional filter condition */
	filter?: string;
}

/** Hub event received via WebSocket */
export interface HubEvent {
	type: "event";
	payload: {
		id: string;
		timestamp: string;
		context: {
			sessionId: string;
			runId?: string;
			agentId?: string;
		};
		event: {
			type: string;
			[key: string]: unknown;
		};
	};
}

/** WebSocket message types */
export type WSMessage = HubEvent | { type: "ack"; command: string; message: string } | { type: "error"; error: string };

/** Node metadata from registry */
export interface NodeTypeMetadata {
	type: string;
	metadata?: {
		displayName: string;
		description?: string;
		category?: string;
		icon?: string;
		color?: string;
		ports?: Array<{
			name: string;
			type: "input" | "output";
			dataType?: string;
			description?: string;
		}>;
	};
}

/** Flow definition for save/load */
export interface FlowDefinition {
	name: string;
	description?: string;
	nodes: Array<{
		id: string;
		type: string;
		config?: Record<string, unknown>;
		position?: { x: number; y: number };
		when?: unknown;
	}>;
	edges: Array<{
		from: string;
		to: string;
		filter?: string;
	}>;
}

/** WebSocket command to send to hub */
export type WSCommand =
	| { type: "send"; message: string }
	| { type: "sendTo"; agent: string; message: string }
	| { type: "sendToRun"; runId: string; message: string }
	| { type: "reply"; promptId: string; content: string; choice?: string }
	| { type: "abort"; reason?: string };
