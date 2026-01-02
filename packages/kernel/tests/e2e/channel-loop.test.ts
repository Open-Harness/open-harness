/**
 * E2E Validation: Channel Loop Test
 *
 * This test validates the core architecture:
 * Executor → Hub → Channel → (commands back) → Hub
 *
 * We need to prove:
 * 1. Events flow from executor through hub to channel
 * 2. Channel can inject commands back into hub
 * 3. The loop works with REAL components (not mocks)
 */

import { beforeEach, describe, expect, it } from "bun:test";
import { HubImpl } from "../../src/engine/hub.js";
import { executeFlow } from "../../src/flow/executor.js";
import { constantNode } from "../../src/flow/nodes/constant.js";
import { echoNode } from "../../src/flow/nodes/echo.js";
import { NodeRegistry } from "../../src/flow/registry.js";
import type { EnrichedEvent } from "../../src/protocol/events.js";
import type { FlowYaml } from "../../src/protocol/flow.js";
import type { Attachment, Cleanup } from "../../src/protocol/flow-runtime.js";

/**
 * TestChannel: A minimal channel for E2E validation
 *
 * Records all events received and can inject commands.
 * This is NOT a mock - it attaches to a real hub.
 */
class TestChannel {
	public events: EnrichedEvent[] = [];
	public eventTypes: string[] = [];
	private cleanup: Cleanup = undefined;
	private hub: HubImpl | null = null;

	/**
	 * Returns an Attachment function that can be used with hub
	 */
	toAttachment(): Attachment {
		return (hub) => {
			this.hub = hub as HubImpl;
			const unsubscribe = hub.subscribe("*", (event) => {
				this.events.push(event);
				this.eventTypes.push(event.event.type);
			});
			this.cleanup = unsubscribe;
			return unsubscribe;
		};
	}

	/**
	 * Inject a message into the hub
	 */
	send(message: string): void {
		if (!this.hub) throw new Error("Channel not attached");
		this.hub.send(message);
	}

	/**
	 * Reply to a prompt
	 */
	reply(promptId: string, content: string): void {
		if (!this.hub) throw new Error("Channel not attached");
		this.hub.reply(promptId, { content, timestamp: new Date() });
	}

	/**
	 * Abort the flow
	 */
	abort(reason?: string): void {
		if (!this.hub) throw new Error("Channel not attached");
		this.hub.abort({ reason });
	}

	/**
	 * Get events of a specific type
	 */
	getEventsOfType(type: string): EnrichedEvent[] {
		return this.events.filter((e) => e.event.type === type);
	}

	/**
	 * Check if a specific event type was received
	 */
	hasEventType(type: string): boolean {
		return this.eventTypes.includes(type);
	}

	/**
	 * Detach from hub
	 */
	detach(): void {
		if (typeof this.cleanup === "function") {
			this.cleanup();
		}
		this.hub = null;
	}
}

describe("Channel Loop E2E", () => {
	let hub: HubImpl;
	let registry: NodeRegistry;
	let channel: TestChannel;

	beforeEach(() => {
		hub = new HubImpl("e2e-test-session");
		registry = new NodeRegistry();
		registry.register(echoNode);
		registry.register(constantNode);
		channel = new TestChannel();
	});

	it("should receive events from flow execution", async () => {
		// Arrange: Simple flow with one node
		const flow: FlowYaml = {
			flow: { name: "e2e-test-flow" },
			nodes: [
				{
					id: "node1",
					type: "echo",
					input: { text: "Hello from E2E test" },
				},
			],
			edges: [],
		};

		// Attach channel to hub
		const attachment = channel.toAttachment();
		attachment(hub);

		// Create execution context
		const phase = async <T>(name: string, fn: () => Promise<T>) => {
			return hub.scoped({ phase: { name } }, async () => {
				hub.emit({ type: "phase:start", name });
				const result = await fn();
				hub.emit({ type: "phase:complete", name });
				return result;
			});
		};

		const task = async <T>(id: string, fn: () => Promise<T>) => {
			return hub.scoped({ task: { id } }, async () => {
				hub.emit({ type: "task:start", taskId: id });
				const result = await fn();
				hub.emit({ type: "task:complete", taskId: id });
				return result;
			});
		};

		// Act: Execute flow
		hub.setStatus("running");
		hub.startSession();
		hub.emit({ type: "harness:start", name: flow.flow.name });

		const result = await executeFlow(flow, registry, { hub, phase, task });

		hub.emit({ type: "harness:complete", success: true });
		hub.setStatus("complete");

		// Assert: Channel received events
		expect(channel.events.length).toBeGreaterThan(0);
		expect(channel.hasEventType("harness:start")).toBe(true);
		expect(channel.hasEventType("phase:start")).toBe(true);
		expect(channel.hasEventType("task:start")).toBe(true);
		expect(channel.hasEventType("task:complete")).toBe(true);
		expect(channel.hasEventType("phase:complete")).toBe(true);
		expect(channel.hasEventType("harness:complete")).toBe(true);

		// Assert: Flow produced correct output
		const output = result.outputs.node1 as { text: string };
		expect(output.text).toBe("Hello from E2E test");

		channel.detach();
	});

	it("should allow channel to inject commands", async () => {
		// Attach channel
		const attachment = channel.toAttachment();
		attachment(hub);
		hub.startSession();

		// Act: Channel sends a message
		channel.send("User input from channel");

		// Assert: Hub received the message event
		expect(channel.hasEventType("session:message")).toBe(true);
		const messageEvent = channel.getEventsOfType("session:message")[0];
		expect(messageEvent?.event).toMatchObject({
			type: "session:message",
			content: "User input from channel",
		});

		channel.detach();
	});

	it("should allow channel to abort flow", async () => {
		// Attach channel
		const attachment = channel.toAttachment();
		attachment(hub);
		hub.setStatus("running");
		hub.startSession();

		// Act: Channel aborts
		channel.abort("User requested abort");

		// Assert: Hub status changed and abort event emitted
		expect(hub.status).toBe("aborted");
		expect(channel.hasEventType("session:abort")).toBe(true);
		const abortEvent = channel.getEventsOfType("session:abort")[0];
		expect(abortEvent?.event).toMatchObject({
			type: "session:abort",
			reason: "User requested abort",
		});

		channel.detach();
	});

	it("should allow channel to reply to prompts", async () => {
		// Attach channel
		const attachment = channel.toAttachment();
		attachment(hub);
		hub.startSession();

		// Simulate a prompt being emitted
		hub.emit({
			type: "session:prompt",
			promptId: "prompt-123",
			prompt: "Choose an option",
			choices: ["A", "B"],
		});

		// Act: Channel replies to prompt
		channel.reply("prompt-123", "Option A");

		// Assert: Reply event was emitted
		expect(channel.hasEventType("session:reply")).toBe(true);
		const replyEvent = channel.getEventsOfType("session:reply")[0];
		expect(replyEvent?.event).toMatchObject({
			type: "session:reply",
			promptId: "prompt-123",
			content: "Option A",
		});

		channel.detach();
	});

	it("should support multiple channels simultaneously", async () => {
		// Create two channels
		const channel1 = new TestChannel();
		const channel2 = new TestChannel();

		// Attach both to same hub
		channel1.toAttachment()(hub);
		channel2.toAttachment()(hub);
		hub.startSession();

		// Emit an event
		hub.emit({ type: "test:event", data: "hello" });

		// Both channels should receive it
		expect(channel1.hasEventType("test:event")).toBe(true);
		expect(channel2.hasEventType("test:event")).toBe(true);

		// One channel sends a command
		channel1.send("Message from channel 1");

		// Both channels should see the message event
		expect(channel1.hasEventType("session:message")).toBe(true);
		expect(channel2.hasEventType("session:message")).toBe(true);

		channel1.detach();
		channel2.detach();
	});

	it("should work with multi-node flow", async () => {
		// Flow with multiple nodes
		const flow: FlowYaml = {
			flow: { name: "multi-node-flow" },
			nodes: [
				{
					id: "const1",
					type: "constant",
					input: { value: "First" },
				},
				{
					id: "echo1",
					type: "echo",
					input: { text: "{{ const1.value }}" },
				},
			],
			edges: [{ from: "const1", to: "echo1" }],
		};

		// Attach channel
		const attachment = channel.toAttachment();
		attachment(hub);

		const phase = async <T>(name: string, fn: () => Promise<T>) => {
			return hub.scoped({ phase: { name } }, async () => {
				hub.emit({ type: "phase:start", name });
				const result = await fn();
				hub.emit({ type: "phase:complete", name });
				return result;
			});
		};

		const task = async <T>(id: string, fn: () => Promise<T>) => {
			return hub.scoped({ task: { id } }, async () => {
				hub.emit({ type: "task:start", taskId: id });
				const result = await fn();
				hub.emit({ type: "task:complete", taskId: id });
				return result;
			});
		};

		hub.setStatus("running");
		hub.startSession();

		const result = await executeFlow(flow, registry, { hub, phase, task });

		hub.setStatus("complete");

		// Should have task events for each node
		const taskStartEvents = channel.getEventsOfType("task:start");
		const taskCompleteEvents = channel.getEventsOfType("task:complete");

		expect(taskStartEvents.length).toBe(2);
		expect(taskCompleteEvents.length).toBe(2);

		// Verify execution order via context
		expect(result.outputs.const1).toMatchObject({ value: "First" });
		expect(result.outputs.echo1).toMatchObject({ text: "First" });

		channel.detach();
	});
});
