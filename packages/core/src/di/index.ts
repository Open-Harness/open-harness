/**
 * DI Exports
 *
 * @module @openharness/core/di
 */

// Re-export Container from needle-di for convenience
export { Container, InjectionToken, inject, injectable } from "@needle-di/core";
// Types
export type { IConfig, IContainer } from "./tokens.js";
// Core tokens
export {
	IAgentRunnerToken,
	IConfigToken,
	IEventBusToken,
} from "./tokens.js";
