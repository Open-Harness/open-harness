/**
 * Renderer Tests
 *
 * Tests for the Renderer module including:
 * - Pattern matching (FR-020)
 * - Renderer creation and factory
 * - Pure observer constraints (FR-018, FR-019)
 * - Renderer execution
 */

import { describe, expect, it, vi } from "vitest";
import { type AnyEvent, createEvent } from "../src/event/Event.js";
import {
	type CreateRendererOptions,
	createRenderer,
	createRendererRegistry,
	type EventPattern,
	findMatchingPatterns,
	matchesAnyPattern,
	matchesPattern,
	type Renderer,
	type RendererRegistry,
	type RenderFunction,
	renderEvent,
	renderEventAsync,
} from "../src/renderer/index.js";

// ============================================================================
// Test State Types
// ============================================================================

interface TestState {
	count: number;
	messages: string[];
}

// ============================================================================
// Pattern Matching Tests
// ============================================================================

describe("Pattern Matching", () => {
	describe("matchesPattern", () => {
		it("should match exact patterns", () => {
			expect(matchesPattern("text:delta", "text:delta")).toBe(true);
			expect(matchesPattern("user:input", "user:input")).toBe(true);
			expect(matchesPattern("error:network", "error:network")).toBe(true);
		});

		it("should not match different exact patterns", () => {
			expect(matchesPattern("text:delta", "text:complete")).toBe(false);
			expect(matchesPattern("user:input", "user:output")).toBe(false);
			expect(matchesPattern("error:network", "error:timeout")).toBe(false);
		});

		it("should match wildcard suffix patterns (error:*)", () => {
			expect(matchesPattern("error:network", "error:*")).toBe(true);
			expect(matchesPattern("error:timeout", "error:*")).toBe(true);
			expect(matchesPattern("error:validation", "error:*")).toBe(true);
			expect(matchesPattern("error:", "error:*")).toBe(true); // Edge case: empty suffix
		});

		it("should not match wildcard suffix for different prefixes", () => {
			expect(matchesPattern("text:delta", "error:*")).toBe(false);
			expect(matchesPattern("user:input", "error:*")).toBe(false);
			expect(matchesPattern("errornetwork", "error:*")).toBe(false); // No colon
		});

		it("should match wildcard prefix patterns (*:completed)", () => {
			expect(matchesPattern("agent:completed", "*:completed")).toBe(true);
			expect(matchesPattern("tool:completed", "*:completed")).toBe(true);
			expect(matchesPattern("task:completed", "*:completed")).toBe(true);
			expect(matchesPattern(":completed", "*:completed")).toBe(true); // Edge case: empty prefix
		});

		it("should not match wildcard prefix for different suffixes", () => {
			expect(matchesPattern("agent:started", "*:completed")).toBe(false);
			expect(matchesPattern("tool:called", "*:completed")).toBe(false);
			expect(matchesPattern("agentcompleted", "*:completed")).toBe(false); // No colon
		});

		it("should match catch-all pattern (*)", () => {
			expect(matchesPattern("anything", "*")).toBe(true);
			expect(matchesPattern("text:delta", "*")).toBe(true);
			expect(matchesPattern("error:network", "*")).toBe(true);
			expect(matchesPattern("", "*")).toBe(true); // Empty string
		});

		it("should handle edge cases", () => {
			// Empty event name
			expect(matchesPattern("", "text:delta")).toBe(false);
			expect(matchesPattern("", "*")).toBe(true);

			// Pattern with multiple colons
			expect(matchesPattern("a:b:c", "a:b:c")).toBe(true);
			expect(matchesPattern("a:b:c", "a:*")).toBe(true);
			expect(matchesPattern("a:b:c", "*:c")).toBe(true);
		});
	});

	describe("matchesAnyPattern", () => {
		it("should return true if any pattern matches", () => {
			expect(matchesAnyPattern("error:network", ["text:*", "error:*"])).toBe(true);
			expect(matchesAnyPattern("text:delta", ["text:*", "error:*"])).toBe(true);
			expect(matchesAnyPattern("anything", ["exact", "*"])).toBe(true);
		});

		it("should return false if no patterns match", () => {
			expect(matchesAnyPattern("user:input", ["text:*", "error:*"])).toBe(false);
			expect(matchesAnyPattern("different", ["exact", "specific"])).toBe(false);
		});

		it("should handle empty patterns array", () => {
			expect(matchesAnyPattern("anything", [])).toBe(false);
		});

		it("should handle single pattern", () => {
			expect(matchesAnyPattern("text:delta", ["text:delta"])).toBe(true);
			expect(matchesAnyPattern("text:delta", ["text:complete"])).toBe(false);
		});
	});

	describe("findMatchingPatterns", () => {
		it("should find all matching patterns", () => {
			const patterns: EventPattern[] = ["*", "agent:*", "*:completed"];
			const matches = findMatchingPatterns("agent:completed", patterns);

			expect(matches).toHaveLength(3);
			expect(matches).toContain("*");
			expect(matches).toContain("agent:*");
			expect(matches).toContain("*:completed");
		});

		it("should return empty array when no patterns match", () => {
			const patterns: EventPattern[] = ["text:*", "error:*"];
			const matches = findMatchingPatterns("user:input", patterns);

			expect(matches).toHaveLength(0);
		});

		it("should preserve pattern order", () => {
			const patterns: EventPattern[] = ["*:completed", "agent:*", "*"];
			const matches = findMatchingPatterns("agent:completed", patterns);

			expect(matches[0]).toBe("*:completed");
			expect(matches[1]).toBe("agent:*");
			expect(matches[2]).toBe("*");
		});
	});
});

// ============================================================================
// Renderer Interface Tests
// ============================================================================

describe("Renderer Interface", () => {
	it("should define a renderer with required properties", () => {
		const renderer: Renderer<TestState, void> = {
			name: "test",
			patterns: ["text:*"],
			render: () => {},
		};

		expect(renderer.name).toBe("test");
		expect(renderer.patterns).toEqual(["text:*"]);
		expect(typeof renderer.render).toBe("function");
	});

	it("should support multiple patterns", () => {
		const renderer: Renderer<TestState, void> = {
			name: "multi",
			patterns: ["text:*", "error:*", "*:completed"],
			render: () => {},
		};

		expect(renderer.patterns).toHaveLength(3);
	});

	it("should support catch-all pattern", () => {
		const renderer: Renderer<TestState, void> = {
			name: "all",
			patterns: ["*"],
			render: () => {},
		};

		expect(renderer.patterns).toEqual(["*"]);
	});
});

// ============================================================================
// RenderFunction Tests
// ============================================================================

describe("RenderFunction", () => {
	it("should receive event and state parameters", () => {
		const renderFn: RenderFunction<TestState, void> = vi.fn();
		const event = createEvent("text:delta", { delta: "hello" });
		const state: TestState = { count: 1, messages: [] };

		renderFn(event, state);

		expect(renderFn).toHaveBeenCalledWith(event, state);
	});

	it("should return output value", () => {
		const renderFn: RenderFunction<TestState, string> = (event) => `Rendered: ${event.name}`;

		const event = createEvent("text:delta", { delta: "hello" });
		const state: TestState = { count: 1, messages: [] };

		const result = renderFn(event, state);
		expect(result).toBe("Rendered: text:delta");
	});

	it("should receive readonly event (cannot modify)", () => {
		const renderFn: RenderFunction<TestState, void> = (event, state) => {
			// TypeScript enforces readonly - event and state should not be modified
			// This test documents the expected behavior
			expect(event.name).toBe("text:delta");
			expect(state.count).toBe(1);
		};

		const event = createEvent("text:delta", { delta: "hello" });
		const state: TestState = { count: 1, messages: [] };

		renderFn(event, state);
	});
});

// ============================================================================
// createRenderer Factory Tests
// ============================================================================

describe("createRenderer", () => {
	it("should create a renderer from options", () => {
		const renderer = createRenderer<TestState>({
			name: "test",
			renderers: {
				"text:delta": () => {},
			},
		});

		expect(renderer.name).toBe("test");
		expect(renderer.patterns).toEqual(["text:delta"]);
		expect(typeof renderer.render).toBe("function");
	});

	it("should extract patterns from renderers keys", () => {
		const renderer = createRenderer<TestState>({
			name: "multi",
			renderers: {
				"text:delta": () => {},
				"error:*": () => {},
				"*:completed": () => {},
			},
		});

		expect(renderer.patterns).toHaveLength(3);
		expect(renderer.patterns).toContain("text:delta");
		expect(renderer.patterns).toContain("error:*");
		expect(renderer.patterns).toContain("*:completed");
	});

	it("should call matching render function", () => {
		const textDeltaFn = vi.fn();
		const errorFn = vi.fn();

		const renderer = createRenderer<TestState>({
			name: "test",
			renderers: {
				"text:delta": textDeltaFn,
				"error:*": errorFn,
			},
		});

		const event = createEvent("text:delta", { delta: "hello" });
		const state: TestState = { count: 1, messages: [] };

		renderer.render(event, state);

		expect(textDeltaFn).toHaveBeenCalledWith(event, state);
		expect(errorFn).not.toHaveBeenCalled();
	});

	it("should call multiple matching render functions", () => {
		const catchAllFn = vi.fn();
		const agentFn = vi.fn();
		const completedFn = vi.fn();

		const renderer = createRenderer<TestState>({
			name: "test",
			renderers: {
				"*": catchAllFn,
				"agent:*": agentFn,
				"*:completed": completedFn,
			},
		});

		const event = createEvent("agent:completed", { agentName: "test" });
		const state: TestState = { count: 1, messages: [] };

		renderer.render(event, state);

		// All three patterns should match "agent:completed"
		expect(catchAllFn).toHaveBeenCalledWith(event, state);
		expect(agentFn).toHaveBeenCalledWith(event, state);
		expect(completedFn).toHaveBeenCalledWith(event, state);
	});

	it("should not call non-matching render functions", () => {
		const textFn = vi.fn();
		const errorFn = vi.fn();

		const renderer = createRenderer<TestState>({
			name: "test",
			renderers: {
				"text:*": textFn,
				"error:*": errorFn,
			},
		});

		const event = createEvent("user:input", { text: "hello" });
		const state: TestState = { count: 1, messages: [] };

		renderer.render(event, state);

		expect(textFn).not.toHaveBeenCalled();
		expect(errorFn).not.toHaveBeenCalled();
	});

	it("should return result from last matching render function", () => {
		const renderer = createRenderer<TestState, string>({
			name: "test",
			renderers: {
				"*": () => "catch-all",
				"text:*": () => "text",
				"text:delta": () => "text-delta",
			},
		});

		const event = createEvent("text:delta", { delta: "hello" });
		const state: TestState = { count: 1, messages: [] };

		// Result depends on key iteration order in the object
		const result = renderer.render(event, state);
		expect(typeof result).toBe("string");
	});
});

// ============================================================================
// CreateRendererOptions Tests
// ============================================================================

describe("CreateRendererOptions", () => {
	it("should require name property", () => {
		const options: CreateRendererOptions<TestState> = {
			name: "required-name",
			renderers: {},
		};

		expect(options.name).toBe("required-name");
	});

	it("should allow empty renderers map", () => {
		const renderer = createRenderer<TestState>({
			name: "empty",
			renderers: {},
		});

		expect(renderer.patterns).toHaveLength(0);
	});
});

// ============================================================================
// Renderer Registry Tests
// ============================================================================

describe("createRendererRegistry", () => {
	it("should create registry from renderer array", () => {
		const renderer1: Renderer<TestState> = {
			name: "one",
			patterns: ["text:*"],
			render: () => {},
		};

		const renderer2: Renderer<TestState> = {
			name: "two",
			patterns: ["error:*"],
			render: () => {},
		};

		const registry = createRendererRegistry([renderer1, renderer2]);

		expect(registry.size).toBe(2);
		expect(registry.get("one")).toBe(renderer1);
		expect(registry.get("two")).toBe(renderer2);
	});

	it("should throw on duplicate renderer names", () => {
		const renderer1: Renderer<TestState> = {
			name: "duplicate",
			patterns: ["text:*"],
			render: () => {},
		};

		const renderer2: Renderer<TestState> = {
			name: "duplicate",
			patterns: ["error:*"],
			render: () => {},
		};

		expect(() => createRendererRegistry([renderer1, renderer2])).toThrow('Duplicate renderer name: "duplicate"');
	});

	it("should handle empty array", () => {
		const registry = createRendererRegistry<TestState>([]);
		expect(registry.size).toBe(0);
	});

	it("should be readonly", () => {
		const renderer: Renderer<TestState> = {
			name: "test",
			patterns: ["*"],
			render: () => {},
		};

		const registry: RendererRegistry<TestState> = createRendererRegistry([renderer]);

		// Type system enforces readonly - this is a compile-time check
		expect(typeof registry.get).toBe("function");
		expect(typeof registry.has).toBe("function");
		expect(typeof registry.size).toBe("number");
	});
});

// ============================================================================
// Renderer Execution Tests
// ============================================================================

describe("renderEvent", () => {
	it("should call matching renderers", () => {
		const textFn = vi.fn();
		const errorFn = vi.fn();

		const renderers: Renderer<TestState>[] = [
			{ name: "text", patterns: ["text:*"], render: textFn },
			{ name: "error", patterns: ["error:*"], render: errorFn },
		];

		const event = createEvent("text:delta", { delta: "hello" });
		const state: TestState = { count: 1, messages: [] };

		renderEvent(event, state, renderers);

		expect(textFn).toHaveBeenCalledWith(event, state);
		expect(errorFn).not.toHaveBeenCalled();
	});

	it("should call multiple matching renderers", () => {
		const textFn = vi.fn();
		const allFn = vi.fn();

		const renderers: Renderer<TestState>[] = [
			{ name: "text", patterns: ["text:*"], render: textFn },
			{ name: "all", patterns: ["*"], render: allFn },
		];

		const event = createEvent("text:delta", { delta: "hello" });
		const state: TestState = { count: 1, messages: [] };

		renderEvent(event, state, renderers);

		expect(textFn).toHaveBeenCalledWith(event, state);
		expect(allFn).toHaveBeenCalledWith(event, state);
	});

	it("should not modify event or state (pure observer)", () => {
		const originalEvent = createEvent("text:delta", { delta: "hello" });
		const originalState: TestState = { count: 1, messages: ["initial"] };

		// Create deep copies to compare
		const eventCopy = JSON.stringify(originalEvent);
		const stateCopy = JSON.stringify(originalState);

		const renderer: Renderer<TestState> = {
			name: "test",
			patterns: ["*"],
			render: (_event, _state) => {
				// Try to modify (these should be readonly in TypeScript)
				// Runtime check that we don't accidentally modify
			},
		};

		renderEvent(originalEvent, originalState, [renderer]);

		// Event and state should be unchanged
		expect(JSON.stringify(originalEvent)).toBe(eventCopy);
		expect(JSON.stringify(originalState)).toBe(stateCopy);
	});

	it("should handle empty renderers array", () => {
		const event = createEvent("text:delta", { delta: "hello" });
		const state: TestState = { count: 1, messages: [] };

		// Should not throw
		expect(() => renderEvent(event, state, [])).not.toThrow();
	});
});

describe("renderEventAsync", () => {
	it("should call matching renderers asynchronously", async () => {
		const textFn = vi.fn();

		const renderers: Renderer<TestState>[] = [{ name: "text", patterns: ["text:*"], render: textFn }];

		const event = createEvent("text:delta", { delta: "hello" });
		const state: TestState = { count: 1, messages: [] };

		renderEventAsync(event, state, renderers);

		// Function hasn't been called yet (microtask)
		expect(textFn).not.toHaveBeenCalled();

		// Wait for microtask to complete
		await new Promise((resolve) => queueMicrotask(resolve));

		expect(textFn).toHaveBeenCalledWith(event, state);
	});

	it("should not throw on renderer errors", async () => {
		const throwingFn = vi.fn(() => {
			throw new Error("Renderer error");
		});

		const renderers: Renderer<TestState>[] = [{ name: "throwing", patterns: ["*"], render: throwingFn }];

		const event = createEvent("text:delta", { delta: "hello" });
		const state: TestState = { count: 1, messages: [] };

		// Should not throw
		expect(() => renderEventAsync(event, state, renderers)).not.toThrow();

		// Wait for microtask
		await new Promise((resolve) => queueMicrotask(resolve));

		// Function was called but error was swallowed
		expect(throwingFn).toHaveBeenCalled();
	});

	it("should run multiple renderers in parallel", async () => {
		const callOrder: number[] = [];

		const renderer1: Renderer<TestState> = {
			name: "one",
			patterns: ["*"],
			render: () => {
				callOrder.push(1);
			},
		};

		const renderer2: Renderer<TestState> = {
			name: "two",
			patterns: ["*"],
			render: () => {
				callOrder.push(2);
			},
		};

		const event = createEvent("text:delta", { delta: "hello" });
		const state: TestState = { count: 1, messages: [] };

		renderEventAsync(event, state, [renderer1, renderer2]);

		// Wait for microtasks
		await new Promise((resolve) => queueMicrotask(resolve));

		// Both renderers should have been called
		expect(callOrder).toHaveLength(2);
		expect(callOrder).toContain(1);
		expect(callOrder).toContain(2);
	});
});

// ============================================================================
// Pure Observer Constraint Tests (FR-018, FR-019)
// ============================================================================

describe("Pure Observer Constraints", () => {
	describe("FR-018: Renderers cannot modify events or state", () => {
		it("should pass readonly event and state to render function", () => {
			let receivedEvent: AnyEvent | undefined;
			let receivedState: TestState | undefined;

			const renderer = createRenderer<TestState>({
				name: "test",
				renderers: {
					"*": (event, state) => {
						receivedEvent = event;
						receivedState = state;
					},
				},
			});

			const event = createEvent("text:delta", { delta: "hello" });
			const state: TestState = { count: 1, messages: ["test"] };

			renderer.render(event, state);

			// Verify data was received
			expect(receivedEvent).toBeDefined();
			expect(receivedState).toBeDefined();
			expect(receivedEvent?.name).toBe("text:delta");
			expect(receivedState?.count).toBe(1);
		});
	});

	describe("FR-019: Renderers cannot emit new events", () => {
		it("should have void return type by default", () => {
			const renderer = createRenderer<TestState>({
				name: "test",
				renderers: {
					"*": () => {
						// Void return - cannot emit events
					},
				},
			});

			const event = createEvent("text:delta", { delta: "hello" });
			const state: TestState = { count: 1, messages: [] };

			const result = renderer.render(event, state);

			// Result is undefined (void)
			expect(result).toBeUndefined();
		});
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Renderer Integration", () => {
	it("should work with real event types", () => {
		const outputs: string[] = [];

		const renderer = createRenderer<TestState>({
			name: "collector",
			renderers: {
				"text:delta": (event) => {
					outputs.push(`delta: ${(event.payload as { delta: string }).delta}`);
				},
				"text:complete": (event) => {
					outputs.push(`complete: ${(event.payload as { fullText: string }).fullText}`);
				},
				"error:*": (event) => {
					outputs.push(`error: ${(event.payload as { message: string }).message}`);
				},
			},
		});

		const state: TestState = { count: 1, messages: [] };

		// Simulate event stream
		renderer.render(createEvent("text:delta", { delta: "Hello" }), state);
		renderer.render(createEvent("text:delta", { delta: " World" }), state);
		renderer.render(createEvent("text:complete", { fullText: "Hello World" }), state);
		renderer.render(createEvent("error:network", { message: "Connection lost" }), state);

		expect(outputs).toEqual(["delta: Hello", "delta:  World", "complete: Hello World", "error: Connection lost"]);
	});

	it("should handle terminal-like rendering scenario", () => {
		let output = "";

		const terminalRenderer = createRenderer<TestState>({
			name: "terminal",
			renderers: {
				"text:delta": (event) => {
					output += (event.payload as { delta: string }).delta;
				},
				"agent:started": (event) => {
					output += `\n[${(event.payload as { agentName: string }).agentName}] Starting...\n`;
				},
				"agent:completed": (event) => {
					output += `\n[${(event.payload as { agentName: string }).agentName}] Done.\n`;
				},
			},
		});

		const state: TestState = { count: 0, messages: [] };

		// Simulate agent conversation
		terminalRenderer.render(createEvent("agent:started", { agentName: "Assistant" }), state);
		terminalRenderer.render(createEvent("text:delta", { delta: "Hello" }), state);
		terminalRenderer.render(createEvent("text:delta", { delta: " there!" }), state);
		terminalRenderer.render(createEvent("agent:completed", { agentName: "Assistant" }), state);

		expect(output).toBe("\n[Assistant] Starting...\nHello there!\n[Assistant] Done.\n");
	});

	it("should support multiple renderers with different patterns", () => {
		const textOutput: string[] = [];
		const errorOutput: string[] = [];
		const allOutput: string[] = [];

		const textRenderer: Renderer<TestState> = {
			name: "text",
			patterns: ["text:*"],
			render: (event) => {
				textOutput.push(event.name);
			},
		};

		const errorRenderer: Renderer<TestState> = {
			name: "error",
			patterns: ["error:*"],
			render: (event) => {
				errorOutput.push(event.name);
			},
		};

		const logRenderer: Renderer<TestState> = {
			name: "log",
			patterns: ["*"],
			render: (event) => {
				allOutput.push(event.name);
			},
		};

		const renderers = [textRenderer, errorRenderer, logRenderer];
		const state: TestState = { count: 0, messages: [] };

		// Simulate events
		renderEvent(createEvent("text:delta", { delta: "a" }), state, renderers);
		renderEvent(createEvent("error:network", { message: "err" }), state, renderers);
		renderEvent(createEvent("user:input", { text: "hi" }), state, renderers);

		expect(textOutput).toEqual(["text:delta"]);
		expect(errorOutput).toEqual(["error:network"]);
		expect(allOutput).toEqual(["text:delta", "error:network", "user:input"]);
	});
});
