/**
 * Server-side programs - composable business logic for the server package.
 *
 * These programs use Effect services (Context.Tag) and are specific to
 * server-side operations (session management, event observation, recording).
 *
 * @module
 */

// Session management
export { type ForkResult, forkSession } from "./forkSession.js"
export { type LoadedSession, loadSession } from "./loadSession.js"
export { type ResumeConfig, resumeSession } from "./resumeSession.js"

// Observation
export { observeEvents, type ObserveEventsOptions } from "./observeEvents.js"

// Recording
export { recordEvent } from "./recordEvent.js"

// Workflow tape
export { loadWorkflowTape } from "./loadWorkflowTape.js"
