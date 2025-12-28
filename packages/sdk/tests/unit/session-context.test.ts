/**
 * SessionContext Unit Tests
 *
 * Tests for the interactive session runtime context.
 *
 * @module tests/unit/session-context
 */

import { beforeEach, describe, expect, test } from "bun:test";
import type { InjectedMessage, UserResponse } from "../../src/core/unified-events/types.js";
import { AsyncQueue } from "../../src/harness/async-queue.js";
import { SessionContext, type SessionContextDeps } from "../../src/harness/session-context.js";

/**
 * Deferred promise helper for tests
 */
interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason?: unknown) => void;
}

// Helper for creating deferred promises - may be used in future tests
function _createDeferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe("SessionContext", () => {
	let messageQueue: AsyncQueue<InjectedMessage>;
	let promptResolvers: Map<string, Deferred<UserResponse>>;
	let abortController: AbortController;
	let emittedPrompts: Array<{ promptId: string; prompt: string; choices?: string[] }>;
	let promptIdCounter: number;
	let session: SessionContext;

	beforeEach(() => {
		messageQueue = new AsyncQueue<InjectedMessage>();
		promptResolvers = new Map();
		abortController = new AbortController();
		emittedPrompts = [];
		promptIdCounter = 0;

		const deps: SessionContextDeps = {
			messageQueue,
			promptResolvers,
			abortController,
			emitPrompt: (promptId, prompt, choices) => {
				emittedPrompts.push({ promptId, prompt, choices });
			},
			generatePromptId: () => `prompt-${++promptIdCounter}`,
		};

		session = new SessionContext(deps);
	});

	describe("waitForUser", () => {
		test("emits prompt event and blocks until reply", async () => {
			// Start waiting (don't await yet)
			const waitPromise = session.waitForUser("Continue?");

			// Verify prompt was emitted
			expect(emittedPrompts).toHaveLength(1);
			expect(emittedPrompts[0]).toEqual({
				promptId: "prompt-1",
				prompt: "Continue?",
				choices: undefined,
			});

			// Verify a resolver was registered
			expect(promptResolvers.has("prompt-1")).toBe(true);

			// Simulate transport.reply()
			const resolver = promptResolvers.get("prompt-1");
			expect(resolver).toBeDefined();
			resolver?.resolve({
				content: "yes",
				timestamp: new Date(),
			});

			// Wait should now resolve
			const response = await waitPromise;
			expect(response.content).toBe("yes");
		});

		test("passes choices to emit callback", async () => {
			const choices = ["Yes", "No", "Maybe"];
			const waitPromise = session.waitForUser("Pick one", { choices });

			expect(emittedPrompts[0]?.choices).toEqual(choices);

			// Resolve to complete the test
			promptResolvers.get("prompt-1")?.resolve({
				content: "Yes",
				choice: "Yes",
				timestamp: new Date(),
			});

			const response = await waitPromise;
			expect(response.choice).toBe("Yes");
		});

		test("throws when already aborted", async () => {
			abortController.abort();

			await expect(session.waitForUser("Hello?")).rejects.toThrow("Session aborted");
		});

		test("throws when aborted during wait", async () => {
			const waitPromise = session.waitForUser("Waiting...");

			// Abort while waiting
			abortController.abort();

			await expect(waitPromise).rejects.toThrow("Session aborted");
		});

		test("validates response with validator", async () => {
			const waitPromise = session.waitForUser("Enter number", {
				validator: (input) => {
					const num = Number.parseInt(input, 10);
					if (Number.isNaN(num)) return "Must be a number";
					return true;
				},
			});

			// Resolve with invalid input
			promptResolvers.get("prompt-1")?.resolve({
				content: "not-a-number",
				timestamp: new Date(),
			});

			await expect(waitPromise).rejects.toThrow("Must be a number");
		});

		test("validator returning false gives generic error", async () => {
			const waitPromise = session.waitForUser("Enter something", {
				validator: () => false,
			});

			promptResolvers.get("prompt-1")?.resolve({
				content: "anything",
				timestamp: new Date(),
			});

			await expect(waitPromise).rejects.toThrow("Invalid response");
		});

		test("cleans up resolver after completion", async () => {
			const waitPromise = session.waitForUser("Test");

			expect(promptResolvers.size).toBe(1);

			promptResolvers.get("prompt-1")?.resolve({
				content: "done",
				timestamp: new Date(),
			});

			await waitPromise;

			// Resolver should be cleaned up
			expect(promptResolvers.size).toBe(0);
		});

		test("cleans up resolver on abort", async () => {
			const waitPromise = session.waitForUser("Test");

			expect(promptResolvers.size).toBe(1);

			abortController.abort();

			try {
				await waitPromise;
			} catch {
				// Expected
			}

			// Resolver should be cleaned up
			expect(promptResolvers.size).toBe(0);
		});
	});

	describe("hasMessages", () => {
		test("returns false when queue is empty", () => {
			expect(session.hasMessages()).toBe(false);
		});

		test("returns true when messages are available", () => {
			messageQueue.push({
				content: "hello",
				timestamp: new Date(),
			});

			expect(session.hasMessages()).toBe(true);
		});
	});

	describe("readMessages", () => {
		test("returns empty array when no messages", () => {
			expect(session.readMessages()).toEqual([]);
		});

		test("returns and clears all messages", () => {
			const msg1: InjectedMessage = { content: "first", timestamp: new Date() };
			const msg2: InjectedMessage = { content: "second", timestamp: new Date() };
			const msg3: InjectedMessage = { content: "third", agent: "agent1", timestamp: new Date() };

			messageQueue.push(msg1);
			messageQueue.push(msg2);
			messageQueue.push(msg3);

			const messages = session.readMessages();

			expect(messages).toHaveLength(3);
			expect(messages[0]?.content).toBe("first");
			expect(messages[1]?.content).toBe("second");
			expect(messages[2]?.content).toBe("third");
			expect(messages[2]?.agent).toBe("agent1");

			// Queue should be empty now
			expect(session.hasMessages()).toBe(false);
			expect(session.readMessages()).toEqual([]);
		});
	});

	describe("isAborted", () => {
		test("returns false initially", () => {
			expect(session.isAborted()).toBe(false);
		});

		test("returns true after abort", () => {
			abortController.abort();
			expect(session.isAborted()).toBe(true);
		});
	});
});
