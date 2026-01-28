/**
 * Sessions API Route Handler
 *
 * Provides endpoints for listing recorded workflow sessions.
 * Sessions are stored in SQLite via core-v2's SqliteStore.
 *
 * GET /api/sessions - List all recorded sessions with metadata
 */

import {
  createSqliteStore,
  type PublicStore,
  type SessionMetadata,
} from "@open-harness/core-v2";
import { NextResponse } from "next/server";

/**
 * Database path for session storage.
 * Uses a file in the project root for persistence across restarts.
 */
const DATABASE_PATH = process.env.SQLITE_PATH || "./data/sessions.db";

/**
 * Singleton store instance to avoid re-creating connections.
 * Lazy initialized on first request.
 */
let storePromise: Promise<PublicStore> | null = null;

/**
 * Get or create the store instance.
 */
async function getStore(): Promise<PublicStore> {
  if (!storePromise) {
    storePromise = createSqliteStore({ path: DATABASE_PATH });
  }
  return storePromise;
}

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
