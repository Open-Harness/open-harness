import { z } from "zod";
export declare const EventType: {
    readonly SESSION_START: "session_start";
    readonly SESSION_END: "session_end";
    readonly RESULT: "result";
    readonly THINKING: "thinking";
    readonly TEXT: "text";
    readonly TOOL_CALL: "tool_call";
    readonly TOOL_RESULT: "tool_result";
    readonly TOOL_PROGRESS: "tool_progress";
    readonly COMPACT: "compact";
    readonly STATUS: "status";
    readonly ERROR: "error";
    readonly MONOLOGUE: "monologue";
};
export declare const EventTypeConst: {
    readonly SESSION_START: "session_start";
    readonly SESSION_END: "session_end";
    readonly RESULT: "result";
    readonly THINKING: "thinking";
    readonly TEXT: "text";
    readonly TOOL_CALL: "tool_call";
    readonly TOOL_RESULT: "tool_result";
    readonly TOOL_PROGRESS: "tool_progress";
    readonly COMPACT: "compact";
    readonly STATUS: "status";
    readonly ERROR: "error";
    readonly MONOLOGUE: "monologue";
};
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
export declare const StopReasonSchema: z.ZodEnum<{
    failed: "failed";
    compact: "compact";
    finished: "finished";
}>;
export type StopReason = z.infer<typeof StopReasonSchema>;
export declare const CodingResultSchema: z.ZodObject<{
    stopReason: z.ZodEnum<{
        failed: "failed";
        compact: "compact";
        finished: "finished";
    }>;
    summary: z.ZodString;
    handoff: z.ZodString;
}, z.core.$strip>;
export type CodingResult = z.infer<typeof CodingResultSchema>;
export type JSONSchemaFormat = {
    type: "json_schema";
    schema: Record<string, unknown>;
};
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
export declare function zodToSdkSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>): JSONSchemaFormat;
export declare const CodingResultSdkSchema: JSONSchemaFormat;
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
