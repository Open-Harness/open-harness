import { describe, expect, it } from "bun:test";
import {
	generateRecordingId,
	parseRecordingId,
	type EvalDataset,
	type EvalCase,
	type EvalVariant,
	type EvalArtifact,
	type Assertion,
} from "../../src/eval/types.js";
import type { RecordingLinkedEvent } from "../../src/state/events.js";

describe("eval/types", () => {
	describe("generateRecordingId", () => {
		it("should generate deterministic ID from params", () => {
			const id = generateRecordingId({
				datasetId: "coder-reviewer.v1",
				caseId: "simple-api",
				variantId: "claude-default",
				nodeId: "coder",
				invocation: 0,
			});

			expect(id).toBe(
				"eval__coder-reviewer.v1__simple-api__claude-default__coder__inv0",
			);
		});

		it("should handle different invocation numbers", () => {
			const id0 = generateRecordingId({
				datasetId: "test",
				caseId: "case",
				variantId: "variant",
				nodeId: "node",
				invocation: 0,
			});

			const id1 = generateRecordingId({
				datasetId: "test",
				caseId: "case",
				variantId: "variant",
				nodeId: "node",
				invocation: 1,
			});

			expect(id0).not.toBe(id1);
			expect(id0).toContain("inv0");
			expect(id1).toContain("inv1");
		});

		it("should be deterministic (same input = same output)", () => {
			const params = {
				datasetId: "test",
				caseId: "case",
				variantId: "variant",
				nodeId: "node",
				invocation: 5,
			};

			const id1 = generateRecordingId(params);
			const id2 = generateRecordingId(params);

			expect(id1).toBe(id2);
		});
	});

	describe("parseRecordingId", () => {
		it("should parse valid recording ID", () => {
			const id = "eval__coder-reviewer.v1__simple-api__claude-default__coder__inv0";
			const parsed = parseRecordingId(id);

			expect(parsed).toEqual({
				datasetId: "coder-reviewer.v1",
				caseId: "simple-api",
				variantId: "claude-default",
				nodeId: "coder",
				invocation: 0,
			});
		});

		it("should return undefined for invalid ID format", () => {
			expect(parseRecordingId("invalid-id")).toBeUndefined();
			expect(parseRecordingId("eval__missing__parts")).toBeUndefined();
			expect(parseRecordingId("")).toBeUndefined();
		});

		it("should roundtrip with generateRecordingId", () => {
			const original = {
				datasetId: "my-dataset.v2",
				caseId: "test-case",
				variantId: "openai-gpt4",
				nodeId: "analyzer",
				invocation: 42,
			};

			const id = generateRecordingId(original);
			const parsed = parseRecordingId(id);

			expect(parsed).toEqual(original);
		});
	});

	describe("type definitions", () => {
		it("should allow valid EvalDataset", () => {
			const dataset: EvalDataset = {
				id: "test-dataset",
				workflowName: "test-workflow",
				version: "1.0.0",
				cases: [],
			};

			expect(dataset.id).toBe("test-dataset");
		});

		it("should allow valid EvalCase", () => {
			const evalCase: EvalCase = {
				id: "test-case",
				name: "Test Case",
				input: { prompt: "Hello" },
				assertions: [{ type: "behavior.no_errors" }],
				tags: ["smoke"],
			};

			expect(evalCase.id).toBe("test-case");
		});

		it("should allow valid EvalVariant", () => {
			const variant: EvalVariant = {
				id: "claude-default",
				providerTypeByNode: {
					coder: "claude.agent",
					reviewer: "claude.agent",
				},
				modelByNode: {
					coder: "sonnet",
				},
				tags: ["baseline"],
			};

			expect(variant.id).toBe("claude-default");
		});

		it("should allow all assertion types", () => {
			const assertions: Assertion[] = [
				{ type: "output.contains", path: "outputs.main", value: "hello" },
				{ type: "output.equals", path: "state.status", value: "success" },
				{ type: "metric.latency_ms.max", value: 30000 },
				{ type: "metric.total_cost_usd.max", value: 1.0 },
				{ type: "metric.tokens.input.max", value: 10000 },
				{ type: "metric.tokens.output.max", value: 5000 },
				{ type: "behavior.no_errors" },
				{ type: "behavior.node_executed", nodeId: "main" },
				{ type: "behavior.node_invocations.max", nodeId: "main", value: 3 },
			];

			expect(assertions.length).toBe(9);
		});
	});

	describe("recording:linked event", () => {
		it("should allow creating recording:linked event", () => {
			const event: RecordingLinkedEvent = {
				type: "recording:linked",
				runId: "run-123",
				nodeId: "coder",
				invocation: 0,
				providerType: "claude.agent",
				recordingId: "eval__test__case__variant__coder__inv0",
				mode: "record",
				timestamp: Date.now(),
			};

			expect(event.type).toBe("recording:linked");
			expect(event.mode).toBe("record");
		});

		it("should allow all mode values", () => {
			const modes: Array<"record" | "replay" | "live"> = [
				"record",
				"replay",
				"live",
			];

			for (const mode of modes) {
				const event: RecordingLinkedEvent = {
					type: "recording:linked",
					runId: "run-123",
					nodeId: "node",
					invocation: 0,
					providerType: "test",
					recordingId: "test-id",
					mode,
					timestamp: Date.now(),
				};

				expect(event.mode).toBe(mode);
			}
		});
	});
});
