/**
 * Executor Node Events Tests
 *
 * Tests for Phase 3 execution events:
 * - node:start emitted before node execution
 * - node:complete emitted after successful execution
 * - node:error emitted on failure
 * - node:skipped emitted when node is skipped
 */

import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { HubImpl } from "../../src/engine/hub.js";
import { executeFlow } from "../../src/flow/executor.js";
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

	// Simple echo node
	registry.register({
		type: "test.echo",
		inputSchema: z.object({ value: z.string() }),
		outputSchema: z.object({ result: z.string() }),
		run: async (_ctx, input: { value: string }) => ({
			result: input.value,
		}),
	});

	// Failing node
	registry.register({
		type: "test.fail",
		inputSchema: z.object({}),
		outputSchema: z.object({}),
		run: async () => {
			throw new Error("Intentional failure");
		},
	});

	// Slow node (for duration testing)
	registry.register({
		type: "test.slow",
		inputSchema: z.object({ delayMs: z.number() }),
		outputSchema: z.object({ done: z.boolean() }),
		run: async (_ctx, input: { delayMs: number }) => {
			await new Promise((r) => setTimeout(r, input.delayMs));
			return { done: true };
		},
	});

	return registry;
}

describe("Executor Node Events", () => {
	describe("node:start", () => {
		it("emits node:start before node execution", async () => {
			const hub = new HubImpl("test-session");
			const registry = createRegistry();
			const events: BaseEvent[] = [];

			hub.subscribe("node:*", (e: EnrichedEvent) => {
				events.push(e.event);
			});

			const flow: FlowYaml = {
				flow: { name: "test" },
				nodes: [{ id: "echo1", type: "test.echo", input: { value: "hello" } }],
				edges: [],
			};

			await executeFlow(flow, registry, createTestContext(hub));

			const startEvent = events.find((e) => e.type === "node:start");
			expect(startEvent).toBeDefined();
			expect(startEvent).toMatchObject({
				type: "node:start",
				nodeId: "echo1",
				nodeType: "test.echo",
			});
		});

		it("emits node:start before node:complete", async () => {
			const hub = new HubImpl("test-session");
			const registry = createRegistry();
			const eventTypes: string[] = [];

			hub.subscribe("node:*", (e: EnrichedEvent) => {
				eventTypes.push(e.event.type);
			});

			const flow: FlowYaml = {
				flow: { name: "test" },
				nodes: [{ id: "echo1", type: "test.echo", input: { value: "hello" } }],
				edges: [],
			};

			await executeFlow(flow, registry, createTestContext(hub));

			const startIdx = eventTypes.indexOf("node:start");
			const completeIdx = eventTypes.indexOf("node:complete");

			expect(startIdx).toBeLessThan(completeIdx);
		});
	});

	describe("node:complete", () => {
		it("emits node:complete with output and duration", async () => {
			const hub = new HubImpl("test-session");
			const registry = createRegistry();
			const events: BaseEvent[] = [];

			hub.subscribe("node:complete", (e: EnrichedEvent) => {
				events.push(e.event);
			});

			const flow: FlowYaml = {
				flow: { name: "test" },
				nodes: [{ id: "echo1", type: "test.echo", input: { value: "hello" } }],
				edges: [],
			};

			await executeFlow(flow, registry, createTestContext(hub));

			expect(events).toHaveLength(1);
			const completeEvent = events[0] as {
				type: string;
				nodeId: string;
				output: unknown;
				durationMs: number;
			};
			expect(completeEvent.nodeId).toBe("echo1");
			expect(completeEvent.output).toEqual({ result: "hello" });
			expect(completeEvent.durationMs).toBeGreaterThanOrEqual(0);
		});

		it("includes accurate duration for slow nodes", async () => {
			const hub = new HubImpl("test-session");
			const registry = createRegistry();
			const events: BaseEvent[] = [];

			hub.subscribe("node:complete", (e: EnrichedEvent) => {
				events.push(e.event);
			});

			const flow: FlowYaml = {
				flow: { name: "test" },
				nodes: [{ id: "slow1", type: "test.slow", input: { delayMs: 50 } }],
				edges: [],
			};

			await executeFlow(flow, registry, createTestContext(hub));

			const completeEvent = events[0] as {
				type: string;
				durationMs: number;
			};
			expect(completeEvent.durationMs).toBeGreaterThanOrEqual(50);
		});
	});

	describe("node:error", () => {
		it("emits node:error on failure", async () => {
			const hub = new HubImpl("test-session");
			const registry = createRegistry();
			const events: BaseEvent[] = [];

			hub.subscribe("node:error", (e: EnrichedEvent) => {
				events.push(e.event);
			});

			const flow: FlowYaml = {
				flow: { name: "test", policy: { failFast: false } },
				nodes: [{ id: "fail1", type: "test.fail", input: {} }],
				edges: [],
			};

			await executeFlow(flow, registry, createTestContext(hub));

			expect(events).toHaveLength(1);
			const errorEvent = events[0] as {
				type: string;
				nodeId: string;
				error: string;
				stack?: string;
			};
			expect(errorEvent.nodeId).toBe("fail1");
			expect(errorEvent.error).toBe("Intentional failure");
			expect(errorEvent.stack).toBeDefined();
		});

		it("emits node:start before node:error", async () => {
			const hub = new HubImpl("test-session");
			const registry = createRegistry();
			const eventTypes: string[] = [];

			hub.subscribe("node:*", (e: EnrichedEvent) => {
				eventTypes.push(e.event.type);
			});

			const flow: FlowYaml = {
				flow: { name: "test", policy: { failFast: false } },
				nodes: [{ id: "fail1", type: "test.fail", input: {} }],
				edges: [],
			};

			await executeFlow(flow, registry, createTestContext(hub));

			const startIdx = eventTypes.indexOf("node:start");
			const errorIdx = eventTypes.indexOf("node:error");

			expect(startIdx).toBeLessThan(errorIdx);
		});
	});

	describe("node:skipped", () => {
		it("emits node:skipped with reason 'when' for condition skip", async () => {
			const hub = new HubImpl("test-session");
			const registry = createRegistry();
			const events: BaseEvent[] = [];

			hub.subscribe("node:skipped", (e: EnrichedEvent) => {
				events.push(e.event);
			});

			// Node has when clause that requires run=true, but we pass run=false
			const flow: FlowYaml = {
				flow: { name: "test" },
				nodes: [
					{
						id: "echo1",
						type: "test.echo",
						input: { value: "hello" },
						when: { equals: { var: "flow.input.run", value: true } },
					},
				],
				edges: [],
			};

			// Pass run=false so the when clause evaluates to false, skipping the node
			await executeFlow(flow, registry, createTestContext(hub), {
				run: false,
			});

			expect(events).toHaveLength(1);
			const skipEvent = events[0] as {
				type: string;
				nodeId: string;
				reason: string;
			};
			expect(skipEvent.nodeId).toBe("echo1");
			expect(skipEvent.reason).toBe("when");
		});

		it("emits node:skipped with reason 'edge' for edge skip", async () => {
			const hub = new HubImpl("test-session");
			const registry = createRegistry();
			const events: BaseEvent[] = [];

			hub.subscribe("node:skipped", (e: EnrichedEvent) => {
				events.push(e.event);
			});

			// Node B depends on Node A via edge with condition that won't fire
			const flow: FlowYaml = {
				flow: { name: "test" },
				nodes: [
					{ id: "nodeA", type: "test.echo", input: { value: "a" } },
					{ id: "nodeB", type: "test.echo", input: { value: "b" } },
				],
				edges: [
					{
						from: "nodeA",
						to: "nodeB",
						when: { equals: { var: "nodeA.result", value: "never-matches" } },
					},
				],
			};

			await executeFlow(flow, registry, createTestContext(hub));

			const skipEvent = events.find(
				(e) => (e as { nodeId: string }).nodeId === "nodeB",
			) as { type: string; nodeId: string; reason: string } | undefined;

			expect(skipEvent).toBeDefined();
			expect(skipEvent?.reason).toBe("edge");
		});

		it("does not emit node:start for skipped nodes", async () => {
			const hub = new HubImpl("test-session");
			const registry = createRegistry();
			const startEvents: string[] = [];

			hub.subscribe("node:start", (e: EnrichedEvent) => {
				startEvents.push((e.event as { type: string; nodeId: string }).nodeId);
			});

			const flow: FlowYaml = {
				flow: { name: "test" },
				nodes: [
					{
						id: "skipped1",
						type: "test.echo",
						input: { value: "hello" },
						when: { equals: { var: "flow.input.run", value: false } },
					},
				],
				edges: [],
			};

			await executeFlow(flow, registry, createTestContext(hub), { run: true });

			// Node should be skipped, no start event
			expect(startEvents).not.toContain("skipped1");
		});
	});

	describe("multi-node flows", () => {
		it("emits events in execution order", async () => {
			const hub = new HubImpl("test-session");
			const registry = createRegistry();
			const events: { type: string; nodeId: string }[] = [];

			hub.subscribe("node:*", (e: EnrichedEvent) => {
				const evt = e.event as { type: string; nodeId: string };
				events.push({ type: evt.type, nodeId: evt.nodeId });
			});

			const flow: FlowYaml = {
				flow: { name: "test" },
				nodes: [
					{ id: "a", type: "test.echo", input: { value: "a" } },
					{ id: "b", type: "test.echo", input: { value: "b" } },
					{ id: "c", type: "test.echo", input: { value: "c" } },
				],
				edges: [
					{ from: "a", to: "b" },
					{ from: "b", to: "c" },
				],
			};

			await executeFlow(flow, registry, createTestContext(hub));

			// Should see: start(a), complete(a), start(b), complete(b), start(c), complete(c)
			expect(events).toEqual([
				{ type: "node:start", nodeId: "a" },
				{ type: "node:complete", nodeId: "a" },
				{ type: "node:start", nodeId: "b" },
				{ type: "node:complete", nodeId: "b" },
				{ type: "node:start", nodeId: "c" },
				{ type: "node:complete", nodeId: "c" },
			]);
		});
	});
});
