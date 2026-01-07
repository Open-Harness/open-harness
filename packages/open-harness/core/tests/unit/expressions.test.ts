// Integration tests for JSONata expression evaluator
// Tests the core capabilities needed for flow orchestration

import { beforeEach, describe, expect, test } from "bun:test";
import {
	clearExpressionCache,
	type ExpressionContext,
	ExpressionError,
	evaluateExpression,
	evaluateExpressionResult,
	evaluateTemplateResult,
	isPureBinding,
	parseTemplate,
	resolveTemplate,
	resolveTemplateResult,
	wrapThrow,
	wrapThrowAsync,
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

// ============================================================================
// Result-based API tests (neverthrow integration)
// ============================================================================

describe("ExpressionError", () => {
	test("creates error with code and message", () => {
		const err = new ExpressionError("EVALUATION_ERROR", "Invalid expression");
		expect(err.code).toBe("EVALUATION_ERROR");
		expect(err.message).toBe("Invalid expression");
		expect(err.name).toBe("ExpressionError");
	});

	test("includes original error in chain", () => {
		const cause = new SyntaxError("Bad syntax");
		const err = new ExpressionError("PARSE_ERROR", "Failed to parse", cause);
		expect(err.originalError).toBe(cause);
	});

	test("error codes are distinguishable", () => {
		const codes: Array<"PARSE_ERROR" | "EVALUATION_ERROR" | "VALIDATION_ERROR" | "UNDEFINED_BINDING" | "TYPE_ERROR"> = [
			"PARSE_ERROR",
			"EVALUATION_ERROR",
			"VALIDATION_ERROR",
			"UNDEFINED_BINDING",
			"TYPE_ERROR",
		];
		codes.forEach((code) => {
			const err = new ExpressionError(code, `Error: ${code}`);
			expect(err.code).toBe(code);
		});
	});
});

describe("wrapThrow", () => {
	test("successful execution returns ok", () => {
		const result = wrapThrow("EVALUATION_ERROR", () => {
			return 42;
		});
		expect(result.isOk()).toBe(true);
		expect(result.value).toBe(42);
	});

	test("throws error returns err with code", () => {
		const result = wrapThrow("EVALUATION_ERROR", () => {
			throw new Error("Something broke");
		});
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.code).toBe("EVALUATION_ERROR");
			expect(result.error.message).toBe("Something broke");
		}
	});

	test("catches non-Error throws", () => {
		const result = wrapThrow("PARSE_ERROR", () => {
			throw "string error";
		});
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.message).toBe("string error");
		}
	});
});

describe("wrapThrowAsync", () => {
	test("successful async execution returns ok", async () => {
		const result = await wrapThrowAsync("EVALUATION_ERROR", async () => {
			return "success";
		});
		expect(result.isOk()).toBe(true);
		expect(result.value).toBe("success");
	});

	test("async error returns err with code", async () => {
		const result = await wrapThrowAsync("EVALUATION_ERROR", async () => {
			throw new Error("Async failed");
		});
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.code).toBe("EVALUATION_ERROR");
			expect(result.error.message).toBe("Async failed");
		}
	});

	test("catches async rejection", async () => {
		const result = await wrapThrowAsync("EVALUATION_ERROR", async () => {
			await Promise.reject(new Error("Promise rejected"));
			return "never";
		});
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.message).toContain("Promise rejected");
		}
	});
});

describe("evaluateExpressionResult", () => {
	test("successful evaluation returns ok", async () => {
		const ctx: ExpressionContext = { task: { title: "Hello" } };
		const result = await evaluateExpressionResult("task.title", ctx);
		expect(result.isOk()).toBe(true);
		expect(result.value).toBe("Hello");
	});

	test("missing path returns ok with undefined", async () => {
		const ctx: ExpressionContext = {};
		const result = await evaluateExpressionResult("missing.path", ctx);
		expect(result.isOk()).toBe(true);
		expect(result.value).toBeUndefined();
	});

	test("syntax error returns err", async () => {
		const ctx: ExpressionContext = { x: 5 };
		const result = await evaluateExpressionResult("x +++ y", ctx); // Invalid syntax
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.code).toBe("EVALUATION_ERROR");
		}
	});

	test("complex expression success", async () => {
		const ctx: ExpressionContext = { a: 5, b: 3 };
		const result = await evaluateExpressionResult("a > b", ctx);
		expect(result.isOk()).toBe(true);
		expect(result.value).toBe(true);
	});
});

describe("evaluateTemplateResult", () => {
	test("template evaluation returns ok string", async () => {
		const ctx: ExpressionContext = { name: "World" };
		const segments = parseTemplate("Hello {{ name }}!");
		const result = await evaluateTemplateResult(segments, ctx);
		expect(result.isOk()).toBe(true);
		expect(result.value).toBe("Hello World!");
	});

	test("template with missing values returns ok", async () => {
		const ctx: ExpressionContext = {};
		const segments = parseTemplate("Value: {{ missing }}");
		const result = await evaluateTemplateResult(segments, ctx);
		expect(result.isOk()).toBe(true);
		expect(result.value).toBe("Value: ");
	});

	test("multiple expressions in template", async () => {
		const ctx: ExpressionContext = { first: "Hello", second: "World" };
		const segments = parseTemplate("{{ first }} {{ second }}!");
		const result = await evaluateTemplateResult(segments, ctx);
		expect(result.isOk()).toBe(true);
		expect(result.value).toBe("Hello World!");
	});
});

describe("resolveTemplateResult", () => {
	test("pure binding returns ok with object", async () => {
		const ctx: ExpressionContext = { task: { title: "Test", done: false } };
		const result = await resolveTemplateResult("{{ task }}", ctx);
		expect(result.isOk()).toBe(true);
		expect(result.value).toEqual({ title: "Test", done: false });
	});

	test("pure binding returns ok with array", async () => {
		const ctx: ExpressionContext = { items: [1, 2, 3] };
		const result = await resolveTemplateResult("{{ items }}", ctx);
		expect(result.isOk()).toBe(true);
		expect(result.value).toEqual([1, 2, 3]);
	});

	test("pure binding with missing returns ok undefined", async () => {
		const ctx: ExpressionContext = {};
		const result = await resolveTemplateResult("{{ missing }}", ctx);
		expect(result.isOk()).toBe(true);
		expect(result.value).toBeUndefined();
	});

	test("mixed template returns ok string", async () => {
		const ctx: ExpressionContext = { name: "Alice" };
		const result = await resolveTemplateResult("Hello {{ name }}!", ctx);
		expect(result.isOk()).toBe(true);
		expect(result.value).toBe("Hello Alice!");
	});

	test("mixed template with object stringifies", async () => {
		const ctx: ExpressionContext = { data: { x: 1 } };
		const result = await resolveTemplateResult("Data: {{ data }}", ctx);
		expect(result.isOk()).toBe(true);
		expect(result.value).toBe('Data: {"x":1}');
	});

	test("error handling with invalid syntax", async () => {
		const ctx: ExpressionContext = { x: 5 };
		const result = await resolveTemplateResult("{{ x +++ }}", ctx);
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.code).toBe("EVALUATION_ERROR");
		}
	});
});

describe("Result-based API in orchestration patterns", () => {
	test("error handling in conditional template", async () => {
		const ctx: ExpressionContext = {
			task: { title: "Test" },
			reviewer: undefined,
		};
		const template = `{{ $exists(reviewer) ? reviewer.text : "No feedback" }}`;
		const result = await resolveTemplateResult(template, ctx);
		expect(result.isOk()).toBe(true);
		expect(result.value).toBe("No feedback");
	});

	test("match pattern for ok result", async () => {
		const ctx: ExpressionContext = { value: 42 };
		const result = await evaluateExpressionResult("value", ctx);
		let matched = false;
		result.match(
			(val) => {
				expect(val).toBe(42);
				matched = true;
			},
			() => {
				throw new Error("Should not hit error branch");
			},
		);
		expect(matched).toBe(true);
	});

	test("match pattern for err result", async () => {
		const ctx: ExpressionContext = {};
		const result = await evaluateExpressionResult("x +++ y", ctx);
		let matched = false;
		result.match(
			() => {
				throw new Error("Should not hit ok branch");
			},
			(err) => {
				expect(err.code).toBe("EVALUATION_ERROR");
				matched = true;
			},
		);
		expect(matched).toBe(true);
	});

	test("mapErr to transform errors", async () => {
		const ctx: ExpressionContext = {};
		const result = await evaluateExpressionResult("bad syntax", ctx).then((r) =>
			r.mapErr((err) => ({
				...err,
				userMessage: `Expression failed: ${err.message}`,
			})),
		);

		const hasUserMessage = (value: unknown): value is { userMessage: string } => {
			if (typeof value !== "object" || value === null || !("userMessage" in value)) {
				return false;
			}
			return typeof (value as { userMessage?: unknown }).userMessage === "string";
		};

		result.match(
			() => {
				throw new Error("Should have error");
			},
			(err) => {
				expect(hasUserMessage(err)).toBe(true);
				if (hasUserMessage(err)) {
					expect(err.userMessage).toContain("Expression failed");
				}
			},
		);
	});
});
