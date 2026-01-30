/**
 * WorkflowClientProvider - React context provider for workflow client configuration.
 *
 * Per ADR-013: Provides client configuration to the hooks layer.
 *
 * @module
 */

import type { ReactNode } from "react"
import { createContext, useContext, useMemo } from "react"

import type { WorkflowClient } from "../Contract.js"

/**
 * Context value containing workflow client configuration.
 */
export interface WorkflowClientContextValue {
  /** The workflow client instance */
  readonly client: WorkflowClient
  /** Base URL for SSE connections */
  readonly baseUrl: string
}

const WorkflowClientContext = createContext<WorkflowClientContextValue | null>(null)

/**
 * Props for WorkflowClientProvider.
 */
export interface WorkflowClientProviderProps {
  /** WorkflowClient instance */
  readonly client: WorkflowClient
  /** Base URL for SSE connections */
  readonly baseUrl: string
  /** Children to render */
  readonly children: ReactNode
}

/**
 * Provides workflow client configuration to hooks.
 * Must be wrapped with QueryClientProvider from @tanstack/react-query.
 *
 * @example
 * ```tsx
 * import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
 * import { WorkflowClientProvider, HttpClient } from '@open-scaffold/client'
 *
 * const queryClient = new QueryClient()
 * const client = HttpClient({ url: 'http://localhost:3000' })
 *
 * function App() {
 *   return (
 *     <QueryClientProvider client={queryClient}>
 *       <WorkflowClientProvider client={client} baseUrl="http://localhost:3000">
 *         <MyApp />
 *       </WorkflowClientProvider>
 *     </QueryClientProvider>
 *   )
 * }
 * ```
 */
export function WorkflowClientProvider({
  baseUrl,
  children,
  client
}: WorkflowClientProviderProps): JSX.Element {
  const value = useMemo(
    () => ({ client, baseUrl }),
    [client, baseUrl]
  )

  return (
    <WorkflowClientContext.Provider value={value}>
      {children}
    </WorkflowClientContext.Provider>
  )
}

/**
 * Access the workflow client from context.
 * Must be used within WorkflowClientProvider.
 *
 * @throws Error if used outside of WorkflowClientProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { client, baseUrl } = useWorkflowClient()
 *   // Use client for API calls, baseUrl for SSE subscriptions
 * }
 * ```
 */
export function useWorkflowClient(): WorkflowClientContextValue {
  const context = useContext(WorkflowClientContext)
  if (!context) {
    throw new Error("useWorkflowClient must be used within WorkflowClientProvider")
  }
  return context
}
