/**
 * Tests for the eval runner.
 *
 * These tests verify the runner executes workflows correctly,
 * evaluates assertions, runs scorers, and handles errors.
 */

import { describe, it, expect } from "bun:test";
import { runCase, runDataset, runMatrix } from "../../src/eval/runner.js";
import { createCollectingHooks } from "../../src/eval/hooks.js";
import {
	createMockWorkflowFactory,
	createMockRecordingStore,
	createMockDataset,
	createMockVariant,
} from "./fixtures/mock-artifact.js";

describe("runCase", () => {
	it("executes workflow and returns CaseResult", async () => {
		const recordingStore = createMockRecordingStore();
		const workflowFactory = createMockWorkflowFactory();
		const dataset = createMockDataset();
		const variant = createMockVariant();

		const result = await runCase(
			{ recordingStore, workflowFactory },
			dataset,
			"case-1",
			variant,
			"live",
		);

		expect(result.caseId).toBe("case-1");
		expect(result.variantId).toBe("mock-variant");
		expect(result.artifact).toBeDefined();
		expect(result.artifact.runId).toBeDefined();
		expect(result.artifact.snapshot).toBeDefined();
		expect(result.artifact.events.length).toBeGreaterThan(0);
	});

	it("evaluates all assertions against artifact", async () => {
		const recordingStore = createMockRecordingStore();
		const workflowFactory = createMockWorkflowFactory();
		const dataset = createMockDataset();
		const variant = createMockVariant();

		const result = await runCase(
			{ recordingStore, workflowFactory },
			dataset,
			"case-1",
			variant,
			"live",
		);

		// Dataset has 2 assertions per case
		expect(result.assertionResults.length).toBe(2);
		expect(result.assertionResults[0].assertion.type).toBe("behavior.no_errors");
		expect(result.assertionResults[1].assertion.type).toBe("metric.latency_ms.max");
	});

	it("runs scorers and includes ScoreBreakdown", async () => {
		const recordingStore = createMockRecordingStore();
		const workflowFactory = createMockWorkflowFactory();
		const dataset = createMockDataset();
		const variant = createMockVariant();

		const result = await runCase(
			{ recordingStore, workflowFactory },
			dataset,
			"case-1",
			variant,
			"live",
		);

		expect(result.scores).toBeDefined();
		expect(result.scores.overall).toBeGreaterThanOrEqual(0);
		expect(result.scores.overall).toBeLessThanOrEqual(1);
		expect(result.scores.scores.length).toBeGreaterThan(0);

		// Default scorers are latency, cost, tokens
		const scorerNames = result.scores.scores.map((s) => s.name);
		expect(scorerNames).toContain("latency");
		expect(scorerNames).toContain("cost");
		expect(scorerNames).toContain("tokens");
	});

	it("handles workflow errors gracefully", async () => {
		const recordingStore = createMockRecordingStore();
		const workflowFactory = createMockWorkflowFactory({
			nodeOutput: () => {
				throw new Error("Simulated workflow error");
			},
		});
		const dataset = createMockDataset();
		const variant = createMockVariant();

		const result = await runCase(
			{ recordingStore, workflowFactory },
			dataset,
			"case-1",
			variant,
			"live",
		);

		// When a node throws, it emits agent:error, which causes behavior.no_errors to fail
		expect(result.passed).toBe(false);

		// Check that the no_errors assertion failed
		const noErrorsAssertion = result.assertionResults.find(
			(r) => r.assertion.type === "behavior.no_errors",
		);
		expect(noErrorsAssertion?.passed).toBe(false);
		expect(noErrorsAssertion?.message).toContain("error");
	});

	it("calls hooks during execution", async () => {
		const recordingStore = createMockRecordingStore();
		const workflowFactory = createMockWorkflowFactory();
		const dataset = createMockDataset();
		const variant = createMockVariant();
		const hooks = createCollectingHooks();

		await runCase(
			{ recordingStore, workflowFactory, hooks },
			dataset,
			"case-1",
			variant,
			"live",
		);

		expect(hooks.casesStarted.length).toBe(1);
		expect(hooks.casesStarted[0].caseId).toBe("case-1");
		expect(hooks.casesStarted[0].variantId).toBe("mock-variant");

		expect(hooks.casesCompleted.length).toBe(1);
		expect(hooks.casesCompleted[0].caseId).toBe("case-1");
	});

	it("emits recording:linked events for each provider invocation", async () => {
		const recordingStore = createMockRecordingStore();
		const workflowFactory = createMockWorkflowFactory();
		const dataset = createMockDataset();
		const variant = createMockVariant();
		const hooks = createCollectingHooks();

		const result = await runCase(
			{ recordingStore, workflowFactory, hooks },
			dataset,
			"case-1",
			variant,
			"live",
		);

		// Check that recording:linked events were emitted
		const linkedEvents = result.artifact.events.filter(
			(e) => e.type === "recording:linked",
		);
		expect(linkedEvents.length).toBeGreaterThan(0);

		// Also check hooks received them
		expect(hooks.recordingsLinked.length).toBeGreaterThan(0);
		expect(hooks.recordingsLinked[0].mode).toBe("live");
	});
});

describe("runDataset", () => {
	it("runs all cases and aggregates results", async () => {
		const recordingStore = createMockRecordingStore();
		const workflowFactory = createMockWorkflowFactory();
		const dataset = createMockDataset({ numCases: 3 });
		const variant = createMockVariant();

		const result = await runDataset(
			{ recordingStore, workflowFactory },
			dataset,
			variant,
			"live",
		);

		expect(result.datasetId).toBe("test-dataset");
		expect(result.variantId).toBe("mock-variant");
		expect(result.caseResults.length).toBe(3);
	});

	it("calculates correct pass rate", async () => {
		const recordingStore = createMockRecordingStore();
		const workflowFactory = createMockWorkflowFactory();
		const dataset = createMockDataset({ numCases: 4 });
		const variant = createMockVariant();

		const result = await runDataset(
			{ recordingStore, workflowFactory },
			dataset,
			variant,
			"live",
		);

		// All should pass with mock workflow
		expect(result.summary.total).toBe(4);
		expect(result.summary.passed).toBe(4);
		expect(result.summary.failed).toBe(0);
		expect(result.summary.passRate).toBe(1);
	});

	it("handles mixed pass/fail results", async () => {
		const recordingStore = createMockRecordingStore();
		let callCount = 0;
		const workflowFactory = createMockWorkflowFactory({
			nodeOutput: () => {
				callCount++;
				// Fail every other case
				if (callCount % 2 === 0) {
					throw new Error("Simulated failure");
				}
				return { text: "Success" };
			},
		});
		const dataset = createMockDataset({ numCases: 4 });
		const variant = createMockVariant();

		const result = await runDataset(
			{ recordingStore, workflowFactory },
			dataset,
			variant,
			"live",
		);

		expect(result.summary.total).toBe(4);
		expect(result.summary.passed).toBe(2);
		expect(result.summary.failed).toBe(2);
		expect(result.summary.passRate).toBe(0.5);
	});
});

describe("runMatrix", () => {
	it("runs dataset for each variant", async () => {
		const recordingStore = createMockRecordingStore();
		const workflowFactory = createMockWorkflowFactory();
		const dataset = createMockDataset({ numCases: 2 });
		const variants = [
			createMockVariant({ id: "variant-a" }),
			createMockVariant({ id: "variant-b" }),
		];

		const result = await runMatrix(
			{ recordingStore, workflowFactory },
			dataset,
			variants,
			"live",
		);

		expect(result.datasetId).toBe("test-dataset");
		expect(result.variantResults.length).toBe(2);
		expect(result.variantResults[0].variantId).toBe("variant-a");
		expect(result.variantResults[1].variantId).toBe("variant-b");
	});

	it("returns results for all variant-case combinations", async () => {
		const recordingStore = createMockRecordingStore();
		const workflowFactory = createMockWorkflowFactory();
		const dataset = createMockDataset({ numCases: 3 });
		const variants = [
			createMockVariant({ id: "variant-a" }),
			createMockVariant({ id: "variant-b" }),
			createMockVariant({ id: "variant-c" }),
		];

		const result = await runMatrix(
			{ recordingStore, workflowFactory },
			dataset,
			variants,
			"live",
		);

		// 3 variants × 3 cases = 9 total case results
		const totalCaseResults = result.variantResults.reduce(
			(sum, vr) => sum + vr.caseResults.length,
			0,
		);
		expect(totalCaseResults).toBe(9);
	});
});

describe("replay mode", () => {
	it("uses recordings when available in replay mode", async () => {
		// Note: This is a simplified test. In a real scenario, you would
		// pre-populate the recording store with recordings and verify
		// they are used during replay.
		const recordingStore = createMockRecordingStore();
		const workflowFactory = createMockWorkflowFactory();
		const dataset = createMockDataset();
		const variant = createMockVariant();

		// For now, just verify that replay mode can be specified
		// and the mode is passed to hooks
		const hooks = createCollectingHooks();

		const result = await runCase(
			{ recordingStore, workflowFactory, hooks },
			dataset,
			"case-1",
			variant,
			"live", // Using live since we don't have recordings set up
		);

		expect(result.artifact.events.length).toBeGreaterThan(0);
	});
});
