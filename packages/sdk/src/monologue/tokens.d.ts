/**
 * Monologue System DI Tokens
 *
 * Injection tokens for the monologue system.
 * These enable dependency injection and mock replacement in tests.
 *
 * @module monologue/tokens
 */
import { InjectionToken } from "@needle-di/core";
import type { IMonologueLLM, IMonologueService, MonologueConfig } from "./types.js";
/**
 * Token for IMonologueLLM implementation.
 *
 * Production: AnthropicMonologueLLM (uses @anthropic-ai/sdk)
 * Testing: MockMonologueLLM (returns canned responses)
 */
export declare const IMonologueLLMToken: InjectionToken<IMonologueLLM>;
/**
 * Token for IMonologueService implementation.
 *
 * The core service that buffers events, manages history, and coordinates
 * with the LLM to generate narratives.
 */
export declare const IMonologueServiceToken: InjectionToken<IMonologueService>;
/**
 * Token for default MonologueConfig.
 *
 * Provides the default configuration that can be overridden per-scope
 * via the @Monologue decorator options.
 */
export declare const IMonologueConfigToken: InjectionToken<MonologueConfig>;
