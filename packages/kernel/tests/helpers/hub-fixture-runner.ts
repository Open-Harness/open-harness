// Hub fixture runner
// Executes fixture steps against a Hub instance and collects observations

import { createHub, type HubImpl } from "../../src/engine/hub.js";
import type {
	BaseEvent,
	EnrichedEvent,
	EventContext,
} from "../../src/protocol/events.js";
import type { HubStatus } from "../../src/protocol/hub.js";
import type { HubFixture } from "./fixture-loader.js";

export interface HubFixtureResult {
	events: EnrichedEvent[];
	status: HubStatus | null;
	sessionActive: boolean | null;
	pausedSession?: {
		sessionId: string;
		flowName: string;
		currentNodeId: string;
		currentNodeIndex: number;
		outputs: Record<string, unknown>;
		pendingMessages: string[];
		pauseReason?: string;
	};
}

/**
 * Normalize an enriched event for deterministic comparison.
 * Removes non-deterministic fields (id, timestamp) but keeps structure.
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
 * Run a Hub fixture scenario and return observed results.
 */
export async function runHubFixture(
	fixture: HubFixture,
): Promise<HubFixtureResult> {
	const hub = createHub(fixture.sessionId);
	const received: EnrichedEvent[] = [];

	// Subscribe to all events to capture them
	const unsubscribe = hub.subscribe("*", (event) => {
		received.push(event);
	});

	try {
		// Execute each step
		for (const step of fixture.steps) {
			switch (step.type) {
				case "emit": {
					if (!step.event) {
						throw new Error("emit step requires event field");
					}
					hub.emit(
						step.event as BaseEvent,
						step.contextOverride as Partial<EventContext> | undefined,
					);
					break;
				}

				case "startSession": {
					(hub as HubImpl).startSession();
					break;
				}

				case "send": {
					if (!step.message) {
						throw new Error("send step requires message field");
					}
					hub.send(step.message);
					break;
				}

				case "sendTo": {
					if (!step.agent || !step.message) {
						throw new Error("sendTo step requires agent and message fields");
					}
					hub.sendTo(step.agent, step.message);
					break;
				}

				case "sendToRun": {
					if (!step.runId || !step.message) {
						throw new Error("sendToRun step requires runId and message fields");
					}
					hub.sendToRun(step.runId, step.message);
					break;
				}

				case "reply": {
					if (!step.promptId || !step.response) {
						throw new Error("reply step requires promptId and response fields");
					}
					hub.reply(step.promptId, {
						content: step.response.content,
						choice: step.response.choice,
						timestamp: new Date(step.response.timestamp),
					});
					break;
				}

				case "abort": {
					// Support both old string reason and new PauseOptions
					if (step.options) {
						hub.abort(step.options);
					} else if (step.reason) {
						hub.abort({ reason: step.reason });
					} else {
						hub.abort();
					}
					break;
				}

				case "resume": {
					if (!step.sessionId || !step.message) {
						throw new Error(
							"resume step requires sessionId and message fields",
						);
					}
					await hub.resume(step.sessionId, step.message);
					break;
				}

				case "setStatus": {
					if (!step.status) {
						throw new Error("setStatus step requires status field");
					}
					(hub as HubImpl).setStatus(step.status as HubStatus);
					break;
				}

				default: {
					const unknownStep = step as { type: string };
					throw new Error(`Unknown step type: ${unknownStep.type}`);
				}
			}
		}

		// Give async operations time to complete (for async iteration test)
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Capture final state
		const status = hub.status;
		const sessionActive = hub.sessionActive;

		// Capture paused session state if exists
		const pausedState = hub.getPausedSession(fixture.sessionId);
		const pausedSession = pausedState
			? {
					sessionId: pausedState.sessionId,
					flowName: pausedState.flowName,
					currentNodeId: pausedState.currentNodeId,
					currentNodeIndex: pausedState.currentNodeIndex,
					outputs: pausedState.outputs,
					pendingMessages: pausedState.pendingMessages,
					pauseReason: pausedState.pauseReason,
				}
			: undefined;

		return {
			events: received,
			status,
			sessionActive,
			pausedSession,
		};
	} finally {
		unsubscribe();
	}
}

/**
 * Normalize events for deterministic comparison.
 */
export function normalizeEvents(events: EnrichedEvent[]): Array<{
	event: unknown;
	context: EventContext;
}> {
	return events.map(normalizeEvent);
}
