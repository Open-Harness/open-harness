/**
 * Recording Factory - Injectable factory for creating Recorders
 *
 * This follows Pattern 13: Decorator with Factory Injection.
 * The factory is fully injectable, making the @Record decorator testable.
 *
 * Pure Promise-based, no async generators.
 *
 * Node.js compatible - uses fs/promises instead of Bun APIs.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { inject, injectable } from "@needle-di/core";
import type { GenericMessage, IConfig, RunnerCallbacks } from "@openharness/sdk";
import { IConfigToken } from "@openharness/sdk";
import type { IRecorder, IRecordingFactory, RecordedSession } from "./types.js";

/**
 * Check if a file exists using Node.js fs.
 */
async function fileExists(path: string): Promise<boolean> {
	try {
		await readFile(path);
		return true;
	} catch {
		return false;
	}
}

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
		runFn: (args: {
			prompt: string;
			options: Options;
			callbacks?: RunnerCallbacks;
		}) => Promise<GenericMessage | undefined>;
	}): Promise<GenericMessage | undefined> {
		const { prompt, options, callbacks, runFn } = args;
		const filePath = join(this.config.recordingsDir, this.category, `${this.id}.jsonl`);

		// Replay mode: read from file and fire callbacks
		if (this.config.isReplayMode) {
			if (await fileExists(filePath)) {
				const content = await readFile(filePath, "utf-8");
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
					let lastMessage: GenericMessage | undefined;
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
		const capturedMessages: GenericMessage[] = [];

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
		const dir = dirname(filePath);
		await mkdir(dir, { recursive: true });

		// Append to file
		const existing = (await fileExists(filePath)) ? await readFile(filePath, "utf-8") : "";
		await writeFile(filePath, `${existing + JSON.stringify(session)}\n`);

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
