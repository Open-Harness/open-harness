/**
 * @internal/server
 *
 * v0.3.0: Most legacy server code deleted.
 *
 * Deleted:
 * - providers/ (claude, template, testing) - use @signals/provider-*
 * - transports/ (local, websocket, http-sse-server) - old Runtime-based
 * - harness/ - used old Runtime, NodeRegistry
 * - api/hono/{chat,commands,events} - used old Runtime
 *
 * Remaining:
 * - api/hono/health - stateless health check
 * - api/middleware/{cors,error-handler} - Hono middleware utilities
 *
 * For v0.3.0 server patterns:
 * - Use SignalBus from @signals/bus for event routing
 * - Use Provider generators from @signals/provider-*
 * - Build custom Hono routes that consume Provider signals
 */

export * from "./api/hono";
export * from "./api/middleware";
