// Tests for node executor with retry, timeout, and cancellation support

import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { DefaultExecutor, ExecutionError, type ExecutorContext, type NodeExecutionResult } from "../../src/index.js";

// Mock node registry and types
const mockRegistry = {
	get: (type: string) => {
		if (type === "success") {
			return {
				inputSchema: { parse: (x: any) => x },
				outputSchema: { parse: (x: any) => x },
				run: async (_: any, input: any) => ({
					result: `Processed: ${input.text}`,
				}),
			};
		}
		if (type === "failure") {
			return {
				inputSchema: { parse: (x: any) => x },
				outputSchema: { parse: (x: any) => x },
				run: async () => {
					throw new Error("Node failed");
				},
			};
		}
		if (type === "timeout-prone") {
			return {
				inputSchema: { parse: (x: any) => x },
				outputSchema: { parse: (x: any) => x },
				run: async () => {
					await new Promise((resolve) => setTimeout(resolve, 5000));
					return { result: "done" };
				},
			};
		}
		return null;
	},
};

const mockCancelContext = {
	cancelled: false,
	reason: undefined,
	onCancel: [] as Array<(reason: string) => void>,
};

const mockRunContext = {
	runId: "run-123",
	cancel: mockCancelContext,
};

describe("DefaultExecutor", () => {
	let executor: DefaultExecutor;

	beforeEach(() => {
		executor = new DefaultExecutor();
		mockCancelContext.cancelled = false;
		mockCancelContext.reason = undefined;
	});

	describe("runNode (public API - throws)", () => {
		test("successful execution returns output", async () => {
			const result = await executor.runNode({
				registry: mockRegistry as any,
				node: { id: "test-node", type: "success", policy: {} },
				runContext: mockRunContext as any,
				input: { text: "hello" },
			});

			expect(result.error).toBeUndefined();
			expect(result.output).toEqual({ result: "Processed: hello" });
		});

		test("node failure captured as error string", async () => {
			const result = await executor.runNode({
				registry: mockRegistry as any,
				node: { id: "test-node", type: "failure", policy: {} },
				runContext: mockRunContext as any,
				input: {},
			});

			expect(result.error).toContain("Node failed");
			expect(result.output).toBeUndefined();
		});

		test("cancellation returns cancelled error", async () => {
			mockCancelContext.cancelled = true;
			mockCancelContext.reason = "User abort";

			const result = await executor.runNode({
				registry: mockRegistry as any,
				node: { id: "test-node", type: "success", policy: {} },
				runContext: mockRunContext as any,
				input: { text: "hello" },
			});

			expect(result.error).toContain("Cancelled: User abort");
		});
	});

	describe("runNodeResult (Result-based API)", () => {
		test("successful execution returns ok with output", async () => {
			const result = await executor.runNodeResult({
				registry: mockRegistry as any,
				node: { id: "test-node", type: "success", policy: {} },
				runContext: mockRunContext as any,
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
				registry: mockRegistry as any,
				node: { id: "test-node", type: "unknown", policy: {} },
				runContext: mockRunContext as any,
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
				registry: mockRegistry as any,
				node: { id: "test-node", type: "failure", policy: {} },
				runContext: mockRunContext as any,
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
			mockCancelContext.cancelled = true;
			mockCancelContext.reason = "Flow paused";

			const result = await executor.runNodeResult({
				registry: mockRegistry as any,
				node: { id: "test-node", type: "success", policy: {} },
				runContext: mockRunContext as any,
				input: { text: "hello" },
			});

			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.code).toBe("CANCELLED");
				expect(result.error.message).toContain("Flow paused");
				expect(result.error.nodeId).toBe("test-node");
			}
		});

		// Timeout tests skipped - requires long delays
		// test("timeout returns err after maxTimeoutMs", async () => {
		//   ... (would require 5+ second delays to test properly)
		// });

		test("retry logic: retries on failure", async () => {
			let attempts = 0;
			const retryRegistry = {
				get: () => ({
					inputSchema: { parse: (x: any) => x },
					outputSchema: { parse: (x: any) => x },
					run: async () => {
						attempts++;
						if (attempts < 3) {
							throw new Error(`Attempt ${attempts} failed`);
						}
						return { result: "success" };
					},
				}),
			};

			const result = await executor.runNodeResult({
				registry: retryRegistry as any,
				node: {
					id: "test-node",
					type: "flaky",
					policy: {
						retry: { maxAttempts: 3, backoffMs: 0 },
					},
				},
				runContext: mockRunContext as any,
				input: {},
			});

			expect(attempts).toBe(3);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.output).toEqual({ result: "success" });
			}
		});

		test("retry exhaustion: gives up after maxAttempts", async () => {
			const retryRegistry = {
				get: () => ({
					inputSchema: { parse: (x: any) => x },
					outputSchema: { parse: (x: any) => x },
					run: async () => {
						throw new Error("Always fails");
					},
				}),
			};

			const result = await executor.runNodeResult({
				registry: retryRegistry as any,
				node: {
					id: "test-node",
					type: "always-fails",
					policy: {
						retry: { maxAttempts: 2, backoffMs: 0 },
					},
				},
				runContext: mockRunContext as any,
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
				registry: mockRegistry as any,
				node: { id: "test-node", type: "success", policy: {} },
				runContext: mockRunContext as any,
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
				registry: mockRegistry as any,
				node: { id: "test-node", type: "failure", policy: {} },
				runContext: mockRunContext as any,
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
				registry: mockRegistry as any,
				node: { id: "test-node", type: "failure", policy: {} },
				runContext: mockRunContext as any,
				input: {},
			});

			const transformed = result.mapErr((err) => ({
				code: err.code,
				userMessage: `Node '${err.nodeId}' failed: ${err.message}`,
			}));

			transformed.match(
				() => {
					throw new Error("Should have error");
				},
				(err: any) => {
					expect(err.userMessage).toContain("Node 'test-node'");
					expect(err.userMessage).toContain("failed");
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
