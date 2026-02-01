/**
 * Simple test workflow for E2E validation.
 *
 * Uses the state-first API: agent(), phase(), workflow().
 *
 * @module
 */

import { z } from "zod"

import { agent, phase, workflow } from "@open-harness/core"

// ─────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────

interface TestState {
  goal: string
  tasks: Array<string>
  verdict: "continue" | "done" | null
}

type Phases = "planning" | "done"

// ─────────────────────────────────────────────────────────────────
// Agents
// ─────────────────────────────────────────────────────────────────

const planner = agent<TestState, { tasks: Array<string> }>({
  name: "planner",
  model: "claude-sonnet-4-5",
  output: z.object({ tasks: z.array(z.string()) }),
  prompt: (state) => `Create a task list for: ${state.goal}`,
  update: (output, draft) => {
    for (const task of output.tasks) {
      draft.tasks.push(task)
    }
  }
})

// ─────────────────────────────────────────────────────────────────
// Workflow
// ─────────────────────────────────────────────────────────────────

const testWorkflow = workflow<TestState, string, Phases>({
  name: "test-e2e",
  initialState: {
    goal: "",
    tasks: [],
    verdict: null
  },
  start: (input, draft) => {
    draft.goal = input
  },
  phases: {
    planning: {
      run: planner,
      next: "done"
    },
    done: phase.terminal<TestState, Phases>()
  }
})

export default testWorkflow
