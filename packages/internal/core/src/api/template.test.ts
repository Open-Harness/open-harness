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
