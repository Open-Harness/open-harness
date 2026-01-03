import type { RuntimeCommand, RuntimeStatus } from "../core/events.js";

export type NodeStatus = "pending" | "running" | "done" | "failed";
export type EdgeStatus = "pending" | "fired" | "skipped";

export type RunSnapshot = {
  status: RuntimeStatus;
  outputs: Record<string, unknown>;
  state: Record<string, unknown>;
  nodeStatus: Record<string, NodeStatus>;
  edgeStatus: Record<string, EdgeStatus>;
  loopCounters: Record<string, number>;
  inbox: RuntimeCommand[];
};

export type RunState = RunSnapshot & {
  runId?: string;
};
