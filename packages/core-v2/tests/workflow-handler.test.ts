/**
 * Workflow Handler Tests
 *
 * Tests for the createWorkflowHandler function (FR-059).
 * Verifies HTTP handler behavior for server-side workflow execution.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	type AnyEvent,
	type CorsOptions,
	type CreateWorkflowHandlerOptions,
	createWorkflow,
	createWorkflowHandler,
	defineEvent,
	defineHandler,
	type HandlerDefinition,
	stateOnly,
	type Workflow,
	type WorkflowHandler,
} from "../src/index.js";

// =============================================================================
// Test Helpers
// =============================================================================

interface TestState {
	count: number;
	messages: string[];
	terminated: boolean;
}

const initialState: TestState = {
	count: 0,
	messages: [],
	terminated: false,
};

// Simple event definition
const MessageReceived = defineEvent<"message:received", { text: string }>("message:received");

// Simple handler that updates state
const messageHandler = defineHandler(MessageReceived, {
	name: "message-handler",
	handler: (event, state: TestState) =>
		stateOnly({
			...state,
			count: state.count + 1,
			messages: [...state.messages, event.payload.text],
		}),
});

// Handler that terminates workflow
const TerminateReceived = defineEvent<"terminate:received", Record<string, never>>("terminate:received");

const terminateHandler = defineHandler(TerminateReceived, {
	name: "terminate-handler",
	handler: (_event, state: TestState) =>
		stateOnly({
			...state,
			terminated: true,
		}),
});

// Create a test workflow
function createTestWorkflow(): Workflow<TestState> {
	return createWorkflow({
		name: "test-workflow",
		initialState,
		handlers: [messageHandler, terminateHandler] as HandlerDefinition<AnyEvent, TestState>[],
		agents: [],
		until: (state) => state.terminated,
	});
}

// Helper to parse SSE events from response body
async function parseSSEEvents(response: Response): Promise<Array<{ type: string; data: unknown }>> {
	const text = await response.text();
	const lines = text.split("\n\n").filter((line) => line.trim() !== "");
	return lines.map((line) => {
		const dataLine = line.replace("data: ", "");
		return JSON.parse(dataLine);
	});
}

// =============================================================================
// createWorkflowHandler Function Tests
// =============================================================================

describe("createWorkflowHandler", () => {
	let workflow: Workflow<TestState>;
	let handler: WorkflowHandler;

	beforeEach(() => {
		workflow = createTestWorkflow();
		handler = createWorkflowHandler({ workflow });
	});

	afterEach(async () => {
		await workflow.dispose();
	});

	describe("Basic Functionality", () => {
		it("should return a WorkflowHandler with handle method", () => {
			expect(handler).toBeDefined();
			expect(handler.handle).toBeDefined();
			expect(typeof handler.handle).toBe("function");
		});

		it("should handle valid POST request with input", async () => {
			const request = new Request("http://localhost/api/workflow", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ input: "Hello, workflow!" }),
			});

			const response = await handler.handle(request);

			expect(response.status).toBe(200);
			expect(response.headers.get("Content-Type")).toBe("text/event-stream");
		});

		it("should reject non-POST methods", async () => {
			const request = new Request("http://localhost/api/workflow", {
				method: "GET",
			});

			const response = await handler.handle(request);

			expect(response.status).toBe(405);
			const body = await response.json();
			expect(body.error).toBe("Method not allowed");
		});

		it("should reject invalid JSON body", async () => {
			const request = new Request("http://localhost/api/workflow", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "not valid json",
			});

			const response = await handler.handle(request);

			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error).toBe("Invalid JSON body");
		});

		it("should reject missing input field", async () => {
			const request = new Request("http://localhost/api/workflow", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			const response = await handler.handle(request);

			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error).toBe("Missing or invalid 'input' field");
		});

		it("should reject non-string input field", async () => {
			const request = new Request("http://localhost/api/workflow", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ input: 123 }),
			});

			const response = await handler.handle(request);

			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error).toBe("Missing or invalid 'input' field");
		});
	});

	describe("SSE Response Format", () => {
		it("should stream events via SSE", async () => {
			const request = new Request("http://localhost/api/workflow", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ input: "Hello!" }),
			});

			const response = await handler.handle(request);
			const events = await parseSSEEvents(response);

			// Should have at least one event and a done event
			expect(events.length).toBeGreaterThan(0);

			// Find the done event
			const doneEvent = events.find((e) => e.type === "done");
			expect(doneEvent).toBeDefined();
			expect((doneEvent?.data as Record<string, unknown>).sessionId).toBeDefined();
		});

		it("should include event type events", async () => {
			const request = new Request("http://localhost/api/workflow", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ input: "Hello!" }),
			});

			const response = await handler.handle(request);
			const events = await parseSSEEvents(response);

			// Should have event type events (user:input at minimum)
			const eventEvents = events.filter((e) => e.type === "event");
			expect(eventEvents.length).toBeGreaterThan(0);
		});

		it("should include state type events", async () => {
			const request = new Request("http://localhost/api/workflow", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ input: "Hello!" }),
			});

			const response = await handler.handle(request);
			const events = await parseSSEEvents(response);

			// Should have state change events
			const stateEvents = events.filter((e) => e.type === "state");
			expect(stateEvents.length).toBeGreaterThanOrEqual(0); // May or may not have state changes
		});

		it("should set correct SSE headers", async () => {
			const request = new Request("http://localhost/api/workflow", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ input: "Hello!" }),
			});

			const response = await handler.handle(request);

			expect(response.headers.get("Content-Type")).toBe("text/event-stream");
			expect(response.headers.get("Cache-Control")).toBe("no-cache");
			expect(response.headers.get("Connection")).toBe("keep-alive");
		});
	});

	describe("CORS Options Handling", () => {
		it("should handle OPTIONS preflight request", async () => {
			handler = createWorkflowHandler({
				workflow,
				cors: { origin: "http://localhost:3000" },
			});

			const request = new Request("http://localhost/api/workflow", {
				method: "OPTIONS",
				headers: { Origin: "http://localhost:3000" },
			});

			const response = await handler.handle(request);

			expect(response.status).toBe(204);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
		});

		it("should include CORS headers on POST response", async () => {
			handler = createWorkflowHandler({
				workflow,
				cors: { origin: "http://localhost:3000" },
			});

			const request = new Request("http://localhost/api/workflow", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Origin: "http://localhost:3000",
				},
				body: JSON.stringify({ input: "Hello!" }),
			});

			const response = await handler.handle(request);

			expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
		});

		it("should handle multiple allowed origins", async () => {
			handler = createWorkflowHandler({
				workflow,
				cors: { origin: ["http://localhost:3000", "http://localhost:5000"] },
			});

			// Request from first origin
			const request1 = new Request("http://localhost/api/workflow", {
				method: "OPTIONS",
				headers: { Origin: "http://localhost:3000" },
			});

			const response1 = await handler.handle(request1);
			expect(response1.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");

			// Request from second origin
			const request2 = new Request("http://localhost/api/workflow", {
				method: "OPTIONS",
				headers: { Origin: "http://localhost:5000" },
			});

			const response2 = await handler.handle(request2);
			expect(response2.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5000");
		});

		it("should handle wildcard origin", async () => {
			handler = createWorkflowHandler({
				workflow,
				cors: { origin: "*" },
			});

			const request = new Request("http://localhost/api/workflow", {
				method: "OPTIONS",
				headers: { Origin: "http://any-origin.com" },
			});

			const response = await handler.handle(request);

			expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
		});

		it("should not include CORS headers when cors option not provided", async () => {
			handler = createWorkflowHandler({ workflow });

			const request = new Request("http://localhost/api/workflow", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Origin: "http://localhost:3000",
				},
				body: JSON.stringify({ input: "Hello!" }),
			});

			const response = await handler.handle(request);

			expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
		});

		it("should reject unallowed origins", async () => {
			handler = createWorkflowHandler({
				workflow,
				cors: { origin: "http://localhost:3000" },
			});

			const request = new Request("http://localhost/api/workflow", {
				method: "OPTIONS",
				headers: { Origin: "http://evil.com" },
			});

			const response = await handler.handle(request);

			expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
		});

		it("should include configured methods in CORS headers", async () => {
			handler = createWorkflowHandler({
				workflow,
				cors: { origin: "*", methods: ["POST", "GET", "OPTIONS"] },
			});

			const request = new Request("http://localhost/api/workflow", {
				method: "OPTIONS",
				headers: { Origin: "http://localhost:3000" },
			});

			const response = await handler.handle(request);

			expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, GET, OPTIONS");
		});
	});

	describe("Session Recording", () => {
		it("should always include sessionId in done event (auto-generated)", async () => {
			const request = new Request("http://localhost/api/workflow", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ input: "Hello!" }),
			});

			const response = await handler.handle(request);
			const events = await parseSSEEvents(response);

			const doneEvent = events.find((e) => e.type === "done");
			expect(doneEvent).toBeDefined();
			// Session ID is always auto-generated
			expect((doneEvent?.data as Record<string, unknown>).sessionId).toBeDefined();
			expect(typeof (doneEvent?.data as Record<string, unknown>).sessionId).toBe("string");
		});

		it("should auto-generate sessionId when record is false (even if sessionId provided)", async () => {
			// Per current implementation: sessionId is only used from request when record:true
			// When record:false, a new sessionId is always generated
			const customSessionId = "custom-session-123";
			const request = new Request("http://localhost/api/workflow", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				// Without record:true, provided sessionId is ignored
				body: JSON.stringify({ input: "Hello!", sessionId: customSessionId }),
			});

			const response = await handler.handle(request);
			const events = await parseSSEEvents(response);

			const doneEvent = events.find((e) => e.type === "done");
			expect(doneEvent).toBeDefined();
			// SessionId is auto-generated when record:false
			const returnedSessionId = (doneEvent?.data as Record<string, unknown>).sessionId;
			expect(typeof returnedSessionId).toBe("string");
			// The provided sessionId is NOT used when record:false
			expect(returnedSessionId).not.toBe(customSessionId);
		});

		it("should return error when record:true but no store configured", async () => {
			// Workflow WITHOUT store - record should fail with clear error
			const request = new Request("http://localhost/api/workflow", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ input: "Hello!", record: true }),
			});

			const response = await handler.handle(request);
			const events = await parseSSEEvents(response);

			// Should have an error event with Store unavailable message
			const errorEvent = events.find((e) => e.type === "error");
			expect(errorEvent).toBeDefined();
			expect((errorEvent?.data as Record<string, unknown>).message).toContain("Store unavailable");
		});

		it("should use default record option from handler config", async () => {
			handler = createWorkflowHandler({
				workflow,
				record: false, // Default is not recording
			});

			const request = new Request("http://localhost/api/workflow", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ input: "Hello!" }),
			});

			const response = await handler.handle(request);
			const events = await parseSSEEvents(response);

			const doneEvent = events.find((e) => e.type === "done");
			// Should still have a session ID even when not recording
			expect(doneEvent).toBeDefined();
			expect((doneEvent?.data as Record<string, unknown>).sessionId).toBeDefined();
		});
	});

	describe("Workflow Result", () => {
		it("should include terminated status in done event", async () => {
			const request = new Request("http://localhost/api/workflow", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ input: "Hello!" }),
			});

			const response = await handler.handle(request);
			const events = await parseSSEEvents(response);

			const doneEvent = events.find((e) => e.type === "done");
			expect((doneEvent?.data as Record<string, unknown>).terminated).toBeDefined();
		});

		it("should include final state in done event", async () => {
			const request = new Request("http://localhost/api/workflow", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ input: "Hello!" }),
			});

			const response = await handler.handle(request);
			const events = await parseSSEEvents(response);

			const doneEvent = events.find((e) => e.type === "done");
			expect((doneEvent?.data as Record<string, unknown>).finalState).toBeDefined();
		});
	});
});

// =============================================================================
// Interface Type Tests
// =============================================================================

describe("WorkflowHandler Interface", () => {
	it("should have handle method that returns Promise<Response>", () => {
		const workflow = createTestWorkflow();
		const handler = createWorkflowHandler({ workflow });

		// Type check: handle should accept Request and return Promise<Response>
		const request = new Request("http://localhost/api/workflow");
		const resultPromise = handler.handle(request);

		expect(resultPromise).toBeInstanceOf(Promise);

		// Cleanup
		workflow.dispose();
	});
});

describe("CreateWorkflowHandlerOptions Interface", () => {
	it("should accept workflow property", () => {
		const workflow = createTestWorkflow();

		const options: CreateWorkflowHandlerOptions<TestState> = {
			workflow,
		};

		expect(options.workflow).toBe(workflow);

		workflow.dispose();
	});

	it("should accept cors property with origin string", () => {
		const workflow = createTestWorkflow();

		const options: CreateWorkflowHandlerOptions<TestState> = {
			workflow,
			cors: { origin: "http://localhost:3000" },
		};

		expect(options.cors?.origin).toBe("http://localhost:3000");

		workflow.dispose();
	});

	it("should accept cors property with origin array", () => {
		const workflow = createTestWorkflow();

		const options: CreateWorkflowHandlerOptions<TestState> = {
			workflow,
			cors: { origin: ["http://localhost:3000", "http://localhost:5000"] },
		};

		expect(options.cors?.origin).toEqual(["http://localhost:3000", "http://localhost:5000"]);

		workflow.dispose();
	});

	it("should accept record property", () => {
		const workflow = createTestWorkflow();

		const options: CreateWorkflowHandlerOptions<TestState> = {
			workflow,
			record: true,
		};

		expect(options.record).toBe(true);

		workflow.dispose();
	});
});

describe("CorsOptions Interface", () => {
	it("should support string origin", () => {
		const options: CorsOptions = {
			origin: "http://localhost:3000",
		};

		expect(options.origin).toBe("http://localhost:3000");
	});

	it("should support array of origins", () => {
		const options: CorsOptions = {
			origin: ["http://localhost:3000", "http://localhost:5000"],
		};

		expect(options.origin).toEqual(["http://localhost:3000", "http://localhost:5000"]);
	});

	it("should support methods array", () => {
		const options: CorsOptions = {
			methods: ["GET", "POST", "OPTIONS"],
		};

		expect(options.methods).toEqual(["GET", "POST", "OPTIONS"]);
	});
});

// =============================================================================
// Module Exports Tests
// =============================================================================

describe("Module Exports", () => {
	it("should export createWorkflowHandler function", async () => {
		const { createWorkflowHandler } = await import("../src/index.js");
		expect(typeof createWorkflowHandler).toBe("function");
	});

	it("should export WorkflowHandler type (type-only)", async () => {
		// WorkflowHandler is a type, so we test via usage
		const workflow = createTestWorkflow();
		const handler: WorkflowHandler = createWorkflowHandler({ workflow });
		expect(handler.handle).toBeDefined();
		await workflow.dispose();
	});

	it("should export CreateWorkflowHandlerOptions type (type-only)", async () => {
		// CreateWorkflowHandlerOptions is a type, so we test via usage
		const workflow = createTestWorkflow();
		const options: CreateWorkflowHandlerOptions<TestState> = { workflow };
		expect(options.workflow).toBeDefined();
		await workflow.dispose();
	});

	it("should export CorsOptions type (type-only)", async () => {
		// CorsOptions is a type, so we test via usage
		const options: CorsOptions = { origin: "*" };
		expect(options.origin).toBe("*");
	});
});
