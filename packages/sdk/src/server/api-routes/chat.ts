/**
 * POST /api/chat endpoint for Hono API.
 *
 * Handles chat requests from remote clients:
 * - Validates input
 * - Generates unique run ID
 * - Dispatches message to runtime
 * - Returns run ID for SSE subscription
 */

import { randomUUID } from "node:crypto";
import type { UIMessage } from "ai";
import { Hono } from "hono";
import type { Runtime, RuntimeCommand } from "../../runtime/runtime.js";

/**
 * Request body for POST /api/chat.
 */
export interface ChatRequest {
  messages: UIMessage[];
}

/**
 * Response body for POST /api/chat.
 */
export interface ChatResponse {
  /**
   * Unique run ID for this conversation.
   * Use this ID to subscribe to /api/events/:runId for SSE streaming.
   */
  runId: string;
}

/**
 * POST /api/chat handler.
 */
export async function POST_chat(
  runtime: Runtime,
  request: Request,
): Promise<Response> {
  try {
    const chatRequest = (await request.json()) as ChatRequest;

    // Validation: Ensure we have messages
    if (!chatRequest.messages || chatRequest.messages.length === 0) {
      return c.json(
        { error: "messages is required and must not be empty" },
        { status: 400 },
      );
    }

    // Validation: Ensure there's a user message
    const lastUserMessage = chatRequest.messages.findLast(
      (m) => m.role === "user",
    );
    if (!lastUserMessage) {
      return c.json({ error: "No user message found" }, { status: 400 });
    }

    // Extract text from user message
    // UIMessage can have multiple parts (text, images, tools, etc.)
    // We're looking for a text part for now
    const textPart = lastUserMessage.parts.find((p) => p.type === "text");
    if (!textPart) {
      return c.json(
        { error: "User message has no text content" },
        { status: 400 },
      );
    }

    // Generate unique run ID
    const runId = randomUUID();

    // Create and dispatch command to runtime
    const command: RuntimeCommand = {
      type: "send",
      runId,
      message: textPart.text,
    } as RuntimeCommand;

    runtime.dispatch(command);

    // Return run ID for SSE subscription
    const response: ChatResponse = { runId };

    return c.json(response, { status: 200 });
  } catch (error) {
    console.error("Error in POST /api/chat:", error);

    if (error instanceof Error) {
      return c.json({ error: error.message }, { status: 500 });
    }

    return c.json({ error: "Internal server error" }, { status: 500 });
  }
}
ENDOFF;
