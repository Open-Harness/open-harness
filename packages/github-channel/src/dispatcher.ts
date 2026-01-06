import type { ParsedCommand, ParsedReaction } from "./parser.js";
import type { Hub } from "./types.js";

export type DispatchContext = {
	openPromptId?: string; // For reactions that need prompt context
	commenter?: string; // Who issued the command
};

export type DispatchResult = {
	handled: boolean;
	ack?: string;
};

export function dispatchCommand(
	hub: Hub,
	command: ParsedCommand | ParsedReaction,
	context: DispatchContext = {},
): DispatchResult {
	switch (command.type) {
		case "abort": {
			const reason = "reason" in command ? command.reason : undefined;
			hub.abort(reason);
			return { handled: true, ack: "Aborting workflow" };
		}

		case "reply":
			hub.reply(command.promptId, {
				content: command.text,
				timestamp: new Date(),
			});
			return { handled: true, ack: `Replied to ${command.promptId}` };

		case "choose":
			hub.reply(command.promptId, {
				content: command.choice,
				choice: command.choice,
				timestamp: new Date(),
			});
			return { handled: true, ack: `Chose "${command.choice}"` };

		case "pause":
			hub.emit({ type: "channel:pause", source: "github" });
			return { handled: true, ack: "Pause requested" };

		case "resume":
			hub.emit({ type: "channel:resume", source: "github" });
			return { handled: true, ack: "Resume requested" };

		case "status":
			return { handled: true }; // No-op, dashboard shows status

		case "help":
			return {
				handled: true,
				ack: "Commands: /pause /resume /abort /reply /choose /status",
			};

		case "confirm":
			if (context.openPromptId) {
				hub.reply(context.openPromptId, {
					content: "confirmed",
					timestamp: new Date(),
				});
				return { handled: true, ack: "Confirmed" };
			}
			// If no prompt open, +1 reaction acts as pause
			hub.emit({ type: "channel:pause", source: "github" });
			return { handled: true, ack: "Pause requested" };

		// Reaction-based controls
		case "retry":
			hub.emit({ type: "channel:retry", source: "github" });
			return { handled: true };

		case "thumbsUp":
		case "thumbsDown":
			hub.emit({
				type: "channel:feedback",
				value: command.type,
				source: "github",
			});
			return { handled: true };

		default:
			return { handled: false };
	}
}
