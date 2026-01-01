// Protocol: Session
// Session lifecycle management for loop iterations and scoped agent runs

import { randomUUID } from "node:crypto";

/**
 * Session context for scoped agent runs.
 * Sessions provide isolation between loop iterations and concurrent agent runs.
 */
export interface SessionContext {
	/** Unique identifier for this session */
	sessionId: string;
	/** Parent session ID if this is a nested session */
	parentSessionId?: string;
	/** When the session was created */
	createdAt: Date;
	/** AbortController for session interruption */
	abortController: AbortController;
}

/**
 * Create a unique session ID.
 */
export function createSessionId(): string {
	return `session-${randomUUID().slice(0, 8)}`;
}

/**
 * Create a new session context, optionally inheriting from a parent.
 */
export function createSessionContext(parent?: SessionContext): SessionContext {
	return {
		sessionId: createSessionId(),
		parentSessionId: parent?.sessionId,
		createdAt: new Date(),
		abortController: new AbortController(),
	};
}

/**
 * Check if a session has been aborted.
 */
export function isSessionAborted(session: SessionContext): boolean {
	return session.abortController.signal.aborted;
}

/**
 * Abort a session and all operations within it.
 */
export function abortSession(session: SessionContext): void {
	session.abortController.abort();
}
