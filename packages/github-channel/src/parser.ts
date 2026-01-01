export type ParsedCommand =
	| { type: "pause" }
	| { type: "resume" }
	| { type: "abort"; reason?: string }
	| { type: "status" }
	| { type: "reply"; promptId: string; text: string }
	| { type: "choose"; promptId: string; choice: string }
	| { type: "help" }
	| { type: "unknown" };

export function parseSlashCommand(
	text: string,
	allowlist: string[],
): ParsedCommand | null {
	const trimmed = text.trim();
	if (!trimmed.startsWith("/")) {
		return null; // Not a command
	}

	const parts = trimmed.slice(1).split(/\s+/);
	const cmd = parts[0]?.toLowerCase();

	if (!cmd) {
		return null;
	}

	// Check allowlist
	if (allowlist.length > 0 && !allowlist.includes(cmd)) {
		return { type: "unknown" };
	}

	switch (cmd) {
		case "pause":
			return { type: "pause" };
		case "resume":
			return { type: "resume" };
		case "abort": {
			const reason = parts.slice(1).join(" ") || undefined;
			return { type: "abort", reason };
		}
		case "status":
			return { type: "status" };
		case "reply": {
			if (parts.length < 3) {
				return { type: "unknown" };
			}
			const promptId = parts[1];
			if (!promptId) {
				return { type: "unknown" };
			}
			const text = parts.slice(2).join(" ");
			return { type: "reply", promptId, text };
		}
		case "choose": {
			if (parts.length < 3) {
				return { type: "unknown" };
			}
			const promptId = parts[1];
			if (!promptId) {
				return { type: "unknown" };
			}
			const choice = parts.slice(2).join(" ");
			return { type: "choose", promptId, choice };
		}
		case "help":
			return { type: "help" };
		default:
			return { type: "unknown" };
	}
}

export type ParsedReaction =
	| { type: "confirm" } // ✅ or +1
	| { type: "pause" } // ⏸️ or +1 (context-dependent)
	| { type: "resume" } // ▶️ or rocket
	| { type: "abort" } // 🛑 or -1
	| { type: "retry" } // 🔁 or heart
	| { type: "status" } // eyes (view status)
	| { type: "thumbsUp" } // 👍
	| { type: "thumbsDown" } // 👎
	| { type: "unknown" };

export function parseReaction(emoji: string): ParsedReaction {
	const normalized = emoji.trim();

	// GitHub Reactions API names (primary)
	switch (normalized) {
		case "+1":
		case "thumbs_up":
			// +1 can be confirm (if prompt open) or pause
			// Context will be determined by dispatcher
			return { type: "confirm" };
		case "rocket":
			return { type: "resume" };
		case "-1":
		case "thumbs_down":
			return { type: "abort" };
		case "eyes":
			return { type: "status" };
		case "heart":
			return { type: "retry" };
		case "👍":
			return { type: "thumbsUp" };
		case "👎":
			return { type: "thumbsDown" };
	}

	// Emoji character fallback (for backwards compatibility in tests)
	switch (normalized) {
		case "✅":
		case "✓":
		case "✔":
			return { type: "confirm" };
		case "⏸️":
		case "⏸":
			return { type: "pause" };
		case "▶️":
		case "▶":
			return { type: "resume" };
		case "🛑":
		case "🛑️":
			return { type: "abort" };
		case "🔁":
			return { type: "retry" };
		default:
			return { type: "unknown" };
	}
}
