/**
 * @open-scaffold/client - React bindings for workflows.
 *
 * @module
 */

// Context
export type { WorkflowContextValue } from "./context.js"
export { WorkflowContext } from "./context.js"

// Provider
export type { WorkflowProviderProps } from "./Provider.js"
export { WorkflowProvider } from "./Provider.js"

// Hooks
export type { UseFilteredEventsOptions, UseStateAtResult } from "./hooks.js"
export {
  useConnectSession,
  useCreateSession,
  useDisconnect,
  useEvents,
  useFilteredEvents,
  useIsConnected,
  usePosition,
  useSendInput,
  useSessionId,
  useStateAt,
  useStatus,
  useWorkflowState
} from "./hooks.js"
