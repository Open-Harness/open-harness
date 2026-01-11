import type { RuntimeCommand, RuntimeStatus } from "./events";

/** Status of a node execution within a run. */
export type NodeStatus = "pending" | "running" | "done" | "failed";

/** Status of an edge evaluation within a run. */
export type EdgeStatus = "pending" | "fired" | "skipped";

/**
 * Serializable snapshot of a runtime execution.
 *
 * @property {RuntimeStatus} status - Run lifecycle status.
 * @property {Record<string, unknown>} outputs - Node outputs keyed by node id.
 * @property {Record<string, unknown>} state - Workflow state snapshot.
 * @property {Record<string, NodeStatus>} nodeStatus - Node status map.
 * @property {Record<string, EdgeStatus>} edgeStatus - Edge status map.
 * @property {Record<string, number>} loopCounters - Loop counters by edge id.
 * @property {RuntimeCommand[]} inbox - Pending commands.
 * @property {Record<string, string>} agentSessions - Agent session ids by node id.
 */
export type RunSnapshot = {
  runId?: string;
  status: RuntimeStatus;
  outputs: Record<string, unknown>;
  state: Record<string, unknown>;
  nodeStatus: Record<string, NodeStatus>;
  edgeStatus: Record<string, EdgeStatus>;
  loopCounters: Record<string, number>;
  inbox: RuntimeCommand[];
  agentSessions: Record<string, string>;
};

/**
 * Internal runtime state. May include runtime-only fields.
 *
 * @property {string} [runId] - Optional runtime run id.
 */
export type RunState = RunSnapshot & {
  runId?: string;
};
