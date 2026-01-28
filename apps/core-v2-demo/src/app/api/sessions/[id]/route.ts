/**
 * Session Detail API Route Handler
 *
 * Provides endpoint for fetching a specific recorded workflow session
 * including all its events for replay.
 *
 * GET /api/sessions/[id] - Get session with all events
 */

import {
  type AnyEvent,
  createSqliteStore,
  makeSessionId,
  type PublicStore,
  type SessionMetadata,
} from "@open-harness/core-v2";
import { NextResponse } from "next/server";

/**
 * Database path for session storage.
 * Uses the same path as the sessions list endpoint.
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
 * Response type for GET /api/sessions/[id].
 */
interface SessionDetailResponse {
  id: string;
  events: readonly AnyEvent[];
  createdAt: string;
  lastEventAt?: string;
  eventCount: number;
  workflowName?: string;
}

/**
 * Convert SessionMetadata + events to API response format.
 */
function toResponse(
  session: SessionMetadata,
  events: readonly AnyEvent[],
): SessionDetailResponse {
  return {
    id: session.id,
    events,
    createdAt: session.createdAt.toISOString(),
    lastEventAt: session.lastEventAt?.toISOString(),
    eventCount: session.eventCount,
    workflowName: session.workflowName,
  };
}

/**
 * Route params type for Next.js 15+ dynamic routes.
 */
type RouteParams = {
  id: string;
};

/**
 * GET /api/sessions/[id]
 *
 * Returns a specific session with all its events for replay.
 * Returns 404 if session not found.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<RouteParams> },
): Promise<NextResponse<SessionDetailResponse | { error: string }>> {
  try {
    const { id } = await params;
    const store = await getStore();

    // Get all sessions to find metadata
    const sessions = await store.sessions();
    const sessionMeta = sessions.find((s) => s.id === id);

    if (!sessionMeta) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Get events for this session
    const events = await store.events(makeSessionId(id));

    // Convert to response format
    const response = toResponse(sessionMeta, events);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch session:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 },
    );
  }
}
