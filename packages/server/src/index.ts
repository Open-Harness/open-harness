/**
 * @open-harness/server - HTTP/SSE server for workflows.
 *
 * Public API exports only. For internal/advanced exports, use:
 * import { ... } from "@open-harness/server/internal"
 *
 * @module
 */

// Constants
export { DEFAULT_HOST, DEFAULT_PORT } from "./constants.js"

// Public API (no Effect knowledge required)
export { OpenScaffold, OpenScaffoldError } from "./OpenScaffold.js"

export type {
  OpenScaffoldConfig,
  OpenScaffoldServer,
  ProviderMode,
  ServerOptions,
  SessionInfo
} from "./OpenScaffold.js"

// Services
export { EventBusLive } from "./services/EventBusLive.js"

// Provider (Anthropic)
export type { AnthropicModel, AnthropicProviderConfig } from "./provider/Provider.js"
export { AnthropicProvider } from "./provider/Provider.js"
