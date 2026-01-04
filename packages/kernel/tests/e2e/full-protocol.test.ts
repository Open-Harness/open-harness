import { describe, expect, test } from "bun:test";
import type { RuntimeEvent } from "../../src/core/events.js";
import {
	createMockQuery,
	createRuntime,
	DefaultNodeRegistry,
	parseFlowYaml,
} from "../../src/index.js";
import { createClaudeNode } from "../../src/nodes/claude.agent.js";
import type { FixtureFile } from "../../src/testing/mock-query.js";
import { FixtureSchema } from "../../src/testing/mock-query.js";

describe("kernel e2e", () => {
	test("multi-agent loop with JSONata when expression", async () => {
		// This test specifically validates that JSONata string expressions work
		// through the full runtime execution path (expressions.ts → when.ts → runtime.ts)
		const flow = parseFlowYaml(`
name: "e2e-jsonata"
nodes:
  - id: planner
    type: claude.agent
    input:
      prompt: "fixture:planner"
  - id: reviewer
    type: claude.agent
    input:
      prompt: "fixture:reviewer"
edges:
  - from: planner
    to: reviewer
  - from: reviewer
    to: planner
    maxIterations: 2
    when: "$not(reviewer.structuredOutput.passed = true)"
`);

		const plannerFixture = FixtureSchema.parse(
			await Bun.file(
				new URL("../fixtures/recordings/e2e/planner.json", import.meta.url),
			).json(),
		) as FixtureFile;
		const reviewerFixture = FixtureSchema.parse(
			await Bun.file(
				new URL("../fixtures/recordings/e2e/reviewer.json", import.meta.url),
			).json(),
		) as FixtureFile;

		const mockQuery = createMockQuery({
			fixtures: {
				"fixture:planner": plannerFixture,
				"fixture:reviewer": reviewerFixture,
			},
		});

		const registry = new DefaultNodeRegistry();
		registry.register(createClaudeNode({ queryFn: mockQuery }));

		const runtime = createRuntime({ flow, registry });
		const events: RuntimeEvent[] = [];
		runtime.onEvent((event) => {
			events.push(event);
		});

		const snapshot = await runtime.run();

		// Verify the JSONata when expression worked correctly:
		// - First iteration: reviewer.structuredOutput.passed = false → loop continues
		// - Second iteration: reviewer.structuredOutput.passed = true → loop exits
		expect(snapshot.outputs.planner).toMatchObject({ text: "Plan v2" });
		expect(snapshot.outputs.reviewer).toMatchObject({
			structuredOutput: { passed: true },
		});
		expect(snapshot.loopCounters["reviewer->planner"]).toBe(1);
	});

	test("JSONata bindings in node input ({{ expression }} syntax)", async () => {
		// This test validates that JSONata binding expressions work correctly
		// in node input fields, exercising the bindings.ts → expressions.ts path
		const flow = parseFlowYaml(`
name: "e2e-jsonata-bindings"
nodes:
  - id: writer
    type: claude.agent
    input:
      prompt: "fixture:planner"
  - id: reviewer
    type: claude.agent
    input:
      # Uses JSONata binding to include writer's output in prompt
      prompt: "Review this: {{ writer.text }}"
edges:
  - from: writer
    to: reviewer
`);

		const plannerFixture = FixtureSchema.parse(
			await Bun.file(
				new URL("../fixtures/recordings/e2e/planner.json", import.meta.url),
			).json(),
		) as FixtureFile;
		const reviewerFixture = FixtureSchema.parse(
			await Bun.file(
				new URL("../fixtures/recordings/e2e/reviewer.json", import.meta.url),
			).json(),
		) as FixtureFile;

		// Helper to extract text from prompt (string or AsyncIterable)
		async function extractPromptText(
			prompt:
				| string
				| AsyncIterable<{ message?: { content?: string | unknown[] } }>,
		): Promise<string> {
			if (typeof prompt === "string") return prompt;
			for await (const msg of prompt) {
				const content = msg.message?.content;
				if (typeof content === "string") return content;
				if (Array.isArray(content) && content.length > 0) {
					const first = content[0] as { text?: string } | undefined;
					if (first?.text) return first.text;
				}
			}
			return "";
		}

		// Capture resolved prompts to verify binding resolution
		const capturedPrompts: string[] = [];
		const mockQuery = createMockQuery({
			fixtures: {
				"fixture:planner": plannerFixture,
				"fixture:reviewer": reviewerFixture,
			},
			// Route based on prompt content and capture resolved prompts
			selectFixtureKey: async ({ prompt }) => {
				const text = await extractPromptText(prompt);
				if (text.startsWith("fixture:")) {
					return text;
				}
				// Capture the resolved prompt (should have writer.text interpolated)
				capturedPrompts.push(text);
				return "fixture:reviewer";
			},
		});

		const registry = new DefaultNodeRegistry();
		registry.register(createClaudeNode({ queryFn: mockQuery }));

		const runtime = createRuntime({ flow, registry });
		await runtime.run();

		// Verify the JSONata binding was resolved correctly:
		// writer.text from fixture is "Plan v1", so prompt should be "Review this: Plan v1"
		expect(capturedPrompts.some((p) => p === "Review this: Plan v1")).toBe(
			true,
		);
	});

	test("multi-agent loop with recorded fixtures", async () => {
		const flow = parseFlowYaml(`
name: "e2e"
nodes:
  - id: planner
    type: claude.agent
    input:
      prompt: "fixture:planner"
  - id: reviewer
    type: claude.agent
    input:
      prompt: "fixture:reviewer"
edges:
  - from: planner
    to: reviewer
  - from: reviewer
    to: planner
    maxIterations: 2
    when:
      not:
        equals:
          var: "reviewer.structuredOutput.passed"
          value: true
`);

		const plannerFixture = FixtureSchema.parse(
			await Bun.file(
				new URL("../fixtures/recordings/e2e/planner.json", import.meta.url),
			).json(),
		) as FixtureFile;
		const reviewerFixture = FixtureSchema.parse(
			await Bun.file(
				new URL("../fixtures/recordings/e2e/reviewer.json", import.meta.url),
			).json(),
		) as FixtureFile;

		const mockQuery = createMockQuery({
			fixtures: {
				"fixture:planner": plannerFixture,
				"fixture:reviewer": reviewerFixture,
			},
		});

		const registry = new DefaultNodeRegistry();
		registry.register(createClaudeNode({ queryFn: mockQuery }));

		const runtime = createRuntime({ flow, registry });
		const events: RuntimeEvent[] = [];
		runtime.onEvent((event) => {
			events.push(event);
		});

		const snapshot = await runtime.run();

		expect(snapshot.outputs.planner).toMatchObject({ text: "Plan v2" });
		expect(snapshot.outputs.reviewer).toMatchObject({
			structuredOutput: { passed: true },
		});
		expect(snapshot.loopCounters["reviewer->planner"]).toBe(1);
		expect(snapshot.agentSessions.planner).toBe("sess-planner");
		expect(snapshot.agentSessions.reviewer).toBe("sess-reviewer");

		const agentStart = events.filter((event) => event.type === "agent:start");
		const agentComplete = events.filter(
			(event) => event.type === "agent:complete",
		);
		expect(agentStart.length).toBeGreaterThanOrEqual(2);
		expect(agentComplete.length).toBeGreaterThanOrEqual(2);
	});
});
