/**
 * Agent exports for the PRD workflow
 *
 * This module exports pre-configured agents using the declarative
 * defineAgent pattern with Zod schemas for structured outputs.
 *
 * Each agent has:
 * - Agent definition (*.agent.ts) - minimal, declarative config
 * - Prompt function (*.prompt.ts) - extracted for testability
 */

export { plannerAgent } from "./planner.agent.js";
export { createPlannerPrompt, type PlannerPromptContext } from "./planner.prompt.js";
