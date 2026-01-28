/**
 * Sessions API Route Handler
 *
 * Provides endpoints for listing recorded workflow sessions.
 * Sessions are stored in memory via core-v2's MemoryStore.
 *
 * GET /api/sessions - List all recorded sessions with metadata
 */

import { type SessionMetadata } from "@open-harness/core-v2";
import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

/**
 * Response type for GET /api/sessions.
 * Matches the SessionInfo interface expected by SessionList component.
 */
interface SessionResponse {
  id: string;
  createdAt: string;
  lastEventAt?: string;
  eventCount: number;
  workflowName?: string;
}

/**
 * Convert SessionMetadata to API response format.
 * Converts Date objects to ISO strings for JSON serialization.
 */
function toResponse(session: SessionMetadata): SessionResponse {
  return {
    id: session.id,
    createdAt: session.createdAt.toISOString(),
    lastEventAt: session.lastEventAt?.toISOString(),
    eventCount: session.eventCount,
    workflowName: session.workflowName,
  };
}

/**
 * GET /api/sessions
 *
 * Returns a list of all recorded sessions with metadata.
 * Response is an array of SessionResponse objects.
 */
export async function GET(): Promise<NextResponse<SessionResponse[]>> {
  try {
    const store = await getStore();
    const sessions = await store.sessions();

    // Convert to response format with ISO date strings
    const response = sessions.map(toResponse);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch sessions:", error);
    return NextResponse.json([], { status: 500 });
  }
}
