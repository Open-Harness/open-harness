import type { RuntimeEvent } from "../core/events.js";
import type { CommandInbox, StateStore } from "../core/state.js";

export interface NodeRunContext {
  runId: string;
  emit: (event: RuntimeEvent) => void;
  state: StateStore;
  inbox: CommandInbox;
}

export interface NodeTypeDefinition<TIn, TOut> {
  type: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  capabilities?: { streaming?: boolean; multiTurn?: boolean };
  run(ctx: NodeRunContext, input: TIn): Promise<TOut>;
}

export interface NodeRegistry {
  register<TIn, TOut>(def: NodeTypeDefinition<TIn, TOut>): void;
  get(type: string): NodeTypeDefinition<unknown, unknown>;
  has(type: string): boolean;
}

export declare class DefaultNodeRegistry implements NodeRegistry {
  register<TIn, TOut>(def: NodeTypeDefinition<TIn, TOut>): void;
  get(type: string): NodeTypeDefinition<unknown, unknown>;
  has(type: string): boolean;
}
