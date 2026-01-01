/**
 * ReplayRunner - Replays recorded LLM sessions for testing
 *
 * Reads from recorded .jsonl files and fires callbacks as if live.
 * No async generators - pure Promise + callbacks.
 */

import { join } from "node:path";
import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { inject, injectable } from "@needle-di/core";
import type { IAgentRunner, IConfig, RunnerCallbacks } from "@openharness/sdk";
import { IConfigToken } from "@openharness/sdk";
import type { RecordedSession } from "./types.js";

@injectable()
export class ReplayRunner implements IAgentRunner {
	private currentScenarioId: string = "";

	constructor(private config = inject(IConfigToken)) {}

	/**
	 * Set the scenario ID for replay.
	 * This is a convenience method for tests that set up a scenario once.
	 */
	setScenario(id: string): void {
		this.currentScenarioId = id;
	}

	async run(args: {
		prompt: string;
		options: Options & { scenarioId?: string };
		callbacks?: RunnerCallbacks;
	}): Promise<SDKMessage | undefined> {
		const { prompt, options, callbacks } = args;
		const scenarioId = options.scenarioId ?? this.currentScenarioId;

		if (!scenarioId) {
			throw new Error("ReplayRunner: No scenario ID. Either call setScenario() or pass scenarioId in options.");
		}

		// Look for the recording in golden or agents directories
		const possiblePaths = [
			join(this.config.recordingsDir, "golden", `${scenarioId}.jsonl`),
			join(this.config.recordingsDir, "agents", `${scenarioId}.jsonl`),
		];

		let content = "";
		for (const p of possiblePaths) {
			const file = Bun.file(p);
			if (await file.exists()) {
				content = await file.text();
				break;
			}
		}

		if (!content) {
			throw new Error(`ReplayRunner: Recording not found for scenario ${scenarioId}`);
		}

		// Parse recorded sessions
		const sessions: RecordedSession[] = content
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));

		// Find matching session by prompt
		let session = sessions.find((s) => s.prompt === prompt);

		if (!session) {
			// Fallback to first session - throw if genuinely missing
			session = sessions[0];
			if (!session) {
				throw new Error(`ReplayRunner: No matching session found for prompt in ${scenarioId}`);
			}
		}

		if (!session) {
			throw new Error(`ReplayRunner: No sessions found for ${scenarioId}`);
		}

		// Replay messages via callbacks
		let lastMessage: SDKMessage | undefined;
		for (const message of session.messages) {
			lastMessage = message;
			if (callbacks?.onMessage) {
				callbacks.onMessage(message);
			}
		}

		return lastMessage;
	}
}
