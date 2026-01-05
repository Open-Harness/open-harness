// Agent fixture runner
// Executes fixture steps against a minimal FlowRuntime-like runner for agent scenarios

import { createHub, type HubImpl } from "../../src/engine/hub.js";
import type { AgentDefinition } from "../../src/protocol/agent.js";
import type { EnrichedEvent, EventContext } from "../../src/protocol/events.js";
import type { HubStatus } from "../../src/protocol/hub.js";
import type { AgentFixture } from "./fixture-loader.js";

type AgentRuntime = {
	hub: HubImpl;
	executeAgent: <TIn, TOut>(
		agent: AgentDefinition<TIn, TOut>,
		input: TIn,
	) => Promise<{ runId: string; output: TOut }>;
	close: () => void;
};

function createRuntime(sessionId: string): AgentRuntime {
	const hub = createHub(sessionId) as HubImpl;
	hub.startSession();

	let runCounter = 0;

	const executeAgent = async <TIn, TOut>(
		agent: AgentDefinition<TIn, TOut>,
		input: TIn,
	): Promise<{ runId: string; output: TOut }> => {
		const runId = `run-${runCounter++}`;

		if (!agent.emitsStartComplete) {
			hub.emit({ type: "agent:start", agentName: agent.name, runId });
		}

		try {
			// Agents now subscribe to session:message events via hub
			const output = await agent.execute(input, { hub, runId });
			if (!agent.emitsStartComplete) {
				hub.emit({
					type: "agent:complete",
					agentName: agent.name,
					success: true,
					runId,
				});
			}
			return { runId, output };
		} catch (error) {
			if (!agent.emitsStartComplete) {
				hub.emit({
					type: "agent:complete",
					agentName: agent.name,
					success: false,
					runId,
				});
			}
			throw error;
		}
	};

	return {
		hub,
		executeAgent,
		close: () => {
			// No cleanup needed - agents unsubscribe themselves
		},
	};
}

/**
 * Recreate agent scenario based on fixture name.
 * This matches the factories used in scripts/record-fixture.ts
 *
 * V2 SDK Migration: Agents now subscribe to session:message events via hub
 * instead of receiving an inbox. The runid-uniqueness scenario demonstrates
 * this pattern.
 */
function createAgentScenario(
	scenario: string,
	runtime: AgentRuntime,
): () => Promise<unknown> {
	switch (scenario) {
		case "runid-uniqueness": {
			// Agent that receives messages via hub subscription
			const receiver: AgentDefinition<
				{ label: string },
				{ runId: string; message: string }
			> = {
				name: "receiver",
				execute: async (input, ctx) => {
					// Subscribe to session:message events filtered by runId
					return new Promise((resolve) => {
						const timeout = setTimeout(() => {
							resolve({
								runId: ctx.runId,
								message: `timeout:${input.label}`,
							});
						}, 100);

						const unsubscribe = ctx.hub.subscribe(
							"session:message",
							(event) => {
								const payload = event.event as {
									runId?: string;
									content?: string;
								};
								if (payload.runId === ctx.runId && payload.content) {
									clearTimeout(timeout);
									unsubscribe();
									resolve({
										runId: ctx.runId,
										message: payload.content,
									});
								}
							},
						);
					});
				},
			};

			return async () => {
				const runIds: string[] = [];
				const unsubscribe = runtime.hub.subscribe("agent:start", (event) => {
					const runId = (event.event as { runId: string }).runId;
					runIds.push(runId);
					// Defer message send to next microtask to allow agent's
					// execute() to start and set up its subscription first
					queueMicrotask(() => {
						runtime.hub.sendToRun(runId, `message:${runId}`);
					});
				});

				const results = await Promise.all([
					runtime.executeAgent(receiver, { label: "one" }),
					runtime.executeAgent(receiver, { label: "two" }),
				]);

				unsubscribe();

				return {
					runIds,
					results: results.map((entry) => entry.output),
				};
			};
		}
		default: {
			throw new Error(`Unknown agent scenario: ${scenario}`);
		}
	}
}

export interface AgentFixtureResult {
	events: EnrichedEvent[];
	result: unknown;
	durationMs: number;
	status: HubStatus | null;
}

/**
 * Normalize an enriched event for deterministic comparison.
 */
function normalizeEvent(event: EnrichedEvent): {
	event: unknown;
	context: EventContext;
} {
	return {
		event: event.event,
		context: event.context,
	};
}

/**
 * Run an Agent fixture scenario and return observed results.
 */
export async function runAgentFixture(
	fixture: AgentFixture,
): Promise<AgentFixtureResult> {
	const received: EnrichedEvent[] = [];

	let runtime: AgentRuntime | null = null;
	let result: unknown = null;
	let unsubscribe: (() => void) | null = null;
	let runtimeName = "test-runtime";

	const withFrozenTime = async <T>(fn: () => Promise<T>): Promise<T> => {
		const originalNow = Date.now;
		const frozen = Date.now();
		Date.now = () => frozen;
		try {
			return await fn();
		} finally {
			Date.now = originalNow;
		}
	};

	return await withFrozenTime(async () => {
		const startTime = Date.now();
		try {
			for (const step of fixture.steps) {
				switch (step.type) {
					case "create": {
						runtime = createRuntime(fixture.sessionId);
						if (step.name) {
							runtimeName = step.name;
						}
						unsubscribe = runtime.hub.subscribe("*", (event) => {
							received.push(event);
						});
						break;
					}
					case "run": {
						if (!runtime) {
							throw new Error("run step requires runtime instance");
						}
						runtime.hub.setStatus("running");
						runtime.hub.emit({
							type: "harness:start",
							name: runtimeName,
						});

						const scenario = createAgentScenario(fixture.scenario, runtime);
						result = await scenario();

						runtime.hub.emit({
							type: "harness:complete",
							success: true,
							durationMs: Date.now() - startTime,
						});
						runtime.hub.setStatus("complete");
						break;
					}
					default: {
						const unknownStep = step as { type: string };
						throw new Error(`Unknown step type: ${unknownStep.type}`);
					}
				}
			}

			await new Promise((resolve) => setTimeout(resolve, 10));

			const durationMs = Date.now() - startTime;

			return {
				events: received,
				result,
				durationMs,
				status: runtime?.hub.status ?? null,
			};
		} finally {
			if (unsubscribe) {
				unsubscribe();
			}
			if (runtime) {
				runtime.close();
			}
		}
	});
}

/**
 * Normalize events for deterministic comparison.
 */
export function normalizeAgentEvents(events: EnrichedEvent[]): Array<{
	event: unknown;
	context: EventContext;
}> {
	return events.map(normalizeEvent);
}
