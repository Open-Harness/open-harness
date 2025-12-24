/**
 * Recording Factory - Injectable factory for creating Recorders
 *
 * This follows Pattern 13: Decorator with Factory Injection.
 * The factory is fully injectable, making the @Record decorator testable.
 *
 * Pure Promise-based, no async generators.
 */

import { join } from "node:path";
import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { inject, injectable } from "@needle-di/core";
import {
	type IConfig,
	IConfigToken,
	type IRecorder,
	type IRecordingFactory,
	type RecordedSession,
	type RunnerCallbacks,
} from "./tokens.js";

/**
 * Recorder handles the actual record/replay logic for a single session.
 * It's a simple class with no DI - dependencies are passed via constructor.
 */
export class Recorder implements IRecorder {
	constructor(
		private readonly category: string,
		private readonly id: string,
		private readonly config: IConfig,
	) {}

	async run(args: {
		prompt: string;
		options: Options;
		callbacks?: RunnerCallbacks;
		runFn: (args: { prompt: string; options: Options; callbacks?: RunnerCallbacks }) => Promise<SDKMessage | undefined>;
	}): Promise<SDKMessage | undefined> {
		const { prompt, options, callbacks, runFn } = args;
		const filePath = join(this.config.recordingsDir, this.category, `${this.id}.jsonl`);

		// Replay mode: read from file and fire callbacks
		if (this.config.isReplayMode) {
			const file = Bun.file(filePath);
			if (await file.exists()) {
				const content = await file.text();
				const lines = content.trim().split("\n").filter(Boolean);

				// Find matching session or use first
				let session: RecordedSession | undefined;
				for (const line of lines) {
					const s: RecordedSession = JSON.parse(line);
					if (s.prompt === prompt) {
						session = s;
						break;
					}
				}
				if (!session && lines.length > 0 && lines[0]) {
					session = JSON.parse(lines[0]);
				}

				if (session) {
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
			throw new Error(`Recorder: No recording found for ${this.category}/${this.id}`);
		}

		// Record mode: capture messages via callback interception
		const capturedMessages: SDKMessage[] = [];

		const wrappedCallbacks: RunnerCallbacks = {
			onMessage: (message) => {
				capturedMessages.push(message);
				// Forward to original callback
				if (callbacks?.onMessage) {
					callbacks.onMessage(message);
				}
			},
		};

		// Run the actual function
		const result = await runFn({
			prompt,
			options,
			callbacks: wrappedCallbacks,
		});

		// Save recording
		const session: RecordedSession = {
			prompt,
			options,
			messages: capturedMessages,
		};

		// Ensure directory exists
		const dir = join(filePath, "..");
		await Bun.write(join(dir, ".keep"), "");

		// Append to file
		const file = Bun.file(filePath);
		const existing = (await file.exists()) ? await file.text() : "";
		await Bun.write(filePath, `${existing + JSON.stringify(session)}\n`);

		return result;
	}
}

/**
 * RecordingFactory creates Recorder instances with injected dependencies.
 * This is the injectable service that the @Record decorator uses.
 */
@injectable()
export class RecordingFactory implements IRecordingFactory {
	constructor(private config = inject(IConfigToken)) {}

	createRecorder(category: string, id: string): IRecorder {
		return new Recorder(category, id, this.config);
	}
}
