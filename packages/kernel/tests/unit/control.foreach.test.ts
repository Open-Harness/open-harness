// Unit tests for control.foreach node
import { describe, expect, test } from "bun:test";
import { createHub } from "../../src/engine/hub.js";
import { controlForeachNode } from "../../src/flow/nodes/control.foreach.js";
import type { ContainerNodeContext } from "../../src/protocol/flow.js";

describe("control.foreach node", () => {
	test("iterates over array items", async () => {
		const hub = createHub("test-session");
		hub.startSession();
		const events: Array<{ type: string }> = [];

		hub.subscribe("*", (event) => {
			events.push(event.event as { type: string });
		});

		// Mock executeChild that returns item doubled
		const executeChild = async (
			nodeId: string,
			input: Record<string, unknown>,
		) => {
			return { result: `processed-${nodeId}-${input.item}` };
		};

		const ctx: ContainerNodeContext = {
			hub,
			runId: "run-0",
			executeChild,
		};

		const result = await controlForeachNode.run(ctx, {
			items: [1, 2, 3],
			as: "item",
			body: ["process"],
		});

		expect(result.iterations).toHaveLength(3);
		expect(result.iterations[0].item).toBe(1);
		expect(result.iterations[1].item).toBe(2);
		expect(result.iterations[2].item).toBe(3);

		// Each iteration should have outputs
		expect(result.iterations[0].outputs.process).toEqual({
			result: "processed-process-1",
		});
	});

	test("emits session:start and session:end events", async () => {
		const hub = createHub("test-session");
		hub.startSession();
		const sessionEvents: Array<{ type: string; sessionId?: string }> = [];

		hub.subscribe("session:start", (event) => {
			sessionEvents.push(event.event as { type: string; sessionId: string });
		});
		hub.subscribe("session:end", (event) => {
			sessionEvents.push(event.event as { type: string; sessionId: string });
		});

		const executeChild = async () => ({});

		const ctx: ContainerNodeContext = {
			hub,
			runId: "run-0",
			executeChild,
		};

		await controlForeachNode.run(ctx, {
			items: ["a", "b"],
			as: "letter",
			body: ["child1"],
		});

		// Should have 2 start and 2 end events (one per iteration)
		const starts = sessionEvents.filter((e) => e.type === "session:start");
		const ends = sessionEvents.filter((e) => e.type === "session:end");

		expect(starts).toHaveLength(2);
		expect(ends).toHaveLength(2);

		// Each session should have a unique ID
		expect(starts[0].sessionId).not.toBe(starts[1].sessionId);
	});

	test("handles empty array", async () => {
		const hub = createHub("test-session");
		hub.startSession();

		const executeChild = async () => ({});

		const ctx: ContainerNodeContext = {
			hub,
			runId: "run-0",
			executeChild,
		};

		const result = await controlForeachNode.run(ctx, {
			items: [],
			as: "item",
			body: ["process"],
		});

		expect(result.iterations).toHaveLength(0);
	});

	test("executes multiple child nodes in sequence", async () => {
		const hub = createHub("test-session");
		hub.startSession();
		const executionOrder: string[] = [];

		const executeChild = async (
			nodeId: string,
			input: Record<string, unknown>,
		) => {
			executionOrder.push(`${nodeId}:${input.task}`);
			return { nodeId };
		};

		const ctx: ContainerNodeContext = {
			hub,
			runId: "run-0",
			executeChild,
		};

		await controlForeachNode.run(ctx, {
			items: ["task1", "task2"],
			as: "task",
			body: ["step1", "step2", "step3"],
		});

		// Should execute all children for each item in order
		expect(executionOrder).toEqual([
			"step1:task1",
			"step2:task1",
			"step3:task1",
			"step1:task2",
			"step2:task2",
			"step3:task2",
		]);
	});

	test("passes session context to child nodes", async () => {
		const hub = createHub("test-session");
		hub.startSession();
		const sessionIds: string[] = [];

		const executeChild = async (
			_nodeId: string,
			input: Record<string, unknown>,
		) => {
			sessionIds.push(input.sessionId as string);
			return {};
		};

		const ctx: ContainerNodeContext = {
			hub,
			runId: "run-0",
			executeChild,
		};

		const result = await controlForeachNode.run(ctx, {
			items: [1, 2],
			as: "num",
			body: ["child"],
		});

		// Each iteration should have the same sessionId passed to children
		expect(sessionIds[0]).toBe(result.iterations[0].sessionId);
		expect(sessionIds[1]).toBe(result.iterations[1].sessionId);

		// Different iterations should have different session IDs
		expect(sessionIds[0]).not.toBe(sessionIds[1]);
	});

	test("has correct capabilities", () => {
		expect(controlForeachNode.capabilities?.isContainer).toBe(true);
		expect(controlForeachNode.capabilities?.createsSession).toBe(true);
	});

	test("provides iteration context to child nodes", async () => {
		const hub = createHub("test-session");
		hub.startSession();
		const iterationContexts: Array<{
			$iteration: number;
			$first: boolean;
			$last: boolean;
			$maxIterations: number;
		}> = [];

		const executeChild = async (
			_nodeId: string,
			input: Record<string, unknown>,
		) => {
			// Capture the iteration context passed to children
			iterationContexts.push({
				$iteration: input.$iteration as number,
				$first: input.$first as boolean,
				$last: input.$last as boolean,
				$maxIterations: input.$maxIterations as number,
			});
			return { received: input.item };
		};

		const ctx: ContainerNodeContext = {
			hub,
			runId: "run-0",
			executeChild,
		};

		await controlForeachNode.run(ctx, {
			items: ["a", "b", "c"],
			as: "item",
			body: ["process"],
		});

		// Verify iteration context for each iteration
		expect(iterationContexts).toHaveLength(3);

		// First iteration
		expect(iterationContexts[0]).toEqual({
			$iteration: 0,
			$first: true,
			$last: false,
			$maxIterations: 3,
		});

		// Middle iteration
		expect(iterationContexts[1]).toEqual({
			$iteration: 1,
			$first: false,
			$last: false,
			$maxIterations: 3,
		});

		// Last iteration
		expect(iterationContexts[2]).toEqual({
			$iteration: 2,
			$first: false,
			$last: true,
			$maxIterations: 3,
		});
	});

	test("single item array has $first and $last both true", async () => {
		const hub = createHub("test-session");
		hub.startSession();
		let capturedContext: Record<string, unknown> | undefined;

		const executeChild = async (
			_nodeId: string,
			input: Record<string, unknown>,
		) => {
			capturedContext = input;
			return {};
		};

		const ctx: ContainerNodeContext = {
			hub,
			runId: "run-0",
			executeChild,
		};

		await controlForeachNode.run(ctx, {
			items: ["only"],
			as: "item",
			body: ["process"],
		});

		expect(capturedContext?.$iteration).toBe(0);
		expect(capturedContext?.$first).toBe(true);
		expect(capturedContext?.$last).toBe(true);
		expect(capturedContext?.$maxIterations).toBe(1);
	});
});
