/**
 * Helper functions for Claude provider.
 * Pure functions with no dependencies on runtime context.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  ModelUsage,
  NonNullableUsage,
  Options,
  SDKMessage,
  SDKResultMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type {
  ClaudeAgentExtendedOptions,
  ClaudeAgentOutput,
  ClaudeMessageInput,
} from "./claude.agent.js";

/**
 * Resolve outputSchemaFile to outputFormat if provided.
 * Priority: outputFormat > outputSchemaFile
 */
export function resolveOutputSchema(
  options?: ClaudeAgentExtendedOptions,
): Options | undefined {
  if (!options) return undefined;

  const { outputSchemaFile, outputFormat, ...sdkOptions } = options;

  if (outputFormat) {
    return { ...sdkOptions, outputFormat } as Options;
  }

  if (outputSchemaFile) {
    const resolvedPath = resolve(process.cwd(), outputSchemaFile);

    if (!existsSync(resolvedPath)) {
      throw new Error(`outputSchemaFile not found: ${resolvedPath}`);
    }

    try {
      const schemaContent = readFileSync(resolvedPath, "utf-8");
      const schema = JSON.parse(schemaContent) as Record<string, unknown>;

      return {
        ...sdkOptions,
        outputFormat: { type: "json_schema", schema },
      } as Options;
    } catch (error) {
      throw new Error(
        `Failed to load outputSchemaFile: ${resolvedPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return sdkOptions as Options;
}

/**
 * Merge user options with defaults and session ID.
 */
export function mergeOptions(
  options?: ClaudeAgentExtendedOptions,
  sessionId?: string,
): Options | undefined {
  const defaults: Partial<Options> = {
    maxTurns: 100,
    persistSession: true,
    includePartialMessages: true,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
  };

  const resolvedOptions = resolveOutputSchema(options);

  const merged = resolvedOptions
    ? { ...defaults, ...resolvedOptions }
    : { ...defaults };
  if (sessionId && !merged.resume && !merged.continue) {
    merged.resume = sessionId;
  }
  return merged;
}

/**
 * Convert ClaudeMessageInput to SDK message format.
 */
export function toUserMessage(
  input: ClaudeMessageInput,
  sessionId?: string,
): SDKUserMessage {
  const resolvedSessionId = sessionId ?? "";
  if (typeof input === "string") {
    return {
      type: "user",
      message: { role: "user", content: input } as SDKUserMessage["message"],
      parent_tool_use_id: null,
      session_id: resolvedSessionId,
    } as SDKUserMessage;
  }

  const message =
    input.message ??
    (input.content
      ? ({ role: "user", content: input.content } as SDKUserMessage["message"])
      : undefined);

  if (!message) {
    throw new Error("Claude message input must include message or content");
  }

  return {
    type: "user",
    message,
    parent_tool_use_id: input.parentToolUseId ?? null,
    isSynthetic: input.isSynthetic,
    tool_use_result: input.toolUseResult,
    session_id: resolvedSessionId,
  } as SDKUserMessage;
}

/**
 * Create async generator of SDK messages from inputs.
 */
export async function* messageStream(
  messages: ClaudeMessageInput[],
  sessionId?: string,
): AsyncGenerator<SDKUserMessage> {
  for (const message of messages) {
    yield toUserMessage(message, sessionId);
  }
}

/**
 * Extract session ID from SDK message.
 */
export function extractSessionId(message: SDKMessage): string | undefined {
  if (message && typeof message === "object" && "session_id" in message) {
    const sessionId = (message as { session_id?: string }).session_id;
    return sessionId || undefined;
  }
  return undefined;
}

/**
 * Convert SDK usage to output format.
 */
export function toUsage(usage?: NonNullableUsage): {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
} {
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cacheCreationInputTokens: usage?.cache_creation_input_tokens,
    cacheReadInputTokens: usage?.cache_read_input_tokens,
  };
}

/**
 * Convert SDK model usage to output format.
 */
export function toModelUsage(
  modelUsage?: Record<string, ModelUsage>,
): Record<string, { inputTokens: number; outputTokens: number }> | undefined {
  if (!modelUsage) return undefined;
  const mapped: Record<string, { inputTokens: number; outputTokens: number }> =
    {};
  for (const [model, usage] of Object.entries(modelUsage)) {
    mapped[model] = {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    };
  }
  return mapped;
}

/**
 * Extract result from SDK or throw error.
 */
export function getResultOrThrow(result?: SDKResultMessage): ClaudeAgentOutput {
  if (!result) {
    throw new Error("Claude agent returned no result");
  }

  if (result.subtype !== "success") {
    const errors = "errors" in result ? (result.errors as string[]) : [];
    const errorMessage =
      errors && errors.length > 0
        ? errors.join("; ")
        : `Claude agent failed with subtype: ${result.subtype}`;
    throw new Error(errorMessage);
  }

  return {
    text: result.result,
    structuredOutput: result.structured_output,
    usage: result.usage,
    modelUsage: result.modelUsage,
    totalCostUsd: result.total_cost_usd,
    durationMs: result.duration_ms,
    sessionId: result.session_id,
    numTurns: result.num_turns,
    permissionDenials: result.permission_denials,
  };
}

/**
 * Extract error message from unknown error.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
