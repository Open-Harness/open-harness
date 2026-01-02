/**
 * AnthropicEventMapper - Provider-specific event mapping
 *
 * Converts Anthropic SDK messages to unified BaseEvent format.
 * Each provider package implements its own event mapper following this pattern.
 *
 * ## Provider Pattern
 *
 * Event mappers live in the provider layer (not infrastructure) because:
 * 1. Different providers have different message structures (SDKMessage vs ChatCompletionChunk vs GenerateContentResponse)
 * 2. Type safety - no casting at infrastructure level
 * 3. Makes provider-specific code obvious
 * 4. Establishes clear pattern for future providers
 *
 * @example Future OpenAI provider
 * ```typescript
 * // @openharness/openai/src/provider/openai-event-mapper.ts
 * export class OpenAIEventMapper {
 *   static toUnifiedEvents(msg: ChatCompletionChunk, agentName: string): BaseEvent[] {
 *     // OpenAI-specific mapping logic
 *   }
 * }
 * ```
 *
 * @example Future Gemini provider
 * ```typescript
 * // @openharness/gemini/src/provider/gemini-event-mapper.ts
 * export class GeminiEventMapper {
 *   static toUnifiedEvents(msg: GenerateContentResponse, agentName: string): BaseEvent[] {
 *     // Gemini-specific mapping logic
 *   }
 * }
 * ```
 *
 * @module provider/anthropic-event-mapper
 */
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { BaseEvent } from "@openharness/sdk";
/**
 * AnthropicEventMapper - Converts Anthropic SDK messages to unified events
 *
 * This class knows the internal structure of Anthropic's SDKMessage and maps it
 * to the standardized BaseEvent format that all providers must produce.
 *
 * ## Event Mapping
 *
 * Maps SDK message types to standardized event format:
 * - `system.init` → `agent:start`
 * - `assistant` text block → `agent:text`
 * - `assistant` thinking block → `agent:thinking`
 * - `assistant` tool_use block → `agent:tool:start`
 * - `user` tool_result block → `agent:tool:complete`
 * - `result.success` or `result.failure` → `agent:complete`
 *
 * ## Usage
 *
 * ```typescript
 * // In InternalAnthropicAgent
 * const events = AnthropicEventMapper.toUnifiedEvents(sdkMessage, this.name);
 * for (const event of events) {
 *   this.unifiedBus.emit(event, { agent: { name: this.name } });
 * }
 * ```
 */
export declare class AnthropicEventMapper {
    /**
     * Convert Anthropic SDKMessage to provider-agnostic BaseEvent[]
     *
     * A single SDK message may produce multiple events (e.g., an assistant message
     * with both text and tool_use blocks produces multiple events).
     *
     * @param msg - Anthropic SDK message from @anthropic-ai/claude-agent-sdk
     * @param agentName - Agent identifier for event attribution
     * @returns Array of unified events (0+ events, depending on message content)
     *
     * @example Single event
     * ```typescript
     * const msg = { type: "system", subtype: "init", ... };
     * const events = AnthropicEventMapper.toUnifiedEvents(msg, "MyAgent");
     * // events = [{ type: "agent:start", agentName: "MyAgent" }]
     * ```
     *
     * @example Multiple events
     * ```typescript
     * const msg = {
     *   type: "assistant",
     *   message: {
     *     content: [
     *       { type: "text", text: "Hello" },
     *       { type: "tool_use", name: "read_file", input: {...} }
     *     ]
     *   }
     * };
     * const events = AnthropicEventMapper.toUnifiedEvents(msg, "MyAgent");
     * // events = [
     * //   { type: "agent:text", content: "Hello" },
     * //   { type: "agent:tool:start", toolName: "read_file", input: {...} }
     * // ]
     * ```
     */
    static toUnifiedEvents(msg: SDKMessage, agentName: string): BaseEvent[];
}
