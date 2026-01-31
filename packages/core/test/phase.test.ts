/**
 * Tests for Engine/phase.ts
 *
 * Validates the phase() factory function, PhaseDef types,
 * and behavioral assertions verifying next() routing during execution.
 */

import { describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { agent } from "../src/Engine/agent.js"
import { type HumanConfig, phase, type PhaseDef } from "../src/Engine/phase.js"
import { run } from "../src/Engine/run.js"
import { workflow } from "../src/Engine/workflow.js"
import { seedRecorder, type SimpleFixture, testProvider } from "./helpers/test-provider.js"

// ─────────────────────────────────────────────────────────────────
// Test State and Phases
// ─────────────────────────────────────────────────────────────────

interface TestState {
  goal: string
  tasks: Array<{ id: string; status: "pending" | "completed" }>
  approved: boolean
}

type TestPhases = "planning" | "working" | "review" | "done"

interface TaskContext {
  task: { id: string; status: "pending" | "completed" }
}

// Test agent (per ADR-010: agents own provider directly)
const testAgent = agent<TestState, { done: boolean }>({
  name: "test-agent",
  provider: testProvider,
  output: z.object({ done: z.boolean() }),
  prompt: (state) => `Goal: ${state.goal}`,
  update: () => {}
})

// Test agent with context (per ADR-010: agents own provider directly)
const contextAgent = agent<TestState, { result: string }, TaskContext>({
  name: "context-agent",
  provider: testProvider,
  output: z.object({ result: z.string() }),
  prompt: (state, ctx) => `Task ${ctx.task.id}: ${state.goal}`,
  update: (output, draft, ctx) => {
    const task = draft.tasks.find((t) => t.id === ctx.task.id)
    if (task) task.status = "completed"
  }
})

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe("phase() factory", () => {
  describe("validation", () => {
    it("throws if terminal and next are both specified", () => {
      expect(() => {
        phase<TestState, TestPhases>({
          terminal: true,
          next: "done"
        })
      }).toThrow("Phase cannot have both 'terminal: true' and 'next'")
    })

    it("throws if neither terminal nor next is specified (without human)", () => {
      expect(() => {
        phase<TestState, TestPhases>({
          run: testAgent
        })
      }).toThrow("Phase requires 'next' transition or 'terminal: true'")
    })

    it("throws if parallel is specified without forEach", () => {
      expect(() => {
        phase<TestState, TestPhases>({
          run: testAgent,
          parallel: 5,
          next: "done"
        })
      }).toThrow("Phase 'parallel' requires 'forEach'")
    })

    it("throws if onResponse is specified without human", () => {
      expect(() => {
        phase<TestState, TestPhases>({
          run: testAgent,
          onResponse: () => {},
          next: "done"
        })
      }).toThrow("Phase 'onResponse' requires 'human' configuration")
    })
  })

  describe("simple agent phase", () => {
    it("creates phase with agent and static next", () => {
      const p = phase<TestState, TestPhases>({
        run: testAgent,
        next: "working"
      })

      expect(p.run).toBe(testAgent)
      expect(p.next).toBe("working")
      expect(p.terminal).toBeUndefined()
    })

    it("creates phase with agent and until condition", () => {
      const p = phase<TestState, TestPhases>({
        run: testAgent,
        until: (state, output) => (output as { done: boolean })?.done === true,
        next: "working"
      })

      expect(p.until).toBeDefined()
      expect(p.until!({ goal: "", tasks: [], approved: false }, { done: true })).toBe(true)
      expect(p.until!({ goal: "", tasks: [], approved: false }, { done: false })).toBe(false)
    })

    it("creates phase with dynamic next", () => {
      const p = phase<TestState, TestPhases>({
        run: testAgent,
        next: (state) => (state.approved ? "done" : "review")
      })

      expect(typeof p.next).toBe("function")
      const nextFn = p.next as (state: TestState) => TestPhases
      expect(nextFn({ goal: "", tasks: [], approved: true })).toBe("done")
      expect(nextFn({ goal: "", tasks: [], approved: false })).toBe("review")
    })
  })

  describe("parallel agent phase", () => {
    it("creates phase with forEach and parallel", () => {
      const p = phase<TestState, TestPhases, TaskContext>({
        run: contextAgent,
        parallel: 5,
        forEach: (state) => state.tasks.filter((t) => t.status === "pending").map((task) => ({ task })),
        until: (state) => state.tasks.every((t) => t.status === "completed"),
        next: "review"
      })

      expect(p.parallel).toBe(5)
      expect(p.forEach).toBeDefined()

      const state: TestState = {
        goal: "test",
        tasks: [
          { id: "1", status: "pending" },
          { id: "2", status: "completed" }
        ],
        approved: false
      }
      const contexts = p.forEach!(state)
      expect(contexts).toHaveLength(1)
      expect(contexts[0].task.id).toBe("1")
    })
  })

  describe("human-in-the-loop phase", () => {
    it("creates phase with human configuration", () => {
      const p = phase<TestState, TestPhases>({
        human: {
          prompt: (state) => `Review goal: ${state.goal}`,
          type: "approval"
        },
        onResponse: (response, draft) => {
          draft.approved = response === "approve"
        },
        next: (state) => (state.approved ? "done" : "planning")
      })

      expect(p.human).toBeDefined()
      // Type narrow: we know human is a static config, not a function
      const humanConfig = p.human as HumanConfig<TestState>
      expect(humanConfig.type).toBe("approval")
      expect((humanConfig.prompt as (state: TestState) => string)({ goal: "test", tasks: [], approved: false })).toBe(
        "Review goal: test"
      )
      expect(p.onResponse).toBeDefined()
    })

    it("creates choice-type human phase with options", () => {
      const p = phase<TestState, TestPhases>({
        human: {
          prompt: () => "Select an action",
          type: "choice",
          options: ["Continue", "Revise", "Cancel"]
        },
        next: "done"
      })

      // Type narrow: we know human is a static config, not a function
      const humanConfig = p.human as HumanConfig<TestState>
      expect(humanConfig.type).toBe("choice")
      expect(humanConfig.options).toEqual(["Continue", "Revise", "Cancel"])
    })

    it("allows human phase without next (if terminal)", () => {
      // Human phases can optionally not have next if they're terminal
      const p = phase<TestState, TestPhases>({
        human: {
          prompt: () => "Final confirmation",
          type: "approval"
        },
        terminal: true
      })

      expect(p.terminal).toBe(true)
    })
  })

  describe("terminal phase", () => {
    it("creates terminal phase via property", () => {
      const p = phase<TestState, TestPhases>({
        terminal: true
      })

      expect(p.terminal).toBe(true)
      expect(p.next).toBeUndefined()
    })

    it("creates terminal phase via shorthand", () => {
      const p = phase.terminal<TestState, TestPhases>()

      expect(p.terminal).toBe(true)
    })
  })
})

describe("PhaseDef type (compile-time)", () => {
  it("PhaseDef can be assigned from phase()", () => {
    const p: PhaseDef<TestState, TestPhases, void> = phase<TestState, TestPhases>({
      run: testAgent,
      next: "working"
    })

    expect(p.run).toBeDefined()
  })

  it("PhaseDef with context can be assigned", () => {
    const p: PhaseDef<TestState, TestPhases, TaskContext> = phase<TestState, TestPhases, TaskContext>({
      run: contextAgent,
      forEach: (state: TestState) => state.tasks.map((task) => ({ task })),
      next: "done"
    })

    expect(p.forEach).toBeDefined()
  })
})

describe("HumanConfig type (compile-time)", () => {
  // Note: Per ADR-002, only "approval" and "choice" are valid types.
  // For freeform text input, use "choice" with an "Other..." option.
  it("HumanConfig can be created with valid types", () => {
    const approval: HumanConfig<TestState> = {
      prompt: () => "Approve?",
      type: "approval"
    }

    const choice: HumanConfig<TestState> = {
      prompt: () => "Choose",
      type: "choice",
      options: ["A", "B", "C"]
    }

    expect(approval.type).toBe("approval")
    expect(choice.type).toBe("choice")
  })
})

// ─────────────────────────────────────────────────────────────────
// Behavioral: Phase next() routing during execution
// ─────────────────────────────────────────────────────────────────

describe("phase behavioral (next() routing)", () => {
  const providerOptions = { model: "claude-sonnet-4-5" }

  it("static next routes to the correct phase", async () => {
    type Phases = "step1" | "step2" | "done"

    interface StepState {
      value: string
    }

    const outputSchema = z.object({ value: z.string() })

    const step1Agent = agent<StepState, { value: string }>({
      name: "step1-agent",
      provider: testProvider,
      output: outputSchema,
      prompt: () => "Step 1",
      update: (output, draft) => {
        draft.value = output.value
      }
    })

    const step2Agent = agent<StepState, { value: string }>({
      name: "step2-agent",
      provider: testProvider,
      output: outputSchema,
      prompt: (state) => `Step 2: ${state.value}`,
      update: (output, draft) => {
        draft.value = output.value
      }
    })

    const fixtures: ReadonlyArray<SimpleFixture> = [
      {
        prompt: "Step 1",
        output: { value: "from-step1" },
        outputSchema,
        providerOptions
      },
      {
        prompt: "Step 2: from-step1",
        output: { value: "from-step2" },
        outputSchema,
        providerOptions
      }
    ]

    const w = workflow<StepState, string, Phases>({
      name: "static-routing-test",
      initialState: { value: "" },
      start: () => {},
      phases: {
        step1: { run: step1Agent, next: "step2" },
        step2: { run: step2Agent, next: "done" },
        done: phase.terminal<StepState, Phases>()
      }
    })

    const phaseChanges = vi.fn()

    const result = await run(w, {
      input: "go",
      runtime: {
        mode: "playback",
        recorder: await seedRecorder(fixtures),
        database: ":memory:"
      },
      observer: { onPhaseChanged: phaseChanges }
    })

    // Verify routing: step1 -> step2 -> done
    // First phase has fromPhase=undefined (no previous phase)
    expect(phaseChanges).toHaveBeenCalledTimes(3)
    expect(phaseChanges).toHaveBeenNthCalledWith(1, "step1", undefined)
    expect(phaseChanges).toHaveBeenNthCalledWith(2, "step2", "step1")
    expect(phaseChanges).toHaveBeenNthCalledWith(3, "done", "step2")

    // State accumulated through phases
    expect(result.state.value).toBe("from-step2")
    expect(result.exitPhase).toBe("done")
  })

  it("dynamic next routes based on state", async () => {
    type Phases = "check" | "approved" | "rejected"

    interface CheckState {
      score: number
    }

    const scoreSchema = z.object({ score: z.number() })

    const checkAgent = agent<CheckState, { score: number }>({
      name: "checker",
      provider: testProvider,
      output: scoreSchema,
      prompt: () => "Check score",
      update: (output, draft) => {
        draft.score = output.score
      }
    })

    const fixtures: ReadonlyArray<SimpleFixture> = [
      {
        prompt: "Check score",
        output: { score: 85 },
        outputSchema: scoreSchema,
        providerOptions
      }
    ]

    const w = workflow<CheckState, string, Phases>({
      name: "dynamic-routing-test",
      initialState: { score: 0 },
      start: () => {},
      phases: {
        check: {
          run: checkAgent,
          next: (state) => (state.score >= 70 ? "approved" : "rejected")
        },
        approved: phase.terminal<CheckState, Phases>(),
        rejected: phase.terminal<CheckState, Phases>()
      }
    })

    const result = await run(w, {
      input: "evaluate",
      runtime: {
        mode: "playback",
        recorder: await seedRecorder(fixtures),
        database: ":memory:"
      }
    })

    // Score is 85 >= 70, so dynamic next should route to "approved"
    expect(result.state.score).toBe(85)
    expect(result.exitPhase).toBe("approved")
  })

  it("until condition loops phase before transitioning", async () => {
    type Phases = "counting" | "done"

    interface CountState {
      count: number
    }

    const countSchema = z.object({ increment: z.number() })

    const counterAgent = agent<CountState, { increment: number }>({
      name: "counter",
      provider: testProvider,
      output: countSchema,
      prompt: (state) => `Count: ${state.count}`,
      update: (output, draft) => {
        draft.count += output.increment
      }
    })

    // Each call increments by 1 — we need fixtures for count=0, count=1
    const fixtures: ReadonlyArray<SimpleFixture> = [
      {
        prompt: "Count: 0",
        output: { increment: 1 },
        outputSchema: countSchema,
        providerOptions
      },
      {
        prompt: "Count: 1",
        output: { increment: 1 },
        outputSchema: countSchema,
        providerOptions
      }
    ]

    const w = workflow<CountState, string, Phases>({
      name: "until-loop-test",
      initialState: { count: 0 },
      start: () => {},
      phases: {
        counting: {
          run: counterAgent,
          until: (state) => state.count >= 2,
          next: "done"
        },
        done: phase.terminal<CountState, Phases>()
      }
    })

    const agentStartedCalls = vi.fn()

    const result = await run(w, {
      input: "go",
      runtime: {
        mode: "playback",
        recorder: await seedRecorder(fixtures),
        database: ":memory:"
      },
      observer: { onAgentStarted: agentStartedCalls }
    })

    // Agent should have been called twice (count=0 -> 1 -> 2, then until triggers)
    expect(agentStartedCalls).toHaveBeenCalledTimes(2)
    expect(result.state.count).toBe(2)
    expect(result.exitPhase).toBe("done")
  })
})
