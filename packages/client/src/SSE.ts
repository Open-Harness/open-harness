/**
 * SSE (Server-Sent Events) parsing utilities.
 *
 * @module
 */

/**
 * Parsed SSE message.
 */
export interface ParsedSSEMessage {
  readonly event?: string
  readonly data: string
  readonly id?: string
  readonly retry?: number
}

/**
 * Parse a raw SSE message string into a structured message.
 *
 * @example
 * ```typescript
 * parseSSEMessage("event: update\ndata: {\"foo\":\"bar\"}\n\n")
 * // => { event: "update", data: '{"foo":"bar"}' }
 * ```
 */
export const parseSSEMessage = (_raw: string): ParsedSSEMessage | null => {
  const lines = _raw.split(/\r?\n/)
  let event: string | undefined
  let data = ""
  let id: string | undefined
  let retry: number | undefined

  for (const line of lines) {
    if (!line || line.startsWith(":")) continue
    const separatorIndex = line.indexOf(":")
    const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex)
    const value = separatorIndex === -1 ? "" : line.slice(separatorIndex + 1).trimStart()

    switch (field) {
      case "event":
        event = value
        break
      case "data":
        data = data ? `${data}\n${value}` : value
        break
      case "id":
        id = value
        break
      case "retry": {
        const parsed = Number(value)
        if (!Number.isNaN(parsed)) retry = parsed
        break
      }
      default:
        break
    }
  }

  if (!data) return null

  return {
    data,
    ...(event ? { event } : {}),
    ...(id ? { id } : {}),
    ...(typeof retry === "number" ? { retry } : {})
  }
}

/**
 * Create an async iterable from an SSE response stream.
 */
export const createSSEStream = (
  _response: Response
): AsyncIterable<ParsedSSEMessage> => {
  if (!_response.body) {
    throw new Error("SSE response has no body")
  }

  const reader = _response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  const stream = async function*(): AsyncIterable<ParsedSSEMessage> {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      while (true) {
        const match = buffer.match(/\r?\n\r?\n/)
        if (!match || match.index === undefined) break
        const raw = buffer.slice(0, match.index)
        buffer = buffer.slice(match.index + match[0].length)
        const message = parseSSEMessage(raw)
        if (message) {
          yield message
        }
      }
    }

    if (buffer.trim()) {
      const message = parseSSEMessage(buffer)
      if (message) {
        yield message
      }
    }
  }

  return stream()
}
