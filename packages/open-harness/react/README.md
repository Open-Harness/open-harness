---
lastUpdated: "2026-01-10T10:11:36.649Z"
lastCommit: "150d2ad147832f2553c0dbfb779f1a466c0a001b"
lastCommitDate: "2026-01-10T09:55:26Z"
---
# @open-harness/react

React bindings for Open Harness signal-based architecture.

## Status: Stub Package

This package is a placeholder for future React hooks. The v0.2.0 hooks (`useRuntime`, `useHarness`) were deleted as part of the v0.3.0 migration to signal-based providers.

## Current Exports

```typescript
import { SignalBus, type ISignalBus, type Signal } from "@open-harness/react";
```

Re-exports core signal types for convenience.

## Using Signals in React (v0.3.0)

Until signal-native hooks are implemented, use `SignalBus` directly:

```typescript
import { useEffect, useState } from "react";
import { SignalBus } from "@open-harness/react";

function useSignals(bus: SignalBus, pattern: string) {
  const [signals, setSignals] = useState<Signal[]>([]);

  useEffect(() => {
    return bus.subscribe([pattern], (signal) => {
      setSignals((prev) => [...prev, signal]);
    });
  }, [bus, pattern]);

  return signals;
}
```

## Planned Future Hooks

- `useSignalBus()` - Subscribe to signal streams with automatic cleanup
- `useProvider()` - Run a provider and track its streaming state
- `useRecording()` - Replay recorded signal streams
- `useHarnessResult()` - Track harness execution state

## See Also

- [@open-harness/core](../core/README.md) - Core API and providers
- [Examples](../../../examples/) - Usage patterns
