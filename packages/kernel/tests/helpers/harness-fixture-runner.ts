// Harness fixture runner
// Executes fixture steps against a Harness instance and collects observations

import { defineHarness } from "../../src/engine/harness.js";
import type {
	BaseEvent,
	EnrichedEvent,
	EventContext,
} from "../../src/protocol/events.js";
import type {
	Attachment,
	HarnessInstance,
} from "../../src/protocol/harness.js";
import type { HubStatus } from "../../src/protocol/hub.js";
import type { HarnessFixture } from "./fixture-loader.js";

type HarnessFactoryWithSessionId = {
	create(
		input: unknown,
		options?: { sessionIdOverride?: string },
	): HarnessInstance<unknown, unknown>;
};

/**
 * Recreate harness factory based on scenario name.
 * This matches the factories used in scripts/record-fixture.ts
 */
function createHarnessFactory(scenario: string) {
	switch (scenario) {
		case "factory": {
			return defineHarness({
				name: "test-harness",
				agents: {},
				state: (input: { value: number }) => ({ count: input.value }),
				run: async () => ({ ok: true }),
			});
		}
		case "attachment": {
			return defineHarness({
				name: "test-harness",
				agents: {},
				state: () => ({}),
				run: async () => ({ ok: true }),
			});
		}
		case "session": {
			return defineHarness({
				name: "test-harness",
				agents: {},
				state: () => ({}),
				run: async ({ session }) => {
					return { hasSession: session !== undefined };
				},
			});
		}
		case "run-lifecycle": {
			return defineHarness({
				name: "test-harness",
				agents: {},
				state: () => ({ initialized: true }),
				run: async () => ({ result: "success" }),
			});
		}
		case "phase-task": {
			return defineHarness({
				name: "test-harness",
				agents: {},
				state: () => ({}),
				run: async ({ phase, task, emit }) => {
					await phase("Planning", async () => {
						await task("plan", async () => {
							emit({ type: "custom:event", data: "test" });
							return "planned";
						});
					});
					return { ok: true };
				},
			});
		}
		default: {
			throw new Error(`Unknown harness scenario: ${scenario}`);
		}
	}
}

export interface HarnessFixtureResult {
	events: EnrichedEvent[];
	state: unknown;
	result: unknown;
	durationMs: number;
	status: HubStatus | null;
	sessionActive: boolean | null;
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
 * Run a Harness fixture scenario and return observed results.
 */
export async function runHarnessFixture(
	fixture: HarnessFixture,
): Promise<HarnessFixtureResult> {
	const received: EnrichedEvent[] = [];
	let harnessInstance: HarnessInstance<unknown, unknown> | null = null;
	let harnessFactory: HarnessFactoryWithSessionId | null = null;
	let result: unknown = null;
	let finalState: unknown = null;
	const startTime = Date.now();

	// Subscribe to all events to capture them
	let unsubscribe: (() => void) | null = null;

	try {
		// Execute each step
		for (const step of fixture.steps) {
			switch (step.type) {
				case "create": {
					if (!step.name || step.input === undefined) {
						throw new Error("create step requires name and input fields");
					}

					// Recreate the harness factory based on scenario name
					harnessFactory = createHarnessFactory(
						fixture.scenario,
					) as HarnessFactoryWithSessionId<unknown, unknown, unknown>;

					harnessInstance = harnessFactory.create(step.input, {
						sessionIdOverride: fixture.sessionId,
					});
					unsubscribe = harnessInstance.subscribe("*", (event) => {
						received.push(event);
					});
					break;
				}

				case "attach": {
					if (!harnessInstance) {
						throw new Error(
							"attach step requires harness instance (create first)",
						);
					}

					const attachment: Attachment = (hub) => {
						// Simple attachment that subscribes
						return hub.subscribe("*", () => {
							// Attachment received hub
						});
					};

					harnessInstance.attach(attachment);
					break;
				}

				case "startSession": {
					if (!harnessInstance) {
						throw new Error("startSession step requires harness instance");
					}
					harnessInstance.startSession();
					break;
				}

				case "send": {
					if (!harnessInstance || !step.message) {
						throw new Error("send step requires harness instance and message");
					}
					harnessInstance.send(step.message);
					break;
				}

				case "run": {
					if (!harnessInstance) {
						throw new Error("run step requires harness instance");
					}
					const runResult = await harnessInstance.run();
					result = runResult.result;
					finalState = runResult.state;
					break;
				}

				case "phase": {
					if (!step.phaseName) {
						throw new Error("phase step requires phaseName field");
					}
					// Phase is executed within run(), so this is for reference
					// In actual fixtures, phases are part of the run function
					break;
				}

				case "task": {
					if (!step.taskId) {
						throw new Error("task step requires taskId field");
					}
					// Task is executed within run(), so this is for reference
					// In actual fixtures, tasks are part of the run function
					break;
				}

				case "emit": {
					if (!harnessInstance || !step.event) {
						throw new Error(
							"emit step requires harness instance and event field",
						);
					}
					harnessInstance.emit(step.event as BaseEvent);
					break;
				}

				default: {
					const unknownStep = step as { type: string };
					throw new Error(`Unknown step type: ${unknownStep.type}`);
				}
			}
		}

		// Give async operations time to complete
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Capture final state if not set
		if (finalState === null && harnessInstance) {
			finalState = harnessInstance.state;
		}

		const durationMs = Date.now() - startTime;

		return {
			events: received,
			state: finalState,
			result,
			durationMs,
			status: harnessInstance?.status ?? null,
			sessionActive: harnessInstance?.sessionActive ?? null,
		};
	} finally {
		if (unsubscribe) {
			unsubscribe();
		}
	}
}

/**
 * Normalize events for deterministic comparison.
 */
export function normalizeHarnessEvents(events: EnrichedEvent[]): Array<{
	event: unknown;
	context: EventContext;
}> {
	return events.map(normalizeEvent);
}
