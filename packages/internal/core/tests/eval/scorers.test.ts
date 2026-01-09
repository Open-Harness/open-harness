import { describe, expect, it } from "bun:test";
import {
	createLatencyScorer,
	defaultLatencyScorer,
	createCostScorer,
	defaultCostScorer,
	createTokensScorer,
	defaultTokensScorer,
	createSimilarityScorer,
	createLLMJudgeScorer,
} from "../../src/eval/scorers/index.js";
import {
	createSuccessfulArtifact,
	createHighUsageArtifact,
	createMultiNodeArtifact,
	createMockArtifact,
} from "./fixtures/mock-artifact.js";

describe("eval/scorers", () => {
	describe("latency scorer", () => {
		it("should return 1.0 for latency at or below ideal", () => {
			const scorer = createLatencyScorer({ maxMs: 30000, idealMs: 1000 });
			const artifact = createMockArtifact({
				nodes: [{ nodeId: "fast", result: "done", durationMs: 500 }],
			});

			const score = scorer.score(artifact);

			expect(score.name).toBe("latency");
			expect(score.value).toBe(1.0);
			expect(score.rawValue).toBe(500);
		});

		it("should return 0.0 for latency at or above max", () => {
			const scorer = createLatencyScorer({ maxMs: 30000, idealMs: 0 });
			const artifact = createHighUsageArtifact(); // 45000ms

			const score = scorer.score(artifact);

			expect(score.value).toBe(0.0);
		});

		it("should interpolate for latency between ideal and max", () => {
			const scorer = createLatencyScorer({ maxMs: 10000, idealMs: 0 });
			const artifact = createMockArtifact({
				nodes: [{ nodeId: "medium", result: "done", durationMs: 5000 }],
			});

			const score = scorer.score(artifact);

			expect(score.value).toBe(0.5);
		});

		it("should include metadata", () => {
			const scorer = createLatencyScorer({ maxMs: 30000, idealMs: 1000 });
			const artifact = createSuccessfulArtifact();

			const score = scorer.score(artifact);

			expect(score.metadata).toEqual({
				maxMs: 30000,
				idealMs: 1000,
				unit: "ms",
			});
		});

		it("should have working default scorer", () => {
			const artifact = createSuccessfulArtifact();

			const score = defaultLatencyScorer.score(artifact);

			expect(score.name).toBe("latency");
			expect(score.value).toBeGreaterThan(0);
			expect(score.value).toBeLessThanOrEqual(1);
		});
	});

	describe("cost scorer", () => {
		it("should return 1.0 for cost at or below ideal", () => {
			const scorer = createCostScorer({ maxUsd: 1.0, idealUsd: 0 });
			const artifact = createMockArtifact({
				nodes: [
					{ nodeId: "cheap", result: "done", totalCostUsd: 0, durationMs: 100 },
				],
			});

			const score = scorer.score(artifact);

			expect(score.name).toBe("cost");
			expect(score.value).toBe(1.0);
		});

		it("should return 0.0 for cost at or above max", () => {
			const scorer = createCostScorer({ maxUsd: 1.0 });
			const artifact = createHighUsageArtifact(); // $2.50

			const score = scorer.score(artifact);

			expect(score.value).toBe(0.0);
		});

		it("should interpolate for cost between ideal and max", () => {
			const scorer = createCostScorer({ maxUsd: 1.0, idealUsd: 0 });
			const artifact = createMockArtifact({
				nodes: [{ nodeId: "half", result: "done", totalCostUsd: 0.5, durationMs: 100 }],
			});

			const score = scorer.score(artifact);

			expect(score.value).toBe(0.5);
		});

		it("should have working default scorer", () => {
			const artifact = createSuccessfulArtifact();

			const score = defaultCostScorer.score(artifact);

			expect(score.name).toBe("cost");
			expect(score.value).toBeGreaterThan(0);
		});
	});

	describe("tokens scorer", () => {
		it("should return 1.0 for tokens at or below ideal", () => {
			const scorer = createTokensScorer({ maxTokens: 10000, idealTokens: 0 });
			const artifact = createMockArtifact({
				nodes: [
					{
						nodeId: "small",
						result: "done",
						inputTokens: 0,
						outputTokens: 0,
						durationMs: 100,
					},
				],
			});

			const score = scorer.score(artifact);

			expect(score.name).toBe("tokens");
			expect(score.value).toBe(1.0);
		});

		it("should return 0.0 for tokens at or above max", () => {
			const scorer = createTokensScorer({ maxTokens: 10000 });
			const artifact = createHighUsageArtifact(); // 75000 total

			const score = scorer.score(artifact);

			expect(score.value).toBe(0.0);
		});

		it("should include breakdown in metadata", () => {
			const scorer = createTokensScorer({ maxTokens: 10000 });
			const artifact = createSuccessfulArtifact();

			const score = scorer.score(artifact);

			expect(score.metadata?.inputTokens).toBeDefined();
			expect(score.metadata?.outputTokens).toBeDefined();
		});

		it("should have working default scorer", () => {
			const artifact = createSuccessfulArtifact();

			const score = defaultTokensScorer.score(artifact);

			expect(score.name).toBe("tokens");
			expect(score.value).toBeGreaterThanOrEqual(0);
			expect(score.value).toBeLessThanOrEqual(1);
		});
	});

	describe("similarity scorer", () => {
		it("should return 1.0 for exact match", () => {
			const artifact = createMockArtifact({
				outputs: { main: { text: "Hello world" } },
			});
			const scorer = createSimilarityScorer({
				outputPath: "main.text",
				expectedValue: "Hello world",
				algorithm: "exact",
			});

			const score = scorer.score(artifact);

			expect(score.name).toBe("similarity");
			expect(score.value).toBe(1.0);
		});

		it("should return 0.0 for no match (exact)", () => {
			const artifact = createMockArtifact({
				outputs: { main: { text: "Hello world" } },
			});
			const scorer = createSimilarityScorer({
				outputPath: "main.text",
				expectedValue: "Goodbye world",
				algorithm: "exact",
			});

			const score = scorer.score(artifact);

			expect(score.value).toBe(0.0);
		});

		it("should return 1.0 for contains match", () => {
			const artifact = createMockArtifact({
				outputs: { main: { text: "Hello world, how are you?" } },
			});
			const scorer = createSimilarityScorer({
				outputPath: "main.text",
				expectedValue: "world",
				algorithm: "contains",
			});

			const score = scorer.score(artifact);

			expect(score.value).toBe(1.0);
		});

		it("should return stub value for unimplemented algorithms", () => {
			const artifact = createSuccessfulArtifact();
			const scorer = createSimilarityScorer({
				outputPath: "main.text",
				expectedValue: "test",
				algorithm: "levenshtein",
			});

			const score = scorer.score(artifact);

			expect(score.value).toBe(0.5);
			expect(score.metadata?.stub).toBe(true);
		});

		it("should return 0 when path not found", () => {
			const artifact = createMockArtifact({ outputs: {} });
			const scorer = createSimilarityScorer({
				outputPath: "missing.path",
				expectedValue: "test",
			});

			const score = scorer.score(artifact);

			expect(score.value).toBe(0);
			expect(score.metadata?.error).toBeDefined();
		});
	});

	describe("llm-judge scorer", () => {
		it("should return 0 when disabled (default)", () => {
			const artifact = createSuccessfulArtifact();
			const scorer = createLLMJudgeScorer({
				outputPath: "main.text",
				criteria: "Is this good code?",
			});

			const score = scorer.score(artifact);

			expect(score.name).toBe("llm-judge");
			expect(score.value).toBe(0);
			expect(score.metadata?.enabled).toBe(false);
		});

		it("should return stub value when enabled", () => {
			const artifact = createSuccessfulArtifact();
			const scorer = createLLMJudgeScorer({
				outputPath: "main.text",
				criteria: "Is this good code?",
				enabled: true,
			});

			const score = scorer.score(artifact);

			expect(score.value).toBe(0.5);
			expect(score.metadata?.stub).toBe(true);
		});

		it("should return 0 when path not found (even if enabled)", () => {
			const artifact = createMockArtifact({ outputs: {} });
			const scorer = createLLMJudgeScorer({
				outputPath: "missing.path",
				criteria: "Is this good?",
				enabled: true,
			});

			const score = scorer.score(artifact);

			expect(score.value).toBe(0);
			expect(score.metadata?.error).toBeDefined();
		});
	});

	describe("all scorers return valid Score shape", () => {
		const artifact = createMultiNodeArtifact();
		const scorers = [
			defaultLatencyScorer,
			defaultCostScorer,
			defaultTokensScorer,
			createSimilarityScorer({
				outputPath: "coder.text",
				expectedValue: "function",
			}),
			createLLMJudgeScorer({
				outputPath: "coder.text",
				criteria: "test",
			}),
		];

		for (const scorer of scorers) {
			it(`${scorer.name} returns valid Score`, () => {
				const score = scorer.score(artifact);

				expect(score.name).toBe(scorer.name);
				expect(typeof score.value).toBe("number");
				expect(score.value).toBeGreaterThanOrEqual(0);
				expect(score.value).toBeLessThanOrEqual(1);
			});
		}
	});
});
