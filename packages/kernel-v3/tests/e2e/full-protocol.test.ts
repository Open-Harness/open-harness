import { describe, expect, test } from "bun:test";
import type { RuntimeEvent } from "../../src/core/events.js";
import { createMockQuery, createRuntime, DefaultNodeRegistry, parseFlowYaml } from "../../src/index.js";
import { createClaudeNode } from "../../src/nodes/claude.agent.js";
import type { FixtureFile } from "../../src/testing/mock-query.js";
import { FixtureSchema } from "../../src/testing/mock-query.js";

describe("kernel-v3 e2e", () => {
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
			await Bun.file(new URL("../fixtures/recordings/e2e/planner.json", import.meta.url)).json(),
		) as FixtureFile;
		const reviewerFixture = FixtureSchema.parse(
			await Bun.file(new URL("../fixtures/recordings/e2e/reviewer.json", import.meta.url)).json(),
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
		const agentComplete = events.filter((event) => event.type === "agent:complete");
		expect(agentStart.length).toBeGreaterThanOrEqual(2);
		expect(agentComplete.length).toBeGreaterThanOrEqual(2);
	});
});
