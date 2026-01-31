/**
 * open-harness/client - HTTP client and React bindings.
 *
 * @example
 * ```typescript
 * import { HttpClient, useWorkflow } from "open-harness/client"
 *
 * const client = new HttpClient({ baseUrl: "http://localhost:3000" })
 *
 * // React hooks
 * function MyComponent() {
 *   const { state, events } = useWorkflow(client, sessionId)
 *   return <div>{state.output}</div>
 * }
 * ```
 *
 * @module
 */

export * from "@open-scaffold/client"
