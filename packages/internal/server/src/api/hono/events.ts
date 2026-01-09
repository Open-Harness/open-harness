import type { Context } from "hono";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { getLogger, type Runtime, type RuntimeEvent } from "@internal/core";
import { createPartTracker, transformEvent } from "../../transports/local";

export interface EventsRouteOptions {
  /**
   * Include reasoning/thinking parts in the message stream.
   * @default true
   */
  sendReasoning?: boolean;

  /**
   * Include step-start parts at node boundaries.
   * @default true
   */
  sendStepMarkers?: boolean;

  /**
   * Include custom data parts for flow-level events.
   * @default false
   */
  sendFlowMetadata?: boolean;

  /**
   * Include custom data parts for node outputs.
   * @default false
   */
  sendNodeOutputs?: boolean;

  /**
   * Connection timeout in milliseconds.
   * @default 30 * 60 * 1000 (30 minutes)
   */
  timeout?: number;
}

/**
 * Create the events SSE route for streaming runtime events.
 *
 * This route transforms Open Harness RuntimeEvents into Vercel AI SDK
 * UIMessageChunk format and streams them via Server-Sent Events.
 */
export function createEventsRoute(
  runtime: Runtime,
  options?: EventsRouteOptions,
) {
  const app = new Hono();

  const opts = {
    sendReasoning: options?.sendReasoning ?? true,
    sendStepMarkers: options?.sendStepMarkers ?? true,
    sendFlowMetadata: options?.sendFlowMetadata ?? false,
    sendNodeOutputs: options?.sendNodeOutputs ?? false,
    timeout: options?.timeout ?? 30 * 60 * 1000,
    generateMessageId: () => crypto.randomUUID(),
  };

  app.get("/api/events/:runId", async (c: Context) => {
    const runId = c.req.param("runId");

    if (!runId) {
      return c.json({ error: "Missing runId parameter" }, 400);
    }

    try {
      return streamSSE(c, async (stream) => {
        const tracker = createPartTracker();
        const messageId = opts.generateMessageId();

        let unsubscribe: (() => void) | null = null;
        let lastActivity = Date.now();
        let isClosed = false;

        // IMPORTANT: streamSSE closes the connection when this callback resolves.
        // Keep the stream open until we hit terminal/timeout/abort.
        let resolveDone!: () => void;
        const done = new Promise<void>((resolve) => {
          resolveDone = resolve;
        });

        const cleanup = () => {
          if (isClosed) return;
          isClosed = true;
          if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
          }
          resolveDone();
        };

        // Client disconnect
        c.req.raw.signal.addEventListener("abort", cleanup, { once: true });

        // Activity timeout checker
        const timeoutCheck = setInterval(() => {
          const inactiveTime = Date.now() - lastActivity;
          if (inactiveTime > opts.timeout) {
            getLogger().warn({ runId, inactiveTime, timeout: opts.timeout }, "Connection timeout");
            cleanup();
          }
        }, 60000); // Check every minute

        try {
          unsubscribe = runtime.onEvent(async (event: RuntimeEvent) => {
            if (isClosed) return;

            // Filter events for this runId only
            if ("runId" in event && event.runId !== runId) {
              return;
            }

            lastActivity = Date.now();

            try {
              const chunks = transformEvent(event, tracker, messageId, opts);
              if (!chunks || chunks.length === 0) return;

              for (const chunk of chunks) {
                if (isClosed) return;
                await stream.writeSSE({ data: JSON.stringify(chunk) });
              }

              if (
                event.type === "agent:complete" ||
                event.type === "agent:paused" ||
                event.type === "agent:aborted" ||
                event.type === "flow:complete" ||
                event.type === "flow:aborted"
              ) {
                // Ensure text-end is sent if text was started
                if (tracker.textStarted && !tracker.textEnded) {
                  try {
                    if (!isClosed) {
                      await stream.writeSSE({
                        data: JSON.stringify({
                          type: "text-end",
                          id: messageId,
                        }),
                      });
                      tracker.textEnded = true;
                    }
                  } catch {
                    // Ignore
                  }
                }

                cleanup();
              }
            } catch (error) {
              getLogger().error({ err: error, runId }, "Error processing event");
              try {
                if (!isClosed) {
                  await stream.writeSSE({
                    data: JSON.stringify({
                      type: "error",
                      errorText:
                        error instanceof Error
                          ? error.message
                          : "Failed to process event",
                    }),
                  });
                }
              } catch {
                // Ignore
              }
              cleanup();
            }
          });
        } catch (listenerError) {
          getLogger().error({ err: listenerError, runId }, "Error setting up event listener");
          try {
            await stream.writeSSE({
              data: JSON.stringify({
                type: "error",
                errorText:
                  listenerError instanceof Error
                    ? listenerError.message
                    : "Failed to subscribe to events",
              }),
            });
          } catch {
            // Ignore
          }
          cleanup();
        }

        await done;
        clearInterval(timeoutCheck);
      });
    } catch (streamError) {
      getLogger().error({ err: streamError, runId }, "Failed to create SSE stream");
      return c.json(
        {
          error: "Failed to create SSE stream",
          message:
            streamError instanceof Error
              ? streamError.message
              : String(streamError),
        },
        500,
      );
    }
  });

  return app;
}
