// Re-export internal server (except createClaudeNode which we wrap below)
export {
	// Claude types
	type ClaudeAgentExtendedOptions,
	type ClaudeAgentInput,
	type ClaudeAgentOutput,
	type ClaudeMessageInput,
	type ClaudeNodeOptions,
	claudeNode,
	// Middleware
	corsMiddleware,
	// API routes
	createAPIRoutes,
	createChatRoute,
	createCommandsRoute,
	createDefaultRegistry,
	createEventsRoute,
	createHarness,
	createHealthRoute,
	// Transports
	createLocalAIKitTransport,
	createPartTracker,
	createTemplateProvider,
	type EventsRouteOptions,
	errorHandler,
	type Harness,
	// Harness
	type HarnessOptions,
	type RunFlowOptions,
	registerStandardNodes,
	runFlow,
	type TemplateProviderInput,
	TemplateProviderInputSchema,
	type TemplateProviderOutput,
	TemplateProviderOutputSchema,
	// Template provider
	type TemplateSentiment,
	WebSocketTransport,
	type WebSocketTransportOptions,
} from "@internal/server";

export * from "@open-harness/run-store-sqlite";
export * from "./nodes/index";

// ============================================================================
// TYPED PROVIDER WRAPPER
// ============================================================================
// createClaudeNode returns NodeTypeDefinition<ClaudeAgentInput, ClaudeAgentOutput>
// but users expect it to work with setDefaultProvider() which wants Provider type.
// This wrapper provides the proper typing so users don't need ugly casts.

import { createClaudeNode as _createClaudeNode, type ClaudeNodeOptions } from "@internal/server";
import type { Provider } from "@open-harness/core";

/**
 * Create a Claude provider for use with `setDefaultProvider()` and `run()`.
 *
 * @example
 * ```typescript
 * import { setDefaultProvider } from "@open-harness/core";
 * import { createClaudeNode } from "@open-harness/server";
 *
 * setDefaultProvider(createClaudeNode());
 * ```
 */
export function createClaudeNode(options?: ClaudeNodeOptions): Provider {
	return _createClaudeNode(options) as Provider;
}
