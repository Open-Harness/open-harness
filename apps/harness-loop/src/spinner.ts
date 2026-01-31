/**
 * Terminal spinner utility for showing progress during operations.
 *
 * Uses ANSI escape sequences to update in place and hide/show cursor.
 *
 * @module
 */

const HIDE_CURSOR = "\x1b[?25l"
const SHOW_CURSOR = "\x1b[?25h"
const CLEAR_LINE = "\r\x1b[K"

const DIM = "\x1b[2m"
const RESET = "\x1b[0m"

/**
 * Animated terminal spinner that updates in place.
 */
export class Spinner {
  private frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
  private interval: ReturnType<typeof setInterval> | null = null
  private frameIndex = 0
  private message: string = ""
  private isRunning = false

  /**
   * Start the spinner with a message.
   */
  start(message: string): void {
    if (this.isRunning) return

    this.message = message
    this.frameIndex = 0
    this.isRunning = true

    // Hide cursor
    process.stdout.write(HIDE_CURSOR)

    // Render initial frame
    this.render()

    // Start animation
    this.interval = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length
      this.render()
    }, 80)
  }

  /**
   * Update the spinner message without stopping.
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

    // Clear line and show cursor
    process.stdout.write(CLEAR_LINE + SHOW_CURSOR)
    this.isRunning = false
  }

  /**
   * Render the current frame.
   */
  private render(): void {
    const frame = this.frames[this.frameIndex]
    process.stdout.write(`${CLEAR_LINE}${DIM}${frame} ${this.message}${RESET}`)
  }
}
