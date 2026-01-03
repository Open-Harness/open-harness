import { describe, expect, test } from "bun:test";
import {
	createMockQuery,
	createRuntime,
	DefaultNodeRegistry,
	parseFlowYaml,
} from "../../src/index.js";
import { createClaudeNode } from "../../src/nodes/claude.agent.js";
import type { FixtureFile } from "../../src/testing/mock-query.js";
import { FixtureSchema } from "../../src/testing/mock-query.js";

describe("claude node", () => {
	test("emits agent events from mock query", async () => {
		const flow = parseFlowYaml(`
name: "claude"
nodes:
  - id: agent
    type: claude.agent
    input:
      prompt: "fixture:agent"
edges: []
`);

		const fixturePath = new URL(
			"../fixtures/recordings/example/agent.json",
			import.meta.url,
		);
		const fixture = FixtureSchema.parse(
			await Bun.file(fixturePath).json(),
		) as FixtureFile;

		const mockQuery = createMockQuery({
			fixtures: { agent: fixture },
			selectFixtureKey: () => "agent",
		});
		const claudeNode = createClaudeNode({ queryFn: mockQuery });

		const registry = new DefaultNodeRegistry();
		registry.register(claudeNode);

		const runtime = createRuntime({ flow, registry });
		const events: Array<{ type: string; timestamp: number }> = [];
		runtime.onEvent((event) => {
			events.push(event);
		});

		const snapshot = await runtime.run();
		const output = snapshot.outputs.agent as {
			text?: string;
			sessionId?: string;
		};
		expect(output?.text).toBe("fixture done");
		expect(output?.sessionId).toBe("sess-fixture-1");

		const start = events.find((event) => event.type === "agent:start") as
			| { sessionId?: string; prompt?: string; timestamp?: number }
			| undefined;
		expect(start?.sessionId).toBe("sess-fixture-1");
		expect(start?.prompt).toBe("fixture:agent");
		expect(typeof start?.timestamp).toBe("number");

		const text = events.find((event) => event.type === "agent:text") as
			| { content?: string }
			| undefined;
		expect(text?.content).toBe("fixture ");

		const complete = events.find((event) => event.type === "agent:complete") as
			| { result?: string }
			| undefined;
		expect(complete?.result).toBe("fixture done");
	});
});
