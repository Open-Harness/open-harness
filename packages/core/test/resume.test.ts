/**
 * Tests for resume options in ExecuteOptions.
 *
 * Validates that executeWorkflow can resume from a checkpoint state
 * and phase, skipping the workflow's start() function.
 * Uses ProviderRecorder playback with pre-seeded fixtures.
 */

import { describe, expect, it } from "vitest"
import { z } from "zod"

import { tagToEventName } from "../src/Domain/Events.js"
import { agent } from "../src/Engine/agent.js"
import { phase } from "../src/Engine/phase.js"
import { type ExecuteOptions, executeWorkflow } from "../src/Engine/runtime.js"
import { workflow } from "../src/Engine/workflow.js"
import { runWithTestRuntime, type SimpleFixture, testProvider } from "./helpers/test-provider.js"

// ─────────────────────────────────────────────────────────────────
// Test State and Types
// ─────────────────────────────────────────────────────────────────

interface ResumeTestState {
  goal: string
  planItems: Array<string>
  workResults: Array<string>
  verdict: "continue" | "done" | null
}

type ResumePhases = "planning" | "working" | "judging" | "done"

// ─────────────────────────────────────────────────────────────────
// Shared schemas
// ─────────────────────────────────────────────────────────────────

const planSchema = z.object({ plan: z.string() })
const resultSchema = z.object({ result: z.string() })
const verdictSchema = z.object({ verdict: z.enum(["continue", "done"]) })
const providerOptions = { model: "claude-sonnet-4-5" }

// ─────────────────────────────────────────────────────────────────
// Test Agents (per ADR-010: agents own provider directly)
// ─────────────────────────────────────────────────────────────────

const plannerAgent = agent<ResumeTestState, { plan: string }>({
  name: "planner",
  provider: testProvider,
  output: planSchema,
  prompt: (state) => `Plan for: ${state.goal}`,
  update: (output, draft) => {
    draft.planItems.push(output.plan)
  }
})

const workerAgent = agent<ResumeTestState, { result: string }>({
  name: "worker",
  provider: testProvider,
  output: resultSchema,
  prompt: (state) => `Work on: ${state.planItems.join(", ")}`,
  update: (output, draft) => {
    draft.workResults.push(output.result)
  }
})

const judgeAgent = agent<ResumeTestState, { verdict: "continue" | "done" }>({
  name: "judge",
  provider: testProvider,
  output: verdictSchema,
  prompt: (state) => `Judge: ${state.workResults.join(", ")}`,
  update: (output, draft) => {
    draft.verdict = output.verdict
  }
})

// ─────────────────────────────────────────────────────────────────
// Fixture definitions (all prompts across all resume tests)
// ─────────────────────────────────────────────────────────────────

const fixtures: ReadonlyArray<SimpleFixture> = [
  // Planner
  {
    prompt: "Plan for: Build an API",
    output: { plan: "Step from planner" },
    outputSchema: planSchema,
    providerOptions
  },
  // Worker variants (different planItems states)
  {
    prompt: "Work on: initial-plan-from-start, Step from planner",
    output: { result: "Work completed" },
    outputSchema: resultSchema,
    providerOptions
  },
  {
    prompt: "Work on: ",
    output: { result: "Work completed" },
    outputSchema: resultSchema,
    providerOptions
  },
  {
    prompt: "Work on: already-planned",
    output: { result: "Work completed" },
    outputSchema: resultSchema,
    providerOptions
  },
  // Judge variants
  {
    prompt: "Judge: Work completed",
    output: { verdict: "done" },
    outputSchema: verdictSchema,
    providerOptions
  },
  {
    prompt: "Judge: pre-worked",
    output: { verdict: "done" },
    outputSchema: verdictSchema,
    providerOptions
  }
]

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe("executeWorkflow with resume options", () => {
  const phasedWorkflow = workflow<ResumeTestState, string, ResumePhases>({
    name: "resume-test-workflow",
    initialState: {
      goal: "",
      planItems: [],
      workResults: [],
      verdict: null
    },
    start: (input, draft) => {
      draft.goal = input
      draft.planItems.push("initial-plan-from-start")
    },
    phases: {
      planning: { run: plannerAgent, next: "working" },
      working: { run: workerAgent, next: "judging" },
      judging: {
        run: judgeAgent,
        next: (state) => (state.verdict === "done" ? "done" : "planning")
      },
      done: phase.terminal<ResumeTestState, ResumePhases>()
    }
  })

  it("skips start() and uses resumeState when provided", async () => {
    // Simulate a checkpoint: planning already happened, resume from "working" phase
    const checkpointState: ResumeTestState = {
      goal: "Build an API",
      planItems: ["initial-plan-from-start", "Step from planner"],
      workResults: [],
      verdict: null
    }

    const options: ExecuteOptions<string> = {
      input: "Build an API", // input is still required but should be ignored for state init
      sessionId: "resume-session-1",
      resumeState: checkpointState,
      resumePhase: "working"
    }

    const result = await runWithTestRuntime(
      executeWorkflow(phasedWorkflow, options),
      { fixtures }
    )

    // start() should NOT have been called — "initial-plan-from-start" was in our
    // checkpoint already, but we should NOT see it added twice
    const initialPlanCount = result.state.planItems.filter(
      (p) => p === "initial-plan-from-start"
    ).length
    expect(initialPlanCount).toBe(1) // Only from checkpoint, not from start()

    // The planner phase should NOT have run (we resumed at "working")
    const plannerSteps = result.state.planItems.filter((p) => p === "Step from planner")
    expect(plannerSteps.length).toBe(1) // Only from checkpoint, not re-run

    // The worker should have run (working phase)
    expect(result.state.workResults).toContain("Work completed")

    // The judge should have run (judging phase) and said "done"
    expect(result.state.verdict).toBe("done")
  })

  it("starts from the beginning when no resume options are provided", async () => {
    const options: ExecuteOptions<string> = {
      input: "Build an API",
      sessionId: "no-resume-session"
    }

    const result = await runWithTestRuntime(
      executeWorkflow(phasedWorkflow, options),
      { fixtures }
    )

    // start() should have been called
    expect(result.state.planItems).toContain("initial-plan-from-start")

    // All phases should have executed from planning
    expect(result.state.planItems).toContain("Step from planner")
    expect(result.state.workResults).toContain("Work completed")
    expect(result.state.verdict).toBe("done")
  })

  it("emits workflow:started event even when resuming", async () => {
    const checkpointState: ResumeTestState = {
      goal: "Resume test",
      planItems: [],
      workResults: [],
      verdict: null
    }

    const result = await runWithTestRuntime(
      executeWorkflow(phasedWorkflow, {
        input: "Resume test",
        sessionId: "resume-events-session",
        resumeState: checkpointState,
        resumePhase: "working"
      }),
      { fixtures }
    )

    const startedEvents = result.events.filter((e) => e.name === tagToEventName.WorkflowStarted)
    expect(startedEvents.length).toBe(1)

    const completedEvents = result.events.filter((e) => e.name === tagToEventName.WorkflowCompleted)
    expect(completedEvents.length).toBe(1)
  })

  it("does not emit state:intent for start() when resuming", async () => {
    const checkpointState: ResumeTestState = {
      goal: "Check events",
      planItems: ["already-planned"],
      workResults: [],
      verdict: null
    }

    const result = await runWithTestRuntime(
      executeWorkflow(phasedWorkflow, {
        input: "Check events",
        sessionId: "resume-no-start-event",
        resumeState: checkpointState,
        resumePhase: "working"
      }),
      { fixtures }
    )

    // The first state:intent event should NOT be from start()
    // (there should be no goal-setting patch from start)
    const stateEvents = result.events.filter((e) => e.name === tagToEventName.StateIntent)
    expect(stateEvents.length).toBeGreaterThan(0)

    // First state update should be from the worker agent, not from start()
    const firstPayload = stateEvents[0].payload as {
      state: ResumeTestState
    }
    // The worker would have added "Work completed" to workResults
    expect(firstPayload.state.workResults).toContain("Work completed")
  })

  it("resumes at the correct phase and skips earlier phases", async () => {
    const checkpointState: ResumeTestState = {
      goal: "Phase skip test",
      planItems: ["pre-planned"],
      workResults: ["pre-worked"],
      verdict: null
    }

    // Resume directly at the judging phase
    const result = await runWithTestRuntime(
      executeWorkflow(phasedWorkflow, {
        input: "Phase skip test",
        sessionId: "phase-skip-session",
        resumeState: checkpointState,
        resumePhase: "judging"
      }),
      { fixtures }
    )

    // Planning and working should NOT have run again
    expect(result.state.planItems).toEqual(["pre-planned"])
    expect(result.state.workResults).toEqual(["pre-worked"])

    // Judge should have run
    expect(result.state.verdict).toBe("done")

    // Verify phase events: should see judging and done, not planning or working
    const phaseEnteredEvents = result.events.filter((e) => e.name === tagToEventName.PhaseEntered)
    const phaseNames = phaseEnteredEvents.map(
      (e) => (e.payload as { phase: string }).phase
    )
    expect(phaseNames).not.toContain("planning")
    expect(phaseNames).not.toContain("working")
    expect(phaseNames).toContain("judging")
    expect(phaseNames).toContain("done")
  })
})
