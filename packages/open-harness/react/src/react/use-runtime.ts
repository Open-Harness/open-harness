import type { Runtime, RuntimeEvent } from "@open-harness/core";
import { useEffect, useState } from "react";

export interface UseRuntimeReturn {
	events: RuntimeEvent[];
	dispatch: Runtime["dispatch"];
	run: Runtime["run"];
	pause: Runtime["pause"];
	resume: Runtime["resume"];
	stop: Runtime["stop"];
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
		pause: runtime.pause.bind(runtime),
		resume: runtime.resume.bind(runtime),
		stop: runtime.stop.bind(runtime),
	};
}
