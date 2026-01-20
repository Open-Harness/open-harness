/**
 * Schema Conversion Utilities
 *
 * Converts Zod schemas to JSON Schema format for SDK structured output.
 */

import { type core, z } from "zod";

/**
 * Converts a Zod schema to JSON Schema format.
 * Used internally to convert user-provided outputSchema to SDK-compatible format.
 *
 * Uses Zod 4's native toJSONSchema function which provides full compatibility.
 *
 * @param schema - A Zod schema definition
 * @returns JSON Schema compatible object
 */
export function convertZodToJsonSchema(schema: core.$ZodType): Record<string, unknown> {
	return z.toJSONSchema(schema) as Record<string, unknown>;
}
