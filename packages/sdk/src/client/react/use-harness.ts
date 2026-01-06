import type { RuntimeCommand, RuntimeEvent } from "@internal/state";
import { RemoteAIKitTransport } from "@internal/transports-remote";
import { useEffect, useState } from "react";

export interface UseHarnessOptions {
  serverUrl?: string;
  transport?: RemoteAIKitTransport;
  /**
   * Whether the hook should initialize immediately.
   * @default true
   */
  autoConnect?: boolean;
}

export interface UseHarnessReturn {
  events: RuntimeEvent[];
  status: "idle" | "running" | "paused" | "complete";
  sendMessage: (message: string) => Promise<void>;
  sendCommand: (command: RuntimeCommand) => Promise<void>;
  isConnected: boolean;
  error?: Error;
}

export function useHarness(options: UseHarnessOptions = {}): UseHarnessReturn {
  const [events, setEvents] = useState<RuntimeEvent[]>([]);
  const [status, setStatus] = useState<
    "idle" | "running" | "paused" | "complete"
  >("idle");
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  const _transport =
    options.transport ??
    new RemoteAIKitTransport({
      serverUrl: options.serverUrl ?? "http://localhost:3000",
    });

  useEffect(() => {
    const autoConnect = options.autoConnect ?? true;
    if (!autoConnect) return;

    try {
      setIsConnected(true);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsConnected(false);
    }
  }, [options.autoConnect]);

  useEffect(() => {
    const lastEvent = events[events.length - 1];
    if (!lastEvent) return;

    if (lastEvent.type === "flow:start") setStatus("running");
    if (lastEvent.type === "flow:complete") setStatus("complete");
    if (lastEvent.type === "flow:paused") setStatus("paused");
    if (lastEvent.type === "flow:aborted") setStatus("idle");
  }, [events]);

  const sendMessage = async (_message: string) => {
    // NOTE: transport.sendMessages returns a stream and expects the caller to consume it.
    // This hook will be expanded once a standard pattern for remote session lifecycle exists.
    throw new Error("sendMessage not yet implemented - use transport directly");
  };

  const sendCommand = async (_command: RuntimeCommand) => {
    throw new Error(
      "sendCommand not yet implemented - use HTTPSSEClient directly",
    );
  };

  void _transport;
  void setEvents;

  return {
    events,
    status,
    sendMessage,
    sendCommand,
    isConnected,
    error,
  };
}
