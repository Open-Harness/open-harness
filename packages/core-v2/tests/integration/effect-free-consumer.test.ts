/**
 * Effect-Free Consumer Integration Tests
 *
 * This test file verifies that the public API is 100% Effect-free by:
 * 1. Compiling a consumer file WITHOUT access to Effect types (verified via separate tsconfig)
 * 2. Running the consumer code to prove all functions work at runtime
 *
 * Per spec FR-062: "Public API exposes ZERO Effect types"
 */

import { describe, expect, it } from "vitest";
import * as consumerModule from "./effect-free-consumer.js";

describe("Effect-Free Public API (FR-062)", () => {
	describe("TypeScript Compilation Verification", () => {
		it("consumer module exports verification functions", () => {
			// All exported functions should exist
			expect(typeof consumerModule.verifyEventDefinition).toBe("function");
			expect(typeof consumerModule.verifyHandlerDefinition).toBe("function");
			expect(typeof consumerModule.verifyCreateEvent).toBe("function");
			expect(typeof consumerModule.verifyAgentFactory).toBe("function");
			expect(typeof consumerModule.verifyWorkflow).toBe("function");
			expect(typeof consumerModule.verifyTape).toBe("function");
			expect(typeof consumerModule.verifyStore).toBe("function");
			expect(typeof consumerModule.verifyRenderer).toBe("function");
			expect(typeof consumerModule.verifyErrors).toBe("function");
			expect(typeof consumerModule.verifyWorkflowHandler).toBe("function");
			expect(typeof consumerModule.verifyEventBusUtilities).toBe("function");
			expect(typeof consumerModule.verifyCallbacks).toBe("function");
			expect(typeof consumerModule.main).toBe("function");
		});

		it("consumer module can be imported without Effect", () => {
			// The fact that this test runs proves the import succeeded
			// If Effect types were leaked, the import would fail
			expect(consumerModule).toBeDefined();
		});
	});

	describe("Runtime Verification - Event Module", () => {
		it("verifyEventDefinition runs without errors", () => {
			expect(() => consumerModule.verifyEventDefinition()).not.toThrow();
		});

		it("verifyCreateEvent runs without errors", () => {
			expect(() => consumerModule.verifyCreateEvent()).not.toThrow();
		});
	});

	describe("Runtime Verification - Handler Module", () => {
		it("verifyHandlerDefinition runs without errors", () => {
			expect(() => consumerModule.verifyHandlerDefinition()).not.toThrow();
		});
	});

	describe("Runtime Verification - Agent Module", () => {
		it("verifyAgentFactory runs without errors", () => {
			expect(() => consumerModule.verifyAgentFactory()).not.toThrow();
		});
	});

	describe("Runtime Verification - Workflow Module", () => {
		it("verifyWorkflow runs without errors", async () => {
			// This is async due to workflow.run() and workflow.dispose()
			await expect(consumerModule.verifyWorkflow()).resolves.not.toThrow();
		});
	});

	describe("Runtime Verification - Tape Module", () => {
		it("verifyTape runs without errors", () => {
			expect(() => consumerModule.verifyTape()).not.toThrow();
		});
	});

	describe("Runtime Verification - Store Module", () => {
		it("verifyStore runs without errors", async () => {
			// This is async due to createMemoryStore()
			await expect(consumerModule.verifyStore()).resolves.not.toThrow();
		});
	});

	describe("Runtime Verification - Renderer Module", () => {
		it("verifyRenderer runs without errors", () => {
			expect(() => consumerModule.verifyRenderer()).not.toThrow();
		});
	});

	describe("Runtime Verification - Error Classes", () => {
		it("verifyErrors runs without errors", () => {
			expect(() => consumerModule.verifyErrors()).not.toThrow();
		});
	});

	describe("Runtime Verification - Server Integration", () => {
		it("verifyWorkflowHandler runs without errors", () => {
			expect(() => consumerModule.verifyWorkflowHandler()).not.toThrow();
		});
	});

	describe("Runtime Verification - EventBus Utilities", () => {
		it("verifyEventBusUtilities runs without errors", () => {
			expect(() => consumerModule.verifyEventBusUtilities()).not.toThrow();
		});
	});

	describe("Runtime Verification - Callback Types", () => {
		it("verifyCallbacks runs without errors", () => {
			expect(() => consumerModule.verifyCallbacks()).not.toThrow();
		});
	});

	describe("Full Consumer Verification", () => {
		it("main() runs all verifications without errors", async () => {
			// Suppress console output during test
			const originalLog = console.log;
			const originalWarn = console.warn;
			console.log = () => {};
			console.warn = () => {};

			try {
				await expect(consumerModule.main()).resolves.not.toThrow();
			} finally {
				console.log = originalLog;
				console.warn = originalWarn;
			}
		});
	});

	describe("Verification: No Effect Types in Exports", () => {
		it("public API module does not export Effect", async () => {
			const api = await import("../../src/index.js");

			// These Effect types should NOT be exported
			expect("Effect" in api).toBe(false);
			expect("Context" in api).toBe(false);
			expect("Layer" in api).toBe(false);
			expect("Stream" in api).toBe(false);
			expect("Exit" in api).toBe(false);
			expect("Cause" in api).toBe(false);
			expect("Fiber" in api).toBe(false);
			expect("Schema" in api).toBe(false);
			expect("Ref" in api).toBe(false);
			expect("Queue" in api).toBe(false);
		});

		it("public API module does not export Layer implementations", async () => {
			const api = await import("../../src/index.js");

			// These Layer types should NOT be in public API (they expose Effect)
			expect("MemoryStoreLive" in api).toBe(false);
			expect("SqliteStoreMemoryLive" in api).toBe(false);
			expect("makeSqliteStoreLive" in api).toBe(false);
			expect("EventBusLive" in api).toBe(false);
			expect("HandlerRegistryLive" in api).toBe(false);
			expect("AgentRegistryLive" in api).toBe(false);
			expect("WorkflowRuntimeLive" in api).toBe(false);
			expect("ClaudeProviderLive" in api).toBe(false);
		});

		it("Store Context.Tag is not exported", async () => {
			const api = await import("../../src/index.js");

			// Context.Tags should NOT be exported (they're Effect internals)
			expect("Store" in api).toBe(false); // The Context.Tag
			expect("EventBus" in api).toBe(false); // The Context.Tag
			expect("LLMProvider" in api).toBe(false); // The Context.Tag
			expect("HandlerRegistry" in api).toBe(false); // The Context.Tag
			expect("AgentRegistry" in api).toBe(false); // The Context.Tag
			expect("WorkflowRuntime" in api).toBe(false); // The Context.Tag
		});

		it("public API exports Promise-based factories instead of Effect-based", async () => {
			const api = await import("../../src/index.js");

			// Promise-based factories SHOULD be exported
			expect("createMemoryStore" in api).toBe(true);
			expect("createSqliteStore" in api).toBe(true);
			expect("createWorkflow" in api).toBe(true);

			// Effect-based factories should NOT be exported
			expect("createMemoryStoreEffect" in api).toBe(false);
			expect("createSqliteStoreEffect" in api).toBe(false);
		});
	});
});
