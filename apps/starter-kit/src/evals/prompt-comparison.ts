/**
 * Prompt Comparison Eval Suite
 *
 * Demonstrates the primary use case for Open Harness evals:
 * "I have a workflow. I changed my prompt. Is it better or worse?"
 *
 * This suite compares two system prompts (baseline vs candidate) on the same
 * coding tasks to measure which performs better in terms of:
 * - Pass rate (assertions pass)
 * - Token efficiency
 * - Cost
 * - Latency
 */

import { defineSuite, gates, variant } from "@open-harness/core";
import { simpleCoderWorkflow } from "../workflows/simple-coder.js";

/**
 * Prompt Comparison eval suite.
 *
 * Compares a baseline prompt ("helpful coding assistant") against a
 * candidate prompt ("senior engineer, concise, modern patterns").
 */
export const promptComparisonSuite = defineSuite({
	name: "prompt-comparison",
	version: "1.0.0",

	// Use the simple coder workflow
	flow: simpleCoderWorkflow,

	// Baseline variant: Current production style
	// Candidate variant: New experimental style (more concise)
	variants: [
		variant("baseline", {
			model: "claude-sonnet-4-20250514",
			tags: ["baseline", "production"],
			config: {
				systemPrompt: "You are a helpful coding assistant. Write clean, working code.",
			},
		}),
		variant("candidate", {
			model: "claude-sonnet-4-20250514",
			tags: ["candidate", "experimental"],
			config: {
				systemPrompt:
					"You are a senior software engineer. Be concise. Prefer modern patterns. No comments unless complex.",
			},
		}),
	],

	// Compare candidate against baseline
	baseline: "baseline",

	// Test cases - simple coding tasks
	cases: [
		{
			id: "add-numbers",
			name: "Add two numbers",
			input: { task: "Write a JavaScript function that adds two numbers" },
			assertions: [
				{ type: "behavior.no_errors" },
				{
					type: "output.contains",
					path: "outputs.coder.text",
					value: "function",
				},
			],
			tags: ["smoke", "javascript"],
		},
		{
			id: "fizzbuzz",
			name: "FizzBuzz implementation",
			input: { task: "Write fizzbuzz in Python" },
			assertions: [
				{ type: "behavior.no_errors" },
				{ type: "output.contains", path: "outputs.coder.text", value: "fizz" },
			],
			tags: ["smoke", "python"],
		},
		{
			id: "reverse-string",
			name: "Reverse a string",
			input: { task: "Write a TypeScript function to reverse a string" },
			assertions: [
				{ type: "behavior.no_errors" },
				{
					type: "output.contains",
					path: "outputs.coder.text",
					value: "function",
				},
			],
			tags: ["smoke", "typescript"],
		},
	],

	// Default assertions applied to all cases
	defaultAssertions: [{ type: "metric.latency_ms.max", value: 30000 }],

	// Gates for pass/fail determination
	gates: [
		gates.noRegressions(), // No cases that passed now fail
		gates.passRate(0.9), // At least 90% pass rate
		gates.costUnder(0.1), // Each case under $0.10
		gates.latencyUnder(30000), // Each case under 30 seconds
	],
});

export default promptComparisonSuite;
