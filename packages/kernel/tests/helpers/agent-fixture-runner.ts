// Agent fixture runner
// Executes fixture steps against a Harness instance and collects observations

import { defineHarness } from "../../src/engine/harness.js";
import type { EnrichedEvent, EventContext } from "../../src/protocol/events.js";
import type { HubStatus } from "../../src/protocol/hub.js";
import type { AgentFixture } from "./fixture-loader.js";

/**
 * Recreate agent harness factory based on scenario name.
 * This matches the factories used in scripts/record-fixture.ts
 */
function createAgentHarnessFactory(scenario: string) {
	switch (scenario) {
		case "inbox-basic": {
			return defineHarness({
				name: "test-harness",
				agents: {
					receiver: {
						name: "receiver",
						execute: async (
							input: { label: string },
							ctx,
						): Promise<{
							first: string;
							drained: string[];
							iter: string;
						}> => {
							const first = await Promise.race([
								ctx.inbox.pop(),
								new Promise<{ content: string; timestamp: Date }>((resolve) => {
									setTimeout(
										() =>
											resolve({
												content: `timeout:${input.label}:pop`,
												timestamp: new Date(),
											}),
										100,
									);
								}),
							]);

							const drained = ctx.inbox.drain();
							const iterator = ctx.inbox[Symbol.asyncIterator]();
							const iterResult = await Promise.race([
								iterator.next(),
								new Promise<
									IteratorResult<{ content: string; timestamp: Date }>
								>((resolve) => {
									setTimeout(
										() =>
											resolve({
												value: {
													content: `timeout:${input.label}:iter`,
													timestamp: new Date(),
												},
												done: false,
											}),
										100,
									);
								}),
							]);

							return {
								first: first.content,
								drained: drained.map((message) => message.content),
								iter: iterResult.value.content,
							};
						},
					},
				},
				state: () => ({}),
				run: async ({ agents, hub }) => {
					let runId: string | null = null;
					const unsubscribe = hub.subscribe("agent:start", (event) => {
						runId = (event.event as { runId: string }).runId;
						hub.sendToRun(runId, "first");
						hub.sendToRun(runId, "second");
						setTimeout(() => {
							if (runId) {
								hub.sendToRun(runId, "third");
							}
						}, 10);
					});

					const result = await agents.receiver.execute({ label: "basic" });
					unsubscribe();

					return { runId, result };
				},
			});
		}
		case "runid-uniqueness": {
			return defineHarness({
				name: "test-harness",
				agents: {
					receiver: {
						name: "receiver",
						execute: async (
							input: { label: string },
							ctx,
						): Promise<{ runId: string; message: string }> => {
							const message = await Promise.race([
								ctx.inbox.pop(),
								new Promise<{ content: string; timestamp: Date }>((resolve) => {
									setTimeout(
										() =>
											resolve({
												content: `timeout:${input.label}`,
												timestamp: new Date(),
											}),
										100,
									);
								}),
							]);
							return { runId: ctx.runId, message: message.content };
						},
					},
				},
				state: () => ({}),
				run: async ({ agents, hub }) => {
					const runIds: string[] = [];
					const unsubscribe = hub.subscribe("agent:start", (event) => {
						const runId = (event.event as { runId: string }).runId;
						runIds.push(runId);
						hub.sendToRun(runId, `message:${runId}`);
					});

					const results = await Promise.all([
						agents.receiver.execute({ label: "one" }),
						agents.receiver.execute({ label: "two" }),
					]);

					unsubscribe();

					return { runIds, results };
				},
			});
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
	let harnessFactory: ReturnType<typeof defineHarness> | null = null;
	let harnessInstance: ReturnType<typeof defineHarness>["create"] | null = null;
	let result: unknown = null;
	const startTime = Date.now();

	let unsubscribe: (() => void) | null = null;

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
		try {
			for (const step of fixture.steps) {
				switch (step.type) {
					case "create": {
						harnessFactory = createAgentHarnessFactory(fixture.scenario);
						harnessInstance = (
							harnessFactory as ReturnType<typeof defineHarness> & {
								create(
									input: unknown,
									options?: { sessionIdOverride?: string },
								): ReturnType<typeof defineHarness>["create"];
							}
						).create(step.input ?? {}, {
							sessionIdOverride: fixture.sessionId,
						});
						unsubscribe = harnessInstance.subscribe("*", (event) => {
							received.push(event);
						});
						break;
					}
					case "run": {
						if (!harnessInstance) {
							throw new Error("run step requires harness instance");
						}
						const runResult = await harnessInstance.run();
						result = runResult.result;
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
				status: harnessInstance?.status ?? null,
			};
		} finally {
			if (unsubscribe) {
				unsubscribe();
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
