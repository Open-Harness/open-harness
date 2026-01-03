import type { RuntimeCommand } from "./events.js";

export type StatePatch =
  | { op: "set"; path: string; value: unknown }
  | { op: "merge"; path: string; value: Record<string, unknown> };

export interface StateStore {
  get(path: string): unknown;
  set(path: string, value: unknown): void;
  patch(patch: StatePatch): void;
  snapshot(): Record<string, unknown>;
}

export interface CommandInbox {
  next(): RuntimeCommand | undefined;
  enqueue(command: RuntimeCommand): void;
}
