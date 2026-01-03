/**
 * Horizon TUI Theme
 *
 * Color constants and styling for the terminal UI.
 */

export const colors = {
	// Status colors
	success: "green",
	error: "red",
	warning: "yellow",
	info: "cyan",
	muted: "gray",

	// Node status colors
	nodeIdle: "white",
	nodeRunning: "yellow",
	nodeComplete: "green",
	nodeError: "red",
	nodeSkipped: "gray",

	// UI element colors
	border: "blue",
	borderFocus: "cyan",
	label: "white",
	text: "white",
	textMuted: "gray",

	// Agent output colors
	agentText: "white",
	agentThinking: "magenta",
	agentTool: "cyan",

	// Task colors
	taskPending: "gray",
	taskActive: "yellow",
	taskComplete: "green",
} as const;

export const symbols = {
	// Status indicators
	running: "◉",
	complete: "✓",
	error: "✗",
	pending: "○",
	paused: "⏸",

	// Task indicators
	taskPending: "○",
	taskActive: "▶",
	taskComplete: "✓",

	// Flow indicators
	arrowDown: "↓",
	arrowRight: "→",
	loop: "↻",

	// UI elements
	bullet: "•",
	separator: "─",
} as const;

export const boxStyles = {
	default: {
		border: "line" as const,
		style: {
			border: { fg: colors.border },
			label: { fg: colors.label },
		},
	},
	focused: {
		border: "line" as const,
		style: {
			border: { fg: colors.borderFocus },
			label: { fg: colors.label, bold: true },
		},
	},
} as const;

/**
 * Format duration in human-readable form.
 */
export function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	const minutes = Math.floor(ms / 60000);
	const seconds = Math.floor((ms % 60000) / 1000);
	return `${minutes}m ${seconds}s`;
}

/**
 * Format a timestamp as HH:MM:SS.
 */
export function formatTime(date: Date = new Date()): string {
	return date.toTimeString().slice(0, 8);
}

/**
 * Truncate text to fit within a width.
 */
export function truncate(text: string, maxWidth: number): string {
	if (text.length <= maxWidth) return text;
	return `${text.slice(0, maxWidth - 1)}…`;
}
