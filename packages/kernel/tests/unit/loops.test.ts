import { describe, expect, test } from "bun:test";
import type { FlowDefinition, RuntimeEvent } from "../../src/index.js";
import {
	createRuntime,
	DefaultNodeRegistry,
	type NodeTypeDefinition,
} from "../../src/index.js";

const incrementNode: NodeTypeDefinition<{ step?: number }, { count: number }> =
	{
		type: "increment",
		run: async (ctx, input) => {
			const current = ctx.state.get("counter");
			const base = typeof current === "number" ? current : 0;
			const step = typeof input.step === "number" ? input.step : 1;
			const next = base + step;
			ctx.state.set("counter", next);
			return { count: next };
		},
	};

describe("kernel loops", () => {
	test("re-runs nodes until loop condition fails", async () => {
		const flow: FlowDefinition = {
			name: "loop",
			state: { initial: { counter: 0 } },
			nodes: [
				{
					id: "tick",
					type: "increment",
					input: {},
				},
			],
			edges: [
				{
					from: "tick",
					to: "tick",
					maxIterations: 5,
					when: {
						not: {
							equals: { var: "state.counter", value: 3 },
						},
					},
				},
			],
		};

		const registry = new DefaultNodeRegistry();
		registry.register(incrementNode);

		const runtime = createRuntime({ flow, registry });
		const events: RuntimeEvent[] = [];
		runtime.onEvent((event) => {
			events.push(event);
		});

		const snapshot = await runtime.run();

		expect(snapshot.state.counter).toBe(3);
		expect(snapshot.outputs.tick).toEqual({ count: 3 });
		expect(snapshot.loopCounters["tick->tick"]).toBe(2);

		const starts = events.filter((event) => event.type === "node:start");
		expect(starts).toHaveLength(3);

		const loops = events.filter((event) => event.type === "loop:iterate");
		expect(loops).toHaveLength(2);
	});

	test("enforces maxIterations on loop edges", async () => {
		const flow: FlowDefinition = {
			name: "loop-max",
			state: { initial: { counter: 0 } },
			nodes: [
				{
					id: "tick",
					type: "increment",
					input: {},
				},
			],
			edges: [
				{
					from: "tick",
					to: "tick",
					maxIterations: 2,
					when: {
						not: {
							equals: { var: "state.counter", value: 4 },
						},
					},
				},
			],
		};

		const registry = new DefaultNodeRegistry();
		registry.register(incrementNode);

		const runtime = createRuntime({ flow, registry });

		await expect(runtime.run()).rejects.toThrow("exceeded 2");
	});
});
