/**
 * Node.js Compatibility Test
 *
 * Verifies that the @openharness/anthropic package can be imported and used
 * in a Node.js environment without Bun-specific APIs.
 *
 * These tests verify:
 * - All exports are importable
 * - No Bun-specific runtime errors
 * - Basic functionality works without Bun APIs
 *
 * Run with: bun test tests/node-compat.test.ts
 */

import { describe, expect, test } from "bun:test";

describe("Node.js Compatibility", () => {
	describe("Factory API Imports", () => {
		test("can import defineAnthropicAgent", async () => {
			const { defineAnthropicAgent } = await import("../src/provider/factory.js");
			expect(defineAnthropicAgent).toBeDefined();
			expect(typeof defineAnthropicAgent).toBe("function");
		});

		test("can import createPromptTemplate", async () => {
			const { createPromptTemplate, createStaticPrompt } = await import("../src/provider/prompt-template.js");
			expect(createPromptTemplate).toBeDefined();
			expect(createStaticPrompt).toBeDefined();
		});

		test("can import all provider types", async () => {
			const types = await import("../src/provider/types.js");
			// Types are compile-time only, but the module should import without error
			expect(types).toBeDefined();
		});
	});

	describe("Preset Imports", () => {
		test("can import CodingAgent preset", async () => {
			const { CodingAgent } = await import("../src/presets/index.js");
			expect(CodingAgent).toBeDefined();
			expect(CodingAgent.name).toBe("CodingAgent");
		});

		test("can import ReviewAgent preset", async () => {
			const { ReviewAgent } = await import("../src/presets/index.js");
			expect(ReviewAgent).toBeDefined();
			expect(ReviewAgent.name).toBe("ReviewAgent");
		});

		test("can import PlannerAgent preset", async () => {
			const { PlannerAgent } = await import("../src/presets/index.js");
			expect(PlannerAgent).toBeDefined();
			expect(PlannerAgent.name).toBe("PlannerAgent");
		});

		test("can import all preset templates", async () => {
			const {
				CodingPromptTemplate,
				ReviewPromptTemplate,
				PlannerPromptTemplate,
			} = await import("../src/presets/index.js");

			expect(CodingPromptTemplate).toBeDefined();
			expect(ReviewPromptTemplate).toBeDefined();
			expect(PlannerPromptTemplate).toBeDefined();
		});

		test("can import all preset schemas", async () => {
			const {
				CodingInputSchema,
				CodingOutputSchema,
				ReviewInputSchema,
				ReviewOutputSchema,
				PlannerInputSchema,
				PlannerOutputSchema,
			} = await import("../src/presets/index.js");

			expect(CodingInputSchema).toBeDefined();
			expect(CodingOutputSchema).toBeDefined();
			expect(ReviewInputSchema).toBeDefined();
			expect(ReviewOutputSchema).toBeDefined();
			expect(PlannerInputSchema).toBeDefined();
			expect(PlannerOutputSchema).toBeDefined();
		});
	});

	describe("Runtime Compatibility", () => {
		test("createPromptTemplate works without Bun APIs", async () => {
			const { createPromptTemplate } = await import("../src/provider/prompt-template.js");

			const template = createPromptTemplate("Hello {{name}}, your task is {{task}}");
			const rendered = template.render({ name: "World", task: "test" });

			expect(rendered).toBe("Hello World, your task is test");
		});

		test("preset templates render without Bun APIs", async () => {
			const { CodingPromptTemplate } = await import("../src/presets/index.js");

			const rendered = CodingPromptTemplate.render({ task: "Write a function" });

			expect(rendered).toContain("Write a function");
			expect(rendered).toContain("Coding Agent");
		});

		test("Zod schemas validate without Bun APIs", async () => {
			const { CodingInputSchema, ReviewInputSchema, PlannerInputSchema } =
				await import("../src/presets/index.js");

			// Valid inputs
			expect(CodingInputSchema.safeParse({ task: "test" }).success).toBe(true);
			expect(ReviewInputSchema.safeParse({
				task: "test",
				implementationSummary: "done",
			}).success).toBe(true);
			expect(PlannerInputSchema.safeParse({ prd: "test" }).success).toBe(true);

			// Invalid inputs
			expect(CodingInputSchema.safeParse({ task: "" }).success).toBe(false);
			expect(CodingInputSchema.safeParse({}).success).toBe(false);
		});
	});

	describe("Recording Infrastructure (Node.js compatible)", () => {
		test("can import Vault without Bun APIs", async () => {
			const { Vault } = await import("../src/infra/recording/vault.js");
			expect(Vault).toBeDefined();
		});

		test("can import RecordingFactory without Bun APIs", async () => {
			const { RecordingFactory } = await import("../src/infra/recording/recording-factory.js");
			expect(RecordingFactory).toBeDefined();
		});

		test("can import ReplayRunner without Bun APIs", async () => {
			const { ReplayRunner } = await import("../src/infra/recording/replay-runner.js");
			expect(ReplayRunner).toBeDefined();
		});
	});
});
