/**
 * SSE Parsing Unit Tests.
 *
 * Comprehensive tests for SSE (Server-Sent Events) parsing utilities.
 * Tests cover happy path, edge cases, and error conditions.
 *
 * @module
 */

import { describe, expect, it } from "vitest"

import { createSSEStream, parseSSEMessage } from "../src/SSE.js"

// ─────────────────────────────────────────────────────────────────
// parseSSEMessage tests
// ─────────────────────────────────────────────────────────────────

describe("parseSSEMessage", () => {
  describe("valid SSE messages", () => {
    it("parses a single data event", () => {
      const raw = "data: {\"foo\":\"bar\"}"
      const result = parseSSEMessage(raw)

      expect(result).toEqual({ data: "{\"foo\":\"bar\"}" })
    })

    it("parses event with custom event type", () => {
      const raw = "event: update\ndata: {\"status\":\"active\"}"
      const result = parseSSEMessage(raw)

      expect(result).toEqual({
        event: "update",
        data: "{\"status\":\"active\"}"
      })
    })

    it("parses event with id", () => {
      const raw = "id: 12345\ndata: test message"
      const result = parseSSEMessage(raw)

      expect(result).toEqual({
        id: "12345",
        data: "test message"
      })
    })

    it("parses event with retry", () => {
      const raw = "retry: 3000\ndata: reconnect test"
      const result = parseSSEMessage(raw)

      expect(result).toEqual({
        retry: 3000,
        data: "reconnect test"
      })
    })

    it("parses event with all fields", () => {
      const raw = "event: message\nid: abc123\nretry: 5000\ndata: full event"
      const result = parseSSEMessage(raw)

      expect(result).toEqual({
        event: "message",
        id: "abc123",
        retry: 5000,
        data: "full event"
      })
    })

    it("concatenates multiple data lines with newlines", () => {
      const raw = "data: line one\ndata: line two\ndata: line three"
      const result = parseSSEMessage(raw)

      expect(result).toEqual({
        data: "line one\nline two\nline three"
      })
    })

    it("handles data line with colon in value", () => {
      const raw = "data: {\"url\":\"http://example.com:8080/path\"}"
      const result = parseSSEMessage(raw)

      expect(result).toEqual({
        data: "{\"url\":\"http://example.com:8080/path\"}"
      })
    })

    it("strips all leading whitespace after colon", () => {
      const raw = "data:  extra space"
      const result = parseSSEMessage(raw)

      // trimStart() removes ALL leading whitespace
      expect(result).toEqual({ data: "extra space" })
    })

    it("handles field with no colon (empty value)", () => {
      const raw = "data\ndata: has value"
      const result = parseSSEMessage(raw)

      // "data" with no colon yields empty string, which doesn't contribute
      // to concatenation since data starts empty
      expect(result).toEqual({ data: "has value" })
    })
  })

  describe("keep-alive and comment lines", () => {
    it("ignores comment lines starting with colon", () => {
      const raw = ": this is a comment\ndata: actual data"
      const result = parseSSEMessage(raw)

      expect(result).toEqual({ data: "actual data" })
    })

    it("ignores multiple comment lines", () => {
      const raw = ": comment 1\n: comment 2\ndata: the data"
      const result = parseSSEMessage(raw)

      expect(result).toEqual({ data: "the data" })
    })

    it("ignores empty lines", () => {
      const raw = "\n\ndata: test\n\n"
      const result = parseSSEMessage(raw)

      expect(result).toEqual({ data: "test" })
    })
  })

  describe("edge cases", () => {
    it("returns null for empty data", () => {
      const raw = "event: ping"
      const result = parseSSEMessage(raw)

      expect(result).toBeNull()
    })

    it("returns null for empty string", () => {
      const result = parseSSEMessage("")

      expect(result).toBeNull()
    })

    it("returns null for only comments", () => {
      const raw = ": keep-alive\n: another comment"
      const result = parseSSEMessage(raw)

      expect(result).toBeNull()
    })

    it("handles Unicode characters", () => {
      const raw = "data: {\"emoji\":\"🎉\",\"chinese\":\"你好\",\"arabic\":\"مرحبا\"}"
      const result = parseSSEMessage(raw)

      expect(result).toEqual({
        data: "{\"emoji\":\"🎉\",\"chinese\":\"你好\",\"arabic\":\"مرحبا\"}"
      })
    })

    it("handles Windows-style line endings (CRLF)", () => {
      const raw = "event: test\r\ndata: windows line endings"
      const result = parseSSEMessage(raw)

      expect(result).toEqual({
        event: "test",
        data: "windows line endings"
      })
    })

    it("handles mixed line endings", () => {
      const raw = "event: mixed\ndata: line1\r\ndata: line2"
      const result = parseSSEMessage(raw)

      expect(result).toEqual({
        event: "mixed",
        data: "line1\nline2"
      })
    })

    it("handles large payload", () => {
      const largeData = "x".repeat(100000)
      const raw = `data: ${largeData}`
      const result = parseSSEMessage(raw)

      expect(result).toEqual({ data: largeData })
    })

    it("ignores invalid retry (non-numeric)", () => {
      const raw = "retry: invalid\ndata: test"
      const result = parseSSEMessage(raw)

      expect(result).toEqual({ data: "test" })
      expect(result?.retry).toBeUndefined()
    })

    it("ignores unknown fields", () => {
      const raw = "unknown: value\ndata: test"
      const result = parseSSEMessage(raw)

      expect(result).toEqual({ data: "test" })
    })

    it("uses last event value when multiple events specified", () => {
      const raw = "event: first\nevent: second\ndata: test"
      const result = parseSSEMessage(raw)

      expect(result).toEqual({
        event: "second",
        data: "test"
      })
    })

    it("handles data with trailing newline", () => {
      const raw = "data: test\n"
      const result = parseSSEMessage(raw)

      expect(result).toEqual({ data: "test" })
    })

    it("returns null for whitespace-only data (trimmed to empty)", () => {
      const raw = "data:    "
      const result = parseSSEMessage(raw)

      // trimStart() removes all leading whitespace, leaving empty string
      // empty data returns null
      expect(result).toBeNull()
    })
  })

  describe("JSON data parsing scenarios", () => {
    it("preserves valid JSON structure", () => {
      const raw = "data: {\"nested\":{\"array\":[1,2,3],\"bool\":true}}"
      const result = parseSSEMessage(raw)

      expect(result?.data).toBe("{\"nested\":{\"array\":[1,2,3],\"bool\":true}}")
      expect(JSON.parse(result!.data)).toEqual({
        nested: { array: [1, 2, 3], bool: true }
      })
    })

    it("handles malformed JSON (parser does not validate)", () => {
      const raw = "data: {invalid json}"
      const result = parseSSEMessage(raw)

      // parseSSEMessage does not validate JSON, it just returns raw data
      expect(result).toEqual({ data: "{invalid json}" })
    })

    it("handles multiline JSON across multiple data lines", () => {
      const raw = "data: {\"key\":\ndata: \"value\"}"
      const result = parseSSEMessage(raw)

      expect(result?.data).toBe("{\"key\":\n\"value\"}")
    })
  })
})

// ─────────────────────────────────────────────────────────────────
// createSSEStream tests
// ─────────────────────────────────────────────────────────────────

describe("createSSEStream", () => {
  /**
   * Helper to create a mock Response with a readable stream body.
   */
  const createMockResponse = (chunks: Array<string>): Response => {
    const encoder = new TextEncoder()
    let chunkIndex = 0

    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (chunkIndex < chunks.length) {
          controller.enqueue(encoder.encode(chunks[chunkIndex]))
          chunkIndex++
        } else {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream" }
    })
  }

  it("throws error when response has no body", () => {
    const response = new Response(null)

    expect(() => createSSEStream(response)).toThrow("SSE response has no body")
  })

  it("parses single event from stream", async () => {
    const response = createMockResponse(["data: hello\n\n"])
    const stream = createSSEStream(response)

    const messages: Array<{ data: string }> = []
    for await (const message of stream) {
      messages.push(message)
    }

    expect(messages).toEqual([{ data: "hello" }])
  })

  it("parses multiple events from stream", async () => {
    const response = createMockResponse([
      "data: first\n\n",
      "data: second\n\n",
      "data: third\n\n"
    ])
    const stream = createSSEStream(response)

    const messages: Array<{ data: string }> = []
    for await (const message of stream) {
      messages.push(message)
    }

    expect(messages).toEqual([
      { data: "first" },
      { data: "second" },
      { data: "third" }
    ])
  })

  it("handles events split across chunks", async () => {
    const response = createMockResponse([
      "data: part",
      "ial\n\n",
      "data: complete\n\n"
    ])
    const stream = createSSEStream(response)

    const messages: Array<{ data: string }> = []
    for await (const message of stream) {
      messages.push(message)
    }

    expect(messages).toEqual([
      { data: "partial" },
      { data: "complete" }
    ])
  })

  it("handles multiple events in single chunk", async () => {
    const response = createMockResponse([
      "data: one\n\ndata: two\n\ndata: three\n\n"
    ])
    const stream = createSSEStream(response)

    const messages: Array<{ data: string }> = []
    for await (const message of stream) {
      messages.push(message)
    }

    expect(messages).toEqual([
      { data: "one" },
      { data: "two" },
      { data: "three" }
    ])
  })

  it("handles trailing data without final double newline", async () => {
    const response = createMockResponse([
      "data: first\n\n",
      "data: trailing"
    ])
    const stream = createSSEStream(response)

    const messages: Array<{ data: string }> = []
    for await (const message of stream) {
      messages.push(message)
    }

    expect(messages).toEqual([
      { data: "first" },
      { data: "trailing" }
    ])
  })

  it("skips keep-alive messages (comments)", async () => {
    const response = createMockResponse([
      ": keep-alive\n\n",
      "data: actual\n\n",
      ": another keep-alive\n\n"
    ])
    const stream = createSSEStream(response)

    const messages: Array<{ data: string }> = []
    for await (const message of stream) {
      messages.push(message)
    }

    expect(messages).toEqual([{ data: "actual" }])
  })

  it("handles CRLF line endings in stream", async () => {
    const response = createMockResponse([
      "data: crlf test\r\n\r\n"
    ])
    const stream = createSSEStream(response)

    const messages: Array<{ data: string }> = []
    for await (const message of stream) {
      messages.push(message)
    }

    expect(messages).toEqual([{ data: "crlf test" }])
  })

  it("parses events with all fields from stream", async () => {
    const response = createMockResponse([
      "event: update\nid: 123\nretry: 5000\ndata: full event\n\n"
    ])
    const stream = createSSEStream(response)

    const messages: Array<unknown> = []
    for await (const message of stream) {
      messages.push(message)
    }

    expect(messages).toEqual([{
      event: "update",
      id: "123",
      retry: 5000,
      data: "full event"
    }])
  })

  it("handles empty stream", async () => {
    const response = createMockResponse([])
    const stream = createSSEStream(response)

    const messages: Array<unknown> = []
    for await (const message of stream) {
      messages.push(message)
    }

    expect(messages).toEqual([])
  })

  it("handles stream with only whitespace", async () => {
    const response = createMockResponse(["   \n\n"])
    const stream = createSSEStream(response)

    const messages: Array<unknown> = []
    for await (const message of stream) {
      messages.push(message)
    }

    expect(messages).toEqual([])
  })

  it("handles large events in stream", async () => {
    const largeData = "x".repeat(50000)
    const response = createMockResponse([`data: ${largeData}\n\n`])
    const stream = createSSEStream(response)

    const messages: Array<{ data: string }> = []
    for await (const message of stream) {
      messages.push(message)
    }

    expect(messages).toHaveLength(1)
    expect(messages[0].data).toHaveLength(50000)
  })

  it("handles Unicode in stream", async () => {
    const response = createMockResponse([
      "data: {\"emoji\":\"🚀\",\"text\":\"Unicode works!\"}\n\n"
    ])
    const stream = createSSEStream(response)

    const messages: Array<{ data: string }> = []
    for await (const message of stream) {
      messages.push(message)
    }

    expect(messages).toEqual([{
      data: "{\"emoji\":\"🚀\",\"text\":\"Unicode works!\"}"
    }])
  })
})
