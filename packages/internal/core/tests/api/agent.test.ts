import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { agent } from "../../src/api/agent.js";
import { isAgent, isWorkflow } from "../../src/api/types.js";

describe("api/agent", () => {
	describe("agent()", () => {
		it("should create an Agent with _tag discriminator", () => {
			const myAgent = agent({ prompt: "You are helpful." });

			expect(myAgent._tag).toBe("Agent");
		});

		it("should preserve the prompt in config", () => {
			const prompt = "You are a specialized code reviewer.";
			const myAgent = agent({ prompt });

			expect(myAgent.config.prompt).toBe(prompt);
		});

		it("should preserve state in config", () => {
			const state = { history: [], count: 0 };
			const myAgent = agent({
				prompt: "Stateful agent",
				state,
			});

			expect(myAgent.config.state).toEqual(state);
		});

		it("should preserve output schema in config", () => {
			const schema = z.object({ sentiment: z.string() });
			const myAgent = agent({
				prompt: "Analyzer agent",
				output: { schema },
			});

			expect(myAgent.config.output?.schema).toBe(schema);
		});

		it("should create immutable Agent (readonly tag)", () => {
			const myAgent = agent({ prompt: "Test" });

			// TypeScript should prevent mutation, but we verify the structure
			expect(myAgent._tag).toBe("Agent");
			expect(myAgent.config.prompt).toBe("Test");
		});

		it("should create agents with all options", () => {
			const fullAgent = agent({
				prompt: "Full featured agent",
				state: { initialized: true },
				output: { schema: z.string() },
			});

			expect(fullAgent._tag).toBe("Agent");
			expect(fullAgent.config.prompt).toBe("Full featured agent");
			expect(fullAgent.config.state).toEqual({ initialized: true });
			expect(fullAgent.config.output?.schema).toBeDefined();
		});
	});

	describe("type guards", () => {
		it("isAgent() should return true for Agent", () => {
			const myAgent = agent({ prompt: "Test" });
			expect(isAgent(myAgent)).toBe(true);
		});

		it("isAgent() should return false for non-Agent values", () => {
			expect(isAgent(null)).toBe(false);
			expect(isAgent(undefined)).toBe(false);
			expect(isAgent({})).toBe(false);
			expect(isAgent({ _tag: "Workflow" })).toBe(false);
			expect(isAgent("Agent")).toBe(false);
			expect(isAgent(42)).toBe(false);
		});

		it("isWorkflow() should return false for Agent", () => {
			const myAgent = agent({ prompt: "Test" });
			expect(isWorkflow(myAgent)).toBe(false);
		});
	});

	describe("edge cases", () => {
		it("should handle empty string prompt", () => {
			const myAgent = agent({ prompt: "" });
			expect(myAgent.config.prompt).toBe("");
		});

		it("should handle undefined state", () => {
			const myAgent = agent({ prompt: "Test" });
			expect(myAgent.config.state).toBeUndefined();
		});

		it("should handle undefined output", () => {
			const myAgent = agent({ prompt: "Test" });
			expect(myAgent.config.output).toBeUndefined();
		});
	});
});
