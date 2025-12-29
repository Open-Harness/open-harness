/**
 * Recording System - Record and replay LLM sessions for testing
 *
 * This module provides:
 * - ReplayRunner: Replays recorded sessions
 * - RecordingFactory: Creates recorders for session capture
 * - Vault: Storage for recorded sessions
 * - @Record: Decorator for automatic recording
 */
export { type IContainer, Record, setDecoratorContainer, setRecordingFactoryToken } from "./decorators.js";
export { Recorder, RecordingFactory } from "./recording-factory.js";
export { ReplayRunner } from "./replay-runner.js";
export type { IRecorder, IRecordingFactory, IVault, IVaultSession, RecordedSession } from "./types.js";
export { Vault } from "./vault.js";
