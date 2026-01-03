import type { CompiledFlow } from "./compiler.js";
import type { RunSnapshot } from "./snapshot.js";

/**
 * Scheduler determines which nodes are ready to execute next.
 */
export interface Scheduler {
  /**
   * Return the ids of nodes ready to execute.
   * @param state - Current run snapshot.
   * @param graph - Compiled flow graph.
   * @returns List of node ids.
   */
  nextReadyNodes(state: RunSnapshot, graph: CompiledFlow): string[];
}

/** Default scheduler implementation. */
export declare class DefaultScheduler implements Scheduler {
  /**
   * Return the ids of nodes ready to execute.
   * @param state - Current run snapshot.
   * @param graph - Compiled flow graph.
   * @returns List of node ids.
   */
  nextReadyNodes(state: RunSnapshot, graph: CompiledFlow): string[];
}
