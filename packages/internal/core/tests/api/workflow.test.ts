import { describe, expect, it } from "bun:test";
import { agent } from "../../src/api/agent.js";
import { workflow, type WorkflowWithFlow } from "../../src/api/workflow.js";
import { isAgent, isWorkflow, type Edge } from "../../src/api/types.js";

describe("api/workflow", () => {
	describe("workflow()", () => {
		it("should create a Workflow with _tag discriminator", () => {
			const myWorkflow = workflow({
				agents: {
					main: agent({ prompt: "Main agent" }),
				},
				edges: [],
			});

			expect(myWorkflow._tag).toBe("Workflow");
		});

		it("should preserve agents in config", () => {
			const mainAgent = agent({ prompt: "Main agent" });
			const helperAgent = agent({ prompt: "Helper agent" });

			const myWorkflow = workflow({
				agents: { main: mainAgent, helper: helperAgent },
				edges: [],
			});

			expect(myWorkflow.config.agents.main).toBe(mainAgent);
			expect(myWorkflow.config.agents.helper).toBe(helperAgent);
		});

		it("should preserve edges in config", () => {
			const edges: Edge[] = [
				{ from: "main", to: "helper" },
				{ from: "helper", to: "main", when: "needsRetry = true" },
			];

			const myWorkflow = workflow({
				agents: {
					main: agent({ prompt: "Main" }),
					helper: agent({ prompt: "Helper" }),
				},
				edges,
			});

			expect(myWorkflow.config.edges).toEqual(edges);
		});

		it("should preserve state in config", () => {
			const state = { counter: 0, history: [] };

			const myWorkflow = workflow({
				agents: { main: agent({ prompt: "Main" }) },
				edges: [],
				state,
			});

			expect(myWorkflow.config.state).toEqual(state);
		});

		it("should build internal FlowDefinition", () => {
			const myWorkflow = workflow({
				agents: {
					coder: agent({ prompt: "You write code." }),
					reviewer: agent({ prompt: "You review code." }),
				},
				edges: [{ from: "coder", to: "reviewer" }],
			}) as WorkflowWithFlow;

			expect(myWorkflow._flow).toBeDefined();
			expect(myWorkflow._flow.name).toBe("workflow");
		});

		it("should build nodes from agents", () => {
			const myWorkflow = workflow({
				agents: {
					alpha: agent({ prompt: "Agent Alpha" }),
					beta: agent({ prompt: "Agent Beta" }),
				},
				edges: [],
			}) as WorkflowWithFlow;

			const nodeIds = myWorkflow._flow.nodes.map((n) => n.id);
			expect(nodeIds).toContain("alpha");
			expect(nodeIds).toContain("beta");

			const alphaNode = myWorkflow._flow.nodes.find((n) => n.id === "alpha");
			expect(alphaNode?.type).toBe("agent");
			expect(alphaNode?.input.prompt).toBe("Agent Alpha");
		});

		it("should build edges from config edges", () => {
			const myWorkflow = workflow({
				agents: {
					a: agent({ prompt: "A" }),
					b: agent({ prompt: "B" }),
					c: agent({ prompt: "C" }),
				},
				edges: [
					{ from: "a", to: "b" },
					{ from: "b", to: "c", when: "status = 'ready'" },
				],
			}) as WorkflowWithFlow;

			expect(myWorkflow._flow.edges.length).toBe(2);

			const firstEdge = myWorkflow._flow.edges[0];
			expect(firstEdge?.from).toBe("a");
			expect(firstEdge?.to).toBe("b");

			const secondEdge = myWorkflow._flow.edges[1];
			expect(secondEdge?.from).toBe("b");
			expect(secondEdge?.to).toBe("c");
			expect(secondEdge?.when).toBe("status = 'ready'");
		});

		it("should build state definition from config state", () => {
			const myWorkflow = workflow({
				agents: { main: agent({ prompt: "Main" }) },
				edges: [],
				state: { count: 5, items: ["a", "b"] },
			}) as WorkflowWithFlow;

			expect(myWorkflow._flow.state).toEqual({
				initial: { count: 5, items: ["a", "b"] },
			});
		});

		it("should handle workflow without state", () => {
			const myWorkflow = workflow({
				agents: { main: agent({ prompt: "Main" }) },
				edges: [],
			}) as WorkflowWithFlow;

			expect(myWorkflow._flow.state).toBeUndefined();
		});
	});

	describe("type guards", () => {
		it("isWorkflow() should return true for Workflow", () => {
			const myWorkflow = workflow({
				agents: { main: agent({ prompt: "Test" }) },
				edges: [],
			});
			expect(isWorkflow(myWorkflow)).toBe(true);
		});

		it("isWorkflow() should return false for non-Workflow values", () => {
			expect(isWorkflow(null)).toBe(false);
			expect(isWorkflow(undefined)).toBe(false);
			expect(isWorkflow({})).toBe(false);
			expect(isWorkflow({ _tag: "Agent" })).toBe(false);
			expect(isWorkflow("Workflow")).toBe(false);
		});

		it("isAgent() should return false for Workflow", () => {
			const myWorkflow = workflow({
				agents: { main: agent({ prompt: "Test" }) },
				edges: [],
			});
			expect(isAgent(myWorkflow)).toBe(false);
		});
	});

	describe("complex scenarios", () => {
		it("should handle multi-agent workflow with conditional edges", () => {
			const codeWorkflow = workflow({
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
			}) as WorkflowWithFlow;

			expect(codeWorkflow._flow.nodes.length).toBe(3);
			expect(codeWorkflow._flow.edges.length).toBe(3);
			expect(codeWorkflow._flow.state?.initial.maxIterations).toBe(3);
		});

		it("should not include state in node input (agents are stateless)", () => {
			// In v0.3.0, agents are stateless - state lives on workflow level only
			const myAgent = agent({
				prompt: "Agent prompt",
			});

			const myWorkflow = workflow({
				agents: { main: myAgent },
				edges: [],
			}) as WorkflowWithFlow;

			const mainNode = myWorkflow._flow.nodes.find((n) => n.id === "main");
			// Node input should have prompt but no state
			expect(mainNode?.input.prompt).toBe("Agent prompt");
			expect(mainNode?.input.state).toBeUndefined();
		});
	});
});
