/**
 * SSE (Server-Sent Events) utilities.
 *
 * @module
 */

import type { AnyEvent } from "@open-scaffold/core"
import { Stream } from "effect"

/**
 * SSE message format.
 */
export interface SSEMessage {
  readonly event?: string
  readonly data: string
  readonly id?: string
  readonly retry?: number
}

/**
 * Format an event as an SSE message string.
 *
 * @example
 * ```typescript
 * formatSSEMessage({ event: "update", data: '{"foo":"bar"}' })
 * // => "event: update\ndata: {"foo":"bar"}\n\n"
 * ```
 */
export const formatSSEMessage = (_message: SSEMessage): string => {
  const lines: Array<string> = []

  if (_message.event) {
    lines.push(`event: ${_message.event}`)
  }
  if (_message.id) {
    lines.push(`id: ${_message.id}`)
  }
  if (typeof _message.retry === "number") {
    lines.push(`retry: ${_message.retry}`)
  }

  const dataLines = _message.data.split("\n")
  for (const line of dataLines) {
    lines.push(`data: ${line}`)
  }

  return `${lines.join("\n")}\n\n`
}

/**
 * Convert an event stream to SSE message stream.
 */
export const eventStreamToSSE = <E, R>(
  _events: Stream.Stream<AnyEvent, E, R>
): Stream.Stream<string, E, R> => {
  return _events.pipe(
    Stream.map((event) =>
      formatSSEMessage({
        event: event.name,
        id: event.id,
        data: JSON.stringify(event)
      })
    )
  )
}

/**
 * SSE headers for HTTP response.
 */
export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive"
}
