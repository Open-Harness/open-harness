/**
 * Tests for template engine.
 *
 * F2: Template Expansion
 */

import { describe, it, expect } from "vitest";
import {
	expandTemplate,
	hasTemplateExpressions,
	extractPaths,
	parsePath,
	type TemplateContext,
} from "./template.js";

// ============================================================================
// Test Context Factory
// ============================================================================

function createContext(overrides?: Partial<TemplateContext>): TemplateContext {
	return {
		state: { ticker: "AAPL", price: 150.25, ready: true },
		signal: { name: "harness:start", payload: { source: "test" } },
		input: "analyze market",
		...overrides,
	};
}

// ============================================================================
// Basic Template Expansion
// ============================================================================

describe("expandTemplate", () => {
	describe("state access", () => {
		it("expands simple state property", () => {
			const result = expandTemplate(
				"Analyze {{ state.ticker }}",
				createContext(),
			);
			expect(result).toBe("Analyze AAPL");
		});

		it("expands multiple state properties", () => {
			const result = expandTemplate(
				"{{ state.ticker }} at ${{ state.price }}",
				createContext(),
			);
			expect(result).toBe("AAPL at $150.25");
		});

		it("expands boolean state", () => {
			const result = expandTemplate(
				"Ready: {{ state.ready }}",
				createContext(),
			);
			expect(result).toBe("Ready: true");
		});

		it("expands nested state properties", () => {
			const ctx = createContext({
				state: {
					user: {
						name: "Alice",
						preferences: { theme: "dark" },
					},
				},
			});
			const result = expandTemplate(
				"Hello {{ state.user.name }}, theme: {{ state.user.preferences.theme }}",
				ctx,
			);
			expect(result).toBe("Hello Alice, theme: dark");
		});

		it("returns empty string for undefined properties", () => {
			const result = expandTemplate(
				"Value: {{ state.nonexistent }}",
				createContext(),
			);
			expect(result).toBe("Value: ");
		});

		it("handles null values", () => {
			const ctx = createContext({ state: { value: null } });
			const result = expandTemplate("Value: {{ state.value }}", ctx);
			expect(result).toBe("Value: null");
		});
	});

	describe("signal access", () => {
		it("expands signal name", () => {
			const result = expandTemplate(
				"Triggered by {{ signal.name }}",
				createContext(),
			);
			expect(result).toBe("Triggered by harness:start");
		});

		it("expands signal payload properties", () => {
			const ctx = createContext({
				signal: {
					name: "data:received",
					payload: { count: 42, type: "market" },
				},
			});
			const result = expandTemplate(
				"Received {{ signal.payload.count }} {{ signal.payload.type }} items",
				ctx,
			);
			expect(result).toBe("Received 42 market items");
		});
	});

	describe("input access", () => {
		it("expands simple input string", () => {
			const ctx = createContext({ input: "market data" });
			const result = expandTemplate("Processing: {{ input }}", ctx);
			expect(result).toBe("Processing: market data");
		});

		it("expands input object as JSON", () => {
			const ctx = createContext({ input: { query: "stocks" } });
			const result = expandTemplate("Input: {{ input }}", ctx);
			expect(result).toBe('Input: {"query":"stocks"}');
		});

		it("expands input object property", () => {
			const ctx = createContext({ input: { query: "stocks", limit: 10 } });
			const result = expandTemplate(
				"Query: {{ input.query }}, Limit: {{ input.limit }}",
				ctx,
			);
			expect(result).toBe("Query: stocks, Limit: 10");
		});
	});

	describe("shorthand access", () => {
		it("allows shorthand state access without 'state.' prefix", () => {
			const result = expandTemplate("Ticker: {{ ticker }}", createContext());
			expect(result).toBe("Ticker: AAPL");
		});

		it("prefers explicit state. prefix", () => {
			const result = expandTemplate(
				"{{ state.ticker }} vs {{ ticker }}",
				createContext(),
			);
			expect(result).toBe("AAPL vs AAPL");
		});
	});

	describe("edge cases", () => {
		it("returns original string when no templates", () => {
			const result = expandTemplate("No templates here", createContext());
			expect(result).toBe("No templates here");
		});

		it("handles empty template", () => {
			const result = expandTemplate("", createContext());
			expect(result).toBe("");
		});

		it("handles whitespace in expressions", () => {
			const result = expandTemplate(
				"{{   state.ticker   }}",
				createContext(),
			);
			expect(result).toBe("AAPL");
		});

		it("handles arrays in state", () => {
			const ctx = createContext({ state: { items: ["a", "b", "c"] } });
			const result = expandTemplate("Items: {{ state.items }}", ctx);
			expect(result).toBe('Items: ["a","b","c"]');
		});

		it("handles objects in state", () => {
			const ctx = createContext({ state: { config: { a: 1, b: 2 } } });
			const result = expandTemplate("Config: {{ state.config }}", ctx);
			expect(result).toBe('Config: {"a":1,"b":2}');
		});

		it("handles multiple templates on same line", () => {
			const result = expandTemplate(
				"{{ state.ticker }}:{{ state.price }}:{{ state.ready }}",
				createContext(),
			);
			expect(result).toBe("AAPL:150.25:true");
		});

		it("handles deeply nested paths", () => {
			const ctx = createContext({
				state: {
					a: { b: { c: { d: { e: "deep" } } } },
				},
			});
			const result = expandTemplate("{{ state.a.b.c.d.e }}", ctx);
			expect(result).toBe("deep");
		});
	});
});

// ============================================================================
// Template Detection
// ============================================================================

describe("hasTemplateExpressions", () => {
	it("returns true for templates", () => {
		expect(hasTemplateExpressions("Hello {{ state.name }}")).toBe(true);
	});

	it("returns false for plain strings", () => {
		expect(hasTemplateExpressions("Hello world")).toBe(false);
	});

	it("returns false for incomplete braces", () => {
		expect(hasTemplateExpressions("Hello { state.name }")).toBe(false);
		expect(hasTemplateExpressions("Hello {{ state.name }")).toBe(false);
	});
});

// ============================================================================
// Path Extraction
// ============================================================================

describe("extractPaths", () => {
	it("extracts single path", () => {
		expect(extractPaths("{{ state.name }}")).toEqual(["state.name"]);
	});

	it("extracts multiple paths", () => {
		expect(
			extractPaths("{{ state.a }} and {{ signal.name }} with {{ input }}"),
		).toEqual(["state.a", "signal.name", "input"]);
	});

	it("returns empty array for no templates", () => {
		expect(extractPaths("no templates")).toEqual([]);
	});

	it("trims whitespace from paths", () => {
		expect(extractPaths("{{   state.name   }}")).toEqual(["state.name"]);
	});
});

// ============================================================================
// FE-002: Bracket Notation Tests
// ============================================================================

describe("parsePath", () => {
	it("parses simple property path", () => {
		expect(parsePath("state.foo.bar")).toEqual([
			{ type: "property", name: "state" },
			{ type: "property", name: "foo" },
			{ type: "property", name: "bar" },
		]);
	});

	it("parses array index", () => {
		expect(parsePath("state.items[0]")).toEqual([
			{ type: "property", name: "state" },
			{ type: "property", name: "items" },
			{ type: "index", value: 0 },
		]);
	});

	it("parses dynamic key", () => {
		expect(parsePath("state.tasks[state.currentId]")).toEqual([
			{ type: "property", name: "state" },
			{ type: "property", name: "tasks" },
			{ type: "dynamic", expression: "state.currentId" },
		]);
	});

	it("parses mixed bracket and property", () => {
		expect(parsePath("state.tasks[0].name")).toEqual([
			{ type: "property", name: "state" },
			{ type: "property", name: "tasks" },
			{ type: "index", value: 0 },
			{ type: "property", name: "name" },
		]);
	});

	it("parses chained brackets", () => {
		expect(parsePath("state.a[state.b][state.c]")).toEqual([
			{ type: "property", name: "state" },
			{ type: "property", name: "a" },
			{ type: "dynamic", expression: "state.b" },
			{ type: "dynamic", expression: "state.c" },
		]);
	});

	it("parses nested expression in brackets", () => {
		expect(parsePath("state.nested[state.a.b.c]")).toEqual([
			{ type: "property", name: "state" },
			{ type: "property", name: "nested" },
			{ type: "dynamic", expression: "state.a.b.c" },
		]);
	});
});

describe("expandTemplate with bracket notation", () => {
	it("expands array index access", () => {
		const ctx = createContext({
			state: { items: ["first", "second", "third"] },
		});
		const result = expandTemplate("First: {{ state.items[0] }}", ctx);
		expect(result).toBe("First: first");
	});

	it("expands multiple array indices", () => {
		const ctx = createContext({
			state: { items: ["a", "b", "c"] },
		});
		const result = expandTemplate(
			"{{ state.items[0] }}-{{ state.items[1] }}-{{ state.items[2] }}",
			ctx,
		);
		expect(result).toBe("a-b-c");
	});

	it("expands dynamic key from state", () => {
		const ctx = createContext({
			state: {
				currentKey: "foo",
				map: { foo: "bar value", baz: "other value" },
			},
		});
		const result = expandTemplate(
			"Value: {{ state.map[state.currentKey] }}",
			ctx,
		);
		expect(result).toBe("Value: bar value");
	});

	it("expands nested dynamic key", () => {
		const ctx = createContext({
			state: {
				a: { b: "taskId123" },
				tasks: {
					taskId123: { name: "My Task", status: "complete" },
				},
			},
		});
		const result = expandTemplate(
			"Task: {{ state.tasks[state.a.b].name }}",
			ctx,
		);
		expect(result).toBe("Task: My Task");
	});

	it("expands chained dynamic keys", () => {
		const ctx = createContext({
			state: {
				keyA: "level1",
				keyB: "level2",
				data: {
					level1: {
						level2: "deep value",
					},
				},
			},
		});
		const result = expandTemplate(
			"Deep: {{ state.data[state.keyA][state.keyB] }}",
			ctx,
		);
		expect(result).toBe("Deep: deep value");
	});

	it("expands mixed array index and property", () => {
		const ctx = createContext({
			state: {
				users: [
					{ name: "Alice", age: 30 },
					{ name: "Bob", age: 25 },
				],
			},
		});
		const result = expandTemplate(
			"User: {{ state.users[1].name }}, Age: {{ state.users[1].age }}",
			ctx,
		);
		expect(result).toBe("User: Bob, Age: 25");
	});

	it("returns empty string for undefined dynamic key", () => {
		const ctx = createContext({
			state: {
				currentKey: "nonexistent",
				map: { foo: "bar" },
			},
		});
		const result = expandTemplate(
			"Value: {{ state.map[state.currentKey] }}",
			ctx,
		);
		expect(result).toBe("Value: ");
	});

	it("returns empty string for out of bounds array index", () => {
		const ctx = createContext({
			state: { items: ["only one"] },
		});
		const result = expandTemplate("Item: {{ state.items[5] }}", ctx);
		expect(result).toBe("Item: ");
	});

	it("works with numeric string keys", () => {
		const ctx = createContext({
			state: {
				index: "1",
				items: ["a", "b", "c"],
			},
		});
		// Numeric string key works on arrays too
		const result = expandTemplate("Item: {{ state.items[state.index] }}", ctx);
		expect(result).toBe("Item: b");
	});

	it("handles complex real-world PRD workflow pattern", () => {
		// This is the actual use case from the PRD Agent System
		const ctx = createContext({
			state: {
				execution: {
					currentTaskId: "T001",
				},
				planning: {
					allTasks: {
						T001: {
							id: "T001",
							title: "Implement login form",
							status: "in_progress",
						},
						T002: {
							id: "T002",
							title: "Add validation",
							status: "pending",
						},
					},
				},
			},
		});
		const result = expandTemplate(
			"Current task: {{ state.planning.allTasks[state.execution.currentTaskId].title }}",
			ctx,
		);
		expect(result).toBe("Current task: Implement login form");
	});
});
