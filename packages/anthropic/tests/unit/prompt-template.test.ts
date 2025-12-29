/**
 * Unit Tests for Prompt Template Factory
 *
 * Tests for createPromptTemplate() type inference and render() function.
 *
 * Run with: bun test tests/unit/prompt-template.test.ts
 */

import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createPromptTemplate, createStaticPrompt } from "../../src/provider/prompt-template.js";

describe("createPromptTemplate", () => {
	describe("basic template creation", () => {
		test("returns a PromptTemplate object with template and render", () => {
			const template = createPromptTemplate("Hello {{name}}");

			expect(template).toBeDefined();
			expect(template.template).toBe("Hello {{name}}");
			expect(typeof template.render).toBe("function");
		});

		test("render replaces single variable", () => {
			const template = createPromptTemplate("Hello {{name}}");
			const result = template.render({ name: "World" });

			expect(result).toBe("Hello World");
		});

		test("render replaces multiple variables", () => {
			const template = createPromptTemplate("{{greeting}} {{name}}, welcome to {{place}}");
			const result = template.render({
				greeting: "Hello",
				name: "Alice",
				place: "Wonderland",
			});

			expect(result).toBe("Hello Alice, welcome to Wonderland");
		});

		test("render leaves unmatched placeholders as-is", () => {
			const template = createPromptTemplate("Hello {{name}} from {{city}}");
			// Only providing name, not city
			const result = template.render({ name: "Bob" } as { name: string; city: string });

			expect(result).toBe("Hello Bob from {{city}}");
		});

		test("render handles empty data object", () => {
			const template = createPromptTemplate("No variables here");
			const result = template.render({} as Record<never, never>);

			expect(result).toBe("No variables here");
		});

		test("render converts non-string values to strings", () => {
			const template = createPromptTemplate("Count: {{count}}, Active: {{active}}");
			const result = template.render({
				count: 42,
				active: true,
			} as { count: number; active: boolean });

			expect(result).toBe("Count: 42, Active: true");
		});
	});

	describe("with Zod schema validation", () => {
		test("returns validate function when schema provided", () => {
			const schema = z.object({
				task: z.string().min(1),
			});
			const template = createPromptTemplate("Do this: {{task}}", schema);

			expect(template.validate).toBeDefined();
			expect(typeof template.validate).toBe("function");
		});

		test("validate returns true for valid data", () => {
			const schema = z.object({
				task: z.string().min(1),
			});
			const template = createPromptTemplate("Do this: {{task}}", schema);

			expect(template.validate?.({ task: "something" })).toBe(true);
		});

		test("validate returns false for invalid data", () => {
			const schema = z.object({
				task: z.string().min(1),
			});
			const template = createPromptTemplate("Do this: {{task}}", schema);

			expect(template.validate?.({ task: "" })).toBe(false);
			expect(template.validate?.({ task: 123 })).toBe(false);
			expect(template.validate?.({})).toBe(false);
			expect(template.validate?.(null)).toBe(false);
		});

		test("validate is undefined when no schema provided", () => {
			const template = createPromptTemplate("Hello {{name}}");

			expect(template.validate).toBeUndefined();
		});

		test("complex schema validation", () => {
			const schema = z.object({
				input: z.string(),
				mode: z.enum(["fast", "thorough"]),
				iterations: z.number().int().positive().optional(),
			});
			const template = createPromptTemplate("Process {{input}} with {{mode}} mode", schema);

			expect(template.validate?.({ input: "data", mode: "fast" })).toBe(true);
			expect(template.validate?.({ input: "data", mode: "thorough", iterations: 5 })).toBe(true);
			expect(template.validate?.({ input: "data", mode: "invalid" })).toBe(false);
		});
	});

	describe("edge cases", () => {
		test("handles template with no variables", () => {
			const template = createPromptTemplate("Static text with no placeholders");
			const result = template.render({} as Record<never, never>);

			expect(result).toBe("Static text with no placeholders");
		});

		test("handles consecutive variables", () => {
			const template = createPromptTemplate("{{a}}{{b}}{{c}}");
			const result = template.render({ a: "1", b: "2", c: "3" });

			expect(result).toBe("123");
		});

		test("handles variable at start", () => {
			const template = createPromptTemplate("{{greeting}} everyone");
			const result = template.render({ greeting: "Hi" });

			expect(result).toBe("Hi everyone");
		});

		test("handles variable at end", () => {
			const template = createPromptTemplate("Hello {{name}}");
			const result = template.render({ name: "friend" });

			expect(result).toBe("Hello friend");
		});

		test("handles same variable multiple times", () => {
			const template = createPromptTemplate("{{name}} said {{name}} is {{name}}");
			const result = template.render({ name: "Bob" });

			expect(result).toBe("Bob said Bob is Bob");
		});

		test("handles special characters in values", () => {
			const template = createPromptTemplate("Code: {{code}}");
			const result = template.render({ code: "function() { return 42; }" });

			expect(result).toBe("Code: function() { return 42; }");
		});

		test("handles multiline templates", () => {
			const template = createPromptTemplate(`Line 1: {{first}}
Line 2: {{second}}
Line 3: {{third}}`);
			const result = template.render({
				first: "A",
				second: "B",
				third: "C",
			});

			expect(result).toBe(`Line 1: A
Line 2: B
Line 3: C`);
		});
	});
});

describe("createStaticPrompt", () => {
	test("returns a PromptTemplate with the static string", () => {
		const prompt = createStaticPrompt("You are a helpful assistant.");

		expect(prompt).toBeDefined();
		expect(prompt.template).toBe("You are a helpful assistant.");
		expect(typeof prompt.render).toBe("function");
	});

	test("render always returns the static string", () => {
		const prompt = createStaticPrompt("Static prompt text");

		expect(prompt.render({})).toBe("Static prompt text");
		// Static prompts ignore any input data passed to them
		expect(prompt.render({ ignored: "value" } as unknown as Record<string, never>)).toBe("Static prompt text");
	});

	test("has no validate function", () => {
		const prompt = createStaticPrompt("Static prompt");

		expect(prompt.validate).toBeUndefined();
	});

	test("handles empty string", () => {
		const prompt = createStaticPrompt("");

		expect(prompt.template).toBe("");
		expect(prompt.render({})).toBe("");
	});

	test("preserves special characters", () => {
		const prompt = createStaticPrompt("Use {{variable}} syntax for templates");

		// Static prompt should NOT interpret {{variable}} as a placeholder
		expect(prompt.render({})).toBe("Use {{variable}} syntax for templates");
	});
});
