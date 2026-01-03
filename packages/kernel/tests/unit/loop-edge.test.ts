/**
 * Loop Edge Tests
 *
 * Tests for loop edge support in the kernel:
 * - Compiler partitions forward vs loop edges
 * - Executor handles controlled cycles
 * - maxIterations enforcement prevents infinite loops
 * - loop:iterate events are emitted
 */

import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { HubImpl } from "../../src/engine/hub.js";
import { compileFlow } from "../../src/flow/compiler.js";
import {
	executeFlow,
	LoopIterationExceededError,
} from "../../src/flow/executor.js";
import { NodeRegistry } from "../../src/flow/registry.js";
import type { BaseEvent, EnrichedEvent } from "../../src/protocol/events.js";
import type { FlowYaml } from "../../src/protocol/flow.js";

function createTestContext(hub: HubImpl) {
	return {
		hub,
		phase: async <T>(_name: string, fn: () => Promise<T>) => fn(),
		task: async <T>(_id: string, fn: () => Promise<T>) => fn(),
	};
}

function createRegistry() {
	const registry = new NodeRegistry();

	// Counter node - increments a value each time it runs
	let counterValue = 0;
	registry.register({
		type: "test.counter",
		inputSchema: z.object({}),
		outputSchema: z.object({ count: z.number() }),
		run: async () => {
			counterValue++;
			return { count: counterValue };
		},
	});

	// Reset counter before each test
	registry.register({
		type: "test.reset",
		inputSchema: z.object({ startValue: z.number().optional() }),
		outputSchema: z.object({ initialized: z.boolean() }),
		run: async (_ctx, input: { startValue?: number }) => {
			counterValue = input.startValue ?? 0;
			return { initialized: true };
		},
	});

	// Reviewer node - returns passed=true when count >= threshold
	registry.register({
		type: "test.reviewer",
		inputSchema: z.object({
			count: z.number(),
			threshold: z.number(),
		}),
		outputSchema: z.object({ passed: z.boolean() }),
		run: async (_ctx, input: { count: number; threshold: number }) => ({
			passed: input.count >= input.threshold,
		}),
	});

	// Simple echo node for basic tests
	registry.register({
		type: "test.echo",
		inputSchema: z.object({ value: z.string() }),
		outputSchema: z.object({ result: z.string() }),
		run: async (_ctx, input: { value: string }) => ({
			result: input.value,
		}),
	});

	return registry;
}

describe("Loop Edge Compilation", () => {
	it("partitions forward and loop edges correctly", () => {
		const flow: FlowYaml = {
			flow: { name: "test" },
			nodes: [
				{ id: "a", type: "test.echo", input: { value: "a" } },
				{ id: "b", type: "test.echo", input: { value: "b" } },
				{ id: "c", type: "test.echo", input: { value: "c" } },
			],
			edges: [
				{ from: "a", to: "b" }, // forward (default)
				{ from: "b", to: "c", type: "forward" }, // explicit forward
				{ from: "c", to: "b", type: "loop", maxIterations: 3 }, // loop back
			],
		};

		const compiled = compileFlow(flow);

		expect(compiled.forwardEdges).toHaveLength(2);
		expect(compiled.loopEdges).toHaveLength(1);
		expect(compiled.loopEdges[0]).toMatchObject({
			from: "c",
			to: "b",
			type: "loop",
			maxIterations: 3,
		});
	});

	it("excludes loop edges from topological sort (no cycle error)", () => {
		// This would throw "Flow contains a cycle" if loop edges weren't excluded
		const flow: FlowYaml = {
			flow: { name: "test" },
			nodes: [
				{ id: "coder", type: "test.echo", input: { value: "code" } },
				{ id: "reviewer", type: "test.echo", input: { value: "review" } },
			],
			edges: [
				{ from: "coder", to: "reviewer" }, // forward
				{ from: "reviewer", to: "coder", type: "loop", maxIterations: 5 }, // loop back
			],
		};

		// Should not throw
		const compiled = compileFlow(flow);

		expect(compiled.order.map((n) => n.id)).toEqual(["coder", "reviewer"]);
	});

	it("preserves order array without loop edges", () => {
		const flow: FlowYaml = {
			flow: { name: "test" },
			nodes: [
				{ id: "start", type: "test.echo", input: { value: "start" } },
				{ id: "middle", type: "test.echo", input: { value: "middle" } },
				{ id: "end", type: "test.echo", input: { value: "end" } },
			],
			edges: [
				{ from: "start", to: "middle" },
				{ from: "middle", to: "end" },
				{ from: "end", to: "start", type: "loop", maxIterations: 2 },
			],
		};

		const compiled = compileFlow(flow);

		// Order should be topological based on forward edges only
		expect(compiled.order.map((n) => n.id)).toEqual(["start", "middle", "end"]);
	});
});

describe("Loop Edge Execution", () => {
	it("executes loop when condition is true", async () => {
		const hub = new HubImpl("test-session");
		const registry = createRegistry();
		const nodeExecutions: string[] = [];

		hub.subscribe("node:complete", (e: EnrichedEvent) => {
			const evt = e.event as { nodeId: string };
			nodeExecutions.push(evt.nodeId);
		});

		// Flow: reset → counter → reviewer, with loop back to counter
		// Counter increments each run, reviewer passes when count >= 3
		const flow: FlowYaml = {
			flow: { name: "test" },
			nodes: [
				{ id: "reset", type: "test.reset", input: { startValue: 0 } },
				{ id: "counter", type: "test.counter", input: {} },
				{
					id: "reviewer",
					type: "test.reviewer",
					input: {
						count: "{{ counter.count }}",
						threshold: 3,
					},
				},
			],
			edges: [
				{ from: "reset", to: "counter" },
				{ from: "counter", to: "reviewer" },
				{
					from: "reviewer",
					to: "counter",
					type: "loop",
					maxIterations: 5,
					when: {
						not: {
							equals: { var: "reviewer.passed", value: true },
						},
					},
				},
			],
		};

		await executeFlow(flow, registry, createTestContext(hub));

		// Should run: reset, counter (1), reviewer (fail),
		//             counter (2), reviewer (fail),
		//             counter (3), reviewer (pass - exits loop)
		expect(nodeExecutions).toEqual([
			"reset",
			"counter", // count=1
			"reviewer", // passed=false, loop
			"counter", // count=2
			"reviewer", // passed=false, loop
			"counter", // count=3
			"reviewer", // passed=true, done
		]);
	});

	it("does not loop when condition is false", async () => {
		const hub = new HubImpl("test-session");
		const registry = createRegistry();
		const nodeExecutions: string[] = [];

		hub.subscribe("node:complete", (e: EnrichedEvent) => {
			const evt = e.event as { nodeId: string };
			nodeExecutions.push(evt.nodeId);
		});

		// Counter starts at 5, threshold is 3, so reviewer passes immediately
		const flow: FlowYaml = {
			flow: { name: "test" },
			nodes: [
				{ id: "reset", type: "test.reset", input: { startValue: 5 } },
				{ id: "counter", type: "test.counter", input: {} },
				{
					id: "reviewer",
					type: "test.reviewer",
					input: {
						count: "{{ counter.count }}",
						threshold: 3,
					},
				},
			],
			edges: [
				{ from: "reset", to: "counter" },
				{ from: "counter", to: "reviewer" },
				{
					from: "reviewer",
					to: "counter",
					type: "loop",
					maxIterations: 5,
					when: {
						not: {
							equals: { var: "reviewer.passed", value: true },
						},
					},
				},
			],
		};

		await executeFlow(flow, registry, createTestContext(hub));

		// Should run once, no loop
		expect(nodeExecutions).toEqual(["reset", "counter", "reviewer"]);
	});

	it("emits loop:iterate events during loop execution", async () => {
		const hub = new HubImpl("test-session");
		const registry = createRegistry();
		const loopEvents: BaseEvent[] = [];

		hub.subscribe("loop:iterate", (e: EnrichedEvent) => {
			loopEvents.push(e.event);
		});

		const flow: FlowYaml = {
			flow: { name: "test" },
			nodes: [
				{ id: "reset", type: "test.reset", input: { startValue: 0 } },
				{ id: "counter", type: "test.counter", input: {} },
				{
					id: "reviewer",
					type: "test.reviewer",
					input: {
						count: "{{ counter.count }}",
						threshold: 3,
					},
				},
			],
			edges: [
				{ from: "reset", to: "counter" },
				{ from: "counter", to: "reviewer" },
				{
					from: "reviewer",
					to: "counter",
					type: "loop",
					maxIterations: 5,
					when: {
						not: {
							equals: { var: "reviewer.passed", value: true },
						},
					},
				},
			],
		};

		await executeFlow(flow, registry, createTestContext(hub));

		// Should emit 2 loop:iterate events (iterations 1 and 2)
		// Third time, condition is false (passed=true), no event
		expect(loopEvents).toHaveLength(2);
		expect(loopEvents[0]).toMatchObject({
			type: "loop:iterate",
			edgeFrom: "reviewer",
			edgeTo: "counter",
			iteration: 1,
			maxIterations: 5,
		});
		expect(loopEvents[1]).toMatchObject({
			type: "loop:iterate",
			edgeFrom: "reviewer",
			edgeTo: "counter",
			iteration: 2,
			maxIterations: 5,
		});
	});
});

describe("maxIterations Enforcement", () => {
	it("throws LoopIterationExceededError when limit reached", async () => {
		const hub = new HubImpl("test-session");
		const registry = createRegistry();

		// Reviewer never passes, will hit max iterations
		registry.register({
			type: "test.alwaysFail",
			inputSchema: z.object({}),
			outputSchema: z.object({ passed: z.boolean() }),
			run: async () => ({ passed: false }),
		});

		const flow: FlowYaml = {
			flow: { name: "test" },
			nodes: [
				{ id: "start", type: "test.echo", input: { value: "start" } },
				{ id: "alwaysFail", type: "test.alwaysFail", input: {} },
			],
			edges: [
				{ from: "start", to: "alwaysFail" },
				{
					from: "alwaysFail",
					to: "start",
					type: "loop",
					maxIterations: 3,
					when: {
						not: {
							equals: { var: "alwaysFail.passed", value: true },
						},
					},
				},
			],
		};

		let error: Error | null = null;
		try {
			await executeFlow(flow, registry, createTestContext(hub));
		} catch (e) {
			error = e as Error;
		}

		expect(error).toBeInstanceOf(LoopIterationExceededError);
		expect((error as LoopIterationExceededError).edgeFrom).toBe("alwaysFail");
		expect((error as LoopIterationExceededError).edgeTo).toBe("start");
		expect((error as LoopIterationExceededError).maxIterations).toBe(3);
	});

	it("executes exactly maxIterations loops before error", async () => {
		const hub = new HubImpl("test-session");
		const registry = createRegistry();
		const nodeExecutions: string[] = [];

		hub.subscribe("node:complete", (e: EnrichedEvent) => {
			const evt = e.event as { nodeId: string };
			nodeExecutions.push(evt.nodeId);
		});

		registry.register({
			type: "test.alwaysFail",
			inputSchema: z.object({}),
			outputSchema: z.object({ passed: z.boolean() }),
			run: async () => ({ passed: false }),
		});

		const flow: FlowYaml = {
			flow: { name: "test" },
			nodes: [
				{ id: "start", type: "test.echo", input: { value: "start" } },
				{ id: "alwaysFail", type: "test.alwaysFail", input: {} },
			],
			edges: [
				{ from: "start", to: "alwaysFail" },
				{
					from: "alwaysFail",
					to: "start",
					type: "loop",
					maxIterations: 2,
					when: {
						not: {
							equals: { var: "alwaysFail.passed", value: true },
						},
					},
				},
			],
		};

		try {
			await executeFlow(flow, registry, createTestContext(hub));
		} catch {
			// Expected
		}

		// With maxIterations=2:
		// - Initial: start, alwaysFail (iteration 0)
		// - Loop 1: start, alwaysFail (iteration 1)
		// - Loop 2 would be iteration 2, but 2 >= 2, so error before re-executing
		expect(nodeExecutions).toEqual([
			"start",
			"alwaysFail",
			"start",
			"alwaysFail",
		]);
	});

	it("allows exactly maxIterations-1 loops before success", async () => {
		const hub = new HubImpl("test-session");
		const registry = createRegistry();
		const nodeExecutions: string[] = [];

		hub.subscribe("node:complete", (e: EnrichedEvent) => {
			const evt = e.event as { nodeId: string };
			nodeExecutions.push(evt.nodeId);
		});

		// Flow: reset → counter → reviewer, with maxIterations=3
		// Counter reaches 3 on the 3rd run, reviewer passes, no error
		const flow: FlowYaml = {
			flow: { name: "test" },
			nodes: [
				{ id: "reset", type: "test.reset", input: { startValue: 0 } },
				{ id: "counter", type: "test.counter", input: {} },
				{
					id: "reviewer",
					type: "test.reviewer",
					input: {
						count: "{{ counter.count }}",
						threshold: 3,
					},
				},
			],
			edges: [
				{ from: "reset", to: "counter" },
				{ from: "counter", to: "reviewer" },
				{
					from: "reviewer",
					to: "counter",
					type: "loop",
					maxIterations: 3, // 2 loops allowed before hitting limit
					when: {
						not: {
							equals: { var: "reviewer.passed", value: true },
						},
					},
				},
			],
		};

		// Should complete without error (reaches threshold at iteration 3)
		await executeFlow(flow, registry, createTestContext(hub));

		expect(nodeExecutions).toEqual([
			"reset",
			"counter", // count=1
			"reviewer", // fail, loop (iteration 1)
			"counter", // count=2
			"reviewer", // fail, loop (iteration 2)
			"counter", // count=3
			"reviewer", // pass, done (no iteration 3)
		]);
	});
});

describe("Loop Edge Validation", () => {
	it("rejects loop edge without maxIterations", () => {
		const flow: FlowYaml = {
			flow: { name: "test" },
			nodes: [
				{ id: "a", type: "test.echo", input: { value: "a" } },
				{ id: "b", type: "test.echo", input: { value: "b" } },
			],
			edges: [
				{ from: "a", to: "b" },
				// @ts-expect-error - testing runtime validation
				{ from: "b", to: "a", type: "loop" }, // missing maxIterations
			],
		};

		expect(() => compileFlow(flow)).toThrow(
			"Loop edges require maxIterations to prevent infinite loops",
		);
	});

	it("rejects forward edge with maxIterations", () => {
		const flow: FlowYaml = {
			flow: { name: "test" },
			nodes: [
				{ id: "a", type: "test.echo", input: { value: "a" } },
				{ id: "b", type: "test.echo", input: { value: "b" } },
			],
			edges: [
				// @ts-expect-error - testing runtime validation
				{ from: "a", to: "b", maxIterations: 5 }, // invalid for forward edge
			],
		};

		expect(() => compileFlow(flow)).toThrow(
			"maxIterations is only valid for loop edges",
		);
	});
});
