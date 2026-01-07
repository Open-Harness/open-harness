// Integration tests for JSONata expression evaluator
// Tests the core capabilities needed for flow orchestration

import { beforeEach, describe, expect, test } from "bun:test";
import {
	clearExpressionCache,
	type ExpressionContext,
	evaluateExpression,
	isPureBinding,
	parseTemplate,
	resolveTemplate,
} from "../../src/index.js";

beforeEach(() => {
	clearExpressionCache();
});

describe("evaluateExpression", () => {
	describe("path resolution", () => {
		test("resolves simple path", async () => {
			const ctx: ExpressionContext = { task: { title: "Hello" } };
			expect(await evaluateExpression("task.title", ctx)).toBe("Hello");
		});

		test("resolves nested path", async () => {
			const ctx: ExpressionContext = {
				task: { metadata: { author: "John" } },
			};
			expect(await evaluateExpression("task.metadata.author", ctx)).toBe("John");
		});

		test("missing path returns undefined (NOT throw)", async () => {
			const ctx: ExpressionContext = {};
			// This is THE core bug fix - missing paths should not crash
			expect(await evaluateExpression("reviewer.text", ctx)).toBeUndefined();
		});

		test("deeply missing path returns undefined", async () => {
			const ctx: ExpressionContext = { task: {} };
			expect(await evaluateExpression("task.metadata.author.name", ctx)).toBeUndefined();
		});
	});

	describe("operators", () => {
		test("equality check", async () => {
			const ctx: ExpressionContext = { status: "done" };
			expect(await evaluateExpression('status = "done"', ctx)).toBe(true);
			expect(await evaluateExpression('status = "pending"', ctx)).toBe(false);
		});

		test("boolean equality", async () => {
			const ctx: ExpressionContext = { reviewer: { passed: true } };
			expect(await evaluateExpression("reviewer.passed = true", ctx)).toBe(true);
			expect(await evaluateExpression("reviewer.passed = false", ctx)).toBe(false);
		});

		test("inequality", async () => {
			const ctx: ExpressionContext = { count: 5 };
			expect(await evaluateExpression("count != 3", ctx)).toBe(true);
			expect(await evaluateExpression("count != 5", ctx)).toBe(false);
		});

		test("comparison operators", async () => {
			const ctx: ExpressionContext = { count: 5 };
			expect(await evaluateExpression("count > 3", ctx)).toBe(true);
			expect(await evaluateExpression("count < 10", ctx)).toBe(true);
			expect(await evaluateExpression("count >= 5", ctx)).toBe(true);
			expect(await evaluateExpression("count <= 5", ctx)).toBe(true);
		});

		test("$not function", async () => {
			const ctx: ExpressionContext = { reviewer: { passed: false } };
			expect(await evaluateExpression("$not(reviewer.passed)", ctx)).toBe(true);
		});

		test("$exists function", async () => {
			const ctx: ExpressionContext = { reviewer: { text: "Good job" } };
			expect(await evaluateExpression("$exists(reviewer)", ctx)).toBe(true);
			expect(await evaluateExpression("$exists(missing)", ctx)).toBe(false);
		});

		test("and operator", async () => {
			const ctx: ExpressionContext = { a: true, b: true, c: false };
			expect(await evaluateExpression("a and b", ctx)).toBe(true);
			expect(await evaluateExpression("a and c", ctx)).toBe(false);
		});

		test("or operator", async () => {
			const ctx: ExpressionContext = { a: true, b: false };
			expect(await evaluateExpression("a or b", ctx)).toBe(true);
			expect(await evaluateExpression("b or b", ctx)).toBe(false);
		});
	});

	describe("ternary", () => {
		test("basic ternary", async () => {
			const ctx: ExpressionContext = { condition: true };
			expect(await evaluateExpression('condition ? "yes" : "no"', ctx)).toBe("yes");
		});

		test("ternary with missing value defaults", async () => {
			const ctx: ExpressionContext = {};
			// When reviewer is missing, use default
			expect(await evaluateExpression('$exists(reviewer) ? reviewer.text : "No feedback yet"', ctx)).toBe(
				"No feedback yet",
			);
		});

		test("ternary with existing value", async () => {
			const ctx: ExpressionContext = { reviewer: { text: "Looks good!" } };
			expect(await evaluateExpression('$exists(reviewer) ? reviewer.text : "No feedback yet"', ctx)).toBe(
				"Looks good!",
			);
		});
	});

	describe("array access", () => {
		test("first element", async () => {
			const ctx: ExpressionContext = {
				tasks: [{ title: "First" }, { title: "Second" }],
			};
			expect(await evaluateExpression("tasks[0].title", ctx)).toBe("First");
		});

		test("last element with negative index", async () => {
			const ctx: ExpressionContext = {
				tasks: [{ title: "First" }, { title: "Last" }],
			};
			// JSONata uses -1 for last element
			expect(await evaluateExpression("tasks[-1].title", ctx)).toBe("Last");
		});
	});

	describe("string operations", () => {
		test("concatenation", async () => {
			const ctx: ExpressionContext = { name: "World" };
			expect(await evaluateExpression('"Hello " & name', ctx)).toBe("Hello World");
		});
	});

	describe("iteration context", () => {
		test("$iteration is available", async () => {
			const ctx: ExpressionContext = { $iteration: 2 };
			expect(await evaluateExpression("$iteration", ctx)).toBe(2);
		});

		test("$first is available", async () => {
			const ctx: ExpressionContext = { $first: true };
			expect(await evaluateExpression("$first", ctx)).toBe(true);
		});

		test("$last is available", async () => {
			const ctx: ExpressionContext = { $last: false };
			expect(await evaluateExpression("$last", ctx)).toBe(false);
		});

		test("$maxIterations is available", async () => {
			const ctx: ExpressionContext = { $maxIterations: 5 };
			expect(await evaluateExpression("$maxIterations", ctx)).toBe(5);
		});

		test("iteration context in conditions", async () => {
			const ctx: ExpressionContext = { $iteration: 0, $first: true };
			expect(await evaluateExpression('$first ? "Initial" : "Retry"', ctx)).toBe("Initial");
		});
	});
});

describe("parseTemplate", () => {
	test("pure binding", () => {
		const segments = parseTemplate("{{ task.title }}");
		expect(segments).toEqual([{ type: "expression", value: "task.title" }]);
	});

	test("text only", () => {
		const segments = parseTemplate("No bindings here");
		expect(segments).toEqual([{ type: "text", value: "No bindings here" }]);
	});

	test("mixed template", () => {
		const segments = parseTemplate("Hello {{ name }}!");
		expect(segments).toEqual([
			{ type: "text", value: "Hello " },
			{ type: "expression", value: "name" },
			{ type: "text", value: "!" },
		]);
	});

	test("multiple expressions", () => {
		const segments = parseTemplate("{{ a }} and {{ b }}");
		expect(segments).toEqual([
			{ type: "expression", value: "a" },
			{ type: "text", value: " and " },
			{ type: "expression", value: "b" },
		]);
	});
});

describe("isPureBinding", () => {
	test("pure binding", () => {
		expect(isPureBinding("{{ task.title }}")).toBe(true);
		expect(isPureBinding("{{task}}")).toBe(true);
	});

	test("not pure binding", () => {
		expect(isPureBinding("Hello {{ name }}")).toBe(false);
		expect(isPureBinding("{{ a }} {{ b }}")).toBe(false);
		expect(isPureBinding("No bindings")).toBe(false);
	});
});

describe("resolveTemplate", () => {
	test("pure binding preserves type - string", async () => {
		const ctx: ExpressionContext = { task: { title: "Hello" } };
		expect(await resolveTemplate("{{ task.title }}", ctx)).toBe("Hello");
	});

	test("pure binding preserves type - object", async () => {
		const ctx: ExpressionContext = { task: { title: "Hello", done: false } };
		const result = await resolveTemplate("{{ task }}", ctx);
		expect(result).toEqual({ title: "Hello", done: false });
	});

	test("pure binding preserves type - array", async () => {
		const ctx: ExpressionContext = { items: [1, 2, 3] };
		const result = await resolveTemplate("{{ items }}", ctx);
		expect(result).toEqual([1, 2, 3]);
	});

	test("pure binding preserves type - number", async () => {
		const ctx: ExpressionContext = { count: 42 };
		expect(await resolveTemplate("{{ count }}", ctx)).toBe(42);
	});

	test("pure binding with missing path returns undefined", async () => {
		const ctx: ExpressionContext = {};
		expect(await resolveTemplate("{{ missing }}", ctx)).toBeUndefined();
	});

	test("mixed template returns string", async () => {
		const ctx: ExpressionContext = { name: "World" };
		expect(await resolveTemplate("Hello {{ name }}!", ctx)).toBe("Hello World!");
	});

	test("mixed template with missing value uses empty string", async () => {
		const ctx: ExpressionContext = {};
		expect(await resolveTemplate("Value: {{ missing }}", ctx)).toBe("Value: ");
	});

	test("mixed template with object stringifies", async () => {
		const ctx: ExpressionContext = { data: { a: 1 } };
		expect(await resolveTemplate("Data: {{ data }}", ctx)).toBe('Data: {"a":1}');
	});
});

// Real-world patterns that users need
describe("orchestration patterns", () => {
	describe("coder-reviewer loop", () => {
		test("first iteration: reviewer undefined, no crash", async () => {
			const ctx: ExpressionContext = {
				task: { title: "Implement auth", description: "Add login" },
				$iteration: 0,
				$first: true,
				// reviewer is NOT present on first iteration
			};

			// These should all work without crashing
			const prompt = await resolveTemplate(
				`# Task: {{ task.title }}
{{ task.description }}

{{ $exists(reviewer) ? "## Feedback\\n" & reviewer.text : "" }}

{{ $first ? "Implement this task." : "Address the feedback above." }}`,
				ctx,
			);

			expect(prompt).toContain("# Task: Implement auth");
			expect(prompt).toContain("Add login");
			expect(prompt).not.toContain("## Feedback");
			expect(prompt).toContain("Implement this task.");
		});

		test("subsequent iteration: reviewer present, feedback shown", async () => {
			const ctx: ExpressionContext = {
				task: { title: "Implement auth", description: "Add login" },
				reviewer: {
					text: "Add error handling",
					structuredOutput: { passed: false },
				},
				$iteration: 1,
				$first: false,
			};

			const prompt = await resolveTemplate(
				`{{ $exists(reviewer) ? "## Feedback\\n" & reviewer.text : "" }}
{{ $first ? "Implement this task." : "Address the feedback above." }}`,
				ctx,
			);

			expect(prompt).toContain("## Feedback");
			expect(prompt).toContain("Add error handling");
			expect(prompt).toContain("Address the feedback above.");
		});

		test("when clause: loop continues while not passed", async () => {
			// Iteration 0: reviewer undefined
			const ctx0: ExpressionContext = { $iteration: 0 };
			// $not(undefined = true) should be true (continue loop)
			expect(await evaluateExpression("$not(reviewer.structuredOutput.passed = true)", ctx0)).toBe(true);

			// Iteration 1: reviewer.passed = false
			const ctx1: ExpressionContext = {
				reviewer: { structuredOutput: { passed: false } },
				$iteration: 1,
			};
			expect(await evaluateExpression("$not(reviewer.structuredOutput.passed = true)", ctx1)).toBe(true);

			// Final: reviewer.passed = true
			const ctxFinal: ExpressionContext = {
				reviewer: { structuredOutput: { passed: true } },
				$iteration: 2,
			};
			expect(await evaluateExpression("$not(reviewer.structuredOutput.passed = true)", ctxFinal)).toBe(false);
		});
	});

	describe("multi-node data flow", () => {
		test("chain outputs through nodes", async () => {
			const ctx: ExpressionContext = {
				researcher: { text: "Found 3 relevant papers..." },
				summarizer: { text: "Key findings: ..." },
			};

			const writerPrompt = await resolveTemplate(
				`Based on this research:
{{ researcher.text }}

And this summary:
{{ summarizer.text }}

Write a blog post.`,
				ctx,
			);

			expect(writerPrompt).toContain("Found 3 relevant papers");
			expect(writerPrompt).toContain("Key findings:");
		});
	});

	describe("structured output access", () => {
		test("access JSON schema output fields", async () => {
			const ctx: ExpressionContext = {
				analyzer: {
					structuredOutput: {
						score: 85,
						issues: ["Missing tests", "No docs"],
						recommendation: "approve_with_changes",
					},
				},
			};

			expect(await evaluateExpression("analyzer.structuredOutput.score", ctx)).toBe(85);
			expect(await evaluateExpression("analyzer.structuredOutput.score > 80", ctx)).toBe(true);
			expect(await evaluateExpression("analyzer.structuredOutput.issues[0]", ctx)).toBe("Missing tests");
		});
	});
});
