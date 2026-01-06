import { useEffect, useState } from "react";
import type { RuntimeEvent } from "../../core/events.js";
import type { Runtime } from "../../runtime/runtime.js";

export interface UseRuntimeReturn {
  events: RuntimeEvent[];
  dispatch: Runtime["dispatch"];
  run: Runtime["run"];
}

export function useRuntime(runtime: Runtime): UseRuntimeReturn {
  const [events, setEvents] = useState<RuntimeEvent[]>([]);

  useEffect(() => {
    const unsubscribe = runtime.onEvent((event) => {
      setEvents((prev) => [...prev, event]);
    });

    return unsubscribe;
  }, [runtime]);

  return {
    events,
    dispatch: runtime.dispatch.bind(runtime),
    run: runtime.run.bind(runtime),
  };
}
