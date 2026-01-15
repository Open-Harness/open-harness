/**
 * @open-harness/testing
 *
 * v0.3.0: Legacy testing utilities deleted.
 *
 * Old utilities (MockRuntime, runtimeContract, etc.) were for the
 * v0.2.0 graph-based architecture. v0.3.0 uses signal-based providers.
 *
 * For testing signal-based code:
 * - Use MemorySignalStore from @open-harness/core to record signals
 * - Use Player from @internal/signals for replay testing
 * - Mock providers by implementing the Provider interface
 *
 * Future: Signal-native test utilities will be added here.
 */

// Re-export core testing types for convenience
// Import from @internal/signals for development (exports source files for tsc resolution)
export { MemorySignalStore, Player, type SignalStore } from "@internal/signals";
