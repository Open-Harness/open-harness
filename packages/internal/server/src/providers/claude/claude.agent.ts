import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  ModelUsage,
  NonNullableUsage,
  Options,
  SDKMessage,
  SDKPermissionDenial,
  SDKResultMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { CancelContextInternal, NodeTypeDefinition, RuntimeCommand } from "@internal/core";

/**
 * Extended options that support file-based schema references.
 * - outputSchemaFile: Path to a JSON Schema file (resolved relative to cwd)
 * - outputFormat: Inline schema (SDK native format)
 */
export interface ClaudeAgentExtendedOptions
  extends Omit<Options, "outputFormat"> {
  /** Path to JSON Schema file for structured output. Resolved relative to cwd. */
  outputSchemaFile?: string;
  /** Inline JSON Schema for structured output (SDK native format). */
  outputFormat?: { type: "json_schema"; schema: Record<string, unknown> };
}

export type ClaudeMessageInput =
  | string
  | {
      message?: Record<string, unknown>;
      content?: string;
      parentToolUseId?: string | null;
      isSynthetic?: boolean;
      toolUseResult?: unknown;
    };

export interface ClaudeAgentInput {
  prompt?: string;
  messages?: ClaudeMessageInput[];
  /** SDK options with extended support for outputSchemaFile */
  options?: ClaudeAgentExtendedOptions;
}

export interface ClaudeAgentOutput {
  // Note: text is optional when paused=true (SDK maintains history via sessionId)
  // Consumers needing partial text should accumulate from agent:text:delta events
  text?: string;
  structuredOutput?: unknown;
  usage?: NonNullableUsage;
  modelUsage?: Record<string, ModelUsage>;
  totalCostUsd?: number;
  durationMs?: number;
  sessionId?: string;
  numTurns?: number;
  permissionDenials?: SDKPermissionDenial[];
  paused?: boolean;
}

export interface ClaudeNodeOptions {
  replay?: (input: ClaudeAgentInput) => ClaudeAgentOutput | undefined;
  queryFn?: typeof query;
  record?: (call: {
    nodeId: string;
    input: ClaudeAgentInput;
    output: ClaudeAgentOutput;
    events: SDKMessage[];
  }) => void;
}

const ClaudeMessageSchema = z
  .union([
    z.string(),
    z
      .object({
        message: z.record(z.string(), z.unknown()).optional(),
        content: z.string().optional(),
        parentToolUseId: z.string().nullable().optional(),
        isSynthetic: z.boolean().optional(),
        toolUseResult: z.unknown().optional(),
      })
      .refine((value) => value.message || value.content, {
        message: "Claude message input must include message or content",
      }),
  ])
  .describe("Claude user message input");

const ClaudeAgentInputSchema = z
  .object({
    prompt: z.string().optional(),
    messages: z.array(ClaudeMessageSchema).optional(),
    options: z.unknown().optional(),
  })
  .refine(
    (value) =>
      (value.prompt && !value.messages) || (!value.prompt && value.messages),
    {
      message: "Provide exactly one of prompt or messages",
    },
  );

const ClaudeAgentOutputSchema = z.object({
  text: z.string().optional(), // Optional when paused=true
  structuredOutput: z.unknown().optional(),
  usage: z.unknown().optional(),
  modelUsage: z.unknown().optional(),
  totalCostUsd: z.number().optional(),
  durationMs: z.number().optional(),
  sessionId: z.string().optional(),
  numTurns: z.number().optional(),
  permissionDenials: z.unknown().optional(),
  paused: z.boolean().optional(),
});

/**
 * Create a Claude agent node definition.
 */
export function createClaudeNode(
  options: ClaudeNodeOptions = {},
): NodeTypeDefinition<ClaudeAgentInput, ClaudeAgentOutput> {
  return {
    type: "claude.agent",
    inputSchema: ClaudeAgentInputSchema,
    outputSchema: ClaudeAgentOutputSchema,
    capabilities: {
      streaming: true,
      multiTurn: true,
    },
    run: async (ctx, input) => {
      if (options.replay) {
        const replay = options.replay(input);
        if (replay) return replay;
      }

      const resumeMessage = ctx.resumeMessage;
      const hasPrompt = typeof input.prompt === "string";
      const hasMessages = Array.isArray(input.messages);
      if (!resumeMessage && hasPrompt === hasMessages) {
        throw new Error(
          "ClaudeAgentInput requires exactly one of prompt or messages",
        );
      }

      const basePrompt =
        !resumeMessage && typeof input.prompt === "string"
          ? input.prompt
          : undefined;
      const baseMessages =
        !resumeMessage && Array.isArray(input.messages)
          ? input.messages
          : undefined;

      const queuedCommands = drainInbox(ctx.inbox);
      const queuedMessages = commandsToMessages(queuedCommands);
      if (resumeMessage && queuedMessages.length === 0) {
        queuedMessages.push(resumeMessage);
      }

      const promptMessages: ClaudeMessageInput[] = [];
      if (basePrompt) promptMessages.push(basePrompt);
      if (baseMessages) promptMessages.push(...baseMessages);
      promptMessages.push(...queuedMessages);

      if (promptMessages.length === 0) {
        throw new Error("ClaudeAgentInput requires a prompt");
      }

      const knownSessionId = ctx.getAgentSession() ?? input.options?.resume;
      const mergedOptions = mergeOptions(input.options, knownSessionId);
      const queryFn = options.queryFn ?? query;
      const prompt = messageStream(promptMessages, knownSessionId);
      const cancelContext = ctx.cancel as CancelContextInternal | undefined;
      const queryStream = queryFn({
        prompt,
        options: {
          ...mergedOptions,
          abortController: cancelContext?.__controller,
        },
      });
      cancelContext?.__setQuery(queryStream);

      const promptForEvent =
        resumeMessage ?? basePrompt ?? baseMessages ?? promptMessages;
      const startedAt = Date.now();
      let emittedStart = false;
      let finalResult: SDKResultMessage | undefined;
      // Note: We intentionally do NOT accumulate text here.
      // - For pause/resume: SDK maintains full conversation history via sessionId
      // - For streaming UIs: Consumers receive agent:text:delta events in real-time
      // - See issue #78 for the design decision rationale
      let lastSessionId = knownSessionId;
      const recordedMessages: SDKMessage[] = [];
      const pendingToolUses = new Map<
        string,
        { toolName: string; toolInput: unknown; startedAt: number }
      >();

      const emitStart = (sessionId: string) => {
        if (emittedStart) return;
        emittedStart = true;
        ctx.setAgentSession(sessionId);
        ctx.emit({
          type: "agent:start",
          nodeId: ctx.nodeId,
          runId: ctx.runId,
          sessionId,
          model: mergedOptions?.model,
          prompt: promptForEvent,
        });
      };

      if (knownSessionId) {
        emitStart(knownSessionId);
      }

      try {
        for await (const message of queryStream) {
          const sdkMessage = message as SDKMessage;
          recordedMessages.push(sdkMessage);
          const sessionId = extractSessionId(sdkMessage);
          if (sessionId) lastSessionId = sessionId;
          if (!emittedStart && sessionId) {
            emitStart(sessionId);
          }

          if (sdkMessage.type === "stream_event") {
            const streamEvent = sdkMessage.event as {
              type?: string;
              delta?: { type?: string; text?: string; thinking?: string };
            };
            if (streamEvent?.type === "content_block_delta") {
              const delta = streamEvent.delta;
              if (delta?.type === "text_delta" && delta.text) {
                ctx.emit({
                  type: "agent:text:delta",
                  nodeId: ctx.nodeId,
                  runId: ctx.runId,
                  content: delta.text,
                });
              }
              if (delta?.type === "thinking_delta" && delta.thinking) {
                ctx.emit({
                  type: "agent:thinking:delta",
                  nodeId: ctx.nodeId,
                  runId: ctx.runId,
                  content: delta.thinking,
                });
              }
            }
          }

          if (sdkMessage.type === "assistant") {
            if (sdkMessage.error) {
              ctx.emit({
                type: "agent:error",
                nodeId: ctx.nodeId,
                runId: ctx.runId,
                errorType: sdkMessage.error,
                message: sdkMessage.error,
              });
            }

            const content = sdkMessage.message?.content;
            // Always emit complete text/thinking events (not just as fallback)
            // Deltas are for real-time streaming, complete events are for consumers
            // who want the full content
            if (typeof content === "string") {
              ctx.emit({
                type: "agent:text",
                nodeId: ctx.nodeId,
                runId: ctx.runId,
                content,
              });
            }

            if (Array.isArray(content)) {
              for (const rawBlock of content) {
                const block = rawBlock as unknown as Record<string, unknown>;
                const blockType = block.type;
                if (
                  blockType === "tool_use" &&
                  typeof block.id === "string" &&
                  typeof block.name === "string"
                ) {
                  pendingToolUses.set(block.id, {
                    toolName: block.name,
                    toolInput: block.input,
                    startedAt: Date.now(),
                  });
                }
                if (blockType === "text") {
                  const text = block.text;
                  if (typeof text === "string" && text.length > 0) {
                    ctx.emit({
                      type: "agent:text",
                      nodeId: ctx.nodeId,
                      runId: ctx.runId,
                      content: text,
                    });
                  }
                }
                if (blockType === "thinking") {
                  const thinking = block.thinking;
                  if (typeof thinking === "string" && thinking.length > 0) {
                    ctx.emit({
                      type: "agent:thinking",
                      nodeId: ctx.nodeId,
                      runId: ctx.runId,
                      content: thinking,
                    });
                  }
                }
              }
            }
          }

          if (sdkMessage.type === "user" && sdkMessage.tool_use_result) {
            const toolUseId = sdkMessage.parent_tool_use_id;
            const pending = toolUseId
              ? pendingToolUses.get(toolUseId)
              : undefined;
            const toolName =
              pending?.toolName ??
              (typeof sdkMessage.tool_use_result === "object" &&
              sdkMessage.tool_use_result &&
              "tool_name" in sdkMessage.tool_use_result
                ? String(
                    (sdkMessage.tool_use_result as { tool_name?: unknown })
                      .tool_name ?? "unknown",
                  )
                : "unknown");
            const durationMs = pending
              ? Math.max(0, Date.now() - pending.startedAt)
              : undefined;
            const error =
              typeof sdkMessage.tool_use_result === "object" &&
              sdkMessage.tool_use_result &&
              "error" in sdkMessage.tool_use_result
                ? String(
                    (sdkMessage.tool_use_result as { error?: unknown }).error ??
                      "",
                  )
                : undefined;

            ctx.emit({
              type: "agent:tool",
              nodeId: ctx.nodeId,
              runId: ctx.runId,
              toolName,
              toolInput: pending?.toolInput,
              toolOutput: sdkMessage.tool_use_result,
              durationMs,
              error,
            });

            if (toolUseId) {
              pendingToolUses.delete(toolUseId);
            }
          }

          if (sdkMessage.type === "result") {
            finalResult = sdkMessage as SDKResultMessage;
            if (finalResult.subtype !== "success") {
              const errors =
                "errors" in finalResult ? (finalResult.errors as string[]) : [];
              ctx.emit({
                type: "agent:error",
                nodeId: ctx.nodeId,
                runId: ctx.runId,
                errorType: finalResult.subtype,
                message:
                  errors && errors.length > 0
                    ? errors.join("; ")
                    : `Claude agent failed with subtype: ${finalResult.subtype}`,
                details: finalResult,
              });
            }
          }

          if (ctx.cancel.cancelled) {
            if (ctx.cancel.reason === "pause") {
              break;
            }
            if (ctx.cancel.reason === "abort") {
              const abortError = new Error("Aborted");
              abortError.name = "AbortError";
              throw abortError;
            }
          }
        }
      } catch (error) {
        const isAbortError =
          error instanceof Error && error.name === "AbortError";
        if (isAbortError) {
          ctx.emit({
            type: "agent:aborted",
            nodeId: ctx.nodeId,
            runId: ctx.runId,
            reason: ctx.cancel.reason ?? "abort",
          });
          throw error;
        }

        ctx.emit({
          type: "agent:error",
          nodeId: ctx.nodeId,
          runId: ctx.runId,
          errorType: "exception",
          message: errorMessage(error),
          details: error,
        });
        throw error;
      }

      if (ctx.cancel.cancelled && ctx.cancel.reason === "pause") {
        ctx.emit({
          type: "agent:paused",
          nodeId: ctx.nodeId,
          runId: ctx.runId,
          // Note: partialText removed - consumers should accumulate from agent:text:delta events
          // SDK maintains full conversation history via sessionId for resume
          sessionId: lastSessionId,
          numTurns: finalResult?.num_turns,
        });

        return {
          paused: true,
          sessionId: lastSessionId,
          numTurns: finalResult?.num_turns,
        };
      }

      const output = getResultOrThrow(finalResult);
      if (!emittedStart && output.sessionId) {
        emitStart(output.sessionId);
      }

      ctx.emit({
        type: "agent:complete",
        nodeId: ctx.nodeId,
        runId: ctx.runId,
        result: output.text ?? "",
        structuredOutput: output.structuredOutput,
        usage: toUsage(output.usage),
        modelUsage: toModelUsage(output.modelUsage),
        totalCostUsd: output.totalCostUsd,
        durationMs: output.durationMs ?? Math.max(0, Date.now() - startedAt),
        numTurns: output.numTurns ?? finalResult?.num_turns ?? 0,
      });

      options.record?.({
        nodeId: ctx.nodeId,
        input,
        output,
        events: recordedMessages,
      });

      return output;
    },
  };
}

/**
 * Pre-created Claude node instance.
 */
export const claudeNode = createClaudeNode();

/**
 * Resolve outputSchemaFile to outputFormat if provided.
 * Priority: outputFormat > outputSchemaFile
 * @internal Exported for testing only
 */
export function resolveOutputSchema(
  options?: ClaudeAgentExtendedOptions,
): Options | undefined {
  if (!options) return undefined;

  // Extract our custom field and convert to SDK format
  const { outputSchemaFile, outputFormat, ...sdkOptions } = options;

  // If outputFormat is already provided (inline schema), use it directly
  if (outputFormat) {
    return { ...sdkOptions, outputFormat } as Options;
  }

  // If outputSchemaFile is provided, load and convert
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

  // No schema specified, return options as-is
  return sdkOptions as Options;
}

function mergeOptions(
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

  // First resolve any schema file references
  const resolvedOptions = resolveOutputSchema(options);

  const merged = resolvedOptions
    ? { ...defaults, ...resolvedOptions }
    : { ...defaults };
  if (sessionId && !merged.resume && !merged.continue) {
    merged.resume = sessionId;
  }
  return merged;
}

function toUserMessage(
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

async function* messageStream(
  messages: ClaudeMessageInput[],
  sessionId?: string,
): AsyncGenerator<SDKUserMessage> {
  for (const message of messages) {
    yield toUserMessage(message, sessionId);
  }
}

function drainInbox(inbox: {
  next: () => RuntimeCommand | undefined;
}): RuntimeCommand[] {
  const commands: RuntimeCommand[] = [];
  let next = inbox.next();
  while (next) {
    commands.push(next);
    next = inbox.next();
  }
  return commands;
}

function commandsToMessages(commands: RuntimeCommand[]): ClaudeMessageInput[] {
  const messages: ClaudeMessageInput[] = [];
  for (const command of commands) {
    if (command.type === "send") {
      messages.push(command.message);
    } else if (command.type === "reply") {
      messages.push({
        content: command.content,
        parentToolUseId: command.promptId,
      });
    }
  }
  return messages;
}

function extractSessionId(message: SDKMessage): string | undefined {
  if (message && typeof message === "object" && "session_id" in message) {
    const sessionId = (message as { session_id?: string }).session_id;
    return sessionId || undefined;
  }
  return undefined;
}

function toUsage(usage?: NonNullableUsage): {
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

function toModelUsage(
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

function getResultOrThrow(result?: SDKResultMessage): ClaudeAgentOutput {
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

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
