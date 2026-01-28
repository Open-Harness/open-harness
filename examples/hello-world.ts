/**
 * Minimal test workflow for CLI integration testing.
 *
 * Single-agent simple workflow that asks Haiku to generate a greeting.
 * Uses the cheapest/fastest model to minimize cost during testing.
 */

import { z } from "zod"

interface State {
  input: string
  greeting: string
  done: boolean
}

export default {
  name: "hello-world",
  initialState: { input: "", greeting: "", done: false } satisfies State,
  start: (input: string, draft: State) => {
    draft.input = input
  },
  agent: {
    name: "greeter",
    model: "claude-haiku-4-5",
    output: z.object({
      greeting: z.string().describe("A friendly greeting message")
    }),
    prompt: (state: State) =>
      `Generate a short, friendly greeting for someone who said: "${state.input}". Respond with a JSON object containing a "greeting" field.`,
    update: (output: { greeting: string }, draft: State) => {
      draft.greeting = output.greeting
      draft.done = true
    }
  },
  until: (state: State) => state.done
}
