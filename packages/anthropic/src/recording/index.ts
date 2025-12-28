/**
 * Recording System - Record and replay LLM sessions for testing
 *
 * This module provides:
 * - ReplayRunner: Replays recorded sessions
 * - RecordingFactory: Creates recorders for session capture
 * - Vault: Storage for recorded sessions
 * - @Record: Decorator for automatic recording
 */

// Types
export type { IRecorder, IRecordingFactory, IVault, IVaultSession, RecordedSession } from "./types.js";

// Classes
export { ReplayRunner } from "./replay-runner.js";
export { Recorder, RecordingFactory } from "./recording-factory.js";
export { Vault } from "./vault.js";

// Decorators
export { Record, setDecoratorContainer, setRecordingFactoryToken, type IContainer } from "./decorators.js";
