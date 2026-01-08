import { describe, expect, it } from "bun:test";
import { agent } from "../../src/api/agent.js";
import { harness, type HarnessWithFlow } from "../../src/api/harness.js";
import { isAgent, isHarness, type Edge } from "../../src/api/types.js";

describe("api/harness", () => {
	describe("harness()", () => {
		it("should create a Harness with _tag discriminator", () => {
			const myHarness = harness({
				agents: {
					main: agent({ prompt: "Main agent" }),
				},
				edges: [],
			});

			expect(myHarness._tag).toBe("Harness");
		});

		it("should preserve agents in config", () => {
			const mainAgent = agent({ prompt: "Main agent" });
			const helperAgent = agent({ prompt: "Helper agent" });

			const myHarness = harness({
				agents: { main: mainAgent, helper: helperAgent },
				edges: [],
			});

			expect(myHarness.config.agents.main).toBe(mainAgent);
			expect(myHarness.config.agents.helper).toBe(helperAgent);
		});

		it("should preserve edges in config", () => {
			const edges: Edge[] = [
				{ from: "main", to: "helper" },
				{ from: "helper", to: "main", when: "needsRetry = true" },
			];

			const myHarness = harness({
				agents: {
					main: agent({ prompt: "Main" }),
					helper: agent({ prompt: "Helper" }),
				},
				edges,
			});

			expect(myHarness.config.edges).toEqual(edges);
		});

		it("should preserve state in config", () => {
			const state = { counter: 0, history: [] };

			const myHarness = harness({
				agents: { main: agent({ prompt: "Main" }) },
				edges: [],
				state,
			});

			expect(myHarness.config.state).toEqual(state);
		});

		it("should build internal FlowDefinition", () => {
			const myHarness = harness({
				agents: {
					coder: agent({ prompt: "You write code." }),
					reviewer: agent({ prompt: "You review code." }),
				},
				edges: [{ from: "coder", to: "reviewer" }],
			}) as HarnessWithFlow;

			expect(myHarness._flow).toBeDefined();
			expect(myHarness._flow.name).toBe("harness");
		});

		it("should build nodes from agents", () => {
			const myHarness = harness({
				agents: {
					alpha: agent({ prompt: "Agent Alpha" }),
					beta: agent({ prompt: "Agent Beta" }),
				},
				edges: [],
			}) as HarnessWithFlow;

			const nodeIds = myHarness._flow.nodes.map((n) => n.id);
			expect(nodeIds).toContain("alpha");
			expect(nodeIds).toContain("beta");

			const alphaNode = myHarness._flow.nodes.find((n) => n.id === "alpha");
			expect(alphaNode?.type).toBe("agent");
			expect(alphaNode?.input.prompt).toBe("Agent Alpha");
		});

		it("should build edges from config edges", () => {
			const myHarness = harness({
				agents: {
					a: agent({ prompt: "A" }),
					b: agent({ prompt: "B" }),
					c: agent({ prompt: "C" }),
				},
				edges: [
					{ from: "a", to: "b" },
					{ from: "b", to: "c", when: "status = 'ready'" },
				],
			}) as HarnessWithFlow;

			expect(myHarness._flow.edges.length).toBe(2);

			const firstEdge = myHarness._flow.edges[0];
			expect(firstEdge?.from).toBe("a");
			expect(firstEdge?.to).toBe("b");

			const secondEdge = myHarness._flow.edges[1];
			expect(secondEdge?.from).toBe("b");
			expect(secondEdge?.to).toBe("c");
			expect(secondEdge?.when).toBe("status = 'ready'");
		});

		it("should build state definition from config state", () => {
			const myHarness = harness({
				agents: { main: agent({ prompt: "Main" }) },
				edges: [],
				state: { count: 5, items: ["a", "b"] },
			}) as HarnessWithFlow;

			expect(myHarness._flow.state).toEqual({
				initial: { count: 5, items: ["a", "b"] },
			});
		});

		it("should handle harness without state", () => {
			const myHarness = harness({
				agents: { main: agent({ prompt: "Main" }) },
				edges: [],
			}) as HarnessWithFlow;

			expect(myHarness._flow.state).toBeUndefined();
		});
	});

	describe("type guards", () => {
		it("isHarness() should return true for Harness", () => {
			const myHarness = harness({
				agents: { main: agent({ prompt: "Test" }) },
				edges: [],
			});
			expect(isHarness(myHarness)).toBe(true);
		});

		it("isHarness() should return false for non-Harness values", () => {
			expect(isHarness(null)).toBe(false);
			expect(isHarness(undefined)).toBe(false);
			expect(isHarness({})).toBe(false);
			expect(isHarness({ _tag: "Agent" })).toBe(false);
			expect(isHarness("Harness")).toBe(false);
		});

		it("isAgent() should return false for Harness", () => {
			const myHarness = harness({
				agents: { main: agent({ prompt: "Test" }) },
				edges: [],
			});
			expect(isAgent(myHarness)).toBe(false);
		});
	});

	describe("complex scenarios", () => {
		it("should handle multi-agent workflow with conditional edges", () => {
			const workflow = harness({
				agents: {
					coder: agent({ prompt: "You write code." }),
					reviewer: agent({ prompt: "You review code." }),
					fixer: agent({ prompt: "You fix issues." }),
				},
				edges: [
					{ from: "coder", to: "reviewer" },
					{ from: "reviewer", to: "fixer", when: "hasIssues = true" },
					{ from: "reviewer", to: "coder", when: "needsRewrite = true" },
				],
				state: { iteration: 0, maxIterations: 3 },
			}) as HarnessWithFlow;

			expect(workflow._flow.nodes.length).toBe(3);
			expect(workflow._flow.edges.length).toBe(3);
			expect(workflow._flow.state?.initial.maxIterations).toBe(3);
		});

		it("should preserve agent state in node input", () => {
			const statefulAgent = agent({
				prompt: "Stateful",
				state: { memory: [] },
			});

			const myHarness = harness({
				agents: { main: statefulAgent },
				edges: [],
			}) as HarnessWithFlow;

			const mainNode = myHarness._flow.nodes.find((n) => n.id === "main");
			expect(mainNode?.input.state).toEqual({ memory: [] });
		});
	});
});
