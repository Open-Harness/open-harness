// Placeholder types for the planned YAML DAG workflow engine.
// This file intentionally defines only the *major abstractions* so we can
// stabilize names and boundaries before implementing.

export type WorkflowId = string;
export type NodeId = string;
export type NodeTypeId = string;

export interface WorkflowSpec {
	name: string;
	version?: number;
	description?: string;
	input?: Record<string, unknown>;
	policy?: WorkflowPolicy;
}

export interface WorkflowPolicy {
	/**
	 * If true (default), a node failure fails the workflow run.
	 * If false, the engine may continue running other nodes depending on node policies.
	 */
	failFast?: boolean;
}

export type WhenExpr =
	| {
			equals: { var: string; value: unknown };
	  }
	| {
			not: WhenExpr;
	  }
	| {
			and: WhenExpr[];
	  }
	| {
			or: WhenExpr[];
	  };

export interface RetryPolicy {
	maxAttempts: number;
	backoffMs?: number;
}

export interface NodePolicy {
	timeoutMs?: number;
	retry?: RetryPolicy;
	continueOnError?: boolean;
}

export interface NodeSpec {
	id: NodeId;
	type: NodeTypeId;
	input: Record<string, unknown>;
	config?: Record<string, unknown>;
	when?: WhenExpr;
	policy?: NodePolicy;
}

export interface Edge {
	from: NodeId;
	to: NodeId;
}

/**
 * Canonical YAML-aligned workflow definition:
 * - `workflow`: metadata + inputs + workflow policy
 * - `nodes`: node instances
 * - `edges`: explicit dependencies (required; may be empty)
 */
export interface WorkflowYaml {
	workflow: WorkflowSpec;
	nodes: NodeSpec[];
	edges: Edge[];
}

export interface NodeCapabilities {
	/** Emits streaming `agent:text` during run */
	isStreaming?: boolean;
	/** Supports receiving run-scoped injected messages */
	supportsInbox?: boolean;
	/** Long-lived session semantics (voice websocket, etc.) */
	isLongLived?: boolean;
}

