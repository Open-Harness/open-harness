import { describe, expect, test } from "bun:test";
import type { RuntimeEvent } from "../../src/core/events.js";
import { createRuntime, DefaultNodeRegistry, parseFlowYaml } from "../../src/index.js";
import { constantNode, echoNode } from "../../src/nodes/index.js";

describe("kernel forEach", () => {
	test("runs target node for each item and aggregates outputs", async () => {
		const flow = parseFlowYaml(`
name: "foreach"
nodes:
  - id: list
    type: constant
    input:
      value: ["a", "b", "c"]
  - id: echo
    type: echo
    input:
      text: "{{ item }}"
edges:
  - from: list
    to: echo
    forEach:
      in: "{{ list.value }}"
      as: "item"
`);

		const registry = new DefaultNodeRegistry();
		registry.register(constantNode);
		registry.register(echoNode);

		const runtime = createRuntime({ flow, registry });
		const events: RuntimeEvent[] = [];
		runtime.onEvent((event) => {
			events.push(event);
		});

		const snapshot = await runtime.run();

		expect(snapshot.outputs.list).toEqual({ value: ["a", "b", "c"] });
		expect(snapshot.outputs.echo).toEqual({
			iterations: [
				{ item: "a", output: { text: "a" } },
				{ item: "b", output: { text: "b" } },
				{ item: "c", output: { text: "c" } },
			],
		});

		const echoStarts = events.filter((event) => event.type === "node:start" && "nodeId" in event) as Array<{
			nodeId: string;
		}>;
		expect(echoStarts.filter((event) => event.nodeId === "echo")).toHaveLength(3);
	});
});
