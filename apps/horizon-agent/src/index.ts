/**
 * Horizon Agent
 *
 * Multi-agent implementation system with:
 * - Planner: Breaks features into tasks
 * - Coder: Implements each task
 * - Reviewer: Reviews and provides feedback
 *
 * Uses loop edges for controlled coder↔reviewer cycles.
 */

export { createHorizonServer } from "./server.js";
export type { HorizonServerConfig } from "./server.js";
