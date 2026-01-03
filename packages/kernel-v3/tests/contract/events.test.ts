import { describe, expect, test } from "bun:test";
import type { RuntimeEvent } from "../../src/core/events.js";
import { createRuntime, DefaultNodeRegistry, parseFlowYaml } from "../../src/index.js";
import { constantNode, echoNode } from "../../src/nodes/index.js";

describe("runtime event contract", () => {
	test("event payloads include required fields", async () => {
		const flow = parseFlowYaml(`
name: "contract"
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

		const registry = new DefaultNodeRegistry();
		registry.register(constantNode);
		registry.register(echoNode);

		const runtime = createRuntime({ flow, registry });
		const events: RuntimeEvent[] = [];
		runtime.onEvent((event) => {
			events.push(event);
		});

		const snapshot = await runtime.run();
		expect(snapshot.runId).toBeTruthy();

		const flowStart = events.find((event) => event.type === "flow:start");
		expect(flowStart).toMatchObject({
			type: "flow:start",
			flowName: "contract",
		});
		expect(typeof flowStart?.timestamp).toBe("number");

		const nodeStart = events.find((event) => event.type === "node:start") as
			| { nodeId: string; runId: string; timestamp: number }
			| undefined;
		expect(nodeStart?.nodeId).toBeTruthy();
		expect(nodeStart?.runId).toBeTruthy();
		expect(typeof nodeStart?.timestamp).toBe("number");

		const edge = events.find((event) => event.type === "edge:fire") as
			| { from: string; to: string; timestamp: number }
			| undefined;
		expect(edge?.from).toBe("a");
		expect(edge?.to).toBe("b");
		expect(typeof edge?.timestamp).toBe("number");

		const complete = events.find((event) => event.type === "flow:complete") as
			| { status: string; timestamp: number }
			| undefined;
		expect(complete?.status).toBe("complete");
		expect(typeof complete?.timestamp).toBe("number");
	});
});
