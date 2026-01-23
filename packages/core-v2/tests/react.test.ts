/**
 * React Integration Tests
 *
 * Tests for the useWorkflow hook and React integration.
 * These tests verify AI SDK compatibility and tape controls.
 */

import { act, cleanup, render, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEvent, defineEvent, type EventId } from "../src/event/Event.js";
import { defineHandler } from "../src/handler/Handler.js";
import { useWorkflow, useWorkflowContext, WorkflowChat, WorkflowContextError, WorkflowProvider } from "../src/react.js";
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

	it("should export WorkflowProvider component", async () => {
		const module = await import("../src/react.js");
		expect(typeof module.WorkflowProvider).toBe("function");
	});

	it("should export useWorkflowContext hook", async () => {
		const module = await import("../src/react.js");
		expect(typeof module.useWorkflowContext).toBe("function");
	});

	it("should export WorkflowContextError class", async () => {
		const module = await import("../src/react.js");
		expect(typeof module.WorkflowContextError).toBe("function");
	});
});

// ============================================================================
// WorkflowProvider Tests (FR-057)
// ============================================================================

describe("WorkflowProvider (FR-057)", () => {
	// =========================================================================
	// Basic Rendering
	// =========================================================================

	describe("Basic Rendering", () => {
		it("should render children", () => {
			const workflow = createMockWorkflow();

			// Create a simple wrapper that returns children
			const { result } = renderHook(() => useWorkflowContext(), {
				wrapper: ({ children }: { children: ReactNode }) => createElement(WorkflowProvider, { workflow }, children),
			});

			// Context should be available
			expect(result.current).toBeDefined();
		});

		it("should accept workflow prop", () => {
			const workflow = createMockWorkflow();

			const { result } = renderHook(() => useWorkflowContext(), {
				wrapper: ({ children }: { children: ReactNode }) => createElement(WorkflowProvider, { workflow }, children),
			});

			// Should have access to workflow data
			expect(result.current.messages).toBeDefined();
		});

		it("should accept options prop", () => {
			const workflow = createMockWorkflow();
			const options = { initialInput: "Initial value" };

			const { result } = renderHook(() => useWorkflowContext(), {
				wrapper: ({ children }: { children: ReactNode }) =>
					createElement(WorkflowProvider, { workflow, options }, children),
			});

			expect(result.current.input).toBe("Initial value");
		});
	});

	// =========================================================================
	// useWorkflowContext Hook
	// =========================================================================

	describe("useWorkflowContext", () => {
		it("should throw WorkflowContextError when used outside provider", () => {
			// Test the hook directly by expecting renderHook to throw
			expect(() => renderHook(() => useWorkflowContext())).toThrow(WorkflowContextError);
		});

		it("should return AI SDK compatible values", () => {
			const workflow = createMockWorkflow();

			const { result } = renderHook(() => useWorkflowContext(), {
				wrapper: ({ children }: { children: ReactNode }) => createElement(WorkflowProvider, { workflow }, children),
			});

			// AI SDK compatible
			expect("messages" in result.current).toBe(true);
			expect("input" in result.current).toBe(true);
			expect("setInput" in result.current).toBe(true);
			expect("handleSubmit" in result.current).toBe(true);
			expect("isLoading" in result.current).toBe(true);
			expect("error" in result.current).toBe(true);
		});

		it("should return Open Harness unique values", () => {
			const workflow = createMockWorkflow();

			const { result } = renderHook(() => useWorkflowContext(), {
				wrapper: ({ children }: { children: ReactNode }) => createElement(WorkflowProvider, { workflow }, children),
			});

			// Open Harness unique
			expect("events" in result.current).toBe(true);
			expect("state" in result.current).toBe(true);
		});

		it("should return tape controls", () => {
			const workflow = createMockWorkflow();

			const { result } = renderHook(() => useWorkflowContext(), {
				wrapper: ({ children }: { children: ReactNode }) => createElement(WorkflowProvider, { workflow }, children),
			});

			// Tape controls
			expect("tape" in result.current).toBe(true);
			expect(typeof result.current.tape.stepBack).toBe("function");
			expect(typeof result.current.tape.step).toBe("function");
			expect(typeof result.current.tape.rewind).toBe("function");
		});
	});

	// =========================================================================
	// Shared State
	// =========================================================================

	describe("Shared State", () => {
		it("should share input state across consumers", () => {
			const workflow = createMockWorkflow();

			// Create wrapper with provider
			const wrapper = ({ children }: { children: ReactNode }) =>
				createElement(WorkflowProvider, { workflow }, children);

			// Render two hooks
			const { result: result1 } = renderHook(() => useWorkflowContext(), { wrapper });
			const { result: result2 } = renderHook(() => useWorkflowContext(), { wrapper });

			// Both should see empty input initially
			expect(result1.current.input).toBe("");
			expect(result2.current.input).toBe("");
		});

		it("should share messages array across consumers", () => {
			const workflow = createMockWorkflow();
			const initialMessages = [{ id: "1", role: "user" as const, content: "Hello", _events: [] as readonly EventId[] }];

			const wrapper = ({ children }: { children: ReactNode }) =>
				createElement(WorkflowProvider, { workflow, options: { initialMessages } }, children);

			const { result: result1 } = renderHook(() => useWorkflowContext(), { wrapper });
			const { result: result2 } = renderHook(() => useWorkflowContext(), { wrapper });

			// Both should see the same messages
			expect(result1.current.messages).toEqual(initialMessages);
			expect(result2.current.messages).toEqual(initialMessages);
		});

		it("should share events array across consumers", () => {
			const workflow = createMockWorkflow();

			const wrapper = ({ children }: { children: ReactNode }) =>
				createElement(WorkflowProvider, { workflow }, children);

			const { result: result1 } = renderHook(() => useWorkflowContext(), { wrapper });
			const { result: result2 } = renderHook(() => useWorkflowContext(), { wrapper });

			// Both should see empty events initially
			expect(result1.current.events).toEqual([]);
			expect(result2.current.events).toEqual([]);
		});
	});

	// =========================================================================
	// WorkflowContextError
	// =========================================================================

	describe("WorkflowContextError", () => {
		it("should have correct name", () => {
			const error = new WorkflowContextError();
			expect(error.name).toBe("WorkflowContextError");
		});

		it("should have correct message", () => {
			const error = new WorkflowContextError();
			expect(error.message).toBe("useWorkflowContext must be used within a WorkflowProvider");
		});

		it("should be instance of Error", () => {
			const error = new WorkflowContextError();
			expect(error).toBeInstanceOf(Error);
		});
	});

	// =========================================================================
	// Integration Tests
	// =========================================================================

	describe("Integration", () => {
		it("should allow setInput from context", () => {
			const workflow = createMockWorkflow();

			const { result } = renderHook(() => useWorkflowContext(), {
				wrapper: ({ children }: { children: ReactNode }) => createElement(WorkflowProvider, { workflow }, children),
			});

			act(() => {
				result.current.setInput("Hello from context");
			});

			expect(result.current.input).toBe("Hello from context");
		});

		it("should allow handleSubmit from context", async () => {
			const workflow = createMockWorkflow();

			const { result } = renderHook(() => useWorkflowContext(), {
				wrapper: ({ children }: { children: ReactNode }) => createElement(WorkflowProvider, { workflow }, children),
			});

			// Set input
			act(() => {
				result.current.setInput("Test message");
			});

			// Submit
			await act(async () => {
				result.current.handleSubmit();
			});

			// Should have called workflow.run
			expect(workflow.run).toHaveBeenCalled();
		});

		it("should allow tape controls from context", () => {
			const workflow = createMockWorkflow();

			const { result } = renderHook(() => useWorkflowContext(), {
				wrapper: ({ children }: { children: ReactNode }) => createElement(WorkflowProvider, { workflow }, children),
			});

			// Use tape controls
			act(() => {
				result.current.tape.rewind();
			});

			expect(result.current.tape.position).toBe(0);

			act(() => {
				result.current.tape.pause();
			});

			expect(result.current.tape.status).toBe("paused");
		});
	});

	// =========================================================================
	// Generic Type Support
	// =========================================================================

	describe("Generic Type Support", () => {
		it("should support typed state access", () => {
			const workflow = createMockWorkflow();

			const { result } = renderHook(() => useWorkflowContext<TestState>(), {
				wrapper: ({ children }: { children: ReactNode }) => createElement(WorkflowProvider, { workflow }, children),
			});

			// State should be typed as TestState
			expect(result.current.state).toBeDefined();
			// TypeScript should allow accessing TestState properties (compile-time check)
			const _count: number | undefined = (result.current.state as TestState | undefined)?.count;
			expect(_count !== undefined || _count === undefined).toBe(true); // Just verify it compiles
		});
	});
});

// ============================================================================
// WorkflowChat Tests (FR-058)
// ============================================================================

describe("WorkflowChat (FR-058)", () => {
	// Clean up after each test to prevent element accumulation
	afterEach(() => {
		cleanup();
	});

	// =========================================================================
	// Basic Rendering
	// =========================================================================

	describe("Basic Rendering", () => {
		it("should render the chat container", () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow }));

			const chatContainer = container.querySelector('[data-testid="workflow-chat"]');
			expect(chatContainer).not.toBeNull();
		});

		it("should render messages container", () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow }));

			const messagesContainer = container.querySelector('[data-testid="messages-container"]');
			expect(messagesContainer).not.toBeNull();
		});

		it("should render input form", () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow }));

			const form = container.querySelector('[data-testid="chat-form"]');
			expect(form).not.toBeNull();
		});

		it("should render input field", () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow }));

			const input = container.querySelector('[data-testid="chat-input"]');
			expect(input).not.toBeNull();
		});

		it("should render submit button", () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow }));

			const button = container.querySelector('[data-testid="submit-button"]');
			expect(button).not.toBeNull();
			expect(button?.textContent).toBe("Send");
		});
	});

	// =========================================================================
	// Props
	// =========================================================================

	describe("Props", () => {
		it("should apply className to container", () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow, className: "custom-class" }));

			const chatContainer = container.querySelector('[data-testid="workflow-chat"]');
			expect(chatContainer?.className).toBe("custom-class");
		});

		it("should apply placeholder to input", () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow, placeholder: "Custom placeholder..." }));

			const input = container.querySelector('[data-testid="chat-input"]') as HTMLInputElement;
			expect(input.placeholder).toBe("Custom placeholder...");
		});

		it("should use default placeholder when not provided", () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow }));

			const input = container.querySelector('[data-testid="chat-input"]') as HTMLInputElement;
			expect(input.placeholder).toBe("Type a message...");
		});

		it("should not show tape controls by default", () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow }));

			const tapeControls = container.querySelector('[data-testid="tape-controls"]');
			expect(tapeControls).toBeNull();
		});

		it("should show tape controls when showTapeControls is true", () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow, showTapeControls: true }));

			const tapeControls = container.querySelector('[data-testid="tape-controls"]');
			expect(tapeControls).not.toBeNull();
		});
	});

	// =========================================================================
	// Tape Controls
	// =========================================================================

	describe("Tape Controls", () => {
		it("should render rewind button", () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow, showTapeControls: true }));

			const rewindButton = container.querySelector('[data-testid="rewind-button"]');
			expect(rewindButton).not.toBeNull();
		});

		it("should render step back button", () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow, showTapeControls: true }));

			const stepBackButton = container.querySelector('[data-testid="step-back-button"]');
			expect(stepBackButton).not.toBeNull();
		});

		it("should render step button", () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow, showTapeControls: true }));

			const stepButton = container.querySelector('[data-testid="step-button"]');
			expect(stepButton).not.toBeNull();
		});

		it("should render play button", () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow, showTapeControls: true }));

			const playButton = container.querySelector('[data-testid="play-button"]');
			expect(playButton).not.toBeNull();
		});

		it("should render position indicator", () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow, showTapeControls: true }));

			const positionIndicator = container.querySelector('[data-testid="position-indicator"]');
			expect(positionIndicator).not.toBeNull();
			// Initial state: 1 / 0 (position + 1 / length)
			expect(positionIndicator?.textContent).toBe("1 / 0");
		});
	});

	// =========================================================================
	// Input Interaction
	// =========================================================================

	describe("Input Interaction", () => {
		it("should disable submit button when input is empty", () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow }));

			const button = container.querySelector('[data-testid="submit-button"]') as HTMLButtonElement;
			expect(button.disabled).toBe(true);
		});

		it("should have input value from initial input option", async () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow, options: { initialInput: "Hello" } }));

			const input = container.querySelector('[data-testid="chat-input"]') as HTMLInputElement;
			expect(input.value).toBe("Hello");
		});
	});

	// =========================================================================
	// Integration with useWorkflow
	// =========================================================================

	describe("Integration", () => {
		it("should use WorkflowProvider internally", () => {
			// WorkflowChat should work without needing an external provider
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow }));

			// Should render without throwing WorkflowContextError
			const chatContainer = container.querySelector('[data-testid="workflow-chat"]');
			expect(chatContainer).not.toBeNull();
		});

		it("should accept options prop and pass to useWorkflow", () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow, options: { initialInput: "Test input" } }));

			const input = container.querySelector('[data-testid="chat-input"]') as HTMLInputElement;
			expect(input.value).toBe("Test input");
		});
	});

	// =========================================================================
	// Module Exports
	// =========================================================================

	describe("Module Exports", () => {
		it("should export WorkflowChat component", async () => {
			const module = await import("../src/react.js");
			expect(typeof module.WorkflowChat).toBe("function");
		});

		it("should export WorkflowChatProps type", async () => {
			// TypeScript compile-time check - we can't test types at runtime
			// but we can verify the module imports without error
			const module = await import("../src/react.js");
			expect(module).toBeDefined();
		});
	});

	// =========================================================================
	// Accessibility
	// =========================================================================

	describe("Accessibility", () => {
		it("should have form element wrapping input and button", () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow }));

			const form = container.querySelector('[data-testid="chat-form"]');
			expect(form?.tagName.toLowerCase()).toBe("form");
		});

		it("should have input type text", () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow }));

			const input = container.querySelector('[data-testid="chat-input"]') as HTMLInputElement;
			expect(input.type).toBe("text");
		});

		it("should have submit button type submit", () => {
			const workflow = createMockWorkflow();
			const { container } = render(createElement(WorkflowChat, { workflow }));

			const button = container.querySelector('[data-testid="submit-button"]') as HTMLButtonElement;
			expect(button.type).toBe("submit");
		});
	});

	// =========================================================================
	// API Option (FR-060) - Server-Side Execution via SSE
	// =========================================================================

	describe("API Option (FR-060)", () => {
		/**
		 * Helper to create a mock SSE stream response.
		 */
		function createMockSSEResponse(events: Array<{ type: string; data: unknown }>): Response {
			const encoder = new TextEncoder();
			const chunks = events.map((event) => `data: ${JSON.stringify(event)}\n\n`);

			let chunkIndex = 0;
			const stream = new ReadableStream({
				pull(controller) {
					if (chunkIndex < chunks.length) {
						controller.enqueue(encoder.encode(chunks[chunkIndex]));
						chunkIndex++;
					} else {
						controller.close();
					}
				},
			});

			return new Response(stream, {
				status: 200,
				headers: { "Content-Type": "text/event-stream" },
			});
		}

		it("should accept api option in UseWorkflowOptions", () => {
			const workflow = createMockWorkflow();
			// This should compile and not throw
			const { result } = renderHook(() => useWorkflow(workflow, { api: "/api/workflow" }));
			expect(result.current.messages).toBeDefined();
		});

		it("should call fetch with correct URL and body when api is provided", async () => {
			const workflow = createMockWorkflow();
			const mockFetch = vi.fn().mockResolvedValue(
				createMockSSEResponse([
					{
						type: "event",
						data: { id: "e1", name: "user:input", payload: { text: "Hello" }, timestamp: new Date().toISOString() },
					},
					{ type: "state", data: { count: 1, messages: ["Hello"], terminated: false } },
					{ type: "done", data: { sessionId: "test-123", terminated: false } },
				]),
			);
			global.fetch = mockFetch;

			const { result } = renderHook(() => useWorkflow(workflow, { api: "/api/workflow" }));

			// Set input and submit
			await act(async () => {
				result.current.setInput("Hello");
			});

			await act(async () => {
				await result.current.handleSubmit();
			});

			// Verify fetch was called correctly
			expect(mockFetch).toHaveBeenCalledWith(
				"/api/workflow",
				expect.objectContaining({
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ input: "Hello", record: false }),
				}),
			);
		});

		it("should update events state from SSE event messages", async () => {
			const workflow = createMockWorkflow();
			const testEvent = {
				id: "e1",
				name: "user:input",
				payload: { text: "Hello" },
				timestamp: new Date().toISOString(),
			};
			const mockFetch = vi.fn().mockResolvedValue(
				createMockSSEResponse([
					{ type: "event", data: testEvent },
					{ type: "state", data: { count: 1, messages: ["Hello"], terminated: false } },
					{ type: "done", data: { sessionId: "test-123", terminated: false } },
				]),
			);
			global.fetch = mockFetch;

			const { result } = renderHook(() => useWorkflow(workflow, { api: "/api/workflow" }));

			await act(async () => {
				result.current.setInput("Hello");
			});

			await act(async () => {
				await result.current.handleSubmit();
			});

			// Verify events were updated
			expect(result.current.events.length).toBeGreaterThan(0);
			expect(result.current.events[0]?.name).toBe("user:input");
		});

		it("should update state from SSE state messages", async () => {
			const workflow = createMockWorkflow();
			const newState = { count: 1, messages: ["Hello"], terminated: false };
			const mockFetch = vi.fn().mockResolvedValue(
				createMockSSEResponse([
					{
						type: "event",
						data: { id: "e1", name: "user:input", payload: { text: "Hello" }, timestamp: new Date().toISOString() },
					},
					{ type: "state", data: newState },
					{ type: "done", data: { sessionId: "test-123", terminated: false, finalState: newState } },
				]),
			);
			global.fetch = mockFetch;

			const { result } = renderHook(() => useWorkflow<TestState>(workflow, { api: "/api/workflow" }));

			await act(async () => {
				result.current.setInput("Hello");
			});

			await act(async () => {
				await result.current.handleSubmit();
			});

			// Verify state was updated
			expect(result.current.state.count).toBe(1);
			expect(result.current.state.messages).toContain("Hello");
		});

		it("should call onFinish callback when SSE done event is received", async () => {
			const workflow = createMockWorkflow();
			const onFinish = vi.fn();
			const mockFetch = vi.fn().mockResolvedValue(
				createMockSSEResponse([
					{
						type: "event",
						data: { id: "e1", name: "user:input", payload: { text: "Hello" }, timestamp: new Date().toISOString() },
					},
					{ type: "state", data: { count: 1, messages: ["Hello"], terminated: false } },
					{
						type: "done",
						data: {
							sessionId: "test-session",
							terminated: true,
							finalState: { count: 1, messages: ["Hello"], terminated: true },
						},
					},
				]),
			);
			global.fetch = mockFetch;

			const { result } = renderHook(() => useWorkflow(workflow, { api: "/api/workflow", onFinish }));

			await act(async () => {
				result.current.setInput("Hello");
			});

			await act(async () => {
				await result.current.handleSubmit();
			});

			// Verify onFinish was called
			expect(onFinish).toHaveBeenCalled();
			expect(onFinish).toHaveBeenCalledWith(
				expect.objectContaining({
					terminated: true,
				}),
			);
		});

		it("should set error state when SSE error event is received", async () => {
			const workflow = createMockWorkflow();
			const onError = vi.fn();
			const mockFetch = vi
				.fn()
				.mockResolvedValue(
					createMockSSEResponse([{ type: "error", data: { message: "Server error occurred", name: "ServerError" } }]),
				);
			global.fetch = mockFetch;

			const { result } = renderHook(() => useWorkflow(workflow, { api: "/api/workflow", onError }));

			await act(async () => {
				result.current.setInput("Hello");
			});

			await act(async () => {
				await result.current.handleSubmit();
			});

			// Verify error state was set
			expect(result.current.error).not.toBeNull();
			expect(result.current.error?.message).toBe("Server error occurred");
			expect(onError).toHaveBeenCalled();
		});

		it("should handle HTTP errors from server", async () => {
			const workflow = createMockWorkflow();
			const mockFetch = vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ error: "Not found" }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				}),
			);
			global.fetch = mockFetch;

			const { result } = renderHook(() => useWorkflow(workflow, { api: "/api/workflow" }));

			await act(async () => {
				result.current.setInput("Hello");
			});

			await act(async () => {
				await result.current.handleSubmit();
			});

			// Verify error was set
			expect(result.current.error).not.toBeNull();
			expect(result.current.error?.message).toContain("404");
		});

		it("should pass record option to server request body", async () => {
			const workflow = createMockWorkflow();
			const mockFetch = vi
				.fn()
				.mockResolvedValue(
					createMockSSEResponse([{ type: "done", data: { sessionId: "test-123", terminated: false } }]),
				);
			global.fetch = mockFetch;

			const { result } = renderHook(() => useWorkflow(workflow, { api: "/api/workflow", record: true }));

			await act(async () => {
				result.current.setInput("Hello");
			});

			await act(async () => {
				await result.current.handleSubmit();
			});

			// Verify record was passed to server
			expect(mockFetch).toHaveBeenCalledWith(
				"/api/workflow",
				expect.objectContaining({
					body: expect.stringContaining('"record":true'),
				}),
			);
		});

		it("should NOT call workflow.run when api option is provided", async () => {
			const workflow = createMockWorkflow();
			const mockFetch = vi
				.fn()
				.mockResolvedValue(
					createMockSSEResponse([{ type: "done", data: { sessionId: "test-123", terminated: false } }]),
				);
			global.fetch = mockFetch;

			const { result } = renderHook(() => useWorkflow(workflow, { api: "/api/workflow" }));

			await act(async () => {
				result.current.setInput("Hello");
			});

			await act(async () => {
				await result.current.handleSubmit();
			});

			// Verify workflow.run was NOT called (server handles execution)
			expect(workflow.run).not.toHaveBeenCalled();
		});

		it("should call workflow.run when api option is NOT provided", async () => {
			const workflow = createMockWorkflow();

			const { result } = renderHook(() => useWorkflow(workflow));

			await act(async () => {
				result.current.setInput("Hello");
			});

			await act(async () => {
				await result.current.handleSubmit();
			});

			// Verify workflow.run WAS called (local execution)
			expect(workflow.run).toHaveBeenCalled();
		});

		it("should set isLoading false after request completes", async () => {
			const workflow = createMockWorkflow();
			const mockFetch = vi.fn().mockResolvedValue(
				createMockSSEResponse([
					{
						type: "event",
						data: { id: "e1", name: "user:input", payload: { text: "Hello" }, timestamp: new Date().toISOString() },
					},
					{ type: "done", data: { sessionId: "test-123", terminated: false } },
				]),
			);
			global.fetch = mockFetch;

			const { result } = renderHook(() => useWorkflow(workflow, { api: "/api/workflow" }));

			await act(async () => {
				result.current.setInput("Hello");
			});

			await act(async () => {
				await result.current.handleSubmit();
			});

			// Should no longer be loading after completion
			expect(result.current.isLoading).toBe(false);
		});

		it("should handle missing Content-Type header gracefully", async () => {
			const workflow = createMockWorkflow();
			const mockFetch = vi.fn().mockResolvedValue(
				new Response("plain text", {
					status: 200,
					headers: { "Content-Type": "text/plain" },
				}),
			);
			global.fetch = mockFetch;

			const { result } = renderHook(() => useWorkflow(workflow, { api: "/api/workflow" }));

			await act(async () => {
				result.current.setInput("Hello");
			});

			await act(async () => {
				await result.current.handleSubmit();
			});

			// Should set an error for unexpected content type
			expect(result.current.error).not.toBeNull();
			expect(result.current.error?.message).toContain("text/event-stream");
		});
	});
});
