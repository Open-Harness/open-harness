import { describe, expect, it } from "bun:test";
import {
	evaluateAssertions,
	createArtifactView,
	extractMetrics,
} from "../../src/eval/assertions.js";
import type { Assertion } from "../../src/eval/types.js";
import {
	createMockArtifact,
	createSuccessfulArtifact,
	createErrorArtifact,
	createMultiNodeArtifact,
	createHighUsageArtifact,
} from "./fixtures/mock-artifact.js";

describe("eval/assertions", () => {
	describe("output.contains", () => {
		it("should pass when value is contained in output", () => {
			const artifact = createMockArtifact({
				outputs: { main: { text: "Hello world" } },
			});
			const assertion: Assertion = {
				type: "output.contains",
				path: "outputs.main.text",
				value: "world",
			};

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(true);
			expect(result!.actual).toBe("Hello world");
		});

		it("should fail when value is not contained", () => {
			const artifact = createMockArtifact({
				outputs: { main: { text: "Hello world" } },
			});
			const assertion: Assertion = {
				type: "output.contains",
				path: "outputs.main.text",
				value: "goodbye",
			};

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(false);
			expect(result!.message).toContain("contain");
		});

		it("should fail when path not found", () => {
			const artifact = createMockArtifact({ outputs: {} });
			const assertion: Assertion = {
				type: "output.contains",
				path: "outputs.missing.field",
				value: "test",
			};

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(false);
			expect(result!.message).toContain("not found");
		});
	});

	describe("output.equals", () => {
		it("should pass with exact string match", () => {
			const artifact = createMockArtifact({
				outputs: { main: { status: "success" } },
			});
			const assertion: Assertion = {
				type: "output.equals",
				path: "outputs.main.status",
				value: "success",
			};

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(true);
		});

		it("should pass with nested path", () => {
			const artifact = createMockArtifact({
				outputs: { main: { data: { nested: { value: 42 } } } },
			});
			const assertion: Assertion = {
				type: "output.equals",
				path: "outputs.main.data.nested.value",
				value: 42,
			};

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(true);
		});

		it("should fail when values differ", () => {
			const artifact = createMockArtifact({
				outputs: { main: { count: 5 } },
			});
			const assertion: Assertion = {
				type: "output.equals",
				path: "outputs.main.count",
				value: 10,
			};

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(false);
			expect(result!.actual).toBe(5);
		});

		it("should handle object comparison", () => {
			const artifact = createMockArtifact({
				outputs: { main: { obj: { a: 1, b: 2 } } },
			});
			const assertion: Assertion = {
				type: "output.equals",
				path: "outputs.main.obj",
				value: { a: 1, b: 2 },
			};

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(true);
		});
	});

	describe("metric.latency_ms.max", () => {
		it("should pass when latency is under budget", () => {
			const artifact = createSuccessfulArtifact();
			const assertion: Assertion = {
				type: "metric.latency_ms.max",
				value: 30000,
			};

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(true);
		});

		it("should fail when latency exceeds budget", () => {
			const artifact = createHighUsageArtifact(); // 45000ms
			const assertion: Assertion = {
				type: "metric.latency_ms.max",
				value: 30000,
			};

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(false);
			expect(result!.actual).toBe(45000);
			expect(result!.message).toContain("exceeds");
		});
	});

	describe("metric.total_cost_usd.max", () => {
		it("should pass when cost is under budget", () => {
			const artifact = createSuccessfulArtifact(); // $0.01
			const assertion: Assertion = {
				type: "metric.total_cost_usd.max",
				value: 1.0,
			};

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(true);
		});

		it("should fail when cost exceeds budget", () => {
			const artifact = createHighUsageArtifact(); // $2.50
			const assertion: Assertion = {
				type: "metric.total_cost_usd.max",
				value: 1.0,
			};

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(false);
			expect(result!.message).toContain("exceeds");
		});
	});

	describe("metric.tokens.input.max", () => {
		it("should pass when input tokens under budget", () => {
			const artifact = createSuccessfulArtifact(); // 200 tokens
			const assertion: Assertion = {
				type: "metric.tokens.input.max",
				value: 1000,
			};

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(true);
		});

		it("should fail when input tokens exceed budget", () => {
			const artifact = createHighUsageArtifact(); // 50000 tokens
			const assertion: Assertion = {
				type: "metric.tokens.input.max",
				value: 10000,
			};

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(false);
		});
	});

	describe("metric.tokens.output.max", () => {
		it("should pass when output tokens under budget", () => {
			const artifact = createSuccessfulArtifact(); // 100 tokens
			const assertion: Assertion = {
				type: "metric.tokens.output.max",
				value: 1000,
			};

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(true);
		});

		it("should fail when output tokens exceed budget", () => {
			const artifact = createHighUsageArtifact(); // 25000 tokens
			const assertion: Assertion = {
				type: "metric.tokens.output.max",
				value: 5000,
			};

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(false);
		});
	});

	describe("behavior.no_errors", () => {
		it("should pass when no errors occurred", () => {
			const artifact = createSuccessfulArtifact();
			const assertion: Assertion = { type: "behavior.no_errors" };

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(true);
		});

		it("should fail when errors occurred", () => {
			const artifact = createErrorArtifact("main", "Something went wrong");
			const assertion: Assertion = { type: "behavior.no_errors" };

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(false);
			expect(result!.message).toContain("error");
		});
	});

	describe("behavior.node_executed", () => {
		it("should pass when node was executed", () => {
			const artifact = createMultiNodeArtifact();
			const assertion: Assertion = {
				type: "behavior.node_executed",
				nodeId: "coder",
			};

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(true);
		});

		it("should fail when node was not executed", () => {
			const artifact = createSuccessfulArtifact();
			const assertion: Assertion = {
				type: "behavior.node_executed",
				nodeId: "nonexistent-node",
			};

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(false);
			expect(result!.message).toContain("not executed");
		});
	});

	describe("behavior.node_invocations.max", () => {
		it("should pass when invocations under limit", () => {
			const artifact = createMultiNodeArtifact();
			const assertion: Assertion = {
				type: "behavior.node_invocations.max",
				nodeId: "coder",
				value: 5,
			};

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(true);
		});

		it("should fail when invocations exceed limit", () => {
			const artifact = createMockArtifact({
				nodes: [
					{ nodeId: "retry-node", result: "try 1", durationMs: 100 },
					{ nodeId: "retry-node", result: "try 2", durationMs: 100 },
					{ nodeId: "retry-node", result: "try 3", durationMs: 100 },
				],
			});
			const assertion: Assertion = {
				type: "behavior.node_invocations.max",
				nodeId: "retry-node",
				value: 2,
			};

			const [result] = evaluateAssertions(artifact, [assertion]);

			expect(result!.passed).toBe(false);
			expect(result!.actual).toBe(3);
		});
	});

	describe("extractMetrics", () => {
		it("should aggregate metrics across multiple nodes", () => {
			const artifact = createMultiNodeArtifact();
			const metrics = extractMetrics(artifact.events);

			expect(metrics.totalDurationMs).toBe(3500); // 2000 + 1500
			expect(metrics.totalCostUsd).toBe(0.035); // 0.02 + 0.015
			expect(metrics.totalInputTokens).toBe(900); // 500 + 400
			expect(metrics.totalOutputTokens).toBe(300); // 200 + 100
		});

		it("should track metrics per node", () => {
			const artifact = createMultiNodeArtifact();
			const metrics = extractMetrics(artifact.events);

			expect(metrics.byNode.coder).toEqual({
				durationMs: 2000,
				totalCostUsd: 0.02,
				inputTokens: 500,
				outputTokens: 200,
				invocations: 1,
			});

			expect(metrics.byNode.reviewer).toEqual({
				durationMs: 1500,
				totalCostUsd: 0.015,
				inputTokens: 400,
				outputTokens: 100,
				invocations: 1,
			});
		});
	});

	describe("createArtifactView", () => {
		it("should create normalized view with outputs", () => {
			const artifact = createMockArtifact({
				outputs: { main: { text: "Hello" } },
			});

			const view = createArtifactView(artifact);

			expect(view.outputs).toEqual({ main: { text: "Hello" } });
		});

		it("should include node errors", () => {
			const artifact = createErrorArtifact("failing-node", "Error message");

			const view = createArtifactView(artifact);

			expect(view.errors.nodeErrors["failing-node"]).toContain("Error message");
		});

		it("should calculate workflow timing", () => {
			const artifact = createSuccessfulArtifact();

			const view = createArtifactView(artifact);

			expect(view.metrics.workflow.startedAt).toBeDefined();
			expect(view.metrics.workflow.endedAt).toBeDefined();
		});
	});
});
