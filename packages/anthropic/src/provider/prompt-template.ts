/**
 * Prompt Template Factory for @openharness/anthropic
 *
 * Creates type-safe prompt templates with compile-time variable extraction
 * and optional runtime validation via Zod schemas.
 *
 * @module provider/prompt-template
 */

import type { z } from "zod";
import type { ExtractVars, PromptTemplate } from "./types.js";

// Re-export ExtractVars for convenience
export type { ExtractVars } from "./types.js";

/**
 * Create a type-safe prompt template.
 *
 * Uses TypeScript template literal types to extract variable names from the
 * template string at compile time. When a Zod schema is provided, also
 * validates data at runtime.
 *
 * @example
 * ```typescript
 * // Basic usage - type safety inferred from template
 * const template = createPromptTemplate(
 *   "You are a coding assistant. Task: {{task}}"
 * );
 * // TypeScript enforces: template.render({ task: string })
 *
 * // With Zod schema for runtime validation
 * const validatedTemplate = createPromptTemplate(
 *   "Process {{input}} with mode {{mode}}",
 *   z.object({
 *     input: z.string().min(1),
 *     mode: z.enum(["fast", "thorough"])
 *   })
 * );
 * // Both compile-time AND runtime validation
 * ```
 *
 * @param template - Template string with `{{variable}}` placeholders
 * @param schema - Optional Zod schema for runtime validation
 * @returns A PromptTemplate object with render() and optional validate()
 */
export function createPromptTemplate<
	TTemplate extends string,
	TData extends Record<ExtractVars<TTemplate>, unknown> = Record<ExtractVars<TTemplate>, unknown>,
>(template: TTemplate, schema?: z.ZodType<TData>): PromptTemplate<TData> {
	/**
	 * Render the template by replacing {{variable}} with data values.
	 *
	 * Uses a simple regex-based replacement. Variables that exist in
	 * the template but not in data will remain as-is (no silent failures).
	 */
	const render = (data: TData): string => {
		return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
			if (key in (data as Record<string, unknown>)) {
				const value = (data as Record<string, unknown>)[key];
				return String(value);
			}
			// Leave unmatched placeholders as-is (makes debugging easier)
			return match;
		});
	};

	/**
	 * Optional runtime validation using Zod schema.
	 *
	 * Returns a type guard for narrowing unknown data to TData.
	 */
	const validate = schema
		? (data: unknown): data is TData => {
				const result = schema.safeParse(data);
				return result.success;
			}
		: undefined;

	return {
		template,
		render,
		validate,
	};
}

/**
 * Create a simple string-based prompt (no template variables).
 *
 * Useful when you have a static prompt that doesn't need interpolation.
 * The returned PromptTemplate has a no-op render that returns the static string.
 *
 * @example
 * ```typescript
 * const staticPrompt = createStaticPrompt("You are a helpful assistant.");
 * staticPrompt.render({}); // Returns: "You are a helpful assistant."
 * ```
 *
 * @param prompt - Static prompt string
 * @returns A PromptTemplate that always returns the static string
 */
export function createStaticPrompt(prompt: string): PromptTemplate<Record<string, never>> {
	return {
		template: prompt,
		render: () => prompt,
	};
}
