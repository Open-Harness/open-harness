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
	schema: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
};

/**
 * Helper to convert Zod schema to SDK's JSON schema format.
 */
export function zodToSdkSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>): JSONSchemaFormat {
	const shape = schema.shape;
	const properties: Record<string, unknown> = {};
	const required: string[] = [];

	for (const [key, value] of Object.entries(shape)) {
		const def = (value as z.ZodTypeAny)._def;
		if (def.typeName === "ZodString") {
			properties[key] = { type: "string" };
		} else if (def.typeName === "ZodEnum") {
			properties[key] = { type: "string", enum: def.values };
		}
		required.push(key);
	}

	return {
		type: "json_schema",
		schema: {
			type: "object",
			properties,
			required,
		},
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
