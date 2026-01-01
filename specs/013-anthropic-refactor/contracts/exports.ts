/**
 * Package Exports Contract for @openharness/anthropic
 *
 * This file defines what is exported from each package entry point.
 * Implementation must match these exports exactly.
 *
 * Branch: 013-anthropic-refactor
 * Date: 2025-12-28
 */

// ============================================================================
// Main Entry Point: @openharness/anthropic
// ============================================================================

/**
 * Exports from "." (main index.ts)
 *
 * Framework primitives ONLY - no concrete agents.
 */
export const MAIN_EXPORTS = {
  // Factory function
  defineAnthropicAgent: "function",

  // Template utilities
  createPromptTemplate: "function",

  // Types (re-exports)
  // AnthropicAgentDefinition: "type",
  // PromptTemplate: "type",
  // AnthropicAgent: "type",
  // ExecuteOptions: "type",
  // StreamOptions: "type",
  // AgentHandle: "type",

  // Infrastructure (for advanced usage)
  AnthropicRunner: "class",
  ReplayRunner: "class",
  RecordingFactory: "class",
  Vault: "class",

  // Models
  zodToSdkSchema: "function",
  CodingResultSchema: "const",
  EventType: "enum",
  EventTypeConst: "const",

  // Monologue
  AnthropicMonologueLLM: "class",
} as const;

/**
 * NOT exported from main entry point:
 * - BaseAnthropicAgent (internal)
 * - CodingAgent (use presets)
 * - ReviewAgent (use presets)
 * - PlannerAgent (use presets)
 * - ParserAgent (use presets)
 * - ValidationReviewAgent (use presets)
 * - InternalAnthropicAgent (internal)
 */

// ============================================================================
// Presets Entry Point: @openharness/anthropic/presets
// ============================================================================

/**
 * Exports from "./presets"
 *
 * Pre-configured agent instances ready to use.
 */
export const PRESETS_EXPORTS = {
  // Pre-configured agents
  CodingAgent: "AnthropicAgent<CodingInput, CodingOutput>",
  ReviewAgent: "AnthropicAgent<ReviewInput, ReviewOutput>",
  PlannerAgent: "AnthropicAgent<PlannerInput, PlannerOutput>",

  // Preset schemas (for customization)
  CodingInputSchema: "ZodType",
  CodingOutputSchema: "ZodType",
  ReviewInputSchema: "ZodType",
  ReviewOutputSchema: "ZodType",
  PlannerInputSchema: "ZodType",
  PlannerOutputSchema: "ZodType",

  // Preset prompt templates (for override)
  codingPromptTemplate: "PromptTemplate",
  reviewPromptTemplate: "PromptTemplate",
  plannerPromptTemplate: "PromptTemplate",
} as const;

// ============================================================================
// Package.json exports field
// ============================================================================

/**
 * Required package.json exports configuration.
 */
export const PACKAGE_EXPORTS = {
  ".": {
    import: "./dist/index.js",
    types: "./dist/index.d.ts",
  },
  "./presets": {
    import: "./dist/presets/index.js",
    types: "./dist/presets/index.d.ts",
  },
  // Deprecated - kept for backward compatibility with warning
  "./agents": {
    import: "./dist/agents/index.js",
    types: "./dist/agents/index.d.ts",
  },
  "./runner": {
    import: "./dist/infra/runner/index.js",
    types: "./dist/infra/runner/index.d.ts",
  },
  "./recording": {
    import: "./dist/infra/recording/index.js",
    types: "./dist/infra/recording/index.d.ts",
  },
} as const;

// ============================================================================
// Deprecation Notices
// ============================================================================

/**
 * Deprecated exports with migration paths.
 */
export const DEPRECATED_EXPORTS = {
  BaseAnthropicAgent: {
    deprecatedIn: "0.2.0",
    removedIn: "2.0.0",
    replacement: "defineAnthropicAgent()",
    message:
      "BaseAnthropicAgent is deprecated. Use defineAnthropicAgent() factory instead.",
  },
  IEventBus: {
    deprecatedIn: "0.2.0",
    removedIn: "2.0.0",
    replacement: "IUnifiedEventBus",
    message:
      "IEventBus is deprecated. Use IUnifiedEventBus instead. See docs/deprecation-schedule.md.",
  },
  IEventBusToken: {
    deprecatedIn: "0.2.0",
    removedIn: "2.0.0",
    replacement: "IUnifiedEventBusToken",
    message:
      "IEventBusToken is deprecated. Use IUnifiedEventBusToken instead.",
  },
  PromptRegistry: {
    deprecatedIn: "0.2.0",
    removedIn: "2.0.0",
    replacement: "createPromptTemplate()",
    message:
      "PromptRegistry with Bun.file() is deprecated. Use TypeScript prompt templates with createPromptTemplate() instead.",
  },
} as const;
