/**
 * Output assertion evaluators.
 *
 * These evaluate the final output text: contains, matches, json validation, length.
 */

import type { AssertionResult } from "../types.js";
import type {
	OutputContainsAssertion,
	OutputJsonAssertion,
	OutputLengthAssertion,
	OutputMatchesAssertion,
	OutputNotContainsAssertion,
} from "./types.js";

/**
 * Get output as string from various output types.
 */
function getOutputString(output: unknown): string {
	if (typeof output === "string") return output;
	if (output === null || output === undefined) return "";
	if (typeof output === "object" && "text" in output) {
		return String((output as { text: unknown }).text ?? "");
	}
	return JSON.stringify(output);
}

/**
 * Evaluate output.contains assertion.
 */
export function evaluateOutputContains(assertion: OutputContainsAssertion, output: unknown): AssertionResult {
	const outputStr = getOutputString(output);
	const caseSensitive = assertion.caseSensitive ?? true;

	const searchIn = caseSensitive ? outputStr : outputStr.toLowerCase();
	const searchFor = caseSensitive ? assertion.text : assertion.text.toLowerCase();

	const passed = searchIn.includes(searchFor);

	return {
		assertion,
		passed,
		message: passed ? `Output contains "${assertion.text}"` : `Output does not contain "${assertion.text}"`,
		expected: assertion.text,
		actual: outputStr.length > 200 ? `${outputStr.slice(0, 200)}...` : outputStr,
	};
}

/**
 * Evaluate output.notContains assertion.
 */
export function evaluateOutputNotContains(assertion: OutputNotContainsAssertion, output: unknown): AssertionResult {
	const outputStr = getOutputString(output);
	const caseSensitive = assertion.caseSensitive ?? true;

	const searchIn = caseSensitive ? outputStr : outputStr.toLowerCase();
	const searchFor = caseSensitive ? assertion.text : assertion.text.toLowerCase();

	const passed = !searchIn.includes(searchFor);

	return {
		assertion,
		passed,
		message: passed
			? `Output does not contain "${assertion.text}" (as expected)`
			: `Output contains "${assertion.text}" (unexpected)`,
		expected: `not "${assertion.text}"`,
		actual: outputStr.length > 200 ? `${outputStr.slice(0, 200)}...` : outputStr,
	};
}

/**
 * Evaluate output.matches assertion.
 */
export function evaluateOutputMatches(assertion: OutputMatchesAssertion, output: unknown): AssertionResult {
	const outputStr = getOutputString(output);

	let regex: RegExp;
	try {
		regex = new RegExp(assertion.regex, assertion.flags);
	} catch (e) {
		return {
			assertion,
			passed: false,
			message: `Invalid regex pattern: ${(e as Error).message}`,
			expected: assertion.regex,
		};
	}

	const passed = regex.test(outputStr);
	const match = outputStr.match(regex);

	return {
		assertion,
		passed,
		message: passed
			? `Output matches pattern /${assertion.regex}/${assertion.flags ?? ""}`
			: `Output does not match pattern /${assertion.regex}/${assertion.flags ?? ""}`,
		expected: assertion.regex,
		actual: match ? match[0] : outputStr.length > 200 ? `${outputStr.slice(0, 200)}...` : outputStr,
	};
}

/**
 * Evaluate output.json assertion.
 */
export function evaluateOutputJson(assertion: OutputJsonAssertion, output: unknown): AssertionResult {
	const outputStr = getOutputString(output);

	// Try to parse as JSON
	let parsed: unknown;
	try {
		parsed = JSON.parse(outputStr);
	} catch (e) {
		return {
			assertion,
			passed: false,
			message: `Output is not valid JSON: ${(e as Error).message}`,
			actual: outputStr.length > 200 ? `${outputStr.slice(0, 200)}...` : outputStr,
		};
	}

	// Validate against schema
	const result = assertion.schema.safeParse(parsed);

	if (!result.success) {
		return {
			assertion,
			passed: false,
			message: `Output JSON does not match schema: ${result.error.message}`,
			expected: "schema validation",
			actual: parsed,
		};
	}

	return {
		assertion,
		passed: true,
		message: "Output JSON matches schema",
		actual: parsed,
	};
}

/**
 * Evaluate output.length assertion.
 */
export function evaluateOutputLength(assertion: OutputLengthAssertion, output: unknown): AssertionResult {
	const outputStr = getOutputString(output);
	const length = outputStr.length;

	let passed = true;
	const issues: string[] = [];

	if (assertion.min !== undefined && length < assertion.min) {
		passed = false;
		issues.push(`expected min ${assertion.min}, got ${length}`);
	}
	if (assertion.max !== undefined && length > assertion.max) {
		passed = false;
		issues.push(`expected max ${assertion.max}, got ${length}`);
	}

	if (!passed) {
		return {
			assertion,
			passed: false,
			message: `Output length mismatch: ${issues.join(", ")}`,
			expected: { min: assertion.min, max: assertion.max },
			actual: length,
		};
	}

	return {
		assertion,
		passed: true,
		message: `Output length ${length} is within range`,
		actual: length,
	};
}
