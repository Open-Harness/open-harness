/**
 * Zod schemas for YAML dataset validation.
 */

import { z } from "zod";

// ============================================================================
// Value Matcher Schemas
// ============================================================================

const ValueMatcherSchema = z.union([
	z.object({ gte: z.number() }),
	z.object({ lte: z.number() }),
	z.object({ gt: z.number() }),
	z.object({ lt: z.number() }),
	z.object({ between: z.tuple([z.number(), z.number()]) }),
	z.object({ contains: z.string() }),
	z.object({ startsWith: z.string() }),
	z.object({ endsWith: z.string() }),
	z.object({ matches: z.string() }),
]);

// ============================================================================
// Assertion Schemas
// ============================================================================

// Signal assertions
const SignalContainsSchema = z.object({
	type: z.literal("signal.contains"),
	pattern: z.string(),
	payload: z.record(z.unknown()).optional(),
});

const SignalNotSchema = z.object({
	type: z.literal("signal.not"),
	pattern: z.string(),
});

const SignalCountSchema = z.object({
	type: z.literal("signal.count"),
	pattern: z.string(),
	min: z.number().optional(),
	max: z.number().optional(),
	exact: z.number().optional(),
});

const TrajectoryPatternSchema = z.union([
	z.string(),
	z.object({
		pattern: z.string(),
		payload: z.record(z.unknown()).optional(),
	}),
]);

const SignalTrajectorySchema = z.object({
	type: z.literal("signal.trajectory"),
	patterns: z.array(TrajectoryPatternSchema),
	strict: z.boolean().optional(),
});

const SignalFirstSchema = z.object({
	type: z.literal("signal.first"),
	pattern: z.string(),
	payload: z.record(z.unknown()).optional(),
});

const SignalLastSchema = z.object({
	type: z.literal("signal.last"),
	pattern: z.string(),
	payload: z.record(z.unknown()).optional(),
});

// Snapshot assertions
const SnapshotAtSchema = z.object({
	type: z.literal("snapshot.at"),
	afterSignal: z.string(),
	path: z.string(),
	value: z.union([z.unknown(), ValueMatcherSchema]).optional(),
	exists: z.boolean().optional(),
});

const SnapshotFinalSchema = z.object({
	type: z.literal("snapshot.final"),
	path: z.string(),
	value: z.union([z.unknown(), ValueMatcherSchema]).optional(),
	exists: z.boolean().optional(),
});

// Agent assertions
const AgentActivatedSchema = z.object({
	type: z.literal("agent.activated"),
	agentId: z.string(),
	count: z.number().optional(),
	min: z.number().optional(),
	max: z.number().optional(),
});

const AgentCompletedSchema = z.object({
	type: z.literal("agent.completed"),
	agentId: z.string(),
});

const AgentCausedBySchema = z.object({
	type: z.literal("agent.causedBy"),
	agentId: z.string(),
	triggerPattern: z.string(),
});

const AgentEmittedSchema = z.object({
	type: z.literal("agent.emitted"),
	agentId: z.string(),
	signal: z.string(),
});

const AgentSkippedSchema = z.object({
	type: z.literal("agent.skipped"),
	agentId: z.string(),
	reason: z.string().optional(),
});

// Metric assertions
const MetricLatencySchema = z.object({
	type: z.enum(["metric.latency.max", "metric.latency.min"]),
	value: z.number(),
});

const MetricCostSchema = z.object({
	type: z.enum(["metric.cost.max", "metric.cost.min"]),
	value: z.number(),
});

const MetricTokensSchema = z.object({
	type: z.enum(["metric.tokens.max", "metric.tokens.min"]),
	value: z.number(),
	field: z.enum(["input", "output", "total"]).optional(),
});

const MetricActivationsSchema = z.object({
	type: z.literal("metric.activations"),
	min: z.number().optional(),
	max: z.number().optional(),
	exact: z.number().optional(),
});

// Output assertions
const OutputContainsSchema = z.object({
	type: z.literal("output.contains"),
	text: z.string(),
	caseSensitive: z.boolean().optional(),
});

const OutputNotContainsSchema = z.object({
	type: z.literal("output.notContains"),
	text: z.string(),
	caseSensitive: z.boolean().optional(),
});

const OutputMatchesSchema = z.object({
	type: z.literal("output.matches"),
	regex: z.string(),
	flags: z.string().optional(),
});

const OutputLengthSchema = z.object({
	type: z.literal("output.length"),
	min: z.number().optional(),
	max: z.number().optional(),
});

// Note: output.json requires runtime Zod schema, not supported in YAML

// Tool assertions
const ToolCalledSchema = z.object({
	type: z.literal("tool.called"),
	name: z.string(),
	count: z.number().optional(),
	min: z.number().optional(),
	max: z.number().optional(),
});

const ToolNotCalledSchema = z.object({
	type: z.literal("tool.notCalled"),
	name: z.string(),
});

const ToolCalledWithSchema = z.object({
	type: z.literal("tool.calledWith"),
	name: z.string(),
	args: z.record(z.union([z.unknown(), ValueMatcherSchema])),
});

const ToolSequenceSchema = z.object({
	type: z.literal("tool.sequence"),
	tools: z.array(z.string()),
});

// LLM Judge
const LLMJudgeSchema = z.object({
	type: z.literal("llm.judge"),
	criteria: z.array(z.string()),
	rubric: z.string().optional(),
	minScore: z.number(),
	model: z.string().optional(),
	temperature: z.number().optional(),
});

// Lazy reference for recursive composition
const AssertionSchemaRef: z.ZodType<unknown> = z.lazy(() => AssertionSchema);

// Composition assertions
const AllSchema = z.object({
	type: z.literal("all"),
	assertions: z.array(AssertionSchemaRef),
});

const AnySchema = z.object({
	type: z.literal("any"),
	assertions: z.array(AssertionSchemaRef),
});

const NotSchema = z.object({
	type: z.literal("not"),
	assertion: AssertionSchemaRef,
});

/**
 * Complete assertion schema (union of all types).
 */
export const AssertionSchema = z.discriminatedUnion("type", [
	// Signal
	SignalContainsSchema,
	SignalNotSchema,
	SignalCountSchema,
	SignalTrajectorySchema,
	SignalFirstSchema,
	SignalLastSchema,
	// Snapshot
	SnapshotAtSchema,
	SnapshotFinalSchema,
	// Agent
	AgentActivatedSchema,
	AgentCompletedSchema,
	AgentCausedBySchema,
	AgentEmittedSchema,
	AgentSkippedSchema,
	// Metric
	MetricLatencySchema,
	MetricCostSchema,
	MetricTokensSchema,
	MetricActivationsSchema,
	// Output
	OutputContainsSchema,
	OutputNotContainsSchema,
	OutputMatchesSchema,
	OutputLengthSchema,
	// Tool
	ToolCalledSchema,
	ToolNotCalledSchema,
	ToolCalledWithSchema,
	ToolSequenceSchema,
	// LLM Judge
	LLMJudgeSchema,
	// Composition
	AllSchema,
	AnySchema,
	NotSchema,
]);

// ============================================================================
// Case & Dataset Schemas
// ============================================================================

/**
 * Eval case schema.
 */
export const EvalCaseSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	description: z.string().optional(),
	input: z.unknown(),
	assertions: z.array(AssertionSchema),
	tags: z.array(z.string()).optional(),
	timeout: z.number().optional(),
	skip: z.boolean().optional(),
	only: z.boolean().optional(),
});

/**
 * Eval dataset schema.
 */
export const EvalDatasetSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	defaultAssertions: z.array(AssertionSchema).optional(),
	defaultTimeout: z.number().optional(),
	cases: z.array(EvalCaseSchema),
	metadata: z.record(z.unknown()).optional(),
});

export type ParsedEvalDataset = z.infer<typeof EvalDatasetSchema>;
export type ParsedEvalCase = z.infer<typeof EvalCaseSchema>;
