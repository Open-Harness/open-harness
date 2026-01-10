/**
 * @open-harness/server
 *
 * v0.3.0: Most legacy server code deleted.
 *
 * Deleted exports:
 * - Claude agent/node types (use ClaudeProvider from @open-harness/core)
 * - Old API routes (createChatRoute, createCommandsRoute, createEventsRoute, createAPIRoutes)
 * - Old transports (createLocalAIKitTransport, WebSocketTransport)
 * - Old harness (createHarness, runFlow, registerStandardNodes)
 * - Old template provider
 * - Old nodes (echoNode, constantNode)
 *
 * Remaining exports:
 * - createHealthRoute - stateless health check route
 * - corsMiddleware - Hono CORS middleware
 * - errorHandler - Hono error handling middleware
 *
 * For v0.3.0 server patterns:
 * - Use ClaudeProvider/CodexProvider from @open-harness/core
 * - Use SignalBus for event routing
 * - Build custom Hono routes that consume Provider signals
 */

export { createHealthRoute, corsMiddleware, errorHandler } from "@internal/server";
