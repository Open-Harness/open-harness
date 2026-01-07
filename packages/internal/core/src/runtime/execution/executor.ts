import type { NodeDefinition } from "../../state/index.js";
import type { NodeRegistry, NodeRunContext } from "../../nodes/index.js";
import {
  ExecutionError,
  type ExecutionResult,
  wrapExecutionThrowAsync,
} from "./errors.js";

/**
 * Result of a node execution.
 *
 * @property {string} nodeId - Node id.
 * @property {string} runId - Run id for this invocation.
 * @property {unknown} [output] - Output payload.
 * @property {string} [error] - Error string, if failed.
 */
export interface NodeExecutionResult {
  nodeId: string;
  runId: string;
  output?: unknown;
  error?: string;
}

/**
 * Executor context for a single node run.
 *
 * @property {NodeRegistry} registry - Node registry.
 * @property {NodeDefinition} node - Node definition.
 * @property {NodeRunContext} runContext - Node execution context.
 * @property {Record<string, unknown>} input - Resolved input payload.
 */
export interface ExecutorContext {
  registry: NodeRegistry;
  node: NodeDefinition;
  runContext: NodeRunContext;
  input: Record<string, unknown>;
}

/**
 * Node executor interface.
 */
export interface Executor {
  /**
   * Execute a node with the provided context.
   * @param context - Execution context.
   * @returns Execution result.
   */
  runNode(context: ExecutorContext): Promise<NodeExecutionResult>;
}

/** Default executor implementation. */
export class DefaultExecutor implements Executor {
  /**
   * Execute a node with the provided context.
   * @param context - Execution context.
   * @returns Execution result.
   */
  async runNode(context: ExecutorContext): Promise<NodeExecutionResult> {
    const { registry, node, runContext, input } = context;
    const def = registry.get(node.type);

    const maxAttempts = node.policy?.retry?.maxAttempts ?? 1;
    const backoffMs = node.policy?.retry?.backoffMs ?? 0;
    const timeoutMs = node.policy?.timeoutMs;

    let attempt = 0;
    let lastError: unknown = null;

    while (attempt < maxAttempts) {
      attempt += 1;
      if (runContext.cancel.cancelled) {
        return {
          nodeId: node.id,
          runId: runContext.runId,
          error: `Cancelled: ${runContext.cancel.reason ?? "unknown"}`,
        };
      }
      try {
        const parsedInput = parseWithSchema(def.inputSchema, input);
        const output = await withTimeout(
          () => def.run(runContext, parsedInput),
          timeoutMs,
        );
        const parsedOutput = parseWithSchema(def.outputSchema, output);
        return {
          nodeId: node.id,
          runId: runContext.runId,
          output: parsedOutput,
        };
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          await delay(backoffMs);
        }
      }
    }

    return {
      nodeId: node.id,
      runId: runContext.runId,
      error: errorMessage(lastError),
    };
  }

  /**
   * Internal Result-based executor (returns Result<NodeExecutionResult, ExecutionError>).
   * Used internally for error handling patterns.
   *
   * @param context - Execution context
   * @returns Result containing execution result or ExecutionError
   * @internal
   */
  async runNodeResult(
    context: ExecutorContext,
  ): Promise<ExecutionResult<NodeExecutionResult>> {
    const { registry, node, runContext, input } = context;
    const def = registry.get(node.type);

    if (!def) {
      return {
        isOk: () => false,
        isErr: () => true,
        error: new ExecutionError(
          "NODE_NOT_FOUND",
          `Node type "${node.type}" not found in registry`,
          undefined,
          node.id,
          runContext.runId,
        ),
      } as ExecutionResult<NodeExecutionResult>;
    }

    const maxAttempts = node.policy?.retry?.maxAttempts ?? 1;
    const backoffMs = node.policy?.retry?.backoffMs ?? 0;
    const timeoutMs = node.policy?.timeoutMs;

    let attempt = 0;
    let lastError: ExecutionError | undefined = undefined;

    while (attempt < maxAttempts) {
      attempt += 1;
      if (runContext.cancel.cancelled) {
        return {
          isOk: () => false,
          isErr: () => true,
          error: new ExecutionError(
            "CANCELLED",
            `Cancelled: ${runContext.cancel.reason ?? "unknown"}`,
            undefined,
            node.id,
            runContext.runId,
          ),
        } as ExecutionResult<NodeExecutionResult>;
      }

      const result = await wrapExecutionThrowAsync(
        "EXECUTION_FAILED",
        async () => {
          const parsedInput = parseWithSchema(def.inputSchema, input);
          const output = await withTimeout(
            () => def.run(runContext, parsedInput),
            timeoutMs,
          );
          return parseWithSchema(def.outputSchema, output);
        },
        node.id,
        runContext.runId,
      );

      if (result.isOk()) {
        return {
          isOk: () => true,
          isErr: () => false,
          value: {
            nodeId: node.id,
            runId: runContext.runId,
            output: result.value,
          },
        } as ExecutionResult<NodeExecutionResult>;
      }

      lastError = result.error;
      if (attempt < maxAttempts) {
        await delay(backoffMs);
      }
    }

    return {
      isOk: () => false,
      isErr: () => true,
      error:
        lastError ||
        new ExecutionError(
          "EXECUTION_FAILED",
          "Execution failed",
          undefined,
          node.id,
          runContext.runId,
        ),
    } as ExecutionResult<NodeExecutionResult>;
  }
}

function parseWithSchema<T>(schema: unknown, value: T): T {
  if (schema && typeof schema === "object" && "parse" in schema) {
    return (schema as { parse: (input: unknown) => T }).parse(value);
  }
  return value;
}

/**
 * Wait for a duration in milliseconds.
 * @param ms - Delay duration.
 */
async function delay(ms: number): Promise<void> {
  if (!ms || ms <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Run a promise with an optional timeout.
 * @param run - Async function to execute.
 * @param timeoutMs - Timeout duration in milliseconds.
 * @returns Resolved value of the promise.
 */
async function withTimeout<T>(
  run: () => Promise<T>,
  timeoutMs?: number,
): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) {
    return await run();
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Node execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([run(), timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Normalize an unknown error into a string message.
 * @param error - Error to normalize.
 * @returns Error message.
 */
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
