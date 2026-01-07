import { describe, expect, test } from "bun:test";
import type { RuntimeEvent } from "../../src/core/events.js";
import {
	createRuntime,
	DefaultNodeRegistry,
	GraphCompiler,
	parseFlowYaml,
} from "../../src/index.js";
import { constantNode, echoNode } from "../../src/nodes/index.js";

describe("kernel-v3 integration", () => {
	test("parse -> compile -> run", async () => {
		const flow = parseFlowYaml(`
name: "simple"
nodes:
  - id: a
    type: constant
    input:
      value: "Hello"
  - id: b
    type: echo
    input:
      text: "{{ a.value }}"
edges:
  - from: a
    to: b
`);

		const compiler = new GraphCompiler();
		const compiled = compiler.compile(flow);
		expect(compiled.nodes.length).toBe(2);
		expect(compiled.edges.length).toBe(1);

		const registry = new DefaultNodeRegistry();
		registry.register(constantNode);
		registry.register(echoNode);

		const runtime = createRuntime({ flow, registry });
		const events: RuntimeEvent[] = [];
		runtime.onEvent((event) => {
			events.push(event);
		});

		const snapshot = await runtime.run();
		expect(snapshot.outputs.a).toEqual({ value: "Hello" });
		expect(snapshot.outputs.b).toEqual({ text: "Hello" });

		const types = events.map((event) => event.type);
		expect(types).toContain("flow:start");
		expect(types).toContain("node:start");
		expect(types).toContain("node:complete");
		expect(types).toContain("edge:fire");
		expect(types).toContain("flow:complete");
	});
});
