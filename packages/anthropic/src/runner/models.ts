import { z } from "zod";

export const EventType = {
	SESSION_START: "session_start",
	SESSION_END: "session_end",
	RESULT: "result",
	THINKING: "thinking",
	TEXT: "text",
	TOOL_CALL: "tool_call",
	TOOL_RESULT: "tool_result",
	TOOL_PROGRESS: "tool_progress",
	COMPACT: "compact",
	STATUS: "status",
	ERROR: "error",
	MONOLOGUE: "monologue",
} as const;

export const EventTypeConst = EventType;
export type EventType = (typeof EventType)[keyof typeof EventType];

export type AgentEvent = {
	timestamp: Date;
	event_type: EventType;
	agent_name: string;
	content?: string | null;
	tool_name?: string | null;
	tool_input?: Record<string, unknown> | null;
	tool_result?: Record<string, unknown> | null;
	is_error?: boolean;
	metadata?: Record<string, unknown>;
	session_id?: string | null;
};

export const StopReasonSchema = z.enum(["finished", "compact", "failed"]);
export type StopReason = z.infer<typeof StopReasonSchema>;

export const CodingResultSchema = z.object({
	stopReason: StopReasonSchema,
	summary: z.string(),
	handoff: z.string(),
});

export type CodingResult = z.infer<typeof CodingResultSchema>;

export type JSONSchemaFormat = {
	type: "json_schema";
	schema: Record<string, unknown>;
};

/**
 * Get the Zod type name using constructor name (Zod 4.x compatible).
 */
function getZodTypeName(zodType: z.ZodTypeAny): string {
	// Zod 4.x: use constructor name
	const constructorName = zodType.constructor.name;
	// Handle minified names by checking _zod property
	if ("_zod" in zodType) {
		const zod = zodType._zod as { def?: { type?: string } };
		if (zod.def?.type) {
			return zod.def.type;
		}
	}
	return constructorName;
}

/**
 * Convert a Zod type to JSON Schema.
 * Handles common Zod types including arrays, objects, enums, and primitives.
 * Compatible with Zod 4.x.
 */
function zodTypeToJsonSchema(zodType: z.ZodTypeAny): Record<string, unknown> {
	const typeName = getZodTypeName(zodType);

	// Handle by constructor/type name
	if (typeName.includes("String") || typeName === "string") {
		return { type: "string" };
	}

	if (typeName.includes("Number") || typeName === "number") {
		return { type: "number" };
	}

	if (typeName.includes("Boolean") || typeName === "boolean") {
		return { type: "boolean" };
	}

	if (typeName.includes("Null") || typeName === "null") {
		return { type: "null" };
	}

	if (typeName.includes("Array") || typeName === "array") {
		// Access element type via Zod 4.x API
		const def = zodType._zod as { def?: { element?: z.ZodTypeAny } };
		const elementType = def?.def?.element;
		if (elementType) {
			return {
				type: "array",
				items: zodTypeToJsonSchema(elementType),
			};
		}
		return { type: "array" };
	}

	if (typeName.includes("Object") || typeName === "object") {
		const objectType = zodType as z.ZodObject<z.ZodRawShape>;
		const shape = objectType.shape;
		const properties: Record<string, unknown> = {};
		const required: string[] = [];

		for (const [key, value] of Object.entries(shape)) {
			const fieldType = value as z.ZodTypeAny;
			properties[key] = zodTypeToJsonSchema(fieldType);

			// Check if field is required (not optional)
			if (!fieldType.isOptional()) {
				required.push(key);
			}
		}

		return {
			type: "object",
			properties,
			required: required.length > 0 ? required : undefined,
			additionalProperties: false,
		};
	}

	if (typeName.includes("Enum") || typeName === "enum") {
		// Access enum values via Zod 4.x API
		const def = zodType._zod as { def?: { entries?: Record<string, string> } };
		const entries = def?.def?.entries;
		if (entries) {
			return {
				type: "string",
				enum: Object.values(entries),
			};
		}
		return { type: "string" };
	}

	if (typeName.includes("Union") || typeName === "union") {
		// Access union options via Zod 4.x API
		const def = zodType._zod as { def?: { options?: z.ZodTypeAny[] } };
		const options = def?.def?.options;
		if (options && Array.isArray(options)) {
			return { anyOf: options.map((opt) => zodTypeToJsonSchema(opt)) };
		}
		return {};
	}

	if (typeName.includes("Optional") || typeName === "optional") {
		// Access inner type via Zod 4.x API
		const def = zodType._zod as { def?: { innerType?: z.ZodTypeAny } };
		const innerType = def?.def?.innerType;
		if (innerType) {
			return zodTypeToJsonSchema(innerType);
		}
		return {};
	}

	if (typeName.includes("Nullable") || typeName === "nullable") {
		const def = zodType._zod as { def?: { innerType?: z.ZodTypeAny } };
		const innerType = def?.def?.innerType;
		if (innerType) {
			const innerSchema = zodTypeToJsonSchema(innerType);
			return { anyOf: [innerSchema, { type: "null" }] };
		}
		return { type: "null" };
	}

	if (typeName.includes("Default") || typeName === "default") {
		const def = zodType._zod as { def?: { innerType?: z.ZodTypeAny } };
		const innerType = def?.def?.innerType;
		if (innerType) {
			return zodTypeToJsonSchema(innerType);
		}
		return {};
	}

	if (typeName.includes("Literal") || typeName === "literal") {
		const def = zodType._zod as { def?: { value?: unknown } };
		const value = def?.def?.value;
		if (value !== undefined) {
			return { const: value };
		}
		return {};
	}

	if (typeName.includes("Record") || typeName === "record") {
		const def = zodType._zod as { def?: { valueType?: z.ZodTypeAny } };
		const valueType = def?.def?.valueType;
		if (valueType) {
			return {
				type: "object",
				additionalProperties: zodTypeToJsonSchema(valueType),
			};
		}
		return { type: "object" };
	}

	// Fallback for unknown types
	return { type: "string" };
}

/**
 * Helper to convert Zod schema to SDK's JSON schema format.
 * Properly handles nested objects, arrays, enums, and other complex types.
 * Compatible with Zod 4.x.
 *
 * @example
 * ```typescript
 * const MySchema = z.object({
 *   tasks: z.array(z.object({ id: z.string(), name: z.string() })),
 *   count: z.number(),
 * });
 *
 * const sdkSchema = zodToSdkSchema(MySchema);
 * // Returns proper JSON Schema with nested array/object types
 * ```
 */
export function zodToSdkSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>): JSONSchemaFormat {
	return {
		type: "json_schema",
		schema: zodTypeToJsonSchema(schema),
	};
}

export const CodingResultSdkSchema = zodToSdkSchema(CodingResultSchema);

/**
 * Result data from a completed session.
 */
export type SessionResult = {
	success: boolean;
	duration_ms: number;
	num_turns: number;
	total_cost_usd: number;
	usage: {
		input_tokens: number;
		output_tokens: number;
		cache_read_input_tokens: number;
		cache_creation_input_tokens: number;
	};
	structured_output?: unknown;
	errors?: string[];
};

/**
 * Compact event data when context is being compacted.
 */
export type CompactData = {
	trigger: "manual" | "auto";
	pre_tokens: number;
};

/**
 * Status update data.
 */
export type StatusData = {
	status: "compacting" | null;
};
