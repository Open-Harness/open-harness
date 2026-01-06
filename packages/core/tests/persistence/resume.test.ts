import { describe, expect, test } from "bun:test";
import {
	constantNode,
	createRuntime,
	DefaultNodeRegistry,
	echoNode,
	InMemoryRunStore,
	parseFlowYaml,
} from "../../src/index.js";

describe("persistence resume", () => {
	test("resumes from stored snapshot", async () => {
		const flow = parseFlowYaml(`
name: "resume"
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

		const store = new InMemoryRunStore();
		const runtime = createRuntime({ flow, registry, store });

		let paused = false;
		runtime.onEvent((event) => {
			if (!paused && event.type === "node:complete" && event.nodeId === "a") {
				paused = true;
				runtime.dispatch({ type: "abort", resumable: true });
			}
		});

		const pausedSnapshot = await runtime.run();
		expect(pausedSnapshot.status).toBe("paused");
		expect(pausedSnapshot.runId).toBeTruthy();
		expect(pausedSnapshot.outputs.a).toEqual({ value: "Hello" });
		expect(pausedSnapshot.outputs.b).toBeUndefined();

		const runId = pausedSnapshot.runId;
		if (!runId) {
			throw new Error("Missing runId for resume test");
		}

		const resumedRuntime = createRuntime({
			flow,
			registry,
			store,
			resume: { runId },
		});

		const resumedSnapshot = await resumedRuntime.run();
		expect(resumedSnapshot.status).toBe("complete");
		expect(resumedSnapshot.outputs.b).toEqual({ text: "Hello" });
	});
});
