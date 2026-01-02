// Protocol: Errors
// Custom error classes for pause/resume functionality

/**
 * Thrown when attempting to resume a session that doesn't exist.
 */
export class SessionNotFoundError extends Error {
	readonly code = "SESSION_NOT_FOUND";

	constructor(sessionId: string) {
		super(`Session not found: ${sessionId}`);
		this.name = "SessionNotFoundError";
	}
}

/**
 * Thrown when attempting to resume a session that is already running.
 */
export class SessionAlreadyRunningError extends Error {
	readonly code = "SESSION_ALREADY_RUNNING";

	constructor(sessionId: string) {
		super(`Session is already running: ${sessionId}`);
		this.name = "SessionAlreadyRunningError";
	}
}
