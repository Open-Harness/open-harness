import type { Query } from "@anthropic-ai/claude-agent-sdk";

export type CancelReason = "pause" | "abort" | "timeout";

export interface CancelContext {
  readonly signal: AbortSignal;
  readonly reason: CancelReason | undefined;
  readonly cancelled: boolean;

  interrupt(): Promise<void>;
  abort(): void;
  throwIfCancelled(): void;
  onCancel(callback: () => void | Promise<void>): () => void;
}

export interface CancelContextInternal extends CancelContext {
  __setQuery(query: Query): void;
  __controller: AbortController;
}
