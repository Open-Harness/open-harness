import { describe, expect, test } from "bun:test";
import type { RuntimeEvent } from "@open-harness/core";
import {
	constantNode,
	createRuntime,
	DefaultNodeRegistry,
	echoNode,
	type NodeTypeDefinition,
	parseFlowYaml,
} from "@open-harness/core";

const counterNode: NodeTypeDefinition<Record<string, never>, { count: number }> = {
	type: "counter",
	run: async (ctx) => {
		const current = ctx.state.get("counter");
		const base = typeof current === "number" ? current : 0;
		const next = base + 1;
		ctx.state.set("counter", next);
		ctx.emit({
			type: "state:patch",
			patch: { op: "set", path: "counter", value: next },
		});
		return { count: next };
	},
};

const reviewNode: NodeTypeDefinition<Record<string, never>, { passed: boolean }> = {
	type: "review",
	run: async (ctx) => {
		const current = ctx.state.get("counter");
		const passed = typeof current === "number" && current >= 2;
		return { passed };
	},
};

const agentNode: NodeTypeDefinition<{ text: string; message?: string }, { text: string; reply?: string }> = {
	type: "mock.agent",
	run: async (_ctx, input) => {
		// Simplified: reply comes from input instead of inbox
		const reply = input.message;
		return { text: input.text, reply };
	},
};

describe("kernel integration", () => {
	test("branches, loops, forEach, and command ingestion", async () => {
		const flow = parseFlowYaml(`
name: "full"
state:
  initial:
    counter: 0
nodes:
  - id: list
    type: constant
    input:
      value: ["alpha", "beta"]
  - id: agent
    type: mock.agent
    input:
      text: "{{ item }}"
  - id: counter
    type: counter
    input: {}
  - id: review
    type: review
    input: {}
  - id: decide
    type: constant
    input:
      value: "left"
  - id: left
    type: echo
    input:
      text: "L"
  - id: right
    type: echo
    input:
      text: "R"
  - id: join
    type: echo
    input:
      text: "{{ left.text }}"
edges:
  - from: list
    to: agent
    forEach:
      in: "{{ list.value }}"
      as: "item"
  - from: counter
    to: review
  - from: review
    to: counter
    maxIterations: 5
    when:
      not:
        equals:
          var: "review.passed"
          value: true
  - from: decide
    to: left
    when:
      equals:
        var: "decide.value"
        value: "left"
  - from: decide
    to: right
    when:
      equals:
        var: "decide.value"
        value: "right"
  - from: left
    to: join
    gate: "any"
  - from: right
    to: join
    gate: "any"
`);

		const registry = new DefaultNodeRegistry();
		registry.register(constantNode);
		registry.register(echoNode);
		registry.register(counterNode);
		registry.register(reviewNode);
		registry.register(agentNode);

		const runtime = createRuntime({ flow, registry });
		const events: RuntimeEvent[] = [];
		runtime.onEvent((event) => {
			events.push(event);
		});

		const snapshot = await runtime.run();

		expect(snapshot.outputs.list).toEqual({ value: ["alpha", "beta"] });
		// Updated: agent node no longer receives messages via inbox, so no replies
		expect(snapshot.outputs.agent).toEqual({
			iterations: [
				{ item: "alpha", output: { text: "alpha", reply: undefined } },
				{ item: "beta", output: { text: "beta", reply: undefined } },
			],
		});
		expect(snapshot.outputs.counter).toEqual({ count: 2 });
		expect(snapshot.outputs.review).toEqual({ passed: true });
		expect(snapshot.outputs.right).toEqual({ skipped: true, reason: "edge" });
		expect(snapshot.outputs.join).toEqual({ text: "L" });
		expect(snapshot.loopCounters["review->counter"]).toBe(1);

		const eventTypes = events.map((event) => event.type);
		expect(eventTypes).toContain("flow:start");
		expect(eventTypes).toContain("edge:fire");
		expect(eventTypes).toContain("loop:iterate");
		expect(eventTypes).toContain("state:patch");
		expect(eventTypes).toContain("flow:complete");
	});
});
