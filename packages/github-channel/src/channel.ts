import pino from "pino";
import { GithubInputHandler } from "./input-handler.js";
import { initialState, reduce } from "./reducer.js";
import { render } from "./renderer.js";
import type { Attachment, GithubChannelConfig, Hub } from "./types.js";
import { GithubWriter } from "./writer.js";

export function createGithubChannel(config: GithubChannelConfig): Attachment {
	return (hub: Hub) => {
		const logger = pino({ level: config.logLevel || "info" });
		let state = initialState();
		const maxRecent = config.maxRecent ?? 50;
		const debounceMs = config.debounceMs ?? 3000;

		// Get token from env
		const token = process.env[config.tokenEnv];
		if (!token) {
			throw new Error(`Missing token in env var: ${config.tokenEnv}`);
		}

		// Validate exactly one target
		if (
			(config.issueNumber === undefined && config.prNumber === undefined) ||
			(config.issueNumber !== undefined && config.prNumber !== undefined)
		) {
			throw new Error(
				"Exactly one of issueNumber or prNumber must be provided",
			);
		}

		const writer = new GithubWriter(
			{
				repo: config.repo,
				issueNumber: config.issueNumber,
				prNumber: config.prNumber,
				token,
				debounceMs,
			},
			logger,
		);

		// Setup input handler if polling is enabled
		const pollIntervalMs = config.pollIntervalMs ?? 5000;
		let inputHandler: GithubInputHandler | null = null;
		let stopPolling: (() => void) | null = null;

		// Single ensureComment call - create comment, render initial state, start polling
		void writer
			.ensureComment()
			.then((commentId) => {
				// Render initial dashboard immediately after comment creation
				const rendered = render(state);
				writer.queueUpdate(rendered);

				// Setup input handler for polling
				if (pollIntervalMs > 0) {
					inputHandler = new GithubInputHandler(
						{
							repo: config.repo,
							issueNumber: config.issueNumber,
							prNumber: config.prNumber,
							token,
							allowCommands: config.allowCommands ?? [],
							pollIntervalMs,
						},
						commentId,
						hub,
						() => {
							// Get open prompt ID from state
							const openPrompt = state.prompts.find((p) => p.status === "open");
							return openPrompt?.promptId;
						},
						logger,
					);
					stopPolling = inputHandler.startPolling();
				}
			})
			.catch((err) => {
				logger.error({ err }, "Failed to setup channel");
				hub.emit({ type: "channel:error", message: String(err) });
			});

		// Subscribe to events
		const unsubscribe = hub.subscribe(
			["phase:*", "task:*", "agent:*", "session:*", "narrative", "harness:*"],
			(event) => {
				try {
					state = reduce(state, event, maxRecent);
					const rendered = render(state);
					writer.queueUpdate(rendered);
				} catch (err) {
					logger.error(
						{ err, eventType: event.event.type },
						"Error processing event",
					);
					hub.emit({
						type: "channel:error",
						message: `Error processing ${event.event.type}: ${String(err)}`,
					});
				}
			},
		);

		// Cleanup
		return async () => {
			unsubscribe();
			if (stopPolling) {
				stopPolling();
			}
			// Optionally delete comment on shutdown (commented out by default)
			// await writer.deleteComment();
		};
	};
}
