import { randomUUID } from "node:crypto";
import type { Query } from "@anthropic-ai/claude-agent-sdk";
import type { CancelContextInternal, CancelReason } from "../core/cancel.js";
import type {
	RuntimeCommand,
	RuntimeEvent,
	RuntimeEventListener,
	RuntimeEventPayload,
	RuntimeStatus,
} from "../core/events.js";
import type { CommandInbox, StatePatch, StateStore } from "../core/state.js";
import type { EdgeDefinition, FlowDefinition } from "../core/types.js";
import type { RunStore } from "../persistence/run-store.js";
import type { NodeRegistry, NodeRunContext } from "../registry/registry.js";
import { resolveBindings } from "./bindings.js";
import { edgeKey, GraphCompiler } from "./compiler.js";
import { DefaultExecutor } from "./executor.js";
import { DefaultScheduler } from "./scheduler.js";
import type { RunSnapshot, RunState } from "./snapshot.js";
import { evaluateWhen } from "./when.js";

/**
 * Event bus abstraction used by the runtime.
 */
export interface EventBus {
	/**
	 * Emit an event to all subscribers.
	 * @param event - Event payload.
	 */
	emit(event: RuntimeEvent): void;
	/**
	 * Subscribe to events.
	 * @param listener - Event listener.
	 * @returns Unsubscribe function.
	 */
	subscribe(listener: RuntimeEventListener): () => void;
}

/**
 * Public runtime API.
 */
export interface Runtime {
	/**
	 * Execute the flow to completion or pause.
	 * @param input - Optional input overrides.
	 * @returns Final run snapshot.
	 */
	run(input?: Record<string, unknown>): Promise<RunSnapshot>;
	/**
	 * Dispatch a command into the runtime.
	 * @param command - Command to dispatch.
	 */
	dispatch(command: RuntimeCommand): void;
	/**
	 * Subscribe to runtime events.
	 * @param listener - Event listener.
	 * @returns Unsubscribe function.
	 */
	onEvent(listener: RuntimeEventListener): () => void;
	/**
	 * Return a current snapshot of runtime state.
	 * @returns Run snapshot.
	 */
	getSnapshot(): RunSnapshot;
}

/**
 * Options for creating a runtime instance.
 *
 * @property {FlowDefinition} flow - Flow definition.
 * @property {NodeRegistry} registry - Node registry.
 * @property {RunStore} [store] - Optional persistence store.
 */
export interface RuntimeOptions {
	flow: FlowDefinition;
	registry: NodeRegistry;
	store?: RunStore;
	resume?: RuntimeResumeOptions;
}

export type RuntimeResumeOptions =
	| { runId: string }
	| { snapshot: RunSnapshot; runId?: string };

type ForEachIteration = {
	item: unknown;
	output?: unknown;
	error?: string;
	skipped?: boolean;
};

/**
 * In-memory event bus implementation.
 */
export class InMemoryEventBus implements EventBus {
	private readonly listeners = new Set<RuntimeEventListener>();

	/**
	 * Emit an event to all subscribers.
	 * @param event - Event payload.
	 */
	emit(event: RuntimeEvent): void {
		for (const listener of this.listeners) {
			try {
				void listener(event);
			} catch (error) {
				console.error("Event listener error:", error);
			}
		}
	}

	/**
	 * Subscribe to events.
	 * @param listener - Event listener.
	 * @returns Unsubscribe function.
	 */
	subscribe(listener: RuntimeEventListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
}

/**
 * In-memory command inbox.
 */
export class InMemoryCommandInbox implements CommandInbox {
	private readonly queue: RuntimeCommand[] = [];

	/**
	 * Dequeue the next available command.
	 * @returns Next command or undefined.
	 */
	next(): RuntimeCommand | undefined {
		return this.queue.shift();
	}

	/**
	 * Enqueue a new runtime command.
	 * @param command - Command to enqueue.
	 */
	enqueue(command: RuntimeCommand): void {
		this.queue.push(command);
	}

	/**
	 * Return a shallow copy of queued commands.
	 * @returns Current queued commands.
	 */
	snapshot(): RuntimeCommand[] {
		return [...this.queue];
	}
}

/**
 * In-memory state store implementation using dot-path access.
 */
export class InMemoryStateStore implements StateStore {
	private state: Record<string, unknown>;

	/**
	 * Create a state store with initial state.
	 * @param initial - Initial state object.
	 */
	constructor(initial: Record<string, unknown> = {}) {
		this.state = cloneRecord(initial);
	}

	/**
	 * Read a value by path.
	 * @param path - Dot path (e.g., "foo.bar").
	 * @returns The stored value or undefined.
	 */
	get(path: string): unknown {
		if (!path) return this.state;
		const segments = path.split(".").filter((segment) => segment.length > 0);
		let current: unknown = this.state;
		for (const segment of segments) {
			if (current && typeof current === "object" && segment in current) {
				current = (current as Record<string, unknown>)[segment];
			} else {
				return undefined;
			}
		}
		return current;
	}

	/**
	 * Write a value by path.
	 * @param path - Dot path (e.g., "foo.bar").
	 * @param value - Value to set.
	 */
	set(path: string, value: unknown): void {
		if (!path) {
			this.state = value as Record<string, unknown>;
			return;
		}
		const segments = path.split(".").filter((segment) => segment.length > 0);
		let current: Record<string, unknown> = this.state;
		for (let i = 0; i < segments.length - 1; i += 1) {
			const key = segments[i] ?? "";
			if (!key) continue;
			if (!current[key] || typeof current[key] !== "object") {
				current[key] = {};
			}
			current = current[key] as Record<string, unknown>;
		}
		const last = segments[segments.length - 1];
		if (last) current[last] = value;
	}

	/**
	 * Apply a patch operation to the state.
	 * @param patch - Patch to apply.
	 */
	patch(patch: StatePatch): void {
		if (patch.op === "set") {
			this.set(patch.path, patch.value);
			return;
		}
		const existing = this.get(patch.path);
		const next =
			existing && typeof existing === "object" && !Array.isArray(existing)
				? { ...(existing as Record<string, unknown>) }
				: {};
		if (patch.value && typeof patch.value === "object") {
			Object.assign(next, patch.value as Record<string, unknown>);
		}
		this.set(patch.path, next);
	}

	/**
	 * Return a full snapshot of current state.
	 * @returns Snapshot object.
	 */
	snapshot(): Record<string, unknown> {
		return cloneRecord(this.state);
	}
}

/**
 * Default runtime implementation (in-memory).
 */
class InMemoryRuntime implements Runtime {
	private readonly flow: FlowDefinition;
	private readonly registry: NodeRegistry;
	private readonly store?: RunStore;
	private readonly bus: EventBus;
	private readonly inboxes = new Map<string, InMemoryCommandInbox>();
	private readonly stateStore: InMemoryStateStore;
	private readonly nodeControllers = new Map<string, CancelContextInternal>();
	private snapshot: RunState;
	private resumingNodes = new Set<string>();
	private pendingResumeMessage?: string;
	private resumeRunId?: string;

	/**
	 * Create a runtime instance.
	 * @param options - Runtime options.
	 */
	constructor(options: RuntimeOptions) {
		this.flow = options.flow;
		this.registry = options.registry;
		this.store = options.store;
		this.bus = new InMemoryEventBus();

		const resume = resolveResumeSnapshot(options);
		if (resume) {
			this.stateStore = new InMemoryStateStore(resume.snapshot.state ?? {});
			this.snapshot = {
				...resume.snapshot,
				runId: resume.runId,
				inbox: [],
				agentSessions: resume.snapshot.agentSessions ?? {},
			};
			for (const command of resume.snapshot.inbox ?? []) {
				if (command.type === "send" || command.type === "reply") {
					if (!command.runId) continue;
					this.getInbox(command.runId).enqueue(command);
				}
			}
			const inboxRunIds = [...this.inboxes.keys()];
			if (inboxRunIds.length === 1) {
				this.resumeRunId = inboxRunIds[0];
			}
		} else {
			this.stateStore = new InMemoryStateStore(
				options.flow.state?.initial ?? {},
			);
			this.snapshot = createInitialSnapshot(options.flow);
			this.snapshot.runId = randomUUID();
		}
	}

	/**
	 * Execute the flow to completion or pause.
	 * @param input - Optional input overrides.
	 * @returns Final run snapshot.
	 */
	async run(input: Record<string, unknown> = {}): Promise<RunSnapshot> {
		if (
			this.snapshot.status === "complete" ||
			this.snapshot.status === "aborted"
		) {
			throw new Error(`Run ${this.snapshot.runId ?? ""} is not resumable`);
		}

		const isResume = this.snapshot.status !== "idle";
		if (isResume) {
			this.resumingNodes = new Set();
			const resumeMessage = this.pendingResumeMessage ?? "continue";
			this.pendingResumeMessage = resumeMessage;
			for (const [nodeId, status] of Object.entries(this.snapshot.nodeStatus)) {
				if (status === "running") {
					this.snapshot.nodeStatus[nodeId] = "pending";
					this.resumingNodes.add(nodeId);
				}
			}
		}
		this.snapshot.status = "running";
		this.emit(
			isResume
				? { type: "flow:resumed" }
				: { type: "flow:start", flowName: this.flow.name },
		);

		const compiler = new GraphCompiler();
		const compiled = compiler.compile(this.flow);
		const scheduler = new DefaultScheduler();
		const executor = new DefaultExecutor();
		const nodeById = new Map(compiled.nodes.map((node) => [node.id, node]));

		while (this.snapshot.status === "running") {
			const ready = scheduler.nextReadyNodes(this.snapshot, compiled);
			if (ready.length === 0) break;

			const nodeId = ready[0] ?? "";
			const node = nodeById.get(nodeId);
			if (!node) continue;

			const incomingAll = compiled.incoming.get(nodeId) ?? [];
			const incoming = incomingAll.filter((edge) => !isLoopEdge(edge));
			const gate = compiled.gateByNode.get(nodeId) ?? "all";
			const gateDecision = decideGate(incoming, this.snapshot.edgeStatus, gate);
			if (gateDecision === "skip") {
				this.markSkipped(nodeId, "edge");
				await this.evaluateOutgoingEdges(nodeId, compiled, input);
				continue;
			}

			const forEachEdge = selectForEachEdge(
				incomingAll,
				this.snapshot.edgeStatus,
			);
			if (forEachEdge) {
				const iterations = await this.runForEachNode({
					node,
					edge: forEachEdge,
					executor,
					input,
				});
				if (this.snapshot.status !== "running") {
					this.persistSnapshot();
					return this.getSnapshot();
				}
				this.snapshot.nodeStatus[nodeId] = "done";
				this.snapshot.outputs[nodeId] = { iterations };
				await this.evaluateOutgoingEdges(nodeId, compiled, input);
				continue;
			}

			const bindingContext = this.createBindingContext(input);
			const shouldRun = await evaluateWhen(node.when, bindingContext);
			if (!shouldRun) {
				this.markSkipped(nodeId, "when");
				await this.evaluateOutgoingEdges(nodeId, compiled, input);
				continue;
			}

			this.snapshot.nodeStatus[nodeId] = "running";
			const isResuming = this.resumingNodes.has(nodeId);
			let runId: string = randomUUID();
			if (isResuming && this.resumeRunId) {
				runId = this.resumeRunId;
				this.resumeRunId = undefined;
			}
			const resumeMessage = isResuming
				? (this.pendingResumeMessage ?? "continue")
				: undefined;
			if (isResuming && resumeMessage) {
				this.dispatch({ type: "send", runId, message: resumeMessage });
				this.resumingNodes.delete(nodeId);
			}
			const cancelContext = this.createCancelContext(runId);
			const runContext: NodeRunContext = {
				nodeId,
				runId,
				emit: (event) => this.emit(event),
				state: this.stateStore,
				inbox: this.getInbox(runId),
				getAgentSession: () => this.snapshot.agentSessions[nodeId],
				setAgentSession: (sessionId) => this.setAgentSession(nodeId, sessionId),
				resumeMessage,
				cancel: cancelContext,
			};

			this.emit({ type: "node:start", nodeId, runId: runContext.runId });
			const resolvedInput = await resolveBindings(node.input, bindingContext);
			let result: Awaited<ReturnType<DefaultExecutor["runNode"]>> | undefined;
			try {
				result = await executor.runNode({
					registry: this.registry,
					node,
					runContext,
					input: resolvedInput,
				});
			} finally {
				this.nodeControllers.delete(runId);
			}
			if (!result) {
				throw new Error("Node execution returned no result");
			}

			if (runContext.cancel.cancelled) {
				if (
					runContext.cancel.reason === "pause" &&
					result.output !== undefined
				) {
					this.snapshot.outputs[nodeId] = result.output;
				}
				this.persistSnapshot();
				return this.getSnapshot();
			}

			if (result.error) {
				this.snapshot.nodeStatus[nodeId] = "failed";
				this.snapshot.outputs[nodeId] = { error: result.error };
				this.emit({
					type: "node:error",
					nodeId,
					runId: result.runId,
					error: result.error,
				});
				if (!node.policy?.continueOnError) {
					this.snapshot.status = "complete";
					this.emit({
						type: "flow:complete",
						flowName: this.flow.name,
						status: "failed",
					});
					this.persistSnapshot();
					return this.getSnapshot();
				}
			} else {
				this.snapshot.nodeStatus[nodeId] = "done";
				this.snapshot.outputs[nodeId] = result.output;
				this.emit({
					type: "node:complete",
					nodeId,
					runId: result.runId,
					output: result.output,
				});
			}

			await this.evaluateOutgoingEdges(nodeId, compiled, input);
		}

		const status = this.snapshot.status as RuntimeStatus;
		if (status === "paused" || status === "aborted") {
			this.persistSnapshot();
			return this.getSnapshot();
		}

		if (hasPendingNodes(this.snapshot.nodeStatus)) {
			throw new Error("Execution stalled: no ready nodes");
		}

		this.snapshot.status = "complete";
		this.emit({
			type: "flow:complete",
			flowName: this.flow.name,
			status: "complete",
		});
		this.persistSnapshot();
		return this.getSnapshot();
	}

	/**
	 * Dispatch a command into the runtime.
	 * @param command - Command to dispatch.
	 */
	dispatch(command: RuntimeCommand): void {
		if (
			(command.type === "send" || command.type === "reply") &&
			!command.runId
		) {
			this.emit({ type: "command:received", command });
			throw new Error("Runtime command missing runId");
		}

		if (command.type === "send" || command.type === "reply") {
			this.getInbox(command.runId).enqueue(command);
		}
		this.emit({ type: "command:received", command });

		if (command.type === "abort") {
			const isPause = command.resumable === true;
			this.snapshot.status = isPause ? "paused" : "aborted";
			for (const cancelContext of this.nodeControllers.values()) {
				if (isPause) {
					cancelContext
						.interrupt()
						.catch((error) => console.error("Cancel interrupt error:", error));
				} else {
					cancelContext.abort();
				}
			}
			this.emit({
				type: isPause ? "flow:paused" : "flow:aborted",
			});
			this.persistSnapshot();
		}

		if (command.type === "resume") {
			this.pendingResumeMessage = command.message ?? "continue";
			this.snapshot.status = "running";
			this.emit({ type: "flow:resumed" });
		}
	}

	/**
	 * Subscribe to runtime events.
	 * @param listener - Event listener.
	 * @returns Unsubscribe function.
	 */
	onEvent(listener: RuntimeEventListener): () => void {
		return this.bus.subscribe(listener);
	}

	/**
	 * Return a current snapshot of runtime state.
	 * @returns Run snapshot.
	 */
	getSnapshot(): RunSnapshot {
		return {
			runId: this.snapshot.runId,
			status: this.snapshot.status,
			outputs: { ...this.snapshot.outputs },
			state: this.stateStore.snapshot(),
			nodeStatus: { ...this.snapshot.nodeStatus },
			edgeStatus: { ...this.snapshot.edgeStatus },
			loopCounters: { ...this.snapshot.loopCounters },
			inbox: [...this.snapshot.inbox, ...this.inboxQueue()],
			agentSessions: { ...this.snapshot.agentSessions },
		};
	}

	private markSkipped(nodeId: string, reason: "edge" | "when"): void {
		this.snapshot.nodeStatus[nodeId] = "done";
		this.snapshot.outputs[nodeId] = { skipped: true, reason };
		this.emit({ type: "node:skipped", nodeId, reason });
	}

	private async evaluateOutgoingEdges(
		nodeId: string,
		compiled: ReturnType<GraphCompiler["compile"]>,
		input: Record<string, unknown>,
	): Promise<void> {
		const bindingContext = this.createBindingContext(input);
		for (const edge of compiled.edges) {
			if (edge.from !== nodeId) continue;
			const shouldFire = await evaluateWhen(edge.when, bindingContext);
			const key = edgeKey(edge);
			const didReset = shouldFire ? this.resetNodeForReentry(edge) : false;
			this.snapshot.edgeStatus[key] = shouldFire ? "fired" : "skipped";
			if (shouldFire) {
				this.emit({
					type: "edge:fire",
					edgeId: edge.id,
					from: edge.from,
					to: edge.to,
				});
				if (edge.maxIterations && didReset) {
					this.bumpLoopCounter(edge);
				}
			}
		}
	}

	private resetNodeForReentry(edge: EdgeDefinition): boolean {
		const status = this.snapshot.nodeStatus[edge.to];
		if (status === "pending" || status === "running") {
			return false;
		}

		this.snapshot.nodeStatus[edge.to] = "pending";

		return true;
	}

	private async runForEachNode({
		node,
		edge,
		executor,
		input,
	}: {
		node: FlowDefinition["nodes"][number];
		edge: EdgeDefinition;
		executor: DefaultExecutor;
		input: Record<string, unknown>;
	}): Promise<ForEachIteration[]> {
		const forEach = edge.forEach;
		if (!forEach) return [];

		const bindingContext = this.createBindingContext(input);
		const resolved = await resolveBindings(
			{ value: forEach.in },
			bindingContext,
		);
		const list = resolved.value;
		if (!Array.isArray(list)) {
			throw new Error(`forEach expects array at ${forEach.in}`);
		}

		const iterations: ForEachIteration[] = [];
		const asKey = forEach.as;
		this.snapshot.nodeStatus[node.id] = "running";

		for (let i = 0; i < list.length; i++) {
			const item = list[i];
			const iterationContext = this.createBindingContext(input, {
				[asKey]: item,
				$iteration: i,
				$first: i === 0,
				$last: i === list.length - 1,
				$maxIterations: list.length,
			});
			const shouldRun = await evaluateWhen(node.when, iterationContext);
			if (!shouldRun) {
				iterations.push({ item, skipped: true });
				continue;
			}

			const runId: string = randomUUID();
			const cancelContext = this.createCancelContext(runId);
			const runContext: NodeRunContext = {
				nodeId: node.id,
				runId,
				emit: (event) => this.emit(event),
				state: this.stateStore,
				inbox: this.getInbox(runId),
				getAgentSession: () => this.snapshot.agentSessions[node.id],
				setAgentSession: (sessionId) =>
					this.setAgentSession(node.id, sessionId),
				cancel: cancelContext,
			};

			this.emit({
				type: "node:start",
				nodeId: node.id,
				runId: runContext.runId,
			});
			const resolvedInput = await resolveBindings(node.input, iterationContext);
			let result: Awaited<ReturnType<DefaultExecutor["runNode"]>> | undefined;
			try {
				result = await executor.runNode({
					registry: this.registry,
					node,
					runContext,
					input: resolvedInput,
				});
			} finally {
				this.nodeControllers.delete(runId);
			}
			if (!result) {
				throw new Error("Node execution returned no result");
			}

			if (runContext.cancel.cancelled) {
				if (
					runContext.cancel.reason === "pause" &&
					result.output !== undefined
				) {
					this.snapshot.outputs[node.id] = result.output;
				}
				return iterations;
			}

			if (result.error) {
				this.snapshot.nodeStatus[node.id] = "failed";
				iterations.push({ item, error: result.error });
				this.emit({
					type: "node:error",
					nodeId: node.id,
					runId: result.runId,
					error: result.error,
				});
				if (!node.policy?.continueOnError) {
					this.snapshot.status = "complete";
					this.emit({
						type: "flow:complete",
						flowName: this.flow.name,
						status: "failed",
					});
					return iterations;
				}
			} else {
				iterations.push({ item, output: result.output });
				this.emit({
					type: "node:complete",
					nodeId: node.id,
					runId: result.runId,
					output: result.output,
				});
			}
		}

		return iterations;
	}

	private bumpLoopCounter(edge: EdgeDefinition): void {
		const key = edgeKey(edge);
		const current = this.snapshot.loopCounters[key] ?? 0;
		const next = current + 1;
		this.snapshot.loopCounters[key] = next;
		this.emit({ type: "loop:iterate", edgeId: edge.id, iteration: next });
		if (edge.maxIterations && next >= edge.maxIterations) {
			throw new Error(
				`Loop edge ${edge.from} -> ${edge.to} exceeded ${edge.maxIterations}`,
			);
		}
	}

	private createBindingContext(
		input: Record<string, unknown>,
		extra: Record<string, unknown> = {},
	): Record<string, unknown> {
		return {
			flow: { input },
			state: this.stateStore.snapshot(),
			...this.snapshot.outputs,
			...extra,
		};
	}

	/**
	 * Emit an event and persist it if a RunStore is configured.
	 * @param event - Runtime event to emit.
	 */
	private emit(event: RuntimeEventPayload): void {
		const timestamped: RuntimeEvent = { ...event, timestamp: Date.now() };
		this.bus.emit(timestamped);
		if (this.store && this.snapshot.runId) {
			this.store.appendEvent(this.snapshot.runId, timestamped);
		}
	}

	/**
	 * Persist the current snapshot if a RunStore is configured.
	 */
	private persistSnapshot(): void {
		if (this.store && this.snapshot.runId) {
			this.store.saveSnapshot(this.snapshot.runId, this.getSnapshot());
		}
	}

	private setAgentSession(nodeId: string, sessionId: string): void {
		this.snapshot.agentSessions[nodeId] = sessionId;
		this.persistSnapshot();
	}

	private getInbox(runId: string): InMemoryCommandInbox {
		const existing = this.inboxes.get(runId);
		if (existing) return existing;
		const inbox = new InMemoryCommandInbox();
		this.inboxes.set(runId, inbox);
		return inbox;
	}

	/**
	 * Read the current inbox queue without dropping items.
	 * @returns Current inbox commands.
	 */
	private inboxQueue(): RuntimeCommand[] {
		const pending: RuntimeCommand[] = [];
		for (const inbox of this.inboxes.values()) {
			pending.push(...inbox.snapshot());
		}
		return pending;
	}

	private createCancelContext(runId: string): CancelContextInternal {
		const controller = new AbortController();
		const callbacks = new Set<() => void | Promise<void>>();
		let reason: CancelReason | undefined;
		let cancelled = false;
		let queryRef: Query | undefined;

		const notify = async () => {
			for (const callback of callbacks) {
				try {
					await callback();
				} catch (error) {
					console.error("Cancel callback error:", error);
				}
			}
		};
		const safeInvoke = (callback: () => void | Promise<void>) => {
			void Promise.resolve(callback()).catch((error) => {
				console.error("Cancel callback error:", error);
			});
		};

		const context: CancelContextInternal = {
			signal: controller.signal,
			get reason() {
				return reason;
			},
			get cancelled() {
				return cancelled;
			},
			interrupt: async () => {
				if (cancelled) return;
				reason = "pause";
				cancelled = true;
				await notify();
				if (queryRef?.interrupt) {
					await queryRef.interrupt();
				}
			},
			abort: () => {
				if (cancelled) return;
				reason = "abort";
				cancelled = true;
				controller.abort();
				void notify();
			},
			throwIfCancelled: () => {
				if (cancelled) {
					throw new Error(`Cancelled: ${reason ?? "unknown"}`);
				}
			},
			onCancel: (callback) => {
				if (cancelled) {
					safeInvoke(callback);
					return () => {};
				}
				callbacks.add(callback);
				return () => callbacks.delete(callback);
			},
			__setQuery: (query) => {
				queryRef = query;
			},
			__controller: controller,
		};

		this.nodeControllers.set(runId, context);
		return context;
	}
}

/**
 * Create a new runtime instance.
 *
 * @param options - Runtime construction options.
 * @returns Runtime instance.
 */
export function createRuntime(options: RuntimeOptions): Runtime {
	return new InMemoryRuntime(options);
}

/**
 * Build the initial run snapshot for a flow definition.
 * @param flow - Flow definition.
 * @returns Initial run state.
 */
function createInitialSnapshot(flow: FlowDefinition): RunState {
	const nodeStatus: Record<string, "pending"> = {};
	for (const node of flow.nodes) {
		nodeStatus[node.id] = "pending";
	}

	const edgeStatus: Record<string, "pending"> = {};
	const loopCounters: Record<string, number> = {};
	for (const edge of flow.edges) {
		const key = edgeKey(edge);
		edgeStatus[key] = "pending";
		loopCounters[key] = 0;
	}

	return {
		status: "idle",
		outputs: {},
		state: { ...(flow.state?.initial ?? {}) },
		nodeStatus,
		edgeStatus,
		loopCounters,
		inbox: [],
		agentSessions: {},
	};
}

type ResumeSnapshot = {
	runId: string;
	snapshot: RunSnapshot;
};

function resolveResumeSnapshot(options: RuntimeOptions): ResumeSnapshot | null {
	if (!options.resume) return null;
	if ("snapshot" in options.resume) {
		const runId = options.resume.runId ?? options.resume.snapshot.runId;
		if (!runId) {
			throw new Error("Resume snapshot requires a runId");
		}
		return { runId, snapshot: options.resume.snapshot };
	}

	if (!options.store) {
		throw new Error("RunStore is required to resume by runId");
	}

	const snapshot = options.store.loadSnapshot(options.resume.runId);
	if (!snapshot) {
		throw new Error(`No snapshot found for runId ${options.resume.runId}`);
	}
	return { runId: options.resume.runId, snapshot };
}

/**
 * Clone a record using structuredClone when available.
 * @param input - Record to clone.
 * @returns Cloned record.
 */
function cloneRecord(input: Record<string, unknown>): Record<string, unknown> {
	if (typeof structuredClone === "function") {
		return structuredClone(input);
	}
	return JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
}

function decideGate(
	incoming: EdgeDefinition[],
	edgeStatus: Record<string, "pending" | "fired" | "skipped">,
	gate: "any" | "all",
): "run" | "skip" {
	if (incoming.length === 0) return "run";

	let fired = 0;
	let skipped = 0;
	for (const edge of incoming) {
		const key = edgeKey(edge);
		const status = edgeStatus[key] ?? "pending";
		if (status === "fired") fired += 1;
		if (status === "skipped") skipped += 1;
	}

	if (gate === "all") {
		return skipped > 0 ? "skip" : "run";
	}

	return fired > 0 ? "run" : "skip";
}

function hasPendingNodes(nodeStatus: Record<string, string>): boolean {
	return Object.values(nodeStatus).some((status) => status === "pending");
}

function isLoopEdge(edge: { maxIterations?: number }): boolean {
	return typeof edge.maxIterations === "number";
}

function selectForEachEdge(
	incoming: EdgeDefinition[],
	edgeStatus: Record<string, "pending" | "fired" | "skipped">,
): EdgeDefinition | undefined {
	const candidates = incoming.filter(
		(edge) => edge.forEach && edgeStatus[edgeKey(edge)] === "fired",
	);
	if (candidates.length > 1) {
		throw new Error(
			`Multiple forEach edges fired into node "${candidates[0]?.to ?? ""}"`,
		);
	}
	return candidates[0];
}
