/**
 * @openharness/channels
 *
 * Channel implementations for the Open Harness SDK.
 *
 * Channels are event consumers built with defineChannel pattern:
 * - State management for rendering state
 * - Pattern matching for event filtering
 * - Lifecycle hooks for setup/cleanup
 *
 * @example
 * ```typescript
 * import { defineHarness } from "@openharness/sdk";
 * import { consoleChannel, clackChannel } from "@openharness/channels";
 *
 * const harness = defineHarness({ ... })
 *   .attach(consoleChannel({ colors: true }))
 *   .attach(clackChannel({ showTasks: true }));
 *
 * await harness.run();
 * ```
 *
 * @module @openharness/channels
 */

// ============================================================================
// Console Channel
// ============================================================================

export { type ConsoleChannelOptions, consoleChannel } from "./console/index.js";

// ============================================================================
// Clack Channel
// ============================================================================

export { type ClackChannelOptions, clackChannel } from "./clack/index.js";
