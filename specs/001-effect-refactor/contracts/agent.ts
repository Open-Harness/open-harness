/**
 * Agent Contracts - Public API Types
 *
 * These interfaces define the public API surface for Agents.
 * Agents are AI actors that activate on specific events.
 *
 * @module @core-v2/agent
 */

import type { Event, AnyEvent } from "./event";

/**
 * Prompt template that can include dynamic content.
 */
export type PromptTemplate = string | PromptPart[];

/**
 * Part of a prompt template.
 */
export interface PromptPart {
  readonly type: "text" | "variable";
  readonly content: string;
}

/**
 * Agent definition - the AI actor that responds to events.
 *
 * @typeParam S - The workflow state type
 * @typeParam O - The structured output type from outputSchema
 *
 * @remarks
 * Agents declare:
 * - `activatesOn`: Which events trigger this agent
 * - `emits`: Which event types this agent can produce
 * - `prompt`: How to generate the LLM prompt
 * - `outputSchema`: REQUIRED - The structured output schema (using Zod)
 *
 * **CRITICAL**: Every agent MUST have an `outputSchema`. This is non-negotiable
 * for reliable workflow state. The runtime converts Zod to JSON Schema and passes
 * to the SDK as `outputFormat: { type: "json_schema", schema }`.
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 *
 * const ResearchOutput = z.object({
 *   findings: z.array(z.string()),
 *   confidence: z.number(),
 * });
 *
 * const researcher: Agent<ChatState, z.infer<typeof ResearchOutput>> = {
 *   name: "researcher",
 *   activatesOn: ["task:research-requested"],
 *   emits: ["agent:started", "text:delta", "research:complete", "agent:completed"],
 *
 *   // REQUIRED: Every agent must define its output structure
 *   outputSchema: ResearchOutput,
 *
 *   prompt: (state, event) => `
 *     You are a research assistant. Research: ${event.payload.topic}
 *   `,
 *
 *   // Transform structured output to events
 *   onOutput: (output, event) => [{
 *     id: crypto.randomUUID(),
 *     name: "research:complete",
 *     payload: { findings: output.findings, confidence: output.confidence },
 *     timestamp: new Date(),
 *     causedBy: event.id,
 *   }],
 *
 *   when: (state) => state.activeAgent === undefined,
 * };
 * ```
 */
export interface Agent<S = unknown, O = unknown> {
  /** Unique agent identifier */
  readonly name: string;

  /** Event names that trigger this agent */
  readonly activatesOn: readonly string[];

  /** Event types this agent can produce */
  readonly emits: readonly string[];

  /** Optional LLM model override */
  readonly model?: string;

  /**
   * Generate the LLM prompt from current state and triggering event.
   *
   * @param state - Current workflow state
   * @param event - The event that triggered this agent
   * @returns Prompt string or template
   */
  prompt: (state: S, event: AnyEvent) => PromptTemplate;

  /**
   * Optional guard condition - agent only activates if this returns true.
   *
   * @param state - Current workflow state
   * @returns Whether the agent should activate
   */
  when?: (state: S) => boolean;

  /**
   * REQUIRED: Structured output schema using Zod.
   *
   * Every agent MUST define what the LLM should output. This ensures:
   * 1. Reliable workflow state (no parsing failures)
   * 2. Type-safe event emission via onOutput
   * 3. Deterministic replay
   *
   * The runtime converts to JSON Schema and passes to the SDK as
   * `outputFormat: { type: "json_schema", schema }`.
   */
  outputSchema: unknown; // z.ZodType at runtime

  /**
   * Transform structured output to events.
   *
   * @param output - The parsed structured output (matches outputSchema)
   * @param event - The triggering event (for causedBy linking)
   * @returns Events to emit
   */
  onOutput: (output: O, event: AnyEvent) => AnyEvent[];
}

/**
 * Agent registry - maps agent names to agents.
 */
export type AgentRegistry<S> = ReadonlyMap<string, Agent<S, unknown>>;

// ============================================================================
// Agent Factory Types
// ============================================================================

/**
 * Options for `agent()` factory function.
 *
 * @remarks
 * Both `outputSchema` and `onOutput` are REQUIRED. Every agent must
 * define structured output for reliable workflow state.
 */
export interface AgentOptions<S, O = unknown> {
  /** Unique agent name */
  readonly name: string;
  /** Event names that trigger this agent */
  readonly activatesOn: readonly string[];
  /** Event types this agent can produce */
  readonly emits: readonly string[];
  /** LLM model override */
  readonly model?: string;
  /** Prompt generator */
  readonly prompt: (state: S, event: AnyEvent) => PromptTemplate;
  /** Guard condition */
  readonly when?: (state: S) => boolean;
  /** REQUIRED: Structured output schema using Zod */
  readonly outputSchema: unknown;
  /** REQUIRED: Transform structured output to events */
  readonly onOutput: (output: O, event: AnyEvent) => AnyEvent[];
}
