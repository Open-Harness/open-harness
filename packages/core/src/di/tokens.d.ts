/**
 * Core Injection Tokens
 *
 * These tokens define the core abstractions that can be injected.
 * Provider-specific tokens belong in their respective packages.
 *
 * @module @openharness/core/di/tokens
 */
import { InjectionToken } from "@needle-di/core";
import type { IEventBus } from "../events/types.js";
import type { IAgentRunner } from "../interfaces/agent.js";
/**
 * Core configuration interface.
 */
export interface IConfig {
    /** Whether running in replay mode (for testing) */
    isReplayMode: boolean;
    /** Directory for recordings storage */
    recordingsDir: string;
}
export declare const IConfigToken: InjectionToken<IConfig>;
/**
 * Token for the primary agent runner.
 * In production, this resolves to the configured provider's runner.
 */
export declare const IAgentRunnerToken: InjectionToken<IAgentRunner<import("@openharness/sdk").RunnerOptions, import("../index.js").AgentResult<unknown>>>;
/**
 * Token for the event bus.
 */
export declare const IEventBusToken: InjectionToken<IEventBus>;
/**
 * Interface for DI container.
 * Allows retrieving services by their injection token.
 */
export interface IContainer {
    get<T>(token: InjectionToken<T>): T;
}
