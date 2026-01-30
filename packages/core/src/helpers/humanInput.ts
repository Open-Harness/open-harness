/**
 * Human input helpers for HITL (Human-in-the-Loop) workflows.
 *
 * Provides built-in handlers for common use cases per ADR-002.
 *
 * @module
 */

import * as readline from "readline"

/**
 * Human input handler interface.
 *
 * Defines the contract for handling human input requests in workflows.
 * Implementations can be CLI-based, web-based, or auto-approving for tests.
 */
export interface HumanInputHandler {
  /**
   * Request approval from a human.
   *
   * @param prompt - The prompt to display to the user
   * @returns Promise resolving to true if approved, false otherwise
   */
  approval: (prompt: string) => Promise<boolean>

  /**
   * Request a choice from a human.
   *
   * @param prompt - The prompt to display to the user
   * @param options - Array of options to choose from
   * @returns Promise resolving to the selected option
   */
  choice: (prompt: string, options: Array<string>) => Promise<string>
}

/**
 * CLI-based human input handler using readline.
 *
 * Shows prompts in terminal and waits for user response.
 * Uses Node.js built-in readline for portability.
 *
 * @returns HumanInputHandler that prompts via stdin/stdout
 *
 * @example
 * ```typescript
 * const handler = cliPrompt()
 * const approved = await handler.approval("Deploy to production?")
 * if (approved) {
 *   console.log("Deploying...")
 * }
 * ```
 */
export const cliPrompt = (): HumanInputHandler => ({
  approval: async (prompt: string): Promise<boolean> => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    return new Promise((resolve) => {
      rl.question(`${prompt} (y/n): `, (answer) => {
        rl.close()
        resolve(answer.toLowerCase().startsWith("y"))
      })
    })
  },

  choice: async (prompt: string, options: Array<string>): Promise<string> => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    const optionList = options.map((opt, i) => `${i + 1}. ${opt}`).join("\n")

    return new Promise((resolve) => {
      rl.question(`${prompt}\n${optionList}\nEnter number: `, (answer) => {
        rl.close()
        const idx = parseInt(answer, 10) - 1
        resolve(options[idx] || options[0])
      })
    })
  }
})

/**
 * Auto-approve handler for testing.
 *
 * Automatically approves all prompts and selects the first option.
 * Useful for automated testing and CI/CD pipelines.
 *
 * @returns HumanInputHandler that auto-approves everything
 *
 * @example
 * ```typescript
 * const handler = autoApprove()
 * const approved = await handler.approval("Any prompt?") // Always true
 * const choice = await handler.choice("Pick one", ["A", "B"]) // Always "A"
 * ```
 */
export const autoApprove = (): HumanInputHandler => ({
  approval: async (_prompt: string): Promise<boolean> => true,
  choice: async (_prompt: string, options: Array<string>): Promise<string> => options[0]
})
