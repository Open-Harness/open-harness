/**
 * SignalAssertion Type Definitions
 *
 * Declarative assertions for evaluating signal-based agent executions.
 * These are "assertions as data" - serializable to YAML for datasets.
 */

import type { ZodType } from "zod";

// ============================================================================
// Value Matchers
// ============================================================================

/**
 * Matchers for numeric/string comparisons in assertions.
 * Used by snapshot assertions to match values flexibly.
 */
export type ValueMatcher =
	| { gte: number }
	| { lte: number }
	| { gt: number }
	| { lt: number }
	| { between: [number, number] }
	| { contains: string }
	| { startsWith: string }
	| { endsWith: string }
	| { matches: string }; // regex pattern

// ============================================================================
// Signal Assertions
// ============================================================================

/**
 * Signal exists matching pattern.
 *
 * @example
 * ```yaml
 * - type: signal.contains
 *   pattern: "agent:*"
 *   payload:
 *     agent: reviewer
 * ```
 */
export type SignalContainsAssertion = {
	type: "signal.contains";
	/** Glob pattern (e.g., "agent:*", "tool:**") */
	pattern: string;
	/** Partial payload match */
	payload?: Record<string, unknown>;
};

/**
 * Signal does NOT exist.
 *
 * @example
 * ```yaml
 * - type: signal.not
 *   pattern: "error:*"
 * ```
 */
export type SignalNotAssertion = {
	type: "signal.not";
	pattern: string;
};

/**
 * Count signals matching pattern.
 *
 * @example
 * ```yaml
 * - type: signal.count
 *   pattern: "agent:activated"
 *   min: 2
 *   max: 5
 * ```
 */
export type SignalCountAssertion = {
	type: "signal.count";
	pattern: string;
	min?: number;
	max?: number;
	exact?: number;
};

/**
 * Signals appear in specific order - THE KILLER FEATURE.
 *
 * This enables assertions that traditional eval systems cannot do:
 * verifying that agents executed in the correct sequence.
 *
 * @example
 * ```yaml
 * - type: signal.trajectory
 *   patterns:
 *     - harness:start
 *     - { pattern: agent:activated, payload: { agent: reviewer } }
 *     - review:complete
 *     - { pattern: agent:activated, payload: { agent: fixer } }
 *     - fix:proposed
 *     - harness:end
 * ```
 */
export type SignalTrajectoryAssertion = {
	type: "signal.trajectory";
	/**
	 * Ordered patterns to match. Can be:
	 * - Simple string pattern
	 * - Object with pattern and optional payload match
	 */
	patterns: Array<string | { pattern: string; payload?: Record<string, unknown> }>;
	/**
	 * If true, no unmatched signals allowed between patterns.
	 * Default: false (other signals allowed between)
	 */
	strict?: boolean;
};

/**
 * First matching signal has expected properties.
 */
export type SignalFirstAssertion = {
	type: "signal.first";
	pattern: string;
	payload?: Record<string, unknown>;
};

/**
 * Last matching signal has expected properties.
 */
export type SignalLastAssertion = {
	type: "signal.last";
	pattern: string;
	payload?: Record<string, unknown>;
};

// ============================================================================
// Snapshot Assertions (mid-execution state inspection)
// ============================================================================

/**
 * State at point after specific signal fires.
 *
 * This enables inspecting intermediate state during execution -
 * something traditional eval systems cannot do.
 *
 * @example
 * ```yaml
 * - type: snapshot.at
 *   afterSignal: analysis:complete
 *   path: analysis.confidence
 *   value: { gte: 0.7 }
 * ```
 */
export type SnapshotAtAssertion = {
	type: "snapshot.at";
	/** Signal name to snapshot after */
	afterSignal: string;
	/** Dot notation path: "analysis.confidence" or "files[0].path" */
	path: string;
	/** Expected value or matcher */
	value?: unknown | ValueMatcher;
	/** Check existence only */
	exists?: boolean;
};

/**
 * Final state check.
 *
 * @example
 * ```yaml
 * - type: snapshot.final
 *   path: result.passed
 *   value: true
 * ```
 */
export type SnapshotFinalAssertion = {
	type: "snapshot.final";
	path: string;
	value?: unknown | ValueMatcher;
	exists?: boolean;
};

// ============================================================================
// Agent Assertions
// ============================================================================

/**
 * Agent activated N times.
 */
export type AgentActivatedAssertion = {
	type: "agent.activated";
	agentId: string;
	/** Exact count (default: >= 1) */
	count?: number;
	min?: number;
	max?: number;
};

/**
 * Agent completed successfully (no error signal).
 */
export type AgentCompletedAssertion = {
	type: "agent.completed";
	agentId: string;
};

/**
 * Agent was triggered by specific signal.
 *
 * @example
 * ```yaml
 * - type: agent.causedBy
 *   agentId: fixer
 *   triggerPattern: review:complete
 * ```
 */
export type AgentCausedByAssertion = {
	type: "agent.causedBy";
	agentId: string;
	triggerPattern: string;
};

/**
 * Agent emitted specific signal.
 */
export type AgentEmittedAssertion = {
	type: "agent.emitted";
	agentId: string;
	signal: string;
};

/**
 * Agent skipped (when guard returned false).
 */
export type AgentSkippedAssertion = {
	type: "agent.skipped";
	agentId: string;
	reason?: string;
};

// ============================================================================
// Metric Assertions
// ============================================================================

export type MetricLatencyAssertion = {
	type: "metric.latency.max" | "metric.latency.min";
	/** Milliseconds */
	value: number;
};

export type MetricCostAssertion = {
	type: "metric.cost.max" | "metric.cost.min";
	/** USD */
	value: number;
};

export type MetricTokensAssertion = {
	type: "metric.tokens.max" | "metric.tokens.min";
	value: number;
	/** Default: total */
	field?: "input" | "output" | "total";
};

export type MetricActivationsAssertion = {
	type: "metric.activations";
	min?: number;
	max?: number;
	exact?: number;
};

// ============================================================================
// Output Assertions
// ============================================================================

export type OutputContainsAssertion = {
	type: "output.contains";
	text: string;
	/** Default: true */
	caseSensitive?: boolean;
};

export type OutputNotContainsAssertion = {
	type: "output.notContains";
	text: string;
	caseSensitive?: boolean;
};

export type OutputMatchesAssertion = {
	type: "output.matches";
	regex: string;
	flags?: string;
};

export type OutputJsonAssertion = {
	type: "output.json";
	/** Runtime Zod schema (not serializable to YAML) */
	schema: ZodType;
};

export type OutputLengthAssertion = {
	type: "output.length";
	min?: number;
	max?: number;
};

// ============================================================================
// Tool Assertions (for coding agents)
// ============================================================================

/**
 * Tool was called.
 */
export type ToolCalledAssertion = {
	type: "tool.called";
	name: string;
	count?: number;
	min?: number;
	max?: number;
};

/**
 * Tool was NOT called.
 */
export type ToolNotCalledAssertion = {
	type: "tool.notCalled";
	name: string;
};

/**
 * Tool was called with specific arguments.
 *
 * @example
 * ```yaml
 * - type: tool.calledWith
 *   name: Write
 *   args:
 *     file_path:
 *       endsWith: "utils.ts"
 * ```
 */
export type ToolCalledWithAssertion = {
	type: "tool.calledWith";
	name: string;
	/** Partial match - can use ValueMatcher for fields */
	args: Record<string, unknown | ValueMatcher>;
};

/**
 * Tools called in specific order.
 *
 * @example
 * ```yaml
 * - type: tool.sequence
 *   tools:
 *     - Read
 *     - Edit
 *     - Bash
 * ```
 */
export type ToolSequenceAssertion = {
	type: "tool.sequence";
	tools: string[];
};

// ============================================================================
// LLM-as-Judge
// ============================================================================

/**
 * Use LLM to evaluate output quality.
 *
 * @example
 * ```yaml
 * - type: llm.judge
 *   criteria:
 *     - Code is syntactically correct
 *     - Handles edge cases
 *   minScore: 0.8
 * ```
 */
export type LLMJudgeAssertion = {
	type: "llm.judge";
	/** What to evaluate */
	criteria: string[];
	/** Detailed grading instructions */
	rubric?: string;
	/** 0-1 threshold to pass */
	minScore: number;
	/** Judge model (default: claude-sonnet-4-20250514) */
	model?: string;
	/** Default: 0 */
	temperature?: number;
};

// ============================================================================
// Composition
// ============================================================================

/**
 * All nested assertions must pass.
 */
export type AllAssertion = {
	type: "all";
	assertions: SignalAssertion[];
};

/**
 * At least one nested assertion must pass.
 */
export type AnyAssertion = {
	type: "any";
	assertions: SignalAssertion[];
};

/**
 * Nested assertion must NOT pass.
 */
export type NotAssertion = {
	type: "not";
	assertion: SignalAssertion;
};

// ============================================================================
// Union Type
// ============================================================================

/**
 * All assertion types supported by the eval system.
 */
export type SignalAssertion =
	// Signal
	| SignalContainsAssertion
	| SignalNotAssertion
	| SignalCountAssertion
	| SignalTrajectoryAssertion
	| SignalFirstAssertion
	| SignalLastAssertion
	// Snapshot
	| SnapshotAtAssertion
	| SnapshotFinalAssertion
	// Agent
	| AgentActivatedAssertion
	| AgentCompletedAssertion
	| AgentCausedByAssertion
	| AgentEmittedAssertion
	| AgentSkippedAssertion
	// Metric
	| MetricLatencyAssertion
	| MetricCostAssertion
	| MetricTokensAssertion
	| MetricActivationsAssertion
	// Output
	| OutputContainsAssertion
	| OutputNotContainsAssertion
	| OutputMatchesAssertion
	| OutputJsonAssertion
	| OutputLengthAssertion
	// Tool
	| ToolCalledAssertion
	| ToolNotCalledAssertion
	| ToolCalledWithAssertion
	| ToolSequenceAssertion
	// LLM Judge
	| LLMJudgeAssertion
	// Composition
	| AllAssertion
	| AnyAssertion
	| NotAssertion;
