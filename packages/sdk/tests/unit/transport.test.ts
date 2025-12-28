/**
 * Transport Unit Tests
 *
 * Tests for the Transport interface implementation on HarnessInstance.
 * Tests attach(), cleanup, and event subscription behavior.
 *
 * @module tests/unit/transport
 */

import { describe, expect, test } from "bun:test";
import { injectable } from "@needle-di/core";
import type { Attachment, Transport } from "../../src/infra/unified-events/types.js";
import { defineHarness } from "../../src/factory/define-harness.js";
import type { FluentHarnessEvent } from "../../src/harness/event-types.js";

// Simple mock agent for testing
@injectable()
class MockAgent {
	execute(input: string): string {
		return `result-${input}`;
	}
}

describe("Transport - User Story 1: Fire-and-Forget", () => {
	// T012: Unit test for attach() chaining
	describe("attach() chaining", () => {
		test("attach() returns this for method chaining", () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
			});

			const instance = Harness.create();

			// Cast to unknown to access attach() which isn't in HarnessInstance interface yet
			const harness = instance as unknown as { attach: (a: Attachment) => unknown };

			const attachment: Attachment = (_transport) => undefined;
			const result = harness.attach(attachment);

			// Should return same instance for chaining
			expect(result).toBe(harness);
		});

		test("multiple attach() calls chain correctly", () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
			});

			const instance = Harness.create();
			const harness = instance as unknown as { attach: (a: Attachment) => unknown };

			const calls: string[] = [];
			const a1: Attachment = () => {
				calls.push("a1");
				return undefined;
			};
			const a2: Attachment = () => {
				calls.push("a2");
				return undefined;
			};
			const a3: Attachment = () => {
				calls.push("a3");
				return undefined;
			};

			// Chain all three
			const result = harness.attach(a1);
			const result2 = (result as { attach: (a: Attachment) => unknown }).attach(a2);
			const result3 = (result2 as { attach: (a: Attachment) => unknown }).attach(a3);

			// All should return same instance
			expect(result).toBe(harness);
			expect(result2).toBe(harness);
			expect(result3).toBe(harness);
		});

		test("attachments receive transport on run()", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				attach: (a: Attachment) => unknown;
				run: () => Promise<unknown>;
			};

			let receivedTransport: Transport | undefined;
			const attachment: Attachment = (transport) => {
				receivedTransport = transport;
				return undefined;
			};

			harness.attach(attachment);
			await harness.run();

			expect(receivedTransport).toBeDefined();
			// Transport should have subscribe method
			expect(typeof receivedTransport?.subscribe).toBe("function");
		});
	});

	// T013: Unit test for cleanup function invocation
	describe("cleanup function invocation", () => {
		test("sync cleanup functions are called on run() completion", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				attach: (a: Attachment) => unknown;
				run: () => Promise<unknown>;
			};

			let cleanupCalled = false;
			const attachment: Attachment = () => {
				return () => {
					cleanupCalled = true;
				};
			};

			harness.attach(attachment);
			await harness.run();

			expect(cleanupCalled).toBe(true);
		});

		test("async cleanup functions are awaited on run() completion", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				attach: (a: Attachment) => unknown;
				run: () => Promise<unknown>;
			};

			let cleanupCompleted = false;
			const attachment: Attachment = () => {
				return async () => {
					await new Promise((r) => setTimeout(r, 10));
					cleanupCompleted = true;
				};
			};

			harness.attach(attachment);
			await harness.run();

			expect(cleanupCompleted).toBe(true);
		});

		test("cleanup functions are called in reverse order (LIFO)", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				attach: (a: Attachment) => unknown;
				run: () => Promise<unknown>;
			};

			const cleanupOrder: string[] = [];

			const a1: Attachment = () => () => {
				cleanupOrder.push("a1");
			};
			const a2: Attachment = () => () => {
				cleanupOrder.push("a2");
			};
			const a3: Attachment = () => () => {
				cleanupOrder.push("a3");
			};

			harness.attach(a1);
			(harness as { attach: (a: Attachment) => unknown }).attach(a2);
			(harness as { attach: (a: Attachment) => unknown }).attach(a3);
			await harness.run();

			// Cleanup should be in reverse order (LIFO)
			expect(cleanupOrder).toEqual(["a3", "a2", "a1"]);
		});

		test("cleanup is called even when run() throws", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => {
					throw new Error("Intentional failure");
				},
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				attach: (a: Attachment) => unknown;
				run: () => Promise<unknown>;
			};

			let cleanupCalled = false;
			const attachment: Attachment = () => () => {
				cleanupCalled = true;
			};

			harness.attach(attachment);

			try {
				await harness.run();
			} catch {
				// Expected error
			}

			expect(cleanupCalled).toBe(true);
		});

		test("void cleanup return is handled correctly", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				attach: (a: Attachment) => unknown;
				run: () => Promise<unknown>;
			};

			let attachmentCalled = false;
			const attachment: Attachment = () => {
				attachmentCalled = true;
				// Return void (no cleanup)
				return undefined;
			};

			harness.attach(attachment);
			await harness.run();

			expect(attachmentCalled).toBe(true);
		});
	});

	// T014: Unit test for event order consistency
	describe("event order consistency", () => {
		test("all attachments receive events in same order", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async ({ emit }) => {
					emit("custom:event1", { seq: 1 });
					emit("custom:event2", { seq: 2 });
					emit("custom:event3", { seq: 3 });
					return "done";
				},
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				attach: (a: Attachment) => unknown;
				run: () => Promise<unknown>;
			};

			const events1: string[] = [];
			const events2: string[] = [];
			const events3: string[] = [];

			const a1: Attachment = (transport) => {
				transport.subscribe((rawEvent) => {
					const event = rawEvent as unknown as FluentHarnessEvent;
					if (event.type.startsWith("custom:")) {
						events1.push(event.type);
					}
				});
				return undefined;
			};

			const a2: Attachment = (transport) => {
				transport.subscribe((rawEvent) => {
					const event = rawEvent as unknown as FluentHarnessEvent;
					if (event.type.startsWith("custom:")) {
						events2.push(event.type);
					}
				});
				return undefined;
			};

			const a3: Attachment = (transport) => {
				transport.subscribe((rawEvent) => {
					const event = rawEvent as unknown as FluentHarnessEvent;
					if (event.type.startsWith("custom:")) {
						events3.push(event.type);
					}
				});
				return undefined;
			};

			harness.attach(a1);
			(harness as { attach: (a: Attachment) => unknown }).attach(a2);
			(harness as { attach: (a: Attachment) => unknown }).attach(a3);
			await harness.run();

			// All attachments should receive events in same order
			expect(events1).toEqual(["custom:event1", "custom:event2", "custom:event3"]);
			expect(events2).toEqual(events1);
			expect(events3).toEqual(events1);
		});

		test("events are delivered to attachments as they are emitted", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async ({ phase }) => {
					await phase("test-phase", async () => {
						return "phase-result";
					});
					return "done";
				},
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				attach: (a: Attachment) => unknown;
				run: () => Promise<unknown>;
			};

			const receivedEvents: Array<{ type: string; status?: string }> = [];
			const attachment: Attachment = (transport) => {
				transport.subscribe((rawEvent) => {
					const event = rawEvent as unknown as FluentHarnessEvent;
					receivedEvents.push({ type: event.type, status: (event as { status?: string }).status });
				});
				return undefined;
			};

			harness.attach(attachment);
			await harness.run();

			// Should receive phase events (type="phase" with status="start"|"complete")
			const phaseEvents = receivedEvents.filter((e) => e.type === "phase");
			expect(phaseEvents.length).toBeGreaterThanOrEqual(2);

			// Find start and complete events
			const startEvent = phaseEvents.find((e) => e.status === "start");
			const completeEvent = phaseEvents.find((e) => e.status === "complete");
			expect(startEvent).toBeDefined();
			expect(completeEvent).toBeDefined();

			// Start should come before complete
			const startIdx = receivedEvents.findIndex((e) => e.type === "phase" && e.status === "start");
			const completeIdx = receivedEvents.findIndex((e) => e.type === "phase" && e.status === "complete");
			expect(startIdx).toBeLessThan(completeIdx);
		});

		test("multiple attachments with filters receive correct events", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async ({ emit }) => {
					emit("alpha:one", {});
					emit("beta:two", {});
					emit("alpha:three", {});
					emit("beta:four", {});
					return "done";
				},
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				attach: (a: Attachment) => unknown;
				run: () => Promise<unknown>;
			};

			const alphaEvents: string[] = [];
			const betaEvents: string[] = [];

			const alphaAttachment: Attachment = (transport) => {
				transport.subscribe("alpha:*", (rawEvent) => {
					const event = rawEvent as unknown as FluentHarnessEvent;
					alphaEvents.push(event.type);
				});
				return undefined;
			};

			const betaAttachment: Attachment = (transport) => {
				transport.subscribe("beta:*", (rawEvent) => {
					const event = rawEvent as unknown as FluentHarnessEvent;
					betaEvents.push(event.type);
				});
				return undefined;
			};

			harness.attach(alphaAttachment);
			(harness as { attach: (a: Attachment) => unknown }).attach(betaAttachment);
			await harness.run();

			expect(alphaEvents).toEqual(["alpha:one", "alpha:three"]);
			expect(betaEvents).toEqual(["beta:two", "beta:four"]);
		});
	});

	// Additional edge case tests
	describe("edge cases", () => {
		test("attach() throws if called after run() started", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => {
					await new Promise((r) => setTimeout(r, 50));
					return "done";
				},
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				attach: (a: Attachment) => unknown;
				run: () => Promise<unknown>;
			};

			// Start run (don't await)
			const runPromise = harness.run();

			// Give it time to start
			await new Promise((r) => setTimeout(r, 10));

			// Try to attach after run started - should throw
			const attachment: Attachment = () => undefined;
			expect(() => harness.attach(attachment)).toThrow();

			// Wait for run to complete
			await runPromise;
		});

		test("status transitions correctly: idle → running → complete", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				attach: (a: Attachment) => unknown;
				run: () => Promise<unknown>;
				status: string;
			};

			// Initially idle
			expect(harness.status).toBe("idle");

			let statusDuringRun: string | undefined;
			const attachment: Attachment = (transport) => {
				statusDuringRun = (transport as unknown as { status: string }).status;
				return undefined;
			};

			harness.attach(attachment);
			await harness.run();

			// Status during run should be 'running'
			expect(statusDuringRun).toBe("running");

			// After run, status should be 'complete'
			expect(harness.status).toBe("complete");
		});
	});
});

describe("Transport - User Story 2: Interactive Sessions", () => {
	// T022: Unit test for startSession().complete() flow
	describe("startSession().complete() flow", () => {
		test("startSession() enables session mode and returns this", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				startSession: () => unknown;
				sessionActive: boolean;
			};

			// Initially session should be inactive
			expect(harness.sessionActive).toBe(false);

			// startSession() should return this for chaining
			const result = harness.startSession();
			expect(result).toBe(harness);

			// Session should now be active
			expect(harness.sessionActive).toBe(true);
		});

		test("complete() runs workflow and returns result like run()", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done-from-complete",
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				startSession: () => unknown;
				complete: () => Promise<{ result: string }>;
			};

			harness.startSession();
			const { result } = await harness.complete();

			expect(result).toBe("done-from-complete");
		});

		test("session property available in ExecuteContext when sessionActive", async () => {
			let sessionReceived: unknown;

			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async (ctx) => {
					// Session should be available in context
					sessionReceived = (ctx as unknown as { session?: unknown }).session;
					return "done";
				},
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				startSession: () => unknown;
				complete: () => Promise<unknown>;
			};

			harness.startSession();
			await harness.complete();

			expect(sessionReceived).toBeDefined();
			// Session should have waitForUser method
			expect(typeof (sessionReceived as { waitForUser?: unknown }).waitForUser).toBe("function");
		});

		test("session NOT available in ExecuteContext when using run()", async () => {
			let sessionReceived: unknown = "NOT_CHECKED";

			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async (ctx) => {
					sessionReceived = (ctx as unknown as { session?: unknown }).session;
					return "done";
				},
			});

			const instance = Harness.create();
			await instance.run();

			// Session should be undefined when using run() instead of startSession().complete()
			expect(sessionReceived).toBeUndefined();
		});
	});

	// T024: Unit test for commands ignored when session not active
	describe("commands ignored when session not active", () => {
		test("reply() is no-op when session not active", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				reply: (promptId: string, response: { content: string; timestamp: Date }) => void;
				sessionActive: boolean;
				run: () => Promise<unknown>;
			};

			// Session is not active
			expect(harness.sessionActive).toBe(false);

			// reply() should not throw - just be a no-op
			expect(() => {
				harness.reply("prompt-1", { content: "test", timestamp: new Date() });
			}).not.toThrow();

			// Should still be able to run normally
			await harness.run();
		});

		test("send() is no-op when session not active", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				send: (message: string) => void;
				sessionActive: boolean;
				run: () => Promise<unknown>;
			};

			expect(harness.sessionActive).toBe(false);

			// send() should not throw
			expect(() => {
				harness.send("test message");
			}).not.toThrow();

			await harness.run();
		});

		test("sendTo() is no-op when session not active", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				sendTo: (agent: string, message: string) => void;
				sessionActive: boolean;
				run: () => Promise<unknown>;
			};

			expect(harness.sessionActive).toBe(false);

			// sendTo() should not throw
			expect(() => {
				harness.sendTo("some-agent", "test message");
			}).not.toThrow();

			await harness.run();
		});
	});

	// Interactive prompt/reply round-trip
	describe("prompt/reply round-trip", () => {
		test("waitForUser blocks until reply() called", async () => {
			let waitComplete = false;
			let receivedResponse: unknown;

			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async (ctx) => {
					const session = (ctx as unknown as { session: { waitForUser: (p: string) => Promise<{ content: string }> } })
						.session;
					const response = await session.waitForUser("Continue?");
					receivedResponse = response;
					waitComplete = true;
					return "done";
				},
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				startSession: () => unknown;
				complete: () => Promise<unknown>;
				reply: (promptId: string, response: { content: string; timestamp: Date }) => void;
				subscribe: (listener: (event: unknown) => void) => () => void;
			};

			harness.startSession();

			// Capture prompt events to get promptId
			let capturedPromptId: string | undefined;
			harness.subscribe((rawEvent: unknown) => {
				const event = rawEvent as { type: string; promptId?: string };
				if (event.type === "session:prompt" || event.type === "user:prompt") {
					capturedPromptId = event.promptId;
				}
			});

			// Start complete() but don't await yet
			const completePromise = harness.complete();

			// Give workflow time to start and hit waitForUser
			await new Promise((r) => setTimeout(r, 20));

			// Should be waiting, not complete
			expect(waitComplete).toBe(false);

			// Reply to the prompt
			expect(capturedPromptId).toBeDefined();
			if (!capturedPromptId) throw new Error("Test setup failed: no capturedPromptId");
			harness.reply(capturedPromptId, { content: "yes", timestamp: new Date() });

			// Now complete should finish
			await completePromise;

			expect(waitComplete).toBe(true);
			expect((receivedResponse as { content: string }).content).toBe("yes");
		});

		test("reply() with unknown promptId is ignored", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				startSession: () => unknown;
				complete: () => Promise<unknown>;
				reply: (promptId: string, response: { content: string; timestamp: Date }) => void;
			};

			harness.startSession();

			// Reply to non-existent prompt should not throw
			expect(() => {
				harness.reply("non-existent-prompt", { content: "test", timestamp: new Date() });
			}).not.toThrow();

			// Should still complete normally
			await harness.complete();
		});

		test("user:prompt event emitted when waitForUser called", async () => {
			const receivedEvents: Array<{ type: string; prompt?: string; promptId?: string }> = [];

			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async (ctx) => {
					const session = (ctx as unknown as { session: { waitForUser: (p: string) => Promise<unknown> } }).session;
					// Start waiting but we'll reply immediately
					setTimeout(() => {
						const harness = instance as unknown as { reply: (id: string, r: unknown) => void };
						// Find promptId from events
						const promptEvent = receivedEvents.find((e) => e.type === "session:prompt" || e.type === "user:prompt");
						if (promptEvent?.promptId) {
							harness.reply(promptEvent.promptId, { content: "ok", timestamp: new Date() });
						}
					}, 10);
					await session.waitForUser("Please confirm");
					return "done";
				},
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				startSession: () => unknown;
				complete: () => Promise<unknown>;
				subscribe: (listener: (event: unknown) => void) => () => void;
			};

			harness.startSession();
			harness.subscribe((event: unknown) => {
				const e = event as { type: string; prompt?: string; promptId?: string };
				receivedEvents.push(e);
			});

			await harness.complete();

			// Should have received prompt event
			const promptEvent = receivedEvents.find((e) => e.type === "session:prompt" || e.type === "user:prompt");
			expect(promptEvent).toBeDefined();
			expect(promptEvent?.prompt).toBe("Please confirm");
			expect(promptEvent?.promptId).toBeDefined();
		});

		test("user:reply event emitted when reply() resolves waitForUser", async () => {
			const receivedEvents: Array<{ type: string; promptId?: string; response?: unknown }> = [];

			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async (ctx) => {
					const session = (ctx as unknown as { session: { waitForUser: (p: string) => Promise<unknown> } }).session;
					await session.waitForUser("Confirm?");
					return "done";
				},
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				startSession: () => unknown;
				complete: () => Promise<unknown>;
				subscribe: (listener: (event: unknown) => void) => () => void;
				reply: (id: string, r: unknown) => void;
			};

			harness.startSession();
			harness.subscribe((event: unknown) => {
				receivedEvents.push(event as { type: string; promptId?: string; response?: unknown });
			});

			// Start complete
			const completePromise = harness.complete();
			await new Promise((r) => setTimeout(r, 10));

			// Find and reply to prompt
			const promptEvent = receivedEvents.find((e) => e.type === "session:prompt" || e.type === "user:prompt");
			expect(promptEvent?.promptId).toBeDefined();
			if (!promptEvent?.promptId) throw new Error("Test setup failed: no promptEvent with promptId");
			harness.reply(promptEvent.promptId, { content: "confirmed", timestamp: new Date() });

			await completePromise;

			// Should have received reply event
			const replyEvent = receivedEvents.find((e) => e.type === "session:reply" || e.type === "user:reply");
			expect(replyEvent).toBeDefined();
			expect(replyEvent?.promptId).toBe(promptEvent?.promptId);
		});
	});
});

describe("Transport - User Story 3: WebSocket/SSE Bridge", () => {
	// T035: Unit test for send(message) queuing
	describe("send(message) queuing", () => {
		test("send() queues message when session active", async () => {
			let receivedMessages: Array<{ content: string }> = [];

			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async (ctx) => {
					const session = (
						ctx as unknown as {
							session: {
								hasMessages: () => boolean;
								readMessages: () => Array<{ content: string }>;
							};
						}
					).session;

					// Wait for messages to be injected
					await new Promise((r) => setTimeout(r, 30));

					if (session.hasMessages()) {
						receivedMessages = session.readMessages();
					}
					return "done";
				},
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				startSession: () => unknown;
				complete: () => Promise<unknown>;
				send: (message: string) => void;
			};

			harness.startSession();

			// Start workflow
			const completePromise = harness.complete();

			// Inject messages
			await new Promise((r) => setTimeout(r, 10));
			harness.send("message-1");
			harness.send("message-2");

			await completePromise;

			expect(receivedMessages).toHaveLength(2);
			expect(receivedMessages[0]?.content).toBe("message-1");
			expect(receivedMessages[1]?.content).toBe("message-2");
		});

		test("send() is no-op when session not active (T043)", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				send: (message: string) => void;
				run: () => Promise<unknown>;
			};

			// Should not throw when session not active
			expect(() => harness.send("test")).not.toThrow();
			await harness.run();
		});
	});

	// T036: Unit test for sendTo(agent, message)
	describe("sendTo(agent, message)", () => {
		test("sendTo() queues message with agent targeting", async () => {
			let receivedMessages: Array<{ content: string; agent?: string }> = [];

			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async (ctx) => {
					const session = (
						ctx as unknown as {
							session: {
								hasMessages: () => boolean;
								readMessages: () => Array<{ content: string; agent?: string }>;
							};
						}
					).session;

					await new Promise((r) => setTimeout(r, 30));

					if (session.hasMessages()) {
						receivedMessages = session.readMessages();
					}
					return "done";
				},
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				startSession: () => unknown;
				complete: () => Promise<unknown>;
				sendTo: (agent: string, message: string) => void;
			};

			harness.startSession();
			const completePromise = harness.complete();

			await new Promise((r) => setTimeout(r, 10));
			harness.sendTo("coder", "Write a function");
			harness.sendTo("reviewer", "Review the code");

			await completePromise;

			expect(receivedMessages).toHaveLength(2);
			expect(receivedMessages[0]?.content).toBe("Write a function");
			expect(receivedMessages[0]?.agent).toBe("coder");
			expect(receivedMessages[1]?.content).toBe("Review the code");
			expect(receivedMessages[1]?.agent).toBe("reviewer");
		});

		test("sendTo() is no-op when session not active (T043)", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				sendTo: (agent: string, message: string) => void;
				run: () => Promise<unknown>;
			};

			expect(() => harness.sendTo("agent", "test")).not.toThrow();
			await harness.run();
		});
	});

	// T037: Unit test for async iterator over events
	describe("async iterator over events", () => {
		test("[Symbol.asyncIterator]() yields events as they are emitted", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async ({ emit }) => {
					emit("custom:one", { seq: 1 });
					await new Promise((r) => setTimeout(r, 10));
					emit("custom:two", { seq: 2 });
					await new Promise((r) => setTimeout(r, 10));
					emit("custom:three", { seq: 3 });
					return "done";
				},
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				startSession: () => unknown;
				complete: () => Promise<unknown>;
				[Symbol.asyncIterator]: () => AsyncIterator<{ type: string }>;
			};

			harness.startSession();

			const collectedEvents: Array<{ type: string }> = [];

			// Start collecting events in background
			const collectPromise = (async () => {
				for await (const event of harness) {
					collectedEvents.push(event);
					// Stop after we've collected enough events
					if (collectedEvents.length >= 3) break;
				}
			})();

			// Run the workflow
			await harness.complete();

			// Give iterator time to finish
			await Promise.race([collectPromise, new Promise((r) => setTimeout(r, 100))]);

			// Should have collected custom events
			const customEvents = collectedEvents.filter((e) => e.type.startsWith("custom:"));
			expect(customEvents.length).toBeGreaterThanOrEqual(1);
		});

		test("async iterator completes when harness completes", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async ({ emit }) => {
					emit("test:event", {});
					return "done";
				},
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				startSession: () => unknown;
				complete: () => Promise<unknown>;
				[Symbol.asyncIterator]: () => AsyncIterator<{ type: string }>;
			};

			harness.startSession();

			let iteratorDone = false;
			const events: Array<{ type: string }> = [];

			// Start iterating
			const iteratePromise = (async () => {
				for await (const event of harness) {
					events.push(event);
				}
				iteratorDone = true;
			})();

			// Complete the workflow
			await harness.complete();

			// Wait a bit for iterator to finish
			await Promise.race([iteratePromise, new Promise((r) => setTimeout(r, 100))]);

			expect(iteratorDone).toBe(true);
			expect(events.length).toBeGreaterThan(0);
		});
	});
});

// =============================================================================
// User Story 4: Graceful Abort Handling
// =============================================================================
describe("Transport - User Story 4: Graceful Abort Handling", () => {
	// T044: Unit test for abort(reason) setting status to aborted
	describe("abort(reason) sets status to aborted", () => {
		test("abort() transitions status from running to aborted", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => {
					// Long running work that will be aborted
					await new Promise((r) => setTimeout(r, 100));
					return "done";
				},
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				startSession: () => unknown;
				status: string;
				abort: (reason?: string) => void;
				complete: () => Promise<unknown>;
			};

			harness.startSession();
			const completePromise = harness.complete();

			// Wait for run to start
			await new Promise((r) => setTimeout(r, 10));
			expect(harness.status).toBe("running");

			// Abort the workflow
			harness.abort("Timeout");

			// Status should be aborted
			expect(harness.status).toBe("aborted");

			// Let the promise settle (may reject or resolve)
			try {
				await completePromise;
			} catch {
				// Expected - abort may cause rejection
			}
		});

		test("abort() emits session:abort event", async () => {
			const events: Array<{ type: string; reason?: string }> = [];

			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => {
					await new Promise((r) => setTimeout(r, 100));
					return "done";
				},
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				startSession: () => unknown;
				subscribe: (listener: (event: unknown) => void) => () => void;
				abort: (reason?: string) => void;
				complete: () => Promise<unknown>;
			};

			harness.startSession();
			harness.subscribe((event: unknown) => {
				events.push(event as { type: string; reason?: string });
			});

			const completePromise = harness.complete();
			await new Promise((r) => setTimeout(r, 10));

			harness.abort("User cancelled");

			try {
				await completePromise;
			} catch {
				// Expected
			}

			// Should have session:abort event
			const abortEvent = events.find((e) => e.type === "session:abort");
			expect(abortEvent).toBeDefined();
			expect(abortEvent?.reason).toBe("User cancelled");
		});
	});

	// T046: Unit test for abort() idempotency
	describe("abort() idempotency", () => {
		test("second abort() call is no-op", async () => {
			const events: Array<{ type: string }> = [];

			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => {
					await new Promise((r) => setTimeout(r, 100));
					return "done";
				},
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				startSession: () => unknown;
				subscribe: (listener: (event: unknown) => void) => () => void;
				status: string;
				abort: (reason?: string) => void;
				complete: () => Promise<unknown>;
			};

			harness.startSession();
			harness.subscribe((event: unknown) => {
				events.push(event as { type: string });
			});

			const completePromise = harness.complete();
			await new Promise((r) => setTimeout(r, 10));

			// First abort
			harness.abort("First");
			expect(harness.status).toBe("aborted");

			const abortEventsAfterFirst = events.filter((e) => e.type === "session:abort").length;

			// Second abort - should be no-op
			harness.abort("Second");
			expect(harness.status).toBe("aborted");

			const abortEventsAfterSecond = events.filter((e) => e.type === "session:abort").length;

			// Should only have one abort event
			expect(abortEventsAfterSecond).toBe(abortEventsAfterFirst);

			try {
				await completePromise;
			} catch {
				// Expected
			}
		});

		test("abort() when status is complete does nothing", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				run: () => Promise<unknown>;
				status: string;
				abort: (reason?: string) => void;
			};

			await harness.run();
			expect(harness.status).toBe("complete");

			// Abort after completion
			harness.abort("Too late");

			// Status should still be complete
			expect(harness.status).toBe("complete");
		});
	});

	// T047: Unit test for cleanup functions called on abort
	describe("cleanup functions called on abort", () => {
		test("all cleanup functions called when abort() is called", async () => {
			const cleanupCalls: string[] = [];

			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => {
					await new Promise((r) => setTimeout(r, 100));
					return "done";
				},
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				startSession: () => unknown;
				attach: (attachment: (transport: unknown) => () => void) => unknown;
				abort: (reason?: string) => void;
				complete: () => Promise<unknown>;
			};

			// Attach multiple consumers with cleanup functions
			harness.attach(() => () => {
				cleanupCalls.push("cleanup1");
			});
			harness.attach(() => () => {
				cleanupCalls.push("cleanup2");
			});
			harness.attach(() => () => {
				cleanupCalls.push("cleanup3");
			});

			harness.startSession();
			const completePromise = harness.complete();

			await new Promise((r) => setTimeout(r, 10));

			// Abort
			harness.abort("Cleanup test");

			try {
				await completePromise;
			} catch {
				// Expected - abort causes rejection
			}

			// All cleanups should have been called
			expect(cleanupCalls).toContain("cleanup1");
			expect(cleanupCalls).toContain("cleanup2");
			expect(cleanupCalls).toContain("cleanup3");
		});

		test("cleanup functions called in reverse order on abort", async () => {
			const cleanupOrder: number[] = [];

			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => {
					await new Promise((r) => setTimeout(r, 100));
					return "done";
				},
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				startSession: () => unknown;
				attach: (attachment: (transport: unknown) => () => void) => unknown;
				abort: (reason?: string) => void;
				complete: () => Promise<unknown>;
			};

			harness.attach(() => () => {
				cleanupOrder.push(1);
			});
			harness.attach(() => () => {
				cleanupOrder.push(2);
			});
			harness.attach(() => () => {
				cleanupOrder.push(3);
			});

			harness.startSession();
			const completePromise = harness.complete();

			await new Promise((r) => setTimeout(r, 10));
			harness.abort();

			try {
				await completePromise;
			} catch {
				// Expected
			}

			// Cleanup should be in reverse order: 3, 2, 1
			expect(cleanupOrder).toEqual([3, 2, 1]);
		});
	});

	// T045 is in session-context.test.ts

	describe("abort() without session active", () => {
		test("abort() is no-op when session not active", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				sessionActive: boolean;
				abort: (reason?: string) => void;
				run: () => Promise<unknown>;
			};

			expect(harness.sessionActive).toBe(false);

			// abort() should not throw when session not active
			expect(() => harness.abort("test")).not.toThrow();

			// Should still be able to run normally
			await harness.run();
		});
	});
});

// =============================================================================
// User Story 5: Conditional Attachment Based on Environment
// =============================================================================
describe("Transport - User Story 5: Conditional Attachment", () => {
	// T055: Unit test for harness running with no attachments
	describe("harness runs with no attachments", () => {
		test("harness runs successfully without any attachments", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "completed without attachments",
			});

			const instance = Harness.create();

			// No attach() calls - should still work
			const result = await instance.run();

			expect(result.result).toBe("completed without attachments");
		});

		test("events are still collected without attachments", async () => {
			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async ({ emit }) => {
					emit("task:start", { taskId: "1" });
					emit("task:end", { taskId: "1" });
					return "done";
				},
			});

			const instance = Harness.create();
			const result = await instance.run();

			// Events should be collected even without attachments
			const taskEvents = result.events.filter((e) => e.type.startsWith("task:"));
			expect(taskEvents.length).toBe(2);
		});
	});

	// T056: Unit test for conditional attach() based on env
	describe("conditional attach() based on environment", () => {
		test("attach() only called when condition is true", async () => {
			const attachmentCalled: string[] = [];

			const debugEnabled = true;
			const metricsEnabled = false;

			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				attach: (attachment: (transport: unknown) => void) => unknown;
				run: () => Promise<unknown>;
			};

			// Conditionally attach based on "environment"
			if (debugEnabled) {
				harness.attach(() => {
					attachmentCalled.push("debug");
				});
			}
			if (metricsEnabled) {
				harness.attach(() => {
					attachmentCalled.push("metrics");
				});
			}

			await harness.run();

			// Only debug attachment should have been called
			expect(attachmentCalled).toEqual(["debug"]);
		});

		test("no attachments when all conditions are false", async () => {
			const attachmentCalled: string[] = [];

			const debugEnabled = false;
			const metricsEnabled = false;

			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				attach: (attachment: (transport: unknown) => void) => unknown;
				run: () => Promise<unknown>;
			};

			if (debugEnabled) {
				harness.attach(() => {
					attachmentCalled.push("debug");
				});
			}
			if (metricsEnabled) {
				harness.attach(() => {
					attachmentCalled.push("metrics");
				});
			}

			const result = await harness.run();

			// No attachments should have been called
			expect(attachmentCalled).toEqual([]);
			// But harness should still run successfully
			expect((result as { result: string }).result).toBe("done");
		});
	});

	// T057: Unit test for pre-registered attachments via options
	describe("pre-registered attachments via options", () => {
		test("attachments in options are called when run() starts", async () => {
			const attachmentCalled: string[] = [];

			const preRegisteredAttachment = () => {
				attachmentCalled.push("pre-registered");
			};

			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
				attachments: [preRegisteredAttachment],
			});

			const instance = Harness.create();
			await instance.run();

			// Pre-registered attachment should have been called
			expect(attachmentCalled).toContain("pre-registered");
		});

		test("pre-registered attachments work alongside attach()", async () => {
			const attachmentOrder: string[] = [];

			const preRegisteredAttachment = () => {
				attachmentOrder.push("pre-registered");
			};

			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
				attachments: [preRegisteredAttachment],
			});

			const instance = Harness.create();
			const harness = instance as unknown as {
				attach: (attachment: (transport: unknown) => void) => unknown;
				run: () => Promise<unknown>;
			};

			// Add another attachment via attach()
			harness.attach(() => {
				attachmentOrder.push("runtime-attached");
			});

			await harness.run();

			// Both attachments should have been called
			expect(attachmentOrder).toContain("pre-registered");
			expect(attachmentOrder).toContain("runtime-attached");
		});

		test("pre-registered attachments cleanup functions are called", async () => {
			const cleanupCalled: string[] = [];

			const preRegisteredAttachment = () => () => {
				cleanupCalled.push("pre-registered-cleanup");
			};

			const Harness = defineHarness({
				agents: { agent: MockAgent },
				run: async () => "done",
				attachments: [preRegisteredAttachment],
			});

			const instance = Harness.create();
			await instance.run();

			// Cleanup should have been called
			expect(cleanupCalled).toContain("pre-registered-cleanup");
		});
	});
});
