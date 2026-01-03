import type { Attachment, Cleanup, EnrichedEvent, FlowRunResult, FlowYaml, NodeRegistry } from "@open-harness/kernel";
import { executeFlow, HubImpl } from "@open-harness/kernel";

type PhaseFn = <T>(name: string, fn: () => Promise<T>) => Promise<T>;
type TaskFn = <T>(id: string, fn: () => Promise<T>) => Promise<T>;

async function runCleanup(cleanup: Cleanup): Promise<void> {
	if (!cleanup) return;
	if (typeof cleanup === "function") {
		await Promise.resolve(cleanup());
	}
}

export async function runFlowRuntime(options: {
	flow: FlowYaml;
	registry: NodeRegistry;
	inputOverrides?: Record<string, unknown>;
	attachments?: Attachment[];
	sessionId?: string;
	startSession?: boolean;
}): Promise<FlowRunResult> {
	const sessionId = options.sessionId ?? `flow-${Date.now()}`;
	const hub = new HubImpl(sessionId);
	const events: EnrichedEvent[] = [];
	const cleanups: Cleanup[] = [];
	const start = Date.now();

	const unsubscribe = hub.subscribe("*", (event) => {
		events.push(event);
	});

	for (const attachment of options.attachments ?? []) {
		cleanups.push(attachment(hub));
	}

	if (options.startSession) {
		hub.startSession();
	}

	const phase: PhaseFn = async (name, fn) => {
		return hub.scoped({ phase: { name } }, async () => {
			hub.emit({ type: "phase:start", name });
			try {
				const result = await fn();
				hub.emit({ type: "phase:complete", name });
				return result;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				const stack = error instanceof Error ? error.stack : undefined;
				hub.emit({ type: "phase:failed", name, error: message, stack });
				throw error;
			}
		});
	};

	const task: TaskFn = async (id, fn) => {
		return hub.scoped({ task: { id } }, async () => {
			hub.emit({ type: "task:start", taskId: id });
			try {
				const result = await fn();
				hub.emit({ type: "task:complete", taskId: id, result });
				return result;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				const stack = error instanceof Error ? error.stack : undefined;
				hub.emit({ type: "task:failed", taskId: id, error: message, stack });
				throw error;
			}
		});
	};

	let outputs: Record<string, unknown> = {};
	let success = false;
	let durationMs = 0;

	hub.setStatus("running");
	hub.emit({ type: "harness:start", name: options.flow.flow.name ?? "flow" });

	try {
		const result = await executeFlow(options.flow, options.registry, { hub, phase, task }, options.inputOverrides);
		outputs = result.outputs;
		success = true;
	} finally {
		durationMs = Date.now() - start;
		hub.emit({ type: "harness:complete", success, durationMs });
		hub.setStatus("complete");

		unsubscribe();
		for (const cleanup of cleanups) {
			await runCleanup(cleanup);
		}
	}

	return { outputs, events, durationMs, status: hub.status };
}
