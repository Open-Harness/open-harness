/**
 * RenderOutput - Terminal output helpers for renderers
 *
 * Provides a clean API for terminal output operations:
 * - Line output and updates
 * - Spinner animations
 * - Progress bars
 *
 * @module harness/render-output
 */

/**
 * Spinner control interface for async operations.
 */
export interface Spinner {
	/** Update spinner text while running */
	update(text: string): void;
	/** Stop spinner with success indicator */
	succeed(text?: string): void;
	/** Stop spinner with failure indicator */
	fail(text?: string): void;
	/** Stop spinner without status indicator */
	stop(): void;
}

/**
 * Configuration for RenderOutput.
 */
export interface RenderOutputConfig {
	/** Enable color output */
	colors?: boolean;
	/** Enable Unicode symbols */
	unicode?: boolean;
	/** Custom write function (defaults to console.log) */
	write?: (text: string) => void;
	/** Whether terminal supports cursor movement */
	supportsUpdates?: boolean;
}

/**
 * RenderOutput - Helper class for terminal output.
 *
 * Provides methods for line output, spinners, and progress bars.
 * Supports both simple logging and dynamic terminal updates.
 *
 * @example
 * ```typescript
 * const output = new RenderOutput({ colors: true });
 *
 * output.line('Starting process...');
 * const spinner = output.spinner('Loading');
 * await doWork();
 * spinner.succeed('Done!');
 * ```
 */
export class RenderOutput {
	private config: Required<RenderOutputConfig>;
	private lines: Map<string, string> = new Map();
	private lineIdCounter = 0;

	constructor(config: RenderOutputConfig = {}) {
		this.config = {
			colors: config.colors ?? true,
			unicode: config.unicode ?? true,
			write: config.write ?? ((text: string) => console.log(text)),
			supportsUpdates: config.supportsUpdates ?? false,
		};
	}

	/**
	 * Write a line to output.
	 *
	 * @param text - Text to write
	 * @returns Line ID for updates
	 */
	line(text: string): string {
		const lineId = `line-${++this.lineIdCounter}`;
		this.lines.set(lineId, text);
		this.config.write(text);
		return lineId;
	}

	/**
	 * Update an existing line by ID.
	 *
	 * Note: Only works if terminal supports cursor movement.
	 * Falls back to writing a new line if not supported.
	 *
	 * @param lineId - ID from line() call
	 * @param text - New text for the line
	 */
	update(lineId: string, text: string): void {
		if (!this.lines.has(lineId)) {
			// Line doesn't exist, write as new
			this.config.write(text);
			return;
		}

		this.lines.set(lineId, text);

		if (this.config.supportsUpdates) {
			// In a real implementation, this would use ANSI codes
			// to move cursor and update the line
			this.config.write(`\r${text}`);
		} else {
			// Fall back to writing a new line
			this.config.write(text);
		}
	}

	/**
	 * Create a spinner for async operations.
	 *
	 * @param text - Initial spinner text
	 * @returns Spinner control object
	 */
	spinner(text: string): Spinner {
		const symbols = this.config.unicode
			? { success: "✓", fail: "✗", spin: "◐" }
			: { success: "[OK]", fail: "[FAIL]", spin: "[...]" };

		let currentText = text;
		let running = true;

		// Write initial state
		this.config.write(`${symbols.spin} ${currentText}`);

		return {
			update: (newText: string) => {
				if (!running) return;
				currentText = newText;
				this.config.write(`${symbols.spin} ${currentText}`);
			},
			succeed: (finalText?: string) => {
				if (!running) return;
				running = false;
				const msg = finalText ?? currentText;
				this.config.write(`${symbols.success} ${msg}`);
			},
			fail: (finalText?: string) => {
				if (!running) return;
				running = false;
				const msg = finalText ?? currentText;
				this.config.write(`${symbols.fail} ${msg}`);
			},
			stop: () => {
				running = false;
			},
		};
	}

	/**
	 * Show a progress bar.
	 *
	 * @param current - Current progress value
	 * @param total - Total value
	 * @param label - Optional label
	 */
	progress(current: number, total: number, label?: string): void {
		const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
		const barWidth = 20;
		const filled = Math.round((current / total) * barWidth);
		const empty = barWidth - filled;

		const bar = this.config.unicode ? "█".repeat(filled) + "░".repeat(empty) : "#".repeat(filled) + "-".repeat(empty);

		const labelPart = label ? `${label}: ` : "";
		this.config.write(`${labelPart}[${bar}] ${percentage}% (${current}/${total})`);
	}

	/**
	 * Clear all output.
	 */
	clear(): void {
		this.lines.clear();
		// In a real TTY implementation, this would send clear codes
	}

	/**
	 * Add a blank line.
	 */
	newline(): void {
		this.config.write("");
	}
}
