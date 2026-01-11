import type {
  CancelContext,
  CommandInbox,
  RuntimeEventPayload,
  StateStore,
} from "../state";

/**
 * Execution context passed to node implementations.
 */
export interface NodeRunContext {
  /** Node identifier for this execution. */
  nodeId: string;
  /** Unique run identifier for this node invocation. */
  runId: string;
  /** Emit runtime events for observability/UI updates. */
  emit: (event: RuntimeEventPayload) => void;
  /** Access and mutate shared workflow state. */
  state: StateStore;
  /** Read commands sent to this run (e.g., user replies). */
  inbox: CommandInbox;
  /** Read the stored agent session id for this node, if any. */
  getAgentSession: () => string | undefined;
  /** Persist the agent session id for this node. */
  setAgentSession: (sessionId: string) => void;
  /** Optional resume prompt injected for resumed nodes. */
  resumeMessage?: string;
  /** Cancellation context for mid-stream interruption. */
  cancel: CancelContext;
}

/**
 * Definition of a node type registered with the runtime.
 */
export interface NodeTypeDefinition<TIn, TOut> {
  /** Unique type id referenced by NodeDefinition.type. */
  type: string;
  /** Optional schema for input validation. */
  inputSchema?: unknown;
  /** Optional schema for output validation. */
  outputSchema?: unknown;
  /** Optional capability metadata for UI or runtime. */
  capabilities?: { streaming?: boolean; multiTurn?: boolean };
  /**
   * Execute the node.
   * @param ctx - Node run context.
   * @param input - Parsed node input.
   * @returns Node output.
   */
  run(ctx: NodeRunContext, input: TIn): Promise<TOut>;
}

/**
 * Registry for node type definitions.
 */
export interface NodeRegistry {
  /**
   * Register a node definition.
   * @param def - Node definition to register.
   */
  register<TIn, TOut>(def: NodeTypeDefinition<TIn, TOut>): void;
  /**
   * Resolve a node definition by type.
   * @param type - Node type id.
   * @returns Node definition.
   */
  get(type: string): NodeTypeDefinition<unknown, unknown>;
  /**
   * Check if a node type exists.
   * @param type - Node type id.
   * @returns True if registered.
   */
  has(type: string): boolean;
}

/**
 * Default in-memory registry implementation.
 */
export class DefaultNodeRegistry implements NodeRegistry {
  private readonly registry = new Map<
    string,
    NodeTypeDefinition<unknown, unknown>
  >();

  /**
   * Register a node definition.
   * @param def - Node definition to register.
   */
  register<TIn, TOut>(def: NodeTypeDefinition<TIn, TOut>): void {
    this.registry.set(def.type, def as NodeTypeDefinition<unknown, unknown>);
  }

  /**
   * Resolve a node definition by type.
   * @param type - Node type id.
   * @returns Node definition.
   */
  get(type: string): NodeTypeDefinition<unknown, unknown> {
    const def = this.registry.get(type);
    if (!def) {
      throw new Error(`Unknown node type: ${type}`);
    }
    return def;
  }

  /**
   * Check if a node type exists.
   * @param type - Node type id.
   * @returns True if registered.
   */
  has(type: string): boolean {
    return this.registry.has(type);
  }
}
