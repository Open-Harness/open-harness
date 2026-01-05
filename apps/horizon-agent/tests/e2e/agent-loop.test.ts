/**
 * E2E Tests for Horizon Agent Loop
 *
 * These tests prove that the horizon-agent flow actually works end-to-end:
 * - Multi-node flow execution (planner → coder → reviewer)
 * - Loop edges (reviewer → coder on failure)
 * - forEach task iteration
 * - JSONata expressions in bindings and conditions
 *
 * Uses recorded fixtures to avoid live API calls while still validating
 * the full runtime execution path.
 */

import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
	createClaudeNode,
	createMockQuery,
	createRuntime,
	DefaultNodeRegistry,
	FixtureSchema,
	parseFlowYaml,
	type FixtureFile,
	type RuntimeEvent,
} from "@open-harness/kernel";

// Use test-specific flow that doesn't require schema files
const FLOW_PATH = resolve(import.meta.dir, "../fixtures/e2e/test-agent-loop.yaml");
const FIXTURES_PATH = resolve(import.meta.dir, "../fixtures/e2e");

async function loadFixture(name: string): Promise<FixtureFile> {
	const file = Bun.file(resolve(FIXTURES_PATH, `${name}.json`));
	const data = await file.json();
	return FixtureSchema.parse(data) as FixtureFile;
}

describe("Horizon Agent E2E", () => {
	test("executes full planner → coder → reviewer flow with loop", async () => {
		// Load the actual flow definition
		const flowContent = await Bun.file(FLOW_PATH).text();
		const flow = parseFlowYaml(flowContent);

		// Load fixtures
		const plannerFixture = await loadFixture("planner");
		const coderFixture = await loadFixture("coder");
		const reviewerFixture = await loadFixture("reviewer");

		// Create mock query that routes based on node context
		const mockQuery = createMockQuery({
			fixtures: {
				planner: plannerFixture,
				coder: coderFixture,
				reviewer: reviewerFixture,
			},
			selectFixtureKey: async ({ prompt }) => {
				// Extract prompt text to determine which fixture to use
				const text =
					typeof prompt === "string"
						? prompt
						: await (async () => {
								for await (const msg of prompt) {
									const content = msg.message?.content;
									if (typeof content === "string") return content;
									if (Array.isArray(content) && content.length > 0) {
										const first = content[0] as { text?: string } | undefined;
										if (first?.text) return first.text;
									}
								}
								return "";
							})();

				// Route based on prompt content
				if (text.includes("Feature Implementation Planning")) {
					return "planner";
				}
				if (text.includes("Implementation Task")) {
					return "coder";
				}
				if (text.includes("Code Review")) {
					return "reviewer";
				}

				// Fallback based on keywords
				if (text.includes("planner") || text.includes("feature")) {
					return "planner";
				}
				if (text.includes("coder") || text.includes("implement")) {
					return "coder";
				}
				return "reviewer";
			},
		});

		// Create registry with mock claude node
		const registry = new DefaultNodeRegistry();
		registry.register(createClaudeNode({ queryFn: mockQuery }));

		// Create runtime
		const runtime = createRuntime({ flow, registry });

		// Collect events
		const events: RuntimeEvent[] = [];
		runtime.onEvent((event) => {
			events.push(event);
		});

		// Run the flow
		const snapshot = await runtime.run({ feature: "Add user authentication" });

		// === ASSERTIONS ===

		// 1. Flow completed
		expect(snapshot.status).toBe("complete");

		// 2. All nodes produced output
		expect(snapshot.outputs.planner).toBeDefined();
		expect(snapshot.outputs.coder).toBeDefined();
		expect(snapshot.outputs.reviewer).toBeDefined();

		// 3. Planner produced tasks
		const plannerOutput = snapshot.outputs.planner as {
			structuredOutput: { tasks: Array<{ id: string; title: string }> };
		};
		expect(plannerOutput.structuredOutput.tasks).toBeDefined();
		expect(plannerOutput.structuredOutput.tasks.length).toBeGreaterThan(0);

		// 4. Reviewer eventually passed
		const reviewerOutput = snapshot.outputs.reviewer as {
			structuredOutput: { passed: boolean };
		};
		expect(reviewerOutput.structuredOutput.passed).toBe(true);

		// 5. Loop edge was exercised (reviewer failed once, then passed)
		// The loop counter should be 1 (one iteration before passing)
		expect(snapshot.loopCounters["reviewer->coder"]).toBe(1);

		// 6. Agent events were emitted
		const agentStarts = events.filter((e) => e.type === "agent:start");
		const agentCompletes = events.filter((e) => e.type === "agent:complete");

		// Should have at least 4 agent starts:
		// - planner (1)
		// - coder (2 - initial + after review failure)
		// - reviewer (2 - fail + pass)
		expect(agentStarts.length).toBeGreaterThanOrEqual(4);
		expect(agentCompletes.length).toBeGreaterThanOrEqual(4);

		// 7. Node events were emitted in correct order
		const nodeCompletes = events
			.filter((e) => e.type === "node:complete")
			.map((e) => (e as { nodeId: string }).nodeId);

		// First node should be planner
		expect(nodeCompletes[0]).toBe("planner");

		// Coder and reviewer should appear (possibly multiple times due to loop)
		expect(nodeCompletes).toContain("coder");
		expect(nodeCompletes).toContain("reviewer");

		console.log("✅ Full flow executed successfully");
		console.log(`   - ${plannerOutput.structuredOutput.tasks.length} tasks planned`);
		console.log(`   - Loop iterations: ${snapshot.loopCounters["reviewer->coder"]}`);
		console.log(`   - Total agent calls: ${agentCompletes.length}`);
	}, 30000);

	test("loop edge respects maxIterations", async () => {
		// Create a flow where reviewer never passes - should hit maxIterations
		const flow = parseFlowYaml(`
name: max-iterations-test
nodes:
  - id: coder
    type: claude.agent
    input:
      prompt: "fixture:coder"
  - id: reviewer
    type: claude.agent
    input:
      prompt: "fixture:reviewer"
edges:
  - from: coder
    to: reviewer
  - from: reviewer
    to: coder
    when: "$not(reviewer.structuredOutput.passed = true)"
    maxIterations: 2
`);

		// Create fixture where reviewer NEVER passes
		const neverPassReviewerFixture: FixtureFile = {
			calls: Array(10)
				.fill(null)
				.map((_, i) => ({
					input: { prompt: "fixture:reviewer" },
					output: {
						text: `Review iteration ${i + 1}: Still needs work`,
						structuredOutput: { passed: false, feedback: "Keep trying" },
						usage: { input_tokens: 10, output_tokens: 5 },
						durationMs: 100,
						sessionId: "sess-reviewer",
						numTurns: i + 1,
						totalCostUsd: 0,
					},
					events: [],
				})),
		};

		const coderFixture = await loadFixture("coder");

		const mockQuery = createMockQuery({
			fixtures: {
				"fixture:coder": coderFixture,
				"fixture:reviewer": neverPassReviewerFixture,
			},
		});

		const registry = new DefaultNodeRegistry();
		registry.register(createClaudeNode({ queryFn: mockQuery }));

		const runtime = createRuntime({ flow, registry });

		// Should throw because maxIterations is exceeded
		let error: Error | null = null;
		try {
			await runtime.run();
		} catch (e) {
			error = e as Error;
		}

		expect(error).not.toBeNull();
		expect(error?.message).toMatch(/exceeded|maximum|iterations/i);

		console.log("✅ maxIterations limit enforced correctly");
	}, 30000);

	test("JSONata binding expressions resolve correctly", async () => {
		// Simple flow to test bindings
		const flow = parseFlowYaml(`
name: binding-test
nodes:
  - id: producer
    type: claude.agent
    input:
      prompt: "fixture:planner"
  - id: consumer
    type: claude.agent
    input:
      prompt: "The producer said: {{ producer.text }}"
edges:
  - from: producer
    to: consumer
`);

		const plannerFixture = await loadFixture("planner");
		const coderFixture = await loadFixture("coder");

		// Track what prompts are resolved
		const resolvedPrompts: string[] = [];

		const mockQuery = createMockQuery({
			fixtures: {
				"fixture:planner": plannerFixture,
				"fixture:coder": coderFixture,
			},
			selectFixtureKey: async ({ prompt }) => {
				const text =
					typeof prompt === "string"
						? prompt
						: await (async () => {
								for await (const msg of prompt) {
									const content = msg.message?.content;
									if (typeof content === "string") return content;
									if (Array.isArray(content) && content.length > 0) {
										const first = content[0] as { text?: string } | undefined;
										if (first?.text) return first.text;
									}
								}
								return "";
							})();

				resolvedPrompts.push(text);

				if (text.includes("The producer said:")) {
					return "fixture:coder";
				}
				return "fixture:planner";
			},
		});

		const registry = new DefaultNodeRegistry();
		registry.register(createClaudeNode({ queryFn: mockQuery }));

		const runtime = createRuntime({ flow, registry });
		await runtime.run();

		// The consumer's prompt should have the producer's text interpolated
		const consumerPrompt = resolvedPrompts.find((p) => p.includes("The producer said:"));
		expect(consumerPrompt).toBeDefined();
		expect(consumerPrompt).toContain("I've analyzed the feature request");

		console.log("✅ JSONata bindings resolved correctly");
		console.log(`   Consumer received: "${consumerPrompt?.slice(0, 60)}..."`);
	}, 30000);
});
