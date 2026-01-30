/**
 * @open-scaffold/client - Abstract client contract and HTTP implementation.
 *
 * @module
 */

// Contract
export type {
  ClientConfig,
  ConnectionStatus,
  ForkResult,
  PauseResult,
  ResumeResult,
  SessionInfo,
  StateAtResult,
  WorkflowClient
} from "./Contract.js"
export { ClientError } from "./Contract.js"

// HTTP Client
export { HttpClient } from "./HttpClient.js"

// React bindings (ADR-013 - re-export from react/index.ts)
export * from "./react/index.js"
