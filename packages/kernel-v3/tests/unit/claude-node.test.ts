import { describe, expect, test } from "bun:test";
import {
	createRuntime,
	DefaultNodeRegistry,
	parseFlowYaml,
} from "../../src/index.js";
import { createClaudeNode } from "../../src/nodes/claude.agent.js";

describe("claude node", () => {
	test("uses replay hook without network", async () => {
		const flow = parseFlowYaml(`
name: "claude"
nodes:
  - id: agent
    type: claude.agent
    input:
      prompt: "Hi"
edges: []
`);

		const claudeNode = createClaudeNode({
			replay: () => ({ text: "Hello from replay" }),
		});

		const registry = new DefaultNodeRegistry();
		registry.register(claudeNode);

		const snapshot = await createRuntime({ flow, registry }).run();
		expect(snapshot.outputs.agent).toEqual({ text: "Hello from replay" });
	});
});
