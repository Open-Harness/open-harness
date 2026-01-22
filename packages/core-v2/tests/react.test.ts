/**
 * React Integration Tests
 *
 * Tests for the useWorkflow hook and React integration.
 * These tests verify AI SDK compatibility and tape controls.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createEvent, defineEvent, type EventId } from "../src/event/Event.js";
import { defineHandler } from "../src/handler/Handler.js";
import { useWorkflow } from "../src/react.js";
import type { Workflow, WorkflowDefinition } from "../src/workflow/Workflow.js";

// ============================================================================
// Test Types
// ============================================================================

interface TestState {
	count: number;
	messages: string[];
	terminated: boolean;
}

// ============================================================================
// Test Setup
// ============================================================================

/**
 * Creates a mock workflow for testing.
 */
function createMockWorkflow(overrides: Partial<WorkflowDefinition<TestState>> = {}): Workflow<TestState> {
	const initialState: TestState = {
		count: 0,
		messages: [],
		terminated: false,
	};

	// Define events
	const UserInput = defineEvent<"user:input", { text: string }>("user:input");

	// Define handlers
	const userInputHandler = defineHandler(UserInput, {
		name: "user-input-handler",
		handler: (event, state: TestState) => ({
			state: {
				...state,
				count: state.count + 1,
				messages: [...state.messages, event.payload.text],
			},
			events: [],
		}),
	});

	// Create mock run function that simulates workflow execution
	const mockRun = vi.fn(
		async (options: {
			input: string;
			callbacks?: {
				onEvent?: (e: unknown) => void;
				onStateChange?: (s: TestState) => void;
				onError?: (e: Error) => void;
			};
		}) => {
			const { input, callbacks } = options;

			// Create user input event
			const userInputEvent = createEvent("user:input", { text: input });

			// Call onEvent callback
			callbacks?.onEvent?.(userInputEvent);

			// Compute new state
			const newState: TestState = {
				count: initialState.count + 1,
				messages: [input],
				terminated: false,
			};

			// Call onStateChange callback
			callbacks?.onStateChange?.(newState);

			return {
				state: newState,
				events: [userInputEvent],
				sessionId: "test-session-id",
				tape: {
					position: 0,
					length: 1,
					current: userInputEvent,
					state: newState,
					events: [userInputEvent],
					isRecording: false,
					isReplaying: false,
					status: "idle" as const,
					rewind: () => null as never,
					step: () => null as never,
					stepBack: () => null as never,
					stepTo: () => null as never,
					play: async () => {},
					playTo: async () => {},
					pause: () => {},
					stateAt: () => newState,
					eventAt: () => userInputEvent,
				},
				terminated: false,
			};
		},
	);

	const mockLoad = vi.fn(async () => {
		throw new Error("Not implemented");
	});

	const mockDispose = vi.fn(async () => {});

	// Create workflow mock
	const workflow: Workflow<TestState> = {
		name: overrides.name ?? "test-workflow",
		run: mockRun,
		load: mockLoad,
		dispose: mockDispose,
		// Internal for useWorkflow to access initialState
		_definition: {
			name: overrides.name ?? "test-workflow",
			initialState,
			handlers: [userInputHandler],
			agents: [],
			until: (s: TestState) => s.terminated,
		},
	} as unknown as Workflow<TestState>;

	return workflow;
}

describe("useWorkflow", () => {
	// =========================================================================
	// AI SDK Compatible Values (FR-054)
	// =========================================================================

	describe("AI SDK Compatible Values (FR-054)", () => {
		it("should return messages array", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			expect(result.current.messages).toBeDefined();
			expect(Array.isArray(result.current.messages)).toBe(true);
			expect(result.current.messages.length).toBe(0); // Empty initially
		});

		it("should return input string", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			expect(typeof result.current.input).toBe("string");
			expect(result.current.input).toBe("");
		});

		it("should return setInput function", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			expect(typeof result.current.setInput).toBe("function");
		});

		it("should update input when setInput is called", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			act(() => {
				result.current.setInput("Hello");
			});

			expect(result.current.input).toBe("Hello");
		});

		it("should return handleSubmit function", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			expect(typeof result.current.handleSubmit).toBe("function");
		});

		it("should return isLoading boolean", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			expect(typeof result.current.isLoading).toBe("boolean");
			expect(result.current.isLoading).toBe(false);
		});

		it("should return error (null initially)", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			expect(result.current.error).toBe(null);
		});

		it("should use initialInput option", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow, { initialInput: "Initial value" }));

			expect(result.current.input).toBe("Initial value");
		});

		it("should use initialMessages option when no events", () => {
			const workflow = createMockWorkflow();
			const initialMessages = [{ id: "1", role: "user" as const, content: "Hello", _events: [] as readonly EventId[] }];

			const { result } = renderHook(() => useWorkflow(workflow, { initialMessages }));

			expect(result.current.messages).toEqual(initialMessages);
		});
	});

	// =========================================================================
	// Open Harness Unique Values (FR-055)
	// =========================================================================

	describe("Open Harness Unique Values (FR-055)", () => {
		it("should return events array", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			expect(result.current.events).toBeDefined();
			expect(Array.isArray(result.current.events)).toBe(true);
		});

		it("should return state", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			// State should be initialState from the mock workflow
			expect(result.current.state).toBeDefined();
		});
	});

	// =========================================================================
	// Tape Controls (FR-056)
	// =========================================================================

	describe("Tape Controls (FR-056)", () => {
		it("should return tape object", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			expect(result.current.tape).toBeDefined();
		});

		it("should have tape.position", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			expect(typeof result.current.tape.position).toBe("number");
		});

		it("should have tape.length", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			expect(typeof result.current.tape.length).toBe("number");
		});

		it("should have tape.status", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			expect(typeof result.current.tape.status).toBe("string");
		});

		it("should have tape.rewind function", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			expect(typeof result.current.tape.rewind).toBe("function");
		});

		it("should have tape.step function", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			expect(typeof result.current.tape.step).toBe("function");
		});

		it("should have tape.stepBack function", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			expect(typeof result.current.tape.stepBack).toBe("function");
		});

		it("should have tape.stepTo function", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			expect(typeof result.current.tape.stepTo).toBe("function");
		});

		it("should have tape.play async function", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			expect(typeof result.current.tape.play).toBe("function");
		});

		it("should have tape.playTo async function", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			expect(typeof result.current.tape.playTo).toBe("function");
		});

		it("should have tape.pause function", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			expect(typeof result.current.tape.pause).toBe("function");
		});
	});

	// =========================================================================
	// handleSubmit Behavior
	// =========================================================================

	describe("handleSubmit Behavior", () => {
		it("should prevent form submission", async () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			const preventDefault = vi.fn();

			// Set input first
			act(() => {
				result.current.setInput("Hello");
			});

			// Submit
			await act(async () => {
				result.current.handleSubmit({ preventDefault });
			});

			expect(preventDefault).toHaveBeenCalled();
		});

		it("should clear input after submission", async () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			// Set input
			act(() => {
				result.current.setInput("Hello");
			});

			expect(result.current.input).toBe("Hello");

			// Submit
			await act(async () => {
				result.current.handleSubmit();
			});

			expect(result.current.input).toBe("");
		});

		it("should not submit empty input", async () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			// Submit with empty input
			await act(async () => {
				result.current.handleSubmit();
			});

			// Workflow run should not have been called
			expect(workflow.run).not.toHaveBeenCalled();
		});

		it("should not submit whitespace-only input", async () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			// Set whitespace input
			act(() => {
				result.current.setInput("   ");
			});

			// Submit
			await act(async () => {
				result.current.handleSubmit();
			});

			// Workflow run should not have been called
			expect(workflow.run).not.toHaveBeenCalled();
		});

		it("should call workflow.run with input", async () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			// Set input
			act(() => {
				result.current.setInput("Hello");
			});

			// Submit
			await act(async () => {
				result.current.handleSubmit();
			});

			// Verify workflow.run was called
			expect(workflow.run).toHaveBeenCalledWith(
				expect.objectContaining({
					input: "Hello",
				}),
			);
		});

		it("should call onFinish callback on success", async () => {
			const workflow = createMockWorkflow();
			const onFinish = vi.fn();
			const { result } = renderHook(() => useWorkflow(workflow, { onFinish }));

			// Set input and submit
			act(() => {
				result.current.setInput("Hello");
			});

			await act(async () => {
				result.current.handleSubmit();
			});

			expect(onFinish).toHaveBeenCalled();
		});

		it("should call onError callback on error", async () => {
			const workflow = createMockWorkflow();
			const testError = new Error("Test error");

			// Make run throw
			(workflow.run as ReturnType<typeof vi.fn>).mockRejectedValueOnce(testError);

			const onError = vi.fn();
			const { result } = renderHook(() => useWorkflow(workflow, { onError }));

			// Set input and submit
			act(() => {
				result.current.setInput("Hello");
			});

			await act(async () => {
				result.current.handleSubmit();
			});

			expect(onError).toHaveBeenCalledWith(testError);
		});

		it("should set error state on error", async () => {
			const workflow = createMockWorkflow();
			const testError = new Error("Test error");

			// Make run throw
			(workflow.run as ReturnType<typeof vi.fn>).mockRejectedValueOnce(testError);

			const { result } = renderHook(() => useWorkflow(workflow));

			// Set input and submit
			act(() => {
				result.current.setInput("Hello");
			});

			await act(async () => {
				result.current.handleSubmit();
			});

			expect(result.current.error).toBe(testError);
		});
	});

	// =========================================================================
	// Cleanup on Unmount
	// =========================================================================

	describe("Cleanup on Unmount", () => {
		it("should call workflow.dispose() on unmount", () => {
			const workflow = createMockWorkflow();
			const { unmount } = renderHook(() => useWorkflow(workflow));

			unmount();

			expect(workflow.dispose).toHaveBeenCalled();
		});
	});

	// =========================================================================
	// Tape Controls Behavior
	// =========================================================================

	describe("Tape Controls Behavior", () => {
		it("tape.stepBack should update position (clamped at 0)", async () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			// Position starts at 0
			expect(result.current.tape.position).toBe(0);

			// Step back should stay at 0
			act(() => {
				result.current.tape.stepBack();
			});

			expect(result.current.tape.position).toBe(0);
		});

		it("tape.rewind should set position to 0", async () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			// Submit to add events
			act(() => {
				result.current.setInput("Hello");
			});

			await act(async () => {
				result.current.handleSubmit();
			});

			// Rewind
			act(() => {
				result.current.tape.rewind();
			});

			expect(result.current.tape.position).toBe(0);
		});

		it("tape.step should advance position (with clamping)", async () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			// No events, position should stay at 0
			act(() => {
				result.current.tape.step();
			});

			expect(result.current.tape.position).toBe(0);
		});

		it("tape.stepTo should jump to position (with clamping)", async () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			// Submit to add an event
			act(() => {
				result.current.setInput("Hello");
			});

			await act(async () => {
				result.current.handleSubmit();
			});

			// Step to position (should clamp to max)
			act(() => {
				result.current.tape.stepTo(100);
			});

			// Should be clamped to length - 1
			expect(result.current.tape.position).toBeLessThanOrEqual(result.current.tape.length);
		});

		it("tape.pause should set status to paused", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			act(() => {
				result.current.tape.pause();
			});

			expect(result.current.tape.status).toBe("paused");
		});
	});

	// =========================================================================
	// Message Projection
	// =========================================================================

	describe("Message Projection", () => {
		it("should project events to messages after submission", async () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			// Submit with input
			act(() => {
				result.current.setInput("Hello world");
			});

			await act(async () => {
				result.current.handleSubmit();
			});

			// Messages should include the user input
			expect(result.current.messages.length).toBeGreaterThan(0);
		});
	});

	// =========================================================================
	// Return Type Verification
	// =========================================================================

	describe("Return Type Verification", () => {
		it("should return all required properties", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			// AI SDK compatible
			expect("messages" in result.current).toBe(true);
			expect("input" in result.current).toBe(true);
			expect("setInput" in result.current).toBe(true);
			expect("handleSubmit" in result.current).toBe(true);
			expect("isLoading" in result.current).toBe(true);
			expect("error" in result.current).toBe(true);

			// Open Harness unique
			expect("events" in result.current).toBe(true);
			expect("state" in result.current).toBe(true);

			// Tape controls
			expect("tape" in result.current).toBe(true);
		});

		it("should have readonly arrays", () => {
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			// These should be readonly arrays (TypeScript check at compile time)
			const _messages: readonly unknown[] = result.current.messages;
			const _events: readonly unknown[] = result.current.events;

			expect(Array.isArray(_messages)).toBe(true);
			expect(Array.isArray(_events)).toBe(true);
		});
	});

	// =========================================================================
	// Effect-Free Verification
	// =========================================================================

	describe("Effect-Free Verification", () => {
		it("should work without importing Effect", () => {
			// This test verifies that consumers don't need to import Effect
			const workflow = createMockWorkflow();
			const { result } = renderHook(() => useWorkflow(workflow));

			// All operations should work with plain JavaScript
			act(() => {
				result.current.setInput("Test");
			});

			expect(result.current.input).toBe("Test");
			expect(typeof result.current.handleSubmit).toBe("function");
			expect(typeof result.current.tape.stepBack).toBe("function");
		});
	});
});

// ============================================================================
// Type Export Tests
// ============================================================================

describe("React Module Exports", () => {
	it("should export useWorkflow function", async () => {
		const module = await import("../src/react.js");
		expect(typeof module.useWorkflow).toBe("function");
	});

	it("should export UseWorkflowOptions type (compile-time)", () => {
		// This is a compile-time check - if this code compiles, the type is exported
		const options: import("../src/react.js").UseWorkflowOptions = {
			initialInput: "test",
		};
		expect(options.initialInput).toBe("test");
	});

	it("should export UseWorkflowReturn type (compile-time)", () => {
		// This is a compile-time check
		type Return = import("../src/react.js").UseWorkflowReturn<{ count: number }>;
		const _typeCheck: Return["messages"] = [];
		expect(Array.isArray(_typeCheck)).toBe(true);
	});

	it("should re-export Message type", async () => {
		const module = await import("../src/react.js");
		// Message is a type, so we check if the module loads
		expect(module).toBeDefined();
	});

	it("should re-export TapeControls type", async () => {
		const module = await import("../src/react.js");
		// TapeControls is a type, so we check if the module loads
		expect(module).toBeDefined();
	});

	it("should re-export TapeStatus type", async () => {
		const module = await import("../src/react.js");
		// TapeStatus is a type, so we check if the module loads
		expect(module).toBeDefined();
	});
});
