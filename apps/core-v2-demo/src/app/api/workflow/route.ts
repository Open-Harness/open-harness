/**
 * Workflow API Route Handler
 *
 * Server-side workflow execution endpoint using core-v2's createWorkflowHandler.
 * Exposes the TaskExecutor workflow via Server-Sent Events (SSE) streaming.
 *
 * Request format:
 * POST /api/workflow
 * Body: { input: string, sessionId?: string, record?: boolean }
 *
 * Response: SSE stream with events:
 * - type: "event" - workflow events (user:input, text:delta, etc.)
 * - type: "state" - state changes
 * - type: "done" - completion with sessionId and finalState
 * - type: "error" - error messages
 */

import { createWorkflowHandler } from "@open-harness/core-v2";
import { serverWorkflow } from "@/lib/workflow-server";

// Create the HTTP handler with CORS support for local development
const handler = createWorkflowHandler({
  workflow: serverWorkflow,
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["POST", "OPTIONS"],
  },
});

/**
 * Handle POST requests to execute the workflow.
 * Streams events back via SSE.
 */
export async function POST(request: Request): Promise<Response> {
  return handler.handle(request);
}

/**
 * Handle OPTIONS requests for CORS preflight.
 */
export async function OPTIONS(request: Request): Promise<Response> {
  return handler.handle(request);
}
