/**
 * Open Harness SDK - API Routes
 *
 * Hono route creators for building HTTP endpoints.
 *
 * v0.3.0: Old routes (chat, commands, events) deleted.
 * These used the old Runtime interface. For v0.3.0:
 * - Use SignalBus from @open-harness/core for event routing
 * - Build custom Hono routes that interact with Provider generators
 */

export { createHealthRoute } from "./health";
