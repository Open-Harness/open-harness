/**
 * AnthropicProvider - Pure Anthropic AgentProvider.
 *
 * Returns Stream.Stream - recording happens at server level.
 * Provider is PURE: just call the API and produce events.
 *
 * @module
 */

import { type Options, query } from "@anthropic-ai/claude-agent-sdk"
import {
  type AgentProvider,
  type AgentRunResult,
  type AgentStreamEvent,
  ProviderError,
  type ProviderRunOptions
} from "@open-scaffold/core"
import { Stream } from "effect"
import { zodToJsonSchema } from "zod-to-json-schema"

/**
 * Anthropic model identifiers.
 */
export type AnthropicModel =
  | "claude-haiku-4-5-20251001"
  | "claude-sonnet-4-5-20250929"
  | "claude-opus-4-5-20251101"
  | "claude-haiku-4-5"
  | "claude-sonnet-4-5"
  | "claude-opus-4-5"
  | (string & {})

/**
 * Configuration for AnthropicProvider.
 *
 * Note: Recording/playback is handled at server level (ProviderModeContext).
 * Provider config only includes API-related settings.
 */
export interface AnthropicProviderConfig {
  /**
   * Model to use.
   * @default "claude-haiku-4-5"
   */
  readonly model?: AnthropicModel

  /**
   * Optional API key override (no validation enforced).
   */
  readonly apiKey?: string

  /**
   * Enable extended thinking.
   * @default false
   */
  readonly extendedThinking?: boolean

  /**
   * Max tokens for response.
   * @default 4096
   */
  readonly maxTokens?: number
}

type ExtendedThinkingConfig =
  | {
    readonly enabled: boolean
    readonly budgetTokens?: number
  }
  | boolean

type AnthropicProviderOptions = Partial<Options> & {
  readonly maxTokens?: number
  readonly tools?: unknown
  readonly extendedThinking?: ExtendedThinkingConfig
}

type SdkTools = Array<string> | { type: "preset"; preset: "claude_code" }

/**
 * Create an Anthropic AgentProvider.
 *
 * This is a PURE provider - it just calls the API and returns a Stream.
 * Recording/playback is handled at the server level (ProviderModeContext + ProviderRecorder).
 *
 * @example
 * ```typescript
 * const provider = AnthropicProvider({ model: "claude-haiku-4-5" })
 *
 * const agent = agent({
 *   name: "my-agent",
 *   provider,
 *   // ... rest of agent config
 * })
 * ```
 */
export const AnthropicProvider = (_config?: AnthropicProviderConfig): AgentProvider => {
  const config = _config ?? {}

  return {
    name: "anthropic",

    stream: (options: ProviderRunOptions): Stream.Stream<AgentStreamEvent, ProviderError> =>
      // Stream.fromAsyncIterable wraps the async generator with typed error handling
      // The streamQuery generator handles all SDK message parsing and event emission
      Stream.fromAsyncIterable(streamQuery(options, config), (cause) => mapProviderError(cause))
  }
}

const DEFAULT_MODEL = "claude-haiku-4-5"

/**
 * Stream events from the Anthropic SDK.
 *
 * This async generator handles the complex SDK message parsing:
 * - Emits intermediate events (TextDelta, ThinkingDelta, ToolCall, etc.)
 * - Tracks state for Stop reason
 * - Emits final Result event with structured output
 */
async function* streamQuery(
  options: ProviderRunOptions,
  config: AnthropicProviderConfig
): AsyncGenerator<AgentStreamEvent, void, unknown> {
  const sdkOptions = buildSdkOptions(options, config)
  const stream = query({ prompt: options.prompt, options: sdkOptions })

  let stopEmitted = false
  let stopReason: AgentRunResult["stopReason"] = "end_turn"
  let finalResult: Extract<AgentStreamEvent, { readonly _tag: "Result" }> | undefined
  let sessionIdEmitted = false

  for await (const message of stream) {
    // Capture session ID from init message (type='system', subtype='init')
    // This comes at the START of the stream and is needed for resume functionality
    if (!sessionIdEmitted && isInitMessage(message)) {
      const sessionId = extractSessionIdFromInit(message)
      if (sessionId) {
        sessionIdEmitted = true
        yield { _tag: "SessionInit", sessionId }
      }
    }

    if (message.type === "result") {
      if (message.subtype !== "success") {
        throw new ProviderError({
          code: "UNKNOWN",
          message: message.errors?.join("; ") ?? "Anthropic agent execution failed",
          retryable: false
        })
      }

      const usage = extractUsage(message.usage)

      if (message.structured_output === undefined) {
        throw new ProviderError({
          code: "UNKNOWN",
          message: "Structured output missing from Anthropic response",
          retryable: false
        })
      }

      finalResult = {
        _tag: "Result",
        output: message.structured_output,
        stopReason,
        ...(message.result ? { text: message.result } : {}),
        ...(usage ? { usage } : {}),
        ...(typeof message.session_id === "string" ? { sessionId: message.session_id } : {})
      }

      // Still allow any usage/stop events derived from the result message.
    }

    for (const event of sdkMessageToEvents(message)) {
      if (event._tag === "Stop") {
        stopEmitted = true
        stopReason = event.reason
      }
      yield event
    }
  }

  if (!stopEmitted) {
    yield { _tag: "Stop", reason: "end_turn" }
    stopReason = "end_turn"
  }

  if (!finalResult) {
    throw new ProviderError({
      code: "UNKNOWN",
      message: "Result missing from Anthropic stream",
      retryable: false
    })
  }

  // Emit the final structured output for the streaming runner.
  yield {
    _tag: "Result",
    output: finalResult.output,
    stopReason,
    ...(finalResult.text ? { text: finalResult.text } : {}),
    ...(finalResult.thinking ? { thinking: finalResult.thinking } : {}),
    ...(finalResult.usage ? { usage: finalResult.usage } : {}),
    ...(finalResult.sessionId ? { sessionId: finalResult.sessionId } : {})
  }
}

const buildSdkOptions = (options: ProviderRunOptions, config: AnthropicProviderConfig): Options => {
  if (!options.outputSchema) {
    throw new ProviderError({
      code: "UNKNOWN",
      message: "outputSchema is required for structured output",
      retryable: false
    })
  }

  const providerOptions = (options.providerOptions ?? {}) as AnthropicProviderOptions
  const {
    extendedThinking: providerExtendedThinking,
    maxTokens: providerMaxTokens,
    model: providerModel,
    tools: providerTools,
    ...passthroughOptions
  } = providerOptions
  const model = (typeof providerModel === "string" ? providerModel : undefined) ?? config.model ?? DEFAULT_MODEL

  const maxTokens = typeof providerMaxTokens === "number" ? providerMaxTokens : config.maxTokens

  const extendedThinking = normalizeExtendedThinking(providerExtendedThinking ?? config.extendedThinking)

  const tools = options.tools ?? providerTools

  const outputFormat = {
    type: "json_schema",
    schema: zodToJsonSchema(options.outputSchema) as Record<string, unknown>
  } as const

  const sdkOptions: Options = {
    ...passthroughOptions,
    model,
    includePartialMessages: true,
    outputFormat,
    // Pass resume option if provided - continues existing conversation thread
    ...(options.resume ? { resume: options.resume } : {})
  }

  if (extendedThinking?.enabled && typeof extendedThinking.budgetTokens === "number") {
    sdkOptions.maxThinkingTokens = extendedThinking.budgetTokens
  }

  if (isSdkTools(tools)) {
    sdkOptions.tools = tools
  }

  if (sdkOptions.permissionMode === "bypassPermissions" && !sdkOptions.allowDangerouslySkipPermissions) {
    sdkOptions.allowDangerouslySkipPermissions = true
  }

  const envOverrides: Record<string, string | undefined> = {}

  if (config.apiKey) {
    envOverrides.ANTHROPIC_API_KEY = config.apiKey
  }

  if (typeof maxTokens === "number") {
    envOverrides.CLAUDE_CODE_MAX_OUTPUT_TOKENS = String(maxTokens)
  }

  if (Object.keys(envOverrides).length > 0) {
    sdkOptions.env = {
      ...process.env,
      ...envOverrides
    }
  }

  return sdkOptions
}

const normalizeExtendedThinking = (
  value: ExtendedThinkingConfig | undefined
): { enabled: boolean; budgetTokens?: number } | undefined => {
  if (typeof value === "boolean") {
    return { enabled: value }
  }
  if (!value) {
    return undefined
  }
  return {
    enabled: value.enabled,
    ...(typeof value.budgetTokens === "number" ? { budgetTokens: value.budgetTokens } : {})
  }
}

const sdkMessageToEvents = (message: unknown): ReadonlyArray<AgentStreamEvent> => {
  if (!isRecord(message) || typeof message.type !== "string") {
    return []
  }

  if (message.type === "stream_event") {
    return eventsFromStreamEvent(message.event)
  }

  if (message.type === "assistant") {
    return extractAssistantContent(getMessageContent(message)).events
  }

  if (message.type === "user") {
    return extractUserContent(getMessageContent(message))
  }

  if (message.type === "result") {
    if (message.subtype === "success") {
      const usage = extractUsage(message.usage)
      return usage ? [{ _tag: "Usage", ...usage }] : []
    }
  }

  return []
}

const eventsFromStreamEvent = (event: unknown): ReadonlyArray<AgentStreamEvent> => {
  if (!isRecord(event) || typeof event.type !== "string") {
    return []
  }

  if (event.type === "content_block_delta" && isRecord(event.delta)) {
    if (event.delta.type === "text_delta" && typeof event.delta.text === "string") {
      return [{ _tag: "TextDelta", delta: event.delta.text }]
    }
    if (event.delta.type === "thinking_delta" && typeof event.delta.thinking === "string") {
      return [{ _tag: "ThinkingDelta", delta: event.delta.thinking }]
    }
  }

  if (event.type === "message_delta") {
    const events: Array<AgentStreamEvent> = []
    const stopReason = extractStopReason(event)
    if (stopReason) {
      events.push({ _tag: "Stop", reason: stopReason })
    }
    const usage = extractUsage(event)
    if (usage) {
      events.push({ _tag: "Usage", ...usage })
    }
    return events
  }

  return []
}

const extractAssistantContent = (
  content: unknown
): { events: Array<AgentStreamEvent>; text?: string } => {
  if (!Array.isArray(content)) {
    return { events: [] }
  }

  const events: Array<AgentStreamEvent> = []
  let text: string | undefined

  for (const block of content) {
    if (!isRecord(block) || typeof block.type !== "string") {
      continue
    }

    switch (block.type) {
      case "text": {
        if (typeof block.text === "string") {
          text = block.text
          events.push({ _tag: "TextComplete", text: block.text })
        }
        break
      }
      case "thinking": {
        if (typeof block.thinking === "string") {
          events.push({ _tag: "ThinkingComplete", thinking: block.thinking })
        }
        break
      }
      case "tool_use": {
        const toolId = typeof block.id === "string" ? block.id : ""
        const toolName = typeof block.name === "string" ? block.name : "tool"
        events.push({
          _tag: "ToolCall",
          toolId,
          toolName,
          input: block.input ?? null
        })
        break
      }
      default:
        break
    }
  }

  return { events, ...(text ? { text } : {}) }
}

const extractUserContent = (content: unknown): ReadonlyArray<AgentStreamEvent> => {
  if (!Array.isArray(content)) {
    return []
  }

  const events: Array<AgentStreamEvent> = []

  for (const block of content) {
    if (!isRecord(block) || typeof block.type !== "string") {
      continue
    }

    if (block.type === "tool_result") {
      const toolId = typeof block.tool_use_id === "string" ? block.tool_use_id : ""
      const output = block.content ?? block.output ?? null
      const isError = Boolean(block.is_error ?? block.isError)
      events.push({
        _tag: "ToolResult",
        toolId,
        output,
        isError
      })
    }
  }

  return events
}

const isSdkTools = (value: unknown): value is SdkTools => {
  if (Array.isArray(value)) {
    return value.every((tool) => typeof tool === "string")
  }
  return isRecord(value) && value.type === "preset" && value.preset === "claude_code"
}

const getMessageContent = (message: Record<string, unknown>): unknown => {
  const payload = isRecord(message.message) ? message.message : undefined
  return payload?.content
}

const extractStopReason = (event: unknown): AgentRunResult["stopReason"] | undefined => {
  if (!isRecord(event)) {
    return undefined
  }

  const delta = isRecord(event.delta) ? event.delta : event
  const raw = typeof delta.stop_reason === "string" ? delta.stop_reason : undefined

  if (!raw) {
    return undefined
  }

  switch (raw) {
    case "tool_use":
      return "tool_use"
    case "max_tokens":
      return "max_tokens"
    default:
      return "end_turn"
  }
}

const extractUsage = (value: unknown): AgentRunResult["usage"] | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const usageSource = isRecord(value.usage) ? value.usage : value

  const inputTokens = toNumber(usageSource.input_tokens ?? usageSource.inputTokens)
  const outputTokens = toNumber(usageSource.output_tokens ?? usageSource.outputTokens)

  if (inputTokens === undefined && outputTokens === undefined) {
    return undefined
  }

  return {
    inputTokens: inputTokens ?? 0,
    outputTokens: outputTokens ?? 0
  }
}

const mapProviderError = (cause: unknown): ProviderError => {
  if (cause instanceof ProviderError) {
    return cause
  }

  const message = cause instanceof Error ? cause.message : String(cause)
  const lower = message.toLowerCase()

  if (lower.includes("rate limit") || lower.includes("429")) {
    const retryAfter = extractRetryAfter(cause)
    return new ProviderError({
      code: "RATE_LIMITED",
      message,
      retryable: true,
      ...(retryAfter !== undefined ? { retryAfter } : {})
    })
  }

  if (lower.includes("context window") || lower.includes("context length") || lower.includes("context")) {
    return new ProviderError({
      code: "CONTEXT_EXCEEDED",
      message,
      retryable: false
    })
  }

  if (lower.includes("auth") || lower.includes("api key") || lower.includes("unauthorized") || lower.includes("401")) {
    return new ProviderError({
      code: "AUTH_FAILED",
      message,
      retryable: false
    })
  }

  if (lower.includes("network") || lower.includes("fetch") || lower.includes("timeout")) {
    return new ProviderError({
      code: "NETWORK",
      message,
      retryable: true
    })
  }

  return new ProviderError({
    code: "UNKNOWN",
    message,
    retryable: false
  })
}

const extractRetryAfter = (cause: unknown): number | undefined => {
  if (isRecord(cause)) {
    const retryAfter = toNumber(cause.retryAfter ?? cause.retry_after)
    if (retryAfter !== undefined) {
      return retryAfter
    }
  }
  return undefined
}

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

/**
 * Check if a message is an init message (type='system', subtype='init').
 *
 * The Anthropic Agent SDK sends this as the first message in the stream.
 * It contains the session_id needed for resume functionality.
 */
const isInitMessage = (message: unknown): boolean => {
  if (!isRecord(message)) return false
  return message.type === "system" && message.subtype === "init"
}

/**
 * Extract session ID from an init message.
 *
 * The session_id is at the top level of the init message.
 */
const extractSessionIdFromInit = (message: unknown): string | undefined => {
  if (!isRecord(message)) return undefined
  if (typeof message.session_id === "string") {
    return message.session_id
  }
  return undefined
}
