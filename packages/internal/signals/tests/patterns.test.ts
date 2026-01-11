import { describe, expect, test } from "bun:test";
import { compilePattern, globToRegex, matchesAnyPattern, matchesPattern } from "../src/patterns.js";

describe("patterns", () => {
	describe("globToRegex", () => {
		test("converts single wildcard to segment matcher", () => {
			const regex = globToRegex("node:*:completed");

			expect(regex.test("node:analyst:completed")).toBe(true);
			expect(regex.test("node:trader:completed")).toBe(true);
			expect(regex.test("node::completed")).toBe(true); // empty segment
			expect(regex.test("node:a:b:completed")).toBe(false); // multiple segments
		});

		test("converts double wildcard to any matcher", () => {
			const regex = globToRegex("provider:**");

			expect(regex.test("provider:claude")).toBe(true);
			expect(regex.test("provider:claude:text:delta")).toBe(true);
			expect(regex.test("provider:")).toBe(true);
			expect(regex.test("other:claude")).toBe(false);
		});

		test("handles patterns with multiple wildcards", () => {
			const regex = globToRegex("*:*:completed");

			expect(regex.test("node:analyst:completed")).toBe(true);
			expect(regex.test("task:runner:completed")).toBe(true);
			expect(regex.test("a:b:completed")).toBe(true);
			expect(regex.test("a:b:c:completed")).toBe(false);
		});

		test("escapes regex special characters", () => {
			const regex = globToRegex("state.update");

			expect(regex.test("state.update")).toBe(true);
			expect(regex.test("statexupdate")).toBe(false);
		});

		test("handles prefix wildcards", () => {
			const regex = globToRegex("*:complete");

			expect(regex.test("analysis:complete")).toBe(true);
			expect(regex.test("trade:complete")).toBe(true);
			expect(regex.test("a:b:complete")).toBe(false);
		});

		test("handles suffix wildcards", () => {
			const regex = globToRegex("state:*");

			expect(regex.test("state:analysis")).toBe(true);
			expect(regex.test("state:trade")).toBe(true);
			expect(regex.test("state:")).toBe(true);
			expect(regex.test("state:a:b")).toBe(false);
		});
	});

	describe("compilePattern", () => {
		test("compiles exact string pattern", () => {
			const pattern = compilePattern("analysis:complete");

			expect(pattern.original).toBe("analysis:complete");
			expect(pattern.regex.test("analysis:complete")).toBe(true);
			expect(pattern.regex.test("analysis:incomplete")).toBe(false);
		});

		test("compiles glob pattern", () => {
			const pattern = compilePattern("node:*:activated");

			expect(pattern.original).toBe("node:*:activated");
			expect(pattern.regex.test("node:analyst:activated")).toBe(true);
			expect(pattern.regex.test("node:trader:activated")).toBe(true);
		});

		test("passes through RegExp patterns", () => {
			const regex = /^custom.*pattern$/;
			const pattern = compilePattern(regex);

			expect(pattern.original).toBe(regex);
			expect(pattern.regex).toBe(regex);
		});

		test("escapes special characters in exact patterns", () => {
			const pattern = compilePattern("state.value[0]");

			expect(pattern.regex.test("state.value[0]")).toBe(true);
			expect(pattern.regex.test("statexvalue00")).toBe(false);
		});
	});

	describe("matchesPattern", () => {
		test("matches exact patterns", () => {
			const pattern = compilePattern("test:event");

			expect(matchesPattern("test:event", pattern)).toBe(true);
			expect(matchesPattern("test:other", pattern)).toBe(false);
		});

		test("matches glob patterns", () => {
			const pattern = compilePattern("provider:*:response");

			expect(matchesPattern("provider:claude:response", pattern)).toBe(true);
			expect(matchesPattern("provider:openai:response", pattern)).toBe(true);
			expect(matchesPattern("provider:response", pattern)).toBe(false);
		});

		test("matches regex patterns", () => {
			const pattern = compilePattern(/^(analysis|trade):complete$/);

			expect(matchesPattern("analysis:complete", pattern)).toBe(true);
			expect(matchesPattern("trade:complete", pattern)).toBe(true);
			expect(matchesPattern("review:complete", pattern)).toBe(false);
		});
	});

	describe("matchesAnyPattern", () => {
		test("returns true if any pattern matches", () => {
			const patterns = [
				compilePattern("analysis:complete"),
				compilePattern("trade:proposed"),
				compilePattern("node:*:completed"),
			];

			expect(matchesAnyPattern("analysis:complete", patterns)).toBe(true);
			expect(matchesAnyPattern("trade:proposed", patterns)).toBe(true);
			expect(matchesAnyPattern("node:analyst:completed", patterns)).toBe(true);
		});

		test("returns false if no pattern matches", () => {
			const patterns = [compilePattern("analysis:complete"), compilePattern("trade:proposed")];

			expect(matchesAnyPattern("review:complete", patterns)).toBe(false);
			expect(matchesAnyPattern("other:event", patterns)).toBe(false);
		});

		test("handles empty pattern array", () => {
			expect(matchesAnyPattern("any:event", [])).toBe(false);
		});
	});
});
