import type { Runtime, RuntimeEvent } from "@open-harness/core";
import { useEffect, useState } from "react";

export interface UseRuntimeReturn {
	events: RuntimeEvent[];
	dispatch: Runtime["dispatch"];
	run: Runtime["run"];
}

export function useRuntime(runtime: Runtime): UseRuntimeReturn {
	const [events, setEvents] = useState<RuntimeEvent[]>([]);

	useEffect(() => {
		const unsubscribe = runtime.onEvent((event: RuntimeEvent) => {
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
