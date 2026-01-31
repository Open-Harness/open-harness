/**
 * open-harness/server - HTTP/SSE server and Anthropic provider.
 *
 * @example
 * ```typescript
 * import { OpenScaffold, AnthropicProvider } from "open-harness/server"
 *
 * const server = OpenScaffold.create({
 *   database: ":memory:",
 *   provider: AnthropicProvider.make()
 * })
 *
 * await server.start()
 * ```
 *
 * @module
 */

export * from "@open-scaffold/server"
