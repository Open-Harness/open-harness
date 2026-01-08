/**
 * Tests for the DX layer (defineSuite, variant, gates, runSuite).
 *
 * These tests verify the ergonomic API works correctly on top of
 * the Phase 7 primitives (EvalEngine, runMatrix, etc.).
 */

import { describe, it, expect } from "bun:test";
import {
	defineSuite,
	variant,
	gates,
	runSuite,
} from "../../src/eval/dx.js";
import type { SuiteConfig, SuiteWorkflowFactory, VariantDef } from "../../src/eval/dx-types.js";
import type { NodeRegistry, NodeTypeDefinition } from "../../src/nodes/index.js";
import type { FlowDefinition } from "../../src/state/index.js";

// ============================================================================
// Test fixtures
// ============================================================================

/**
 * Create a simple workflow factory for testing.
 */
function createTestWorkflowFactory(): SuiteWorkflowFactory {
	return ({ caseId, caseInput, variant: v }) => ({
		flow: {
			name: "test-workflow",
			nodes: [
				{
					id: "main",
					type: "mock",
					input: caseInput,
				},
			],
			edges: [],
		} satisfies FlowDefinition,
		register(registry: NodeRegistry, mode) {
			const mockNodeDef: NodeTypeDefinition<Record<string, unknown>, Record<string, unknown>> = {
				type: "mock",
				async run(ctx, input) {
					// Emit agent events for metrics
					ctx.emit({
						type: "agent:start",
						nodeId: ctx.nodeId,
						runId: ctx.runId,
						sessionId: `session-${ctx.nodeId}`,
						prompt: "test",
					});

					ctx.emit({
						type: "agent:complete",
						nodeId: ctx.nodeId,
						runId: ctx.runId,
						result: `Result for ${caseId}`,
						usage: { inputTokens: 100, outputTokens: 50 },
						totalCostUsd: 0.001,
						durationMs: 1000,
						numTurns: 1,
					});

					return { text: `Result for ${caseId}` };
				},
			};
			registry.register(mockNodeDef);
		},
		primaryOutputNodeId: "main",
	});
}

/**
 * Create a workflow factory that can be configured to fail specific cases.
 */
function createConfigurableWorkflowFactory(options?: {
	failingCases?: string[];
	latencyMs?: number;
	costUsd?: number;
}): SuiteWorkflowFactory {
	return ({ caseId, caseInput, variant: v }) => ({
		flow: {
			name: "test-workflow",
			nodes: [{ id: "main", type: "mock", input: caseInput }],
			edges: [],
		} satisfies FlowDefinition,
		register(registry: NodeRegistry, mode) {
			const mockNodeDef: NodeTypeDefinition<Record<string, unknown>, Record<string, unknown>> = {
				type: "mock",
				async run(ctx, input) {
					ctx.emit({
						type: "agent:start",
						nodeId: ctx.nodeId,
						runId: ctx.runId,
						sessionId: `session-${ctx.nodeId}`,
						prompt: "test",
					});

					if (options?.failingCases?.includes(caseId)) {
						ctx.emit({
							type: "agent:error",
							nodeId: ctx.nodeId,
							runId: ctx.runId,
							errorType: "ExecutionError",
							message: `Simulated failure for ${caseId}`,
						});
						throw new Error(`Simulated failure for ${caseId}`);
					}

					ctx.emit({
						type: "agent:complete",
						nodeId: ctx.nodeId,
						runId: ctx.runId,
						result: `Result for ${caseId}`,
						usage: { inputTokens: 100, outputTokens: 50 },
						totalCostUsd: options?.costUsd ?? 0.001,
						durationMs: options?.latencyMs ?? 1000,
						numTurns: 1,
					});

					return { text: `Result for ${caseId}` };
				},
			};
			registry.register(mockNodeDef);
		},
		primaryOutputNodeId: "main",
	});
}

// ============================================================================
// defineSuite tests
// ============================================================================

describe("defineSuite", () => {
	it("creates a validated suite from config", () => {
		const suite = defineSuite({
			name: "test-suite",
			flow: createTestWorkflowFactory(),
			cases: [{ id: "case-1", input: { task: "test" } }],
			variants: [variant("baseline", { model: "test-model" })],
		});

		expect(suite.validated).toBe(true);
		expect(suite.config.name).toBe("test-suite");
		expect(suite.config.cases.length).toBe(1);
		expect(suite.config.variants.length).toBe(1);
	});

	it("throws on missing name", () => {
		expect(() =>
			defineSuite({
				name: "",
				flow: createTestWorkflowFactory(),
				cases: [{ id: "case-1", input: {} }],
				variants: [variant("baseline")],
			}),
		).toThrow("Suite name is required");
	});

	it("throws on missing flow", () => {
		expect(() =>
			defineSuite({
				name: "test-suite",
				flow: undefined as unknown as SuiteWorkflowFactory,
				cases: [{ id: "case-1", input: {} }],
				variants: [variant("baseline")],
			}),
		).toThrow("Suite flow factory is required");
	});

	it("throws on empty cases", () => {
		expect(() =>
			defineSuite({
				name: "test-suite",
				flow: createTestWorkflowFactory(),
				cases: [],
				variants: [variant("baseline")],
			}),
		).toThrow("Suite must have at least one case");
	});

	it("throws on empty variants", () => {
		expect(() =>
			defineSuite({
				name: "test-suite",
				flow: createTestWorkflowFactory(),
				cases: [{ id: "case-1", input: {} }],
				variants: [],
			}),
		).toThrow("Suite must have at least one variant");
	});

	it("throws on duplicate case IDs", () => {
		expect(() =>
			defineSuite({
				name: "test-suite",
				flow: createTestWorkflowFactory(),
				cases: [
					{ id: "case-1", input: {} },
					{ id: "case-1", input: {} },
				],
				variants: [variant("baseline")],
			}),
		).toThrow("Duplicate case ID: case-1");
	});

	it("throws on duplicate variant IDs", () => {
		expect(() =>
			defineSuite({
				name: "test-suite",
				flow: createTestWorkflowFactory(),
				cases: [{ id: "case-1", input: {} }],
				variants: [variant("baseline"), variant("baseline")],
			}),
		).toThrow("Duplicate variant ID: baseline");
	});

	it("throws when baseline variant not found", () => {
		expect(() =>
			defineSuite({
				name: "test-suite",
				flow: createTestWorkflowFactory(),
				cases: [{ id: "case-1", input: {} }],
				variants: [variant("baseline")],
				baseline: "nonexistent",
			}),
		).toThrow('Baseline variant "nonexistent" not found');
	});

	it("accepts valid baseline variant", () => {
		const suite = defineSuite({
			name: "test-suite",
			flow: createTestWorkflowFactory(),
			cases: [{ id: "case-1", input: {} }],
			variants: [variant("baseline"), variant("candidate")],
			baseline: "baseline",
		});

		expect(suite.config.baseline).toBe("baseline");
	});
});

// ============================================================================
// variant tests
// ============================================================================

describe("variant", () => {
	it("creates a variant with just an ID", () => {
		const v = variant("my-variant");

		expect(v.id).toBe("my-variant");
		expect(v.model).toBeUndefined();
		expect(v.modelByNode).toBeUndefined();
	});

	it("creates a variant with model", () => {
		const v = variant("claude/sonnet", { model: "claude-3-5-sonnet-latest" });

		expect(v.id).toBe("claude/sonnet");
		expect(v.model).toBe("claude-3-5-sonnet-latest");
	});

	it("creates a variant with per-node models", () => {
		const v = variant("mixed", {
			modelByNode: {
				coder: "claude-3-5-sonnet-latest",
				reviewer: "claude-3-opus-latest",
			},
		});

		expect(v.id).toBe("mixed");
		expect(v.modelByNode?.coder).toBe("claude-3-5-sonnet-latest");
		expect(v.modelByNode?.reviewer).toBe("claude-3-opus-latest");
	});

	it("creates a variant with tags", () => {
		const v = variant("baseline", { tags: ["baseline", "production"] });

		expect(v.tags).toEqual(["baseline", "production"]);
	});

	it("creates a variant with custom config", () => {
		const v = variant("custom", {
			config: { temperature: 0.7, maxTokens: 1000 },
		});

		expect(v.config).toEqual({ temperature: 0.7, maxTokens: 1000 });
	});
});

// ============================================================================
// gates tests
// ============================================================================

describe("gates.noRegressions", () => {
	it("passes when no comparison available", () => {
		const gate = gates.noRegressions();
		const result = gate.evaluate({
			datasetId: "test",
			variantResults: [],
		});

		expect(result.passed).toBe(true);
		expect(result.message).toBe("No baseline comparison available");
	});

	it("passes when no regressions", () => {
		const gate = gates.noRegressions();
		const result = gate.evaluate({
			datasetId: "test",
			variantResults: [],
			comparison: {
				baselineVariantId: "baseline",
				regressions: [],
				improvements: [],
			},
		});

		expect(result.passed).toBe(true);
		expect(result.message).toBe("No regressions detected");
	});

	it("fails when regressions exist", () => {
		const gate = gates.noRegressions();
		const result = gate.evaluate({
			datasetId: "test",
			variantResults: [],
			comparison: {
				baselineVariantId: "baseline",
				regressions: [
					{
						caseId: "case-1",
						variantId: "candidate",
						type: "assertion",
						description: "behavior.no_errors failed",
						baseline: true,
						current: false,
					},
				],
				improvements: [],
			},
		});

		expect(result.passed).toBe(false);
		expect(result.message).toBe("1 regression(s) detected");
	});

	it("allows metric regressions when configured", () => {
		const gate = gates.noRegressions({ allowMetricRegressions: true });
		const result = gate.evaluate({
			datasetId: "test",
			variantResults: [],
			comparison: {
				baselineVariantId: "baseline",
				regressions: [
					{
						caseId: "case-1",
						variantId: "candidate",
						type: "metric", // Metric regression, not assertion
						description: "Latency increased 30%",
						baseline: 1000,
						current: 1300,
					},
				],
				improvements: [],
			},
		});

		expect(result.passed).toBe(true);
	});
});

describe("gates.passRate", () => {
	it("passes when pass rate meets threshold", () => {
		const gate = gates.passRate(0.8);
		const result = gate.evaluate({
			datasetId: "test",
			variantResults: [
				{
					datasetId: "test",
					variantId: "variant-1",
					caseResults: [],
					summary: { total: 10, passed: 9, failed: 1, passRate: 0.9 },
				},
			],
		});

		expect(result.passed).toBe(true);
		expect(result.message).toContain("90.0%");
	});

	it("fails when pass rate below threshold", () => {
		const gate = gates.passRate(0.9);
		const result = gate.evaluate({
			datasetId: "test",
			variantResults: [
				{
					datasetId: "test",
					variantId: "variant-1",
					caseResults: [],
					summary: { total: 10, passed: 7, failed: 3, passRate: 0.7 },
				},
			],
		});

		expect(result.passed).toBe(false);
		expect(result.message).toContain("70.0%");
		expect(result.message).toContain("< 90%");
	});

	it("checks per-variant when configured", () => {
		const gate = gates.passRate(0.8, { perVariant: true });
		const result = gate.evaluate({
			datasetId: "test",
			variantResults: [
				{
					datasetId: "test",
					variantId: "variant-good",
					caseResults: [],
					summary: { total: 10, passed: 9, failed: 1, passRate: 0.9 },
				},
				{
					datasetId: "test",
					variantId: "variant-bad",
					caseResults: [],
					summary: { total: 10, passed: 6, failed: 4, passRate: 0.6 },
				},
			],
		});

		expect(result.passed).toBe(false);
		expect(result.message).toContain("variant-bad");
	});

	it("throws on invalid threshold", () => {
		expect(() => gates.passRate(-0.1)).toThrow("between 0 and 1");
		expect(() => gates.passRate(1.1)).toThrow("between 0 and 1");
	});
});

describe("gates.latencyUnder", () => {
	it("passes when latency under threshold", () => {
		const gate = gates.latencyUnder(5000);
		const result = gate.evaluate({
			datasetId: "test",
			variantResults: [
				{
					datasetId: "test",
					variantId: "variant-1",
					caseResults: [
						{
							caseId: "case-1",
							variantId: "variant-1",
							artifact: { runId: "run-1", snapshot: {} as any, events: [] },
							assertionResults: [],
							scores: {
								overall: 0.9,
								scores: [{ name: "latency", value: 0.9, rawValue: 1000 }],
							},
							passed: true,
						},
					],
					summary: { total: 1, passed: 1, failed: 0, passRate: 1 },
				},
			],
		});

		expect(result.passed).toBe(true);
		expect(result.message).toContain("1000ms < 5000ms");
	});

	it("fails when latency exceeds threshold", () => {
		const gate = gates.latencyUnder(5000);
		const result = gate.evaluate({
			datasetId: "test",
			variantResults: [
				{
					datasetId: "test",
					variantId: "variant-1",
					caseResults: [
						{
							caseId: "slow-case",
							variantId: "variant-1",
							artifact: { runId: "run-1", snapshot: {} as any, events: [] },
							assertionResults: [],
							scores: {
								overall: 0.5,
								scores: [{ name: "latency", value: 0.5, rawValue: 10000 }],
							},
							passed: true,
						},
					],
					summary: { total: 1, passed: 1, failed: 0, passRate: 1 },
				},
			],
		});

		expect(result.passed).toBe(false);
		expect(result.message).toContain("10000ms >= 5000ms");
		expect(result.message).toContain("slow-case");
	});
});

describe("gates.costUnder", () => {
	it("passes when cost under threshold", () => {
		const gate = gates.costUnder(1.0);
		const result = gate.evaluate({
			datasetId: "test",
			variantResults: [
				{
					datasetId: "test",
					variantId: "variant-1",
					caseResults: [
						{
							caseId: "case-1",
							variantId: "variant-1",
							artifact: { runId: "run-1", snapshot: {} as any, events: [] },
							assertionResults: [],
							scores: {
								overall: 0.9,
								scores: [{ name: "cost", value: 0.9, rawValue: 0.5 }],
							},
							passed: true,
						},
					],
					summary: { total: 1, passed: 1, failed: 0, passRate: 1 },
				},
			],
		});

		expect(result.passed).toBe(true);
	});

	it("fails when cost exceeds threshold", () => {
		const gate = gates.costUnder(1.0);
		const result = gate.evaluate({
			datasetId: "test",
			variantResults: [
				{
					datasetId: "test",
					variantId: "variant-1",
					caseResults: [
						{
							caseId: "expensive-case",
							variantId: "variant-1",
							artifact: { runId: "run-1", snapshot: {} as any, events: [] },
							assertionResults: [],
							scores: {
								overall: 0.5,
								scores: [{ name: "cost", value: 0.5, rawValue: 2.5 }],
							},
							passed: true,
						},
					],
					summary: { total: 1, passed: 1, failed: 0, passRate: 1 },
				},
			],
		});

		expect(result.passed).toBe(false);
		expect(result.message).toContain("$2.5");
		expect(result.message).toContain("expensive-case");
	});
});

describe("gates.requiredCases", () => {
	it("passes when all required cases pass", () => {
		const gate = gates.requiredCases(["important-1", "important-2"]);
		const result = gate.evaluate({
			datasetId: "test",
			variantResults: [
				{
					datasetId: "test",
					variantId: "variant-1",
					caseResults: [
						{
							caseId: "important-1",
							variantId: "variant-1",
							artifact: { runId: "run-1", snapshot: {} as any, events: [] },
							assertionResults: [],
							scores: { overall: 0.9, scores: [] },
							passed: true,
						},
						{
							caseId: "important-2",
							variantId: "variant-1",
							artifact: { runId: "run-2", snapshot: {} as any, events: [] },
							assertionResults: [],
							scores: { overall: 0.9, scores: [] },
							passed: true,
						},
					],
					summary: { total: 2, passed: 2, failed: 0, passRate: 1 },
				},
			],
		});

		expect(result.passed).toBe(true);
	});

	it("fails when required case fails", () => {
		const gate = gates.requiredCases(["important-1"]);
		const result = gate.evaluate({
			datasetId: "test",
			variantResults: [
				{
					datasetId: "test",
					variantId: "variant-1",
					caseResults: [
						{
							caseId: "important-1",
							variantId: "variant-1",
							artifact: { runId: "run-1", snapshot: {} as any, events: [] },
							assertionResults: [],
							scores: { overall: 0.2, scores: [] },
							passed: false,
						},
					],
					summary: { total: 1, passed: 0, failed: 1, passRate: 0 },
				},
			],
		});

		expect(result.passed).toBe(false);
		expect(result.message).toContain("important-1");
	});
});

describe("gates.custom", () => {
	it("allows custom gate logic", () => {
		const gate = gates.custom(
			"custom-gate",
			"Custom validation",
			(result) => ({
				passed: result.variantResults.length > 0,
				message: "Custom check passed",
			}),
		);

		const result = gate.evaluate({
			datasetId: "test",
			variantResults: [
				{
					datasetId: "test",
					variantId: "v1",
					caseResults: [],
					summary: { total: 0, passed: 0, failed: 0, passRate: 0 },
				},
			],
		});

		expect(result.name).toBe("custom-gate");
		expect(result.passed).toBe(true);
	});
});

// ============================================================================
// runSuite tests
// ============================================================================

describe("runSuite", () => {
	it("runs suite and returns report", async () => {
		const suite = defineSuite({
			name: "test-suite",
			flow: createTestWorkflowFactory(),
			cases: [
				{ id: "case-1", input: { task: "test 1" } },
				{ id: "case-2", input: { task: "test 2" } },
			],
			variants: [variant("baseline")],
		});

		const report = await runSuite(suite, { mode: "live" });

		expect(report.suiteName).toBe("test-suite");
		expect(report.matrixResult.datasetId).toBe("test-suite");
		expect(report.matrixResult.variantResults.length).toBe(1);
		expect(report.matrixResult.variantResults[0].caseResults.length).toBe(2);
	});

	it("evaluates gates and sets overall pass/fail", async () => {
		const suite = defineSuite({
			name: "test-suite",
			flow: createTestWorkflowFactory(),
			cases: [{ id: "case-1", input: { task: "test" } }],
			variants: [variant("baseline")],
			gates: [gates.passRate(0.5)],
		});

		const report = await runSuite(suite, { mode: "live" });

		expect(report.gateResults.length).toBe(1);
		expect(report.gateResults[0].name).toBe("pass-rate");
		expect(report.passed).toBe(true);
	});

	it("fails when gates fail", async () => {
		const suite = defineSuite({
			name: "test-suite",
			flow: createConfigurableWorkflowFactory({ failingCases: ["case-1", "case-2"] }),
			cases: [
				{ id: "case-1", input: { task: "test 1" }, assertions: [{ type: "behavior.no_errors" }] },
				{ id: "case-2", input: { task: "test 2" }, assertions: [{ type: "behavior.no_errors" }] },
			],
			variants: [variant("baseline")],
			gates: [gates.passRate(0.9)],
		});

		const report = await runSuite(suite, { mode: "live" });

		expect(report.passed).toBe(false);
		expect(report.gateResults[0].passed).toBe(false);
	});

	it("calculates summary statistics correctly", async () => {
		const suite = defineSuite({
			name: "test-suite",
			flow: createConfigurableWorkflowFactory({ failingCases: ["case-2"] }),
			cases: [
				{ id: "case-1", input: { task: "test 1" } },
				{ id: "case-2", input: { task: "test 2" } },
				{ id: "case-3", input: { task: "test 3" } },
			],
			variants: [variant("baseline")],
			gates: [gates.passRate(0.5)],
			defaultAssertions: [{ type: "behavior.no_errors" }],
		});

		const report = await runSuite(suite, { mode: "live" });

		expect(report.summary.totalCases).toBe(3);
		expect(report.summary.passedCases).toBe(2);
		expect(report.summary.failedCases).toBe(1);
		expect(report.summary.passRate).toBeCloseTo(2 / 3, 2);
		expect(report.summary.gatesPassed).toBe(1);
		expect(report.summary.totalGates).toBe(1);
	});

	it("filters cases by ID", async () => {
		const suite = defineSuite({
			name: "test-suite",
			flow: createTestWorkflowFactory(),
			cases: [
				{ id: "case-1", input: { task: "test 1" } },
				{ id: "case-2", input: { task: "test 2" } },
				{ id: "case-3", input: { task: "test 3" } },
			],
			variants: [variant("baseline")],
		});

		const report = await runSuite(suite, {
			mode: "live",
			filterCases: ["case-1", "case-3"],
		});

		expect(report.matrixResult.variantResults[0].caseResults.length).toBe(2);
		const caseIds = report.matrixResult.variantResults[0].caseResults.map((c) => c.caseId);
		expect(caseIds).toContain("case-1");
		expect(caseIds).toContain("case-3");
		expect(caseIds).not.toContain("case-2");
	});

	it("filters cases by tag", async () => {
		const suite = defineSuite({
			name: "test-suite",
			flow: createTestWorkflowFactory(),
			cases: [
				{ id: "case-1", input: { task: "test 1" }, tags: ["smoke"] },
				{ id: "case-2", input: { task: "test 2" }, tags: ["regression"] },
				{ id: "case-3", input: { task: "test 3" }, tags: ["smoke", "regression"] },
			],
			variants: [variant("baseline")],
		});

		const report = await runSuite(suite, {
			mode: "live",
			filterTags: ["smoke"],
		});

		expect(report.matrixResult.variantResults[0].caseResults.length).toBe(2);
		const caseIds = report.matrixResult.variantResults[0].caseResults.map((c) => c.caseId);
		expect(caseIds).toContain("case-1");
		expect(caseIds).toContain("case-3");
	});

	it("applies default assertions to all cases", async () => {
		const suite = defineSuite({
			name: "test-suite",
			flow: createTestWorkflowFactory(),
			cases: [
				{ id: "case-1", input: { task: "test" } },
			],
			variants: [variant("baseline")],
			defaultAssertions: [
				{ type: "behavior.no_errors" },
				{ type: "metric.latency_ms.max", value: 30000 },
			],
		});

		const report = await runSuite(suite, { mode: "live" });

		// Default assertions should be evaluated
		const assertions = report.matrixResult.variantResults[0].caseResults[0].assertionResults;
		expect(assertions.length).toBeGreaterThanOrEqual(2);
	});

	it("runs multiple variants", async () => {
		const suite = defineSuite({
			name: "test-suite",
			flow: createTestWorkflowFactory(),
			cases: [{ id: "case-1", input: { task: "test" } }],
			variants: [
				variant("variant-a", { model: "model-a" }),
				variant("variant-b", { model: "model-b" }),
			],
		});

		const report = await runSuite(suite, { mode: "live" });

		expect(report.matrixResult.variantResults.length).toBe(2);
		expect(report.matrixResult.variantResults[0].variantId).toBe("variant-a");
		expect(report.matrixResult.variantResults[1].variantId).toBe("variant-b");
	});

	it("performs baseline comparison when specified", async () => {
		const suite = defineSuite({
			name: "test-suite",
			flow: createTestWorkflowFactory(),
			cases: [{ id: "case-1", input: { task: "test" } }],
			variants: [variant("baseline"), variant("candidate")],
			baseline: "baseline",
		});

		const report = await runSuite(suite, { mode: "live" });

		expect(report.matrixResult.comparison).toBeDefined();
		expect(report.matrixResult.comparison?.baselineVariantId).toBe("baseline");
	});

	it("allows overriding baseline at runtime", async () => {
		const suite = defineSuite({
			name: "test-suite",
			flow: createTestWorkflowFactory(),
			cases: [{ id: "case-1", input: { task: "test" } }],
			variants: [variant("v1"), variant("v2")],
			baseline: "v1",
		});

		const report = await runSuite(suite, {
			mode: "live",
			baseline: "v2", // Override to v2
		});

		expect(report.matrixResult.comparison?.baselineVariantId).toBe("v2");
	});
});

// ============================================================================
// Integration tests
// ============================================================================

describe("DX layer integration", () => {
	it("complete workflow: define, run, evaluate", async () => {
		// Define a suite with multiple cases and gates
		const suite = defineSuite({
			name: "integration-test",
			version: "1.0.0",
			flow: createConfigurableWorkflowFactory({ failingCases: ["flaky-case"] }),
			cases: [
				{ id: "smoke-test", input: { task: "smoke" }, tags: ["smoke"] },
				{ id: "regression-test", input: { task: "regression" }, tags: ["regression"] },
				{ id: "flaky-case", input: { task: "flaky" }, tags: ["regression"] },
			],
			variants: [
				variant("baseline", { model: "model-1", tags: ["baseline"] }),
				variant("candidate", { model: "model-2", tags: ["candidate"] }),
			],
			baseline: "baseline",
			defaultAssertions: [
				{ type: "behavior.no_errors" },
			],
			gates: [
				gates.passRate(0.5),
				gates.noRegressions({ allowMetricRegressions: true }),
			],
		});

		// Run the suite
		const report = await runSuite(suite, { mode: "live" });

		// Verify results
		expect(report.suiteName).toBe("integration-test");
		expect(report.matrixResult.variantResults.length).toBe(2);
		expect(report.summary.totalCases).toBe(6); // 3 cases x 2 variants

		// Check gate results
		expect(report.gateResults.length).toBe(2);
		const passRateGate = report.gateResults.find((g) => g.name === "pass-rate");
		expect(passRateGate?.passed).toBe(true); // 4/6 > 0.5
	});
});
