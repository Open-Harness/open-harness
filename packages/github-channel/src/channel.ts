import pino from "pino";
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

		// Ensure comment exists on start
		void writer.ensureComment().catch((err) => {
			logger.error({ err }, "Failed to ensure comment");
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
			// Optionally delete comment on shutdown (commented out by default)
			// await writer.deleteComment();
		};
	};
}
