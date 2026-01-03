import type { CompiledFlow } from "./compiler.js";
import type { RunSnapshot } from "./snapshot.js";

export interface Scheduler {
  nextReadyNodes(state: RunSnapshot, graph: CompiledFlow): string[];
}

export declare class DefaultScheduler implements Scheduler {
  nextReadyNodes(state: RunSnapshot, graph: CompiledFlow): string[];
}
