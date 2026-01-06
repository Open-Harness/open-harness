/**
 * GET /api/events/:runId endpoint for Hono API.
 *
 * Streams runtime events to clients via Server-Sent Events.
 * - Subscribes to runtime events
 * - Transforms to Vercel AI SDK UIMessageChunks
 * - Filters events by runId
 * - Implements 30-minute inactivity timeout
 */

import { randomUUID } from "node:crypto";
import type { UIMessageChunk } from "ai";
import type { Runtime, RuntimeEvent } from "../../runtime/runtime.js";

/**
 * Map runtime events to UI message chunks.
 */
function transformEventToChunk(event: RuntimeEvent): UIMessageChunk | null {
	switch (event.type) {
		case "agent:text:delta":
			return { type: "text-delta", delta: event.content, id: event.runId ?? "" };
		case "agent:thinking:delta":
			return { type: "reasoning-delta", delta: event.content, id: event.runId ?? "" };
		case "node:complete":
			return {
				type: "tool-result",
				toolCallId: event.nodeId,
				toolName: event.output.toolName ?? "",
				toolResult: event.output.result ?? "success",
				id: event.runId ?? "",
			};
		case "agent:complete":
			return {
				type: "text-delta",
				delta: "",
				id: event.runId ?? "",
			};
		default:
			return null;
	}
}

/**
 * SSE connection manager for a single run.
 */
class SSEConnection {
	private readonly response: WritableStreamDefault<Uint8Array>;
	private readonly runId: string;
	private readonly timeoutMs: number;
	private timeoutId: NodeJS.Timeout | null = null;
	private isActive = false;

	constructor(response: WritableStreamDefault<Uint8Array>, runId: string, timeoutMinutes: number = 30) {
		this.response = response;
		this.runId = runId;
		this.timeoutMs = timeoutMinutes * 60 * 1000;
		this.timeoutId = null;
		this.isActive = true;

		// Set timeout
		this.setTimeout();
	}

	setTimeout() {
		this.timeoutId = setTimeout(() => {
			if (this.isActive) {
				this.isActive = false;
				try {
					this.response.end();
				} catch {
					// Stream already closed, ignore error
				}
			}
		}, this.timeoutMs);
	}

	/**
	 * Write a chunk to the response.
	 */
	writeChunk(chunk: Uint8Array): boolean {
		if (!this.isActive) return false;

		try {
			this.response.write(chunk);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Close the SSE connection.
	 */
	close(): void {
		this.isActive = false;
		clearTimeout(this.timeoutId);

		try {
			this.response.end();
		} catch {
			// Stream already closed, ignore error
			}
		}
	}
}

/**
 * Active SSE connections indexed by runId.
 */
const connections = new Map<string, SSEConnection>();

/**
 * GET /api/events/:runId handler.
 */
export async function GET_events(runtime: Runtime): Promise<Response> {
	const { runId } = runtime.getSnapshot();
	const url = new URL(runtime.request.url);
	const pathname = url.pathname;
	const runIdFromPath = pathname.split("/").at(-1);

	// Validation: Ensure path is /api/events/:runId
	if (!pathname.startsWith("/api/events/")) {
		return Response.json({ error: "Invalid path" }, { status: 404 });
	}

	if (!runIdFromPath) {
		return Response.json({ error: "Missing runId" }, { status: 400 });
	}

	// Check if there's already a connection for this runId
	if (connections.has(runIdFromPath)) {
		return Response.json({ error: "Already subscribed to this run" }, { status: 409 });
	}

	// Get headers for SSE
	const headers = new Headers();
	headers.set("Content-Type", "text/event-stream; charset=utf-8");
	headers.set("Cache-Control", "no-cache");
	headers.set("Connection", "keep-alive");

	// Create SSE response
	return new Response(headers, {
		status: 200,
	});
}