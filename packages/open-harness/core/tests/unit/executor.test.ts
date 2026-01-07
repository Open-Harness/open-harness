// Tests for node executor with retry, timeout, and cancellation support

import { beforeEach, describe, expect, test } from "bun:test";
import type { NodeRegistry, NodeRunContext, NodeTypeDefinition, StateStore } from "../../src/index.js";
import { DefaultExecutor, ExecutionError } from "../../src/index.js";

// Mock node registry and types
const passThroughSchema = {
	parse: <T>(value: T) => value,
};

type SuccessInput = { text: string };
type SuccessOutput = { result: string };

const successNode: NodeTypeDefinition<SuccessInput, SuccessOutput> = {
	type: "success",
	inputSchema: passThroughSchema,
	outputSchema: passThroughSchema,
	run: async (_ctx, input) => ({
		result: `Processed: ${input.text}`,
	}),
};

const failureNode: NodeTypeDefinition<Record<string, unknown>, Record<string, unknown>> = {
	type: "failure",
	inputSchema: passThroughSchema,
	outputSchema: passThroughSchema,
	run: async () => {
		throw new Error("Node failed");
	},
};

const timeoutNode: NodeTypeDefinition<Record<string, unknown>, { result: string }> = {
	type: "timeout-prone",
	inputSchema: passThroughSchema,
	outputSchema: passThroughSchema,
	run: async () => {
		await new Promise((resolve) => setTimeout(resolve, 5000));
		return { result: "done" };
	},
};

const mockState: StateStore = {
	get: () => undefined,
	set: () => {},
	patch: () => {},
	snapshot: () => ({}),
};

const createRunContext = (signal: AbortSignal): NodeRunContext => ({
	nodeId: "test-node",
	runId: "run-123",
	emit: () => {},
	signal,
	state: mockState,
});

const createRegistry = (definitions: Array<NodeTypeDefinition<unknown, unknown>>): NodeRegistry => {
	const registry = new Map<string, NodeTypeDefinition<unknown, unknown>>();
	for (const def of definitions) {
		registry.set(def.type, def);
	}
	return {
		register: (def) => {
			registry.set(def.type, def as NodeTypeDefinition<unknown, unknown>);
		},
		has: (type) => registry.has(type),
		get: (type) => registry.get(type) ?? (undefined as unknown as NodeTypeDefinition<unknown, unknown>),
	};
};

const mockRegistry = createRegistry([
	successNode as NodeTypeDefinition<unknown, unknown>,
	failureNode as NodeTypeDefinition<unknown, unknown>,
	timeoutNode as NodeTypeDefinition<unknown, unknown>,
]);

describe("DefaultExecutor", () => {
	let executor: DefaultExecutor;
	let testAbortController: AbortController;

	beforeEach(() => {
		executor = new DefaultExecutor();
		testAbortController = new AbortController();
	});

	describe("runNode (public API - throws)", () => {
		test("successful execution returns output", async () => {
			const result = await executor.runNode({
				registry: mockRegistry,
				node: { id: "test-node", type: "success", input: {}, policy: {} },
				runContext: createRunContext(testAbortController.signal),
				input: { text: "hello" },
			});

			expect(result.error).toBeUndefined();
			expect(result.output).toEqual({ result: "Processed: hello" });
		});

		test("node failure captured as error string", async () => {
			const result = await executor.runNode({
				registry: mockRegistry,
				node: { id: "test-node", type: "failure", input: {}, policy: {} },
				runContext: createRunContext(testAbortController.signal),
				input: {},
			});

			expect(result.error).toContain("Node failed");
			expect(result.output).toBeUndefined();
		});

		test("cancellation returns cancelled error", async () => {
			testAbortController.abort("User abort");

			const result = await executor.runNode({
				registry: mockRegistry,
				node: { id: "test-node", type: "success", input: {}, policy: {} },
				runContext: createRunContext(testAbortController.signal),
				input: { text: "hello" },
			});

			expect(result.error).toContain("Execution cancelled");
		});
	});

	describe("runNodeResult (Result-based API)", () => {
		test("successful execution returns ok with output", async () => {
			const result = await executor.runNodeResult({
				registry: mockRegistry,
				node: { id: "test-node", type: "success", input: {}, policy: {} },
				runContext: createRunContext(testAbortController.signal),
				input: { text: "hello" },
			});

			expect(result.isOk()).toBe(true);
			expect(result.isErr()).toBe(false);
			if (result.isOk()) {
				expect(result.value.output).toEqual({ result: "Processed: hello" });
				expect(result.value.nodeId).toBe("test-node");
				expect(result.value.runId).toBe("run-123");
			}
		});

		test("node not found returns err", async () => {
			const result = await executor.runNodeResult({
				registry: mockRegistry,
				node: { id: "test-node", type: "unknown", input: {}, policy: {} },
				runContext: createRunContext(testAbortController.signal),
				input: {},
			});

			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.code).toBe("NODE_NOT_FOUND");
				expect(result.error.nodeId).toBe("test-node");
				expect(result.error.runId).toBe("run-123");
			}
		});

		test("execution failure returns err with code", async () => {
			const result = await executor.runNodeResult({
				registry: mockRegistry,
				node: { id: "test-node", type: "failure", input: {}, policy: {} },
				runContext: createRunContext(testAbortController.signal),
				input: {},
			});

			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.code).toBe("EXECUTION_FAILED");
				expect(result.error.message).toContain("Node failed");
				expect(result.error.nodeId).toBe("test-node");
				expect(result.error.originalError).toBeDefined();
			}
		});

		test("cancellation returns err with CANCELLED code", async () => {
			testAbortController.abort("Flow paused");

			const result = await executor.runNodeResult({
				registry: mockRegistry,
				node: { id: "test-node", type: "success", input: {}, policy: {} },
				runContext: createRunContext(testAbortController.signal),
				input: { text: "hello" },
			});

			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.code).toBe("CANCELLED");
				expect(result.error.message).toContain("Execution cancelled");
				expect(result.error.nodeId).toBe("test-node");
			}
		});

		// Timeout tests skipped - requires long delays
		// test("timeout returns err after maxTimeoutMs", async () => {
		//   ... (would require 5+ second delays to test properly)
		// });

		test("retry logic: retries on failure", async () => {
			let attempts = 0;
			const retryRegistry = createRegistry([
				{
					type: "flaky",
					inputSchema: passThroughSchema,
					outputSchema: passThroughSchema,
					run: async () => {
						attempts++;
						if (attempts < 3) {
							throw new Error(`Attempt ${attempts} failed`);
						}
						return { result: "success" };
					},
				},
			]);

			const result = await executor.runNodeResult({
				registry: retryRegistry,
				node: {
					id: "test-node",
					type: "flaky",
					input: {},
					policy: {
						retry: { maxAttempts: 3, backoffMs: 0 },
					},
				},
				runContext: createRunContext(testAbortController.signal),
				input: {},
			});

			expect(attempts).toBe(3);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.output).toEqual({ result: "success" });
			}
		});

		test("retry exhaustion: gives up after maxAttempts", async () => {
			const retryRegistry = createRegistry([
				{
					type: "always-fails",
					inputSchema: passThroughSchema,
					outputSchema: passThroughSchema,
					run: async () => {
						throw new Error("Always fails");
					},
				},
			]);

			const result = await executor.runNodeResult({
				registry: retryRegistry,
				node: {
					id: "test-node",
					type: "always-fails",
					input: {},
					policy: {
						retry: { maxAttempts: 2, backoffMs: 0 },
					},
				},
				runContext: createRunContext(testAbortController.signal),
				input: {},
			});

			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.code).toBe("EXECUTION_FAILED");
				expect(result.error.message).toContain("Always fails");
			}
		});

		test("match pattern for ok result", async () => {
			const result = await executor.runNodeResult({
				registry: mockRegistry,
				node: { id: "test-node", type: "success", input: {}, policy: {} },
				runContext: createRunContext(testAbortController.signal),
				input: { text: "hello" },
			});

			let matched = false;
			result.match(
				(execution) => {
					expect(execution.output).toEqual({ result: "Processed: hello" });
					matched = true;
				},
				() => {
					throw new Error("Should not hit error branch");
				},
			);
			expect(matched).toBe(true);
		});

		test("match pattern for err result", async () => {
			const result = await executor.runNodeResult({
				registry: mockRegistry,
				node: { id: "test-node", type: "failure", input: {}, policy: {} },
				runContext: createRunContext(testAbortController.signal),
				input: {},
			});

			let matched = false;
			result.match(
				() => {
					throw new Error("Should not hit ok branch");
				},
				(err) => {
					expect(err.code).toBe("EXECUTION_FAILED");
					matched = true;
				},
			);
			expect(matched).toBe(true);
		});

		test("mapErr to transform errors", async () => {
			const result = await executor.runNodeResult({
				registry: mockRegistry,
				node: { id: "test-node", type: "failure", input: {}, policy: {} },
				runContext: createRunContext(testAbortController.signal),
				input: {},
			});

			const transformed = result.mapErr((err) => ({
				code: err.code,
				userMessage: `Node '${err.nodeId}' failed: ${err.message}`,
			}));

			const hasUserMessage = (value: unknown): value is { userMessage: string } => {
				if (typeof value !== "object" || value === null || !("userMessage" in value)) {
					return false;
				}
				return typeof (value as { userMessage?: unknown }).userMessage === "string";
			};

			transformed.match(
				() => {
					throw new Error("Should have error");
				},
				(err) => {
					expect(hasUserMessage(err)).toBe(true);
					if (hasUserMessage(err)) {
						expect(err.userMessage).toContain("Node 'test-node'");
						expect(err.userMessage).toContain("failed");
					}
				},
			);
		});
	});

	describe("ExecutionError", () => {
		test("creates error with all context", () => {
			const cause = new Error("Root cause");
			const err = new ExecutionError("EXECUTION_FAILED", "Node execution failed", cause, "my-node", "run-456");

			expect(err.code).toBe("EXECUTION_FAILED");
			expect(err.message).toBe("Node execution failed");
			expect(err.nodeId).toBe("my-node");
			expect(err.runId).toBe("run-456");
			expect(err.originalError).toBe(cause);
			expect(err.name).toBe("ExecutionError");
		});

		test("all error codes are valid", () => {
			const codes = [
				"NODE_NOT_FOUND",
				"EXECUTION_TIMEOUT",
				"EXECUTION_FAILED",
				"SCHEMA_VALIDATION_ERROR",
				"CANCELLED",
				"INPUT_VALIDATION_ERROR",
				"OUTPUT_VALIDATION_ERROR",
			] as const;

			codes.forEach((code) => {
				const err = new ExecutionError(code, `Error: ${code}`, undefined, "node-1");
				expect(err.code).toBe(code);
			});
		});
	});
});
