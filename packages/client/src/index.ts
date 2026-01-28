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
// Reconnection
export { sseReconnectSchedule } from "./Reconnect.js"
// SSE
export type { ParsedSSEMessage } from "./SSE.js"
export { createSSEStream, parseSSEMessage } from "./SSE.js"

// React bindings
export type { WorkflowContextValue } from "./react/context.js"
export { WorkflowContext } from "./react/context.js"
export type { PendingInteraction, UseFilteredEventsOptions, UseStateAtResult } from "./react/hooks.js"
export {
  useConnectSession,
  useCreateSession,
  useDisconnect,
  useEvents,
  useFilteredEvents,
  useFork,
  useIsConnected,
  useIsPaused,
  useIsRunning,
  usePause,
  usePendingInteraction,
  usePendingInteractions,
  usePosition,
  useResume,
  useSendInput,
  useSessionId,
  useStateAt,
  useStatus,
  useWorkflowState
} from "./react/hooks.js"
export type { WorkflowProviderProps } from "./react/Provider.js"
export { WorkflowProvider } from "./react/Provider.js"
