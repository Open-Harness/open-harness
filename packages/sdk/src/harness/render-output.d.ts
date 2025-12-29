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
export declare class RenderOutput {
    private config;
    private lines;
    private lineIdCounter;
    constructor(config?: RenderOutputConfig);
    /**
     * Write a line to output.
     *
     * @param text - Text to write
     * @returns Line ID for updates
     */
    line(text: string): string;
    /**
     * Update an existing line by ID.
     *
     * Note: Only works if terminal supports cursor movement.
     * Falls back to writing a new line if not supported.
     *
     * @param lineId - ID from line() call
     * @param text - New text for the line
     */
    update(lineId: string, text: string): void;
    /**
     * Create a spinner for async operations.
     *
     * @param text - Initial spinner text
     * @returns Spinner control object
     */
    spinner(text: string): Spinner;
    /**
     * Show a progress bar.
     *
     * @param current - Current progress value
     * @param total - Total value
     * @param label - Optional label
     */
    progress(current: number, total: number, label?: string): void;
    /**
     * Clear all output.
     */
    clear(): void;
    /**
     * Add a blank line.
     */
    newline(): void;
}
