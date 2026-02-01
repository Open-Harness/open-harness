/**
 * Terminal spinner using log-update for reliable in-place rendering.
 *
 * Provides a clean spinner that works reliably in terminal environments.
 *
 * @module
 */

import logUpdate from "log-update"
import * as colors from "colorette"

// Spinner frames
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const SPINNER_INTERVAL = 80

/**
 * Terminal spinner that updates in place using log-update.
 *
 * Uses the same rendering approach as listr2 for reliable terminal output.
 */
export class Spinner {
  private interval: ReturnType<typeof setInterval> | null = null
  private frameIndex = 0
  private message = ""
  private isRunning = false

  /**
   * Start the spinner with a message.
   */
  start(message: string): void {
    if (this.isRunning) {
      this.update(message)
      return
    }

    this.message = message
    this.frameIndex = 0
    this.isRunning = true

    // Initial render
    this.render()

    // Start animation
    this.interval = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % SPINNER_FRAMES.length
      this.render()
    }, SPINNER_INTERVAL)
  }

  /**
   * Update the spinner message.
   */
  update(message: string): void {
    this.message = message
    if (this.isRunning) {
      this.render()
    }
  }

  /**
   * Stop the spinner and clear the line.
   */
  stop(): void {
    if (!this.isRunning) return

    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }

    // Clear the spinner line
    logUpdate.clear()
    this.isRunning = false
  }

  /**
   * Stop with a success message.
   */
  succeed(message?: string): void {
    this.stopWithSymbol("✓", message ?? this.message, "green")
  }

  /**
   * Stop with a failure message.
   */
  fail(message?: string): void {
    this.stopWithSymbol("✗", message ?? this.message, "red")
  }

  /**
   * Stop with a custom symbol and color.
   */
  private stopWithSymbol(
    symbol: string,
    message: string,
    color: "green" | "red" | "yellow" | "blue"
  ): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }

    const colorFn = colors[color] ?? ((s: string) => s)
    logUpdate(`${colorFn(symbol)} ${message}`)
    logUpdate.done()
    this.isRunning = false
  }

  /**
   * Render the current frame.
   */
  private render(): void {
    const frame = SPINNER_FRAMES[this.frameIndex]
    const output = `${colors.cyan(frame)} ${colors.dim(this.message)}`
    logUpdate(output)
  }
}

/**
 * Create a new spinner instance.
 */
export const createSpinner = (): Spinner => new Spinner()
