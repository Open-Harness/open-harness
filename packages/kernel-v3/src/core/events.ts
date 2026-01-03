import type { StatePatch } from "./state.js";

export type RuntimeStatus = "idle" | "running" | "paused" | "aborted" | "complete";

export type RuntimeCommand =
  | { type: "send"; message: string; runId?: string }
  | { type: "reply"; promptId: string; content: string }
  | { type: "abort"; resumable?: boolean; reason?: string }
  | { type: "resume"; message: string };

export type RuntimeEvent =
  | { type: "flow:start"; flowName: string }
  | { type: "flow:complete"; flowName: string; status: "complete" | "failed" }
  | { type: "node:start"; nodeId: string; runId: string }
  | { type: "node:complete"; nodeId: string; runId: string; output: unknown }
  | { type: "node:error"; nodeId: string; runId: string; error: string }
  | { type: "edge:fire"; edgeId?: string; from: string; to: string }
  | { type: "loop:iterate"; edgeId?: string; iteration: number }
  | { type: "state:patch"; patch: StatePatch }
  | { type: "command:received"; command: RuntimeCommand }
  | { type: "flow:paused" | "flow:resumed" | "flow:aborted" };

export type RuntimeEventListener = (
  event: RuntimeEvent,
) => void | Promise<void>;

export type Unsubscribe = () => void;
