import type { Context } from "hono";

export function errorHandler(err: Error, c: Context) {
  console.error("API Error:", err);

  // If an SSE stream was stashed in context by user code/middleware, try to emit an error.
  try {
    const stream = c.get("sseStream") as unknown;
    if (
      stream &&
      typeof stream === "object" &&
      "writeSSE" in stream &&
      typeof (stream as { writeSSE: unknown }).writeSSE === "function"
    ) {
      void (
        stream as {
          writeSSE: (msg: { event?: string; data: string }) => unknown;
        }
      ).writeSSE({
        event: "error",
        data: JSON.stringify({ type: "error", errorText: err.message }),
      });
    }
  } catch {
    // Ignore if no SSE stream
  }

  return c.json(
    {
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    },
    500,
  );
}
