/**
 * Signal Pattern Matching
 *
 * Patterns can be:
 * - Exact string: "analysis:complete"
 * - Glob with wildcards: "node:*:completed", "harness:*"
 * - RegExp for complex matching
 */

/**
 * A pattern that can match signal names
 */
export type SignalPattern = string | RegExp;

/**
 * Compiled pattern for efficient matching
 */
export interface CompiledPattern {
	/** Original pattern */
	readonly original: SignalPattern;
	/** Compiled regex for matching */
	readonly regex: RegExp;
}

/**
 * Convert a glob pattern to a RegExp
 *
 * Supports:
 * - `*` matches any characters except `:` (single segment)
 * - `**` matches any characters including `:` (multiple segments)
 *
 * @example
 * ```ts
 * globToRegex("node:*:completed") // matches "node:analyst:completed"
 * globToRegex("harness:**")       // matches "harness:claude:text:delta"
 * ```
 */
export function globToRegex(pattern: string): RegExp {
	// Escape special regex characters except * and **
	let regexStr = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

	// Replace ** first (matches across segments)
	regexStr = regexStr.replace(/\*\*/g, ".*");

	// Replace single * (matches within a segment, not across colons)
	// Avoid matching the ** we just converted
	regexStr = regexStr.replace(/(?<!\.)(?<!\.\*)\*/g, "[^:]*");

	return new RegExp(`^${regexStr}$`);
}

/**
 * Compile a pattern into an efficient matcher
 */
export function compilePattern(pattern: SignalPattern): CompiledPattern {
	if (pattern instanceof RegExp) {
		return { original: pattern, regex: pattern };
	}

	// Check if it's a glob pattern (contains * or **)
	if (pattern.includes("*")) {
		return { original: pattern, regex: globToRegex(pattern) };
	}

	// Exact match - escape and anchor
	const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return { original: pattern, regex: new RegExp(`^${escaped}$`) };
}

/**
 * Check if a signal name matches a compiled pattern
 */
export function matchesPattern(signalName: string, compiledPattern: CompiledPattern): boolean {
	return compiledPattern.regex.test(signalName);
}

/**
 * Check if a signal name matches any of the given patterns
 */
export function matchesAnyPattern(signalName: string, patterns: CompiledPattern[]): boolean {
	return patterns.some((pattern) => matchesPattern(signalName, pattern));
}
