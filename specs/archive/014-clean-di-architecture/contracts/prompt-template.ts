/**
 * API Contract: PromptTemplate
 *
 * Type-safe template for rendering prompts with variable substitution.
 */

import type { z } from "zod";

/**
 * Prompt template with typed variable substitution.
 *
 * @template TData - Data type for template variables (inferred from template)
 *
 * @example
 * ```typescript
 * const template: PromptTemplate<{ prd: string }> = createPromptTemplate(`
 *   You are a planner. Break down this PRD:
 *
 *   {{prd}}
 *
 *   Return a list of tasks in JSON format.
 * `);
 *
 * const rendered = template.render({ prd: "Build TODO app" });
 * ```
 */
export interface PromptTemplate<TData> {
	/**
	 * Template string with {{variable}} placeholders.
	 *
	 * Variables are extracted at compile time for type checking.
	 */
	readonly template: string;

	/**
	 * Render template with provided data.
	 *
	 * Validates that all required variables are present.
	 * Substitutes {{variable}} with data[variable].
	 *
	 * @param data - Data matching template variables
	 * @returns Rendered prompt string
	 *
	 * @throws {Error} If required variable missing
	 *
	 * @example
	 * ```typescript
	 * const prompt = template.render({ prd: "Build TODO app" });
	 * // "You are a planner. Break down this PRD:\n\nBuild TODO app\n\n..."
	 * ```
	 */
	render(data: TData): string;

	/**
	 * Optional validation function.
	 *
	 * Called before render to validate data structure.
	 * Throws if data doesn't match expected shape.
	 *
	 * @param data - Data to validate
	 * @throws {Error} If validation fails
	 */
	validate?(data: TData): void;
}

/**
 * Extract variable names from template string.
 *
 * Matches {{variable}} patterns and extracts variable names.
 *
 * @template S - Template string literal type
 */
export type ExtractVars<S extends string> = S extends `${string}{{${infer Var}}}${infer Rest}`
	? Var | ExtractVars<Rest>
	: never;

/**
 * Factory function for creating typed prompt templates.
 *
 * Infers TData type from template variables automatically.
 *
 * @param template - Template string with {{variable}} placeholders
 * @param schema - Optional Zod schema for validation
 * @returns Typed PromptTemplate
 *
 * @example Without schema
 * ```typescript
 * const template = createPromptTemplate(`
 *   Hello {{name}}, you are {{age}} years old.
 * `);
 * // Type: PromptTemplate<{ name: string, age: string }>
 * ```
 *
 * @example With schema
 * ```typescript
 * const template = createPromptTemplate(
 *   `Hello {{name}}, you are {{age}} years old.`,
 *   z.object({
 *     name: z.string(),
 *     age: z.number(),
 *   })
 * );
 * // Type: PromptTemplate<{ name: string, age: number }>
 * // Validates age is number at runtime
 * ```
 */
export declare function createPromptTemplate<TData>(
	template: string,
	schema?: z.ZodSchema<TData>,
): PromptTemplate<TData>;
