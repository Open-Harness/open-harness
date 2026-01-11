/**
 * @open-harness/react
 *
 * v0.3.0: Legacy React hooks deleted.
 *
 * Old hooks (useRuntime, useHarness) were for the v0.2.0 graph-based
 * Runtime architecture. v0.3.0 uses signal-based providers.
 *
 * For React integration with signals:
 * - Use SignalBus.subscribe() in useEffect
 * - Use MemorySignalStore for state snapshots
 *
 * Future: Signal-native React hooks will be added here:
 * - useSignalBus() - subscribe to signal streams
 * - useProvider() - run a provider and track its state
 * - useRecording() - replay recorded signal streams
 */

// Re-export core signal types for convenience
export { type ISignalBus, type Signal, SignalBus } from "@open-harness/core";
