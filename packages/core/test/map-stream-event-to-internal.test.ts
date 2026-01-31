/**
 * Tests for mapStreamEventToInternal function.
 *
 * This function maps AgentStreamEvent (from providers) to internal Event types.
 * It's a pure transformation function with no dependencies.
 *
 * NOTE: The function signature uses `agent: string` per ADR-008. The test variable
 * `testAgent` holds the agent identifier value passed to the function.
 *
 * @module
 */

import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import type { SerializedEvent } from "../src/Domain/Events.js"
import type { AgentStreamEvent } from "../src/Domain/Provider.js"
import { EVENTS, makeEventId } from "../src/Engine/types.js"
import { mapStreamEventToInternal } from "../src/internal.js"

describe("mapStreamEventToInternal", () => {
  const testAgent = "test-agent"

  describe("TextDelta events", () => {
    it("maps TextDelta to text:delta event", async () => {
      const streamEvent: AgentStreamEvent = {
        _tag: "TextDelta",
        delta: "Hello, world!"
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent)
      )

      expect(result).not.toBeNull()
      const event = result as SerializedEvent
      expect(event.name).toBe(EVENTS.TEXT_DELTA)
      expect(event.payload).toEqual({
        agent: "test-agent",
        delta: "Hello, world!"
      })
      expect(event.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      expect(typeof event.timestamp).toBe("number")
      expect(event.causedBy).toBeUndefined()
    })

    it("maps TextDelta with empty string", async () => {
      const streamEvent: AgentStreamEvent = {
        _tag: "TextDelta",
        delta: ""
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent)
      )

      expect(result).not.toBeNull()
      const event = result as SerializedEvent
      expect(event.name).toBe(EVENTS.TEXT_DELTA)
      expect(event.payload).toEqual({
        agent: "test-agent",
        delta: ""
      })
    })

    it("preserves causedBy when provided", async () => {
      const causedBy = await Effect.runPromise(makeEventId())
      const streamEvent: AgentStreamEvent = {
        _tag: "TextDelta",
        delta: "test"
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent, causedBy)
      )

      expect(result).not.toBeNull()
      const event = result as SerializedEvent
      expect(event.causedBy).toBe(causedBy)
    })
  })

  describe("ThinkingDelta events", () => {
    it("maps ThinkingDelta to thinking:delta event", async () => {
      const streamEvent: AgentStreamEvent = {
        _tag: "ThinkingDelta",
        delta: "Let me think about this..."
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent)
      )

      expect(result).not.toBeNull()
      const event = result as SerializedEvent
      expect(event.name).toBe(EVENTS.THINKING_DELTA)
      expect(event.payload).toEqual({
        agent: "test-agent",
        delta: "Let me think about this..."
      })
    })

    it("maps ThinkingDelta with empty string", async () => {
      const streamEvent: AgentStreamEvent = {
        _tag: "ThinkingDelta",
        delta: ""
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent)
      )

      expect(result).not.toBeNull()
      const event = result as SerializedEvent
      expect(event.payload).toEqual({
        agent: "test-agent",
        delta: ""
      })
    })
  })

  describe("ToolCall events", () => {
    it("maps ToolCall to tool:called event", async () => {
      const streamEvent: AgentStreamEvent = {
        _tag: "ToolCall",
        toolId: "tool_123",
        toolName: "search",
        input: { query: "effect-ts" }
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent)
      )

      expect(result).not.toBeNull()
      const event = result as SerializedEvent
      expect(event.name).toBe(EVENTS.TOOL_CALLED)
      expect(event.payload).toEqual({
        agent: "test-agent",
        toolId: "tool_123",
        toolName: "search",
        input: { query: "effect-ts" }
      })
    })

    it("maps ToolCall with complex input", async () => {
      const streamEvent: AgentStreamEvent = {
        _tag: "ToolCall",
        toolId: "tool_456",
        toolName: "execute",
        input: {
          command: "npm test",
          options: { cwd: "/app", timeout: 30000 },
          env: ["NODE_ENV=test"]
        }
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent)
      )

      expect(result).not.toBeNull()
      const event = result as SerializedEvent
      expect(event.payload).toEqual({
        agent: "test-agent",
        toolId: "tool_456",
        toolName: "execute",
        input: {
          command: "npm test",
          options: { cwd: "/app", timeout: 30000 },
          env: ["NODE_ENV=test"]
        }
      })
    })

    it("maps ToolCall with null input", async () => {
      const streamEvent: AgentStreamEvent = {
        _tag: "ToolCall",
        toolId: "tool_789",
        toolName: "get_time",
        input: null
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent)
      )

      expect(result).not.toBeNull()
      const event = result as SerializedEvent
      expect(event.payload).toEqual({
        agent: "test-agent",
        toolId: "tool_789",
        toolName: "get_time",
        input: null
      })
    })
  })

  describe("ToolResult events", () => {
    it("maps ToolResult to tool:result event (success)", async () => {
      const streamEvent: AgentStreamEvent = {
        _tag: "ToolResult",
        toolId: "tool_123",
        output: { data: [1, 2, 3] },
        isError: false
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent)
      )

      expect(result).not.toBeNull()
      const event = result as SerializedEvent
      expect(event.name).toBe(EVENTS.TOOL_RESULT)
      expect(event.payload).toEqual({
        agent: "test-agent",
        toolId: "tool_123",
        output: { data: [1, 2, 3] },
        isError: false
      })
    })

    it("maps ToolResult to tool:result event (error)", async () => {
      const streamEvent: AgentStreamEvent = {
        _tag: "ToolResult",
        toolId: "tool_456",
        output: "Error: Connection timeout",
        isError: true
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent)
      )

      expect(result).not.toBeNull()
      const event = result as SerializedEvent
      expect(event.name).toBe(EVENTS.TOOL_RESULT)
      expect(event.payload).toEqual({
        agent: "test-agent",
        toolId: "tool_456",
        output: "Error: Connection timeout",
        isError: true
      })
    })

    it("maps ToolResult with null output", async () => {
      const streamEvent: AgentStreamEvent = {
        _tag: "ToolResult",
        toolId: "tool_789",
        output: null,
        isError: false
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent)
      )

      expect(result).not.toBeNull()
      const event = result as SerializedEvent
      expect(event.payload).toEqual({
        agent: "test-agent",
        toolId: "tool_789",
        output: null,
        isError: false
      })
    })
  })

  describe("Result events", () => {
    it("returns null for Result events", async () => {
      const streamEvent: AgentStreamEvent = {
        _tag: "Result",
        output: { verdict: "approved" },
        stopReason: "end_turn",
        text: "Approved",
        usage: { inputTokens: 100, outputTokens: 50 }
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent)
      )

      expect(result).toBeNull()
    })

    it("returns null for Result events with minimal fields", async () => {
      const streamEvent: AgentStreamEvent = {
        _tag: "Result",
        output: undefined,
        stopReason: "end_turn"
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent)
      )

      expect(result).toBeNull()
    })
  })

  describe("Unhandled events", () => {
    it("returns null for TextComplete events", async () => {
      const streamEvent: AgentStreamEvent = {
        _tag: "TextComplete",
        text: "Complete text"
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent)
      )

      expect(result).toBeNull()
    })

    it("returns null for ThinkingComplete events", async () => {
      const streamEvent: AgentStreamEvent = {
        _tag: "ThinkingComplete",
        thinking: "Complete thinking"
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent)
      )

      expect(result).toBeNull()
    })

    it("returns null for Stop events", async () => {
      const streamEvent: AgentStreamEvent = {
        _tag: "Stop",
        reason: "end_turn"
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent)
      )

      expect(result).toBeNull()
    })

    it("returns null for Usage events", async () => {
      const streamEvent: AgentStreamEvent = {
        _tag: "Usage",
        inputTokens: 100,
        outputTokens: 50
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent)
      )

      expect(result).toBeNull()
    })

    it("returns null for SessionInit events", async () => {
      const streamEvent: AgentStreamEvent = {
        _tag: "SessionInit",
        sessionId: "session_abc123"
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent)
      )

      expect(result).toBeNull()
    })
  })

  describe("Edge cases", () => {
    it("handles special characters in delta", async () => {
      const streamEvent: AgentStreamEvent = {
        _tag: "TextDelta",
        delta: "Unicode: \u00e9\u00e8\u00ea \nNewline\tTab"
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent)
      )

      expect(result).not.toBeNull()
      const event = result as SerializedEvent
      expect(event.payload).toEqual({
        agent: "test-agent",
        delta: "Unicode: \u00e9\u00e8\u00ea \nNewline\tTab"
      })
    })

    it("handles emoji in delta", async () => {
      const streamEvent: AgentStreamEvent = {
        _tag: "TextDelta",
        delta: "Test with emojis: \uD83D\uDE0A\uD83D\uDE80"
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent)
      )

      expect(result).not.toBeNull()
      const event = result as SerializedEvent
      expect(event.payload).toEqual({
        agent: "test-agent",
        delta: "Test with emojis: \uD83D\uDE0A\uD83D\uDE80"
      })
    })

    it("handles very long delta strings", async () => {
      const longDelta = "a".repeat(10000)
      const streamEvent: AgentStreamEvent = {
        _tag: "TextDelta",
        delta: longDelta
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(testAgent, streamEvent)
      )

      expect(result).not.toBeNull()
      const event = result as SerializedEvent
      expect((event.payload as { delta: string }).delta).toHaveLength(10000)
    })

    it("handles agent name with special characters", async () => {
      const specialAgentName = "agent-with-special_chars.v2"
      const streamEvent: AgentStreamEvent = {
        _tag: "TextDelta",
        delta: "test"
      }

      const result = await Effect.runPromise(
        mapStreamEventToInternal(specialAgentName, streamEvent)
      )

      expect(result).not.toBeNull()
      const event = result as SerializedEvent
      expect(event.payload).toEqual({
        agent: "agent-with-special_chars.v2",
        delta: "test"
      })
    })

    it("generates unique IDs for multiple calls", async () => {
      const streamEvent: AgentStreamEvent = {
        _tag: "TextDelta",
        delta: "test"
      }

      const [result1, result2, result3] = await Effect.runPromise(
        Effect.all([
          mapStreamEventToInternal(testAgent, streamEvent),
          mapStreamEventToInternal(testAgent, streamEvent),
          mapStreamEventToInternal(testAgent, streamEvent)
        ])
      )

      const ids = [
        (result1 as SerializedEvent).id,
        (result2 as SerializedEvent).id,
        (result3 as SerializedEvent).id
      ]

      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(3)
    })
  })
})
