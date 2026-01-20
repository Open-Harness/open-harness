/**
 * Handler Module Public API
 *
 * Re-exports handler types and factories for consumer use.
 * Handlers are pure functions that react to events and update state.
 *
 * @module @core-v2/handler
 */

// Types
export type { DefineHandlerOptions, Handler, HandlerDefinition, HandlerResult } from "./Handler.js";

// Factories and utilities
export { defineHandler, emit, emitEvent, stateOnly } from "./Handler.js";
