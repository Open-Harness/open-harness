/**
 * Tests for Engine/workflow.ts
 *
 * Validates the workflow() factory function, WorkflowDef types,
 * and behavioral assertions verifying phase transitions during execution.
 */

import { describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { agent } from "../src/Engine/agent.js"
import { execute, type RuntimeConfig } from "../src/Engine/execute.js"
import { phase } from "../src/Engine/phase.js"
import { run } from "../src/Engine/run.js"
import { EVENTS } from "../src/Engine/types.js"
import {
  isPhaseWorkflow,
  isSimpleWorkflow,
  type PhaseWorkflowDef,
  type SimpleWorkflowDef,
  workflow
} from "../src/Engine/workflow.js"
import { seedRecorder, type SimpleFixture, testProvider } from "./helpers/test-provider.js"

// ─────────────────────────────────────────────────────────────────
// Test State and Types
// ─────────────────────────────────────────────────────────────────

interface TestState {
  goal: string
  tasks: Array<string>
  done: boolean
  verdict: "continue" | "complete" | null
}

type TestPhases = "planning" | "working" | "judging" | "done"

// Test agents (per ADR-010: agents own provider directly)
const simpleAgent = agent<TestState, { message: string }>({
  name: "simple",
  provider: testProvider,
  output: z.object({ message: z.string() }),
  prompt: (state: TestState) => `Goal: ${state.goal}`,
  update: (output: { message: string }, draft: TestState) => {
    draft.tasks.push(output.message)
  }
})

const plannerAgent = agent<TestState, { tasks: Array<string>; done: boolean }>({
  name: "planner",
  provider: testProvider,
  output: z.object({ tasks: z.array(z.string()), done: z.boolean() }),
  prompt: (state: TestState) => `Plan for: ${state.goal}`,
  update: (output: { tasks: Array<string>; done: boolean }, draft: TestState) => {
    for (const task of output.tasks) {
      draft.tasks.push(task)
    }
    draft.done = output.done
  }
})

const judgeAgent = agent<TestState, { verdict: "continue" | "complete" }>({
  name: "judge",
  provider: testProvider,
  output: z.object({ verdict: z.enum(["continue", "complete"]) }),
  prompt: (state: TestState) => `Judge progress on: ${state.goal}`,
  update: (output: { verdict: "continue" | "complete" }, draft: TestState) => {
    draft.verdict = output.verdict
  }
})

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe("workflow() factory", () => {
  describe("validation", () => {
    it("throws if name is missing", () => {
      expect(() => {
        workflow({
          name: "",
          initialState: { goal: "", tasks: [], done: false, verdict: null },
          start: () => {},
          agent: simpleAgent
        })
      }).toThrow("Workflow requires 'name' field")
    })

    it("throws if initialState is undefined", () => {
      expect(() => {
        workflow({
          name: "test",
          initialState: undefined as unknown as TestState,
          start: () => {},
          agent: simpleAgent
        })
      }).toThrow("Workflow \"test\" requires 'initialState' field")
    })

    it("throws if start is missing", () => {
      expect(() => {
        workflow({
          name: "test",
          initialState: { goal: "", tasks: [], done: false, verdict: null },
          start: undefined as unknown as () => void,
          agent: simpleAgent
        })
      }).toThrow("Workflow \"test\" requires 'start' function")
    })

    it("throws if both agent and phases are specified", () => {
      expect(() => {
        workflow({
          name: "test",
          initialState: { goal: "", tasks: [], done: false, verdict: null },
          start: () => {},
          agent: simpleAgent,
          phases: { done: phase.terminal<TestState, "done">() }
        } as unknown as SimpleWorkflowDef<TestState>)
      }).toThrow("Workflow \"test\" cannot have both 'agent' and 'phases'")
    })

    it("throws if neither agent nor phases are specified", () => {
      expect(() => {
        workflow({
          name: "test",
          initialState: { goal: "", tasks: [], done: false, verdict: null },
          start: () => {}
        } as unknown as SimpleWorkflowDef<TestState>)
      }).toThrow("Workflow \"test\" requires either 'agent' or 'phases'")
    })

    it("throws if phases is empty", () => {
      expect(() => {
        workflow({
          name: "test",
          initialState: { goal: "", tasks: [], done: false, verdict: null },
          start: () => {},
          phases: {} as { done: typeof phase.terminal }
        } as PhaseWorkflowDef<TestState, string, "done">)
      }).toThrow("Workflow \"test\" has empty 'phases'")
    })

    it("throws if no terminal phase exists", () => {
      expect(() => {
        workflow({
          name: "test",
          initialState: { goal: "", tasks: [], done: false, verdict: null },
          start: () => {},
          phases: {
            planning: { run: plannerAgent, next: "planning" as const }
          }
        } as unknown as PhaseWorkflowDef<TestState, string, "planning">)
      }).toThrow("Workflow \"test\" must have at least one terminal phase")
    })
  })

  describe("simple workflow", () => {
    it("creates workflow with agent", () => {
      const w = workflow<TestState>({
        name: "simple-test",
        initialState: { goal: "", tasks: [], done: false, verdict: null },
        start: (input: string, draft: TestState) => {
          draft.goal = input
        },
        agent: simpleAgent
      })

      expect(w.name).toBe("simple-test")
      expect(w.agent).toBe(simpleAgent)
      expect(typeof w.start).toBe("function")
    })

    it("creates workflow with until condition", () => {
      const w = workflow<TestState>({
        name: "with-until",
        initialState: { goal: "", tasks: [], done: false, verdict: null },
        start: (input, draft) => {
          draft.goal = input
        },
        agent: simpleAgent,
        until: (state) => state.done
      })

      expect(w.until).toBeDefined()
      expect(w.until!({ goal: "", tasks: [], done: true, verdict: null })).toBe(true)
      expect(w.until!({ goal: "", tasks: [], done: false, verdict: null })).toBe(false)
    })

    it("start function receives input and draft", () => {
      const state: TestState = { goal: "", tasks: [], done: false, verdict: null }

      const w = workflow<TestState>({
        name: "test",
        initialState: state,
        start: (input, draft) => {
          draft.goal = input
          draft.tasks.push("initialized")
        },
        agent: simpleAgent
      })

      // Simulate calling start (Immer handles the draft in real code)
      w.start("test goal", state as TestState)
      expect(state.goal).toBe("test goal")
      expect(state.tasks).toContain("initialized")
    })
  })

  describe("phase workflow", () => {
    it("creates workflow with phases", () => {
      const w = workflow<TestState, string, TestPhases>({
        name: "phased-test",
        initialState: { goal: "", tasks: [], done: false, verdict: null },
        start: (input, draft) => {
          draft.goal = input
        },
        phases: {
          planning: { run: plannerAgent, until: (_, o) => (o as { done: boolean })?.done, next: "working" },
          working: { run: simpleAgent, next: "judging" },
          judging: { run: judgeAgent, next: (s) => (s.verdict === "continue" ? "planning" : "done") },
          done: phase.terminal<TestState, TestPhases>()
        }
      })

      expect(w.name).toBe("phased-test")
      expect(w.phases.planning).toBeDefined()
      expect(w.phases.working).toBeDefined()
      expect(w.phases.judging).toBeDefined()
      expect(w.phases.done).toBeDefined()
    })

    it("supports optional startPhase", () => {
      const w = workflow<TestState, string, TestPhases>({
        name: "with-start-phase",
        initialState: { goal: "", tasks: [], done: false, verdict: null },
        start: () => {},
        startPhase: "working",
        phases: {
          planning: { run: plannerAgent, next: "working" },
          working: { run: simpleAgent, next: "done" },
          judging: { run: judgeAgent, next: "done" },
          done: phase.terminal<TestState, TestPhases>()
        }
      })

      expect(w.startPhase).toBe("working")
    })
  })
})

describe("type guards", () => {
  const simpleWorkflow = workflow<TestState>({
    name: "simple",
    initialState: { goal: "", tasks: [], done: false, verdict: null },
    start: () => {},
    agent: simpleAgent
  })

  const phaseWorkflow = workflow<TestState, string, TestPhases>({
    name: "phased",
    initialState: { goal: "", tasks: [], done: false, verdict: null },
    start: () => {},
    phases: {
      planning: { run: plannerAgent, next: "done" },
      working: { terminal: true },
      judging: { terminal: true },
      done: phase.terminal<TestState, TestPhases>()
    }
  })

  it("isSimpleWorkflow returns true for simple workflows", () => {
    expect(isSimpleWorkflow(simpleWorkflow)).toBe(true)
    expect(isSimpleWorkflow(phaseWorkflow)).toBe(false)
  })

  it("isPhaseWorkflow returns true for phase workflows", () => {
    expect(isPhaseWorkflow(phaseWorkflow)).toBe(true)
    expect(isPhaseWorkflow(simpleWorkflow)).toBe(false)
  })
})

describe("WorkflowDef types (compile-time)", () => {
  it("SimpleWorkflowDef can be assigned", () => {
    const w: SimpleWorkflowDef<TestState> = workflow<TestState>({
      name: "simple",
      initialState: { goal: "", tasks: [], done: false, verdict: null },
      start: () => {},
      agent: simpleAgent
    })

    expect(w.name).toBe("simple")
  })

  it("PhaseWorkflowDef can be assigned", () => {
    const w: PhaseWorkflowDef<TestState, string, TestPhases> = workflow<TestState, string, TestPhases>({
      name: "phased",
      initialState: { goal: "", tasks: [], done: false, verdict: null },
      start: () => {},
      phases: {
        planning: { run: plannerAgent, next: "done" },
        working: { terminal: true },
        judging: { terminal: true },
        done: phase.terminal<TestState, TestPhases>()
      }
    })

    expect(w.name).toBe("phased")
  })
})

// ─────────────────────────────────────────────────────────────────
// Behavioral: Execute workflow and verify phase transitions
// ─────────────────────────────────────────────────────────────────

describe("workflow behavioral (execution and phase transitions)", () => {
  const providerOptions = { model: "claude-sonnet-4-5" }
  const playbackDummy = {
    name: "playback-dummy",
    model: "playback-dummy",
    stream: () => {
      throw new Error("playbackDummyProvider called - recording not found")
    }
  }

  const taskSchema = z.object({ tasks: z.array(z.string()), done: z.boolean() })
  const messageSchema = z.object({ message: z.string() })

  it("simple workflow executes agent and updates state", async () => {
    const fixtures: ReadonlyArray<SimpleFixture> = [
      {
        prompt: "Goal: write tests",
        output: { message: "tests written" },
        outputSchema: messageSchema,
        providerOptions
      }
    ]

    const w = workflow<TestState>({
      name: "simple-exec-test",
      initialState: { goal: "", tasks: [], done: false, verdict: null },
      start: (input, draft) => {
        draft.goal = input
      },
      agent: simpleAgent,
      until: () => true
    })

    const result = await run(w, {
      input: "write tests",
      runtime: {
        mode: "playback",
        recorder: seedRecorder(fixtures),
        database: ":memory:"
      }
    })

    expect(result.state.goal).toBe("write tests")
    expect(result.state.tasks).toContain("tests written")
    expect(result.completed).toBe(true)
  })

  it("phase workflow transitions through planning -> done", async () => {
    const fixtures: ReadonlyArray<SimpleFixture> = [
      {
        prompt: "Plan for: design system",
        output: { tasks: ["task A", "task B"], done: true },
        outputSchema: taskSchema,
        providerOptions
      }
    ]

    type Phases = "planning" | "done"

    interface PhaseState {
      goal: string
      tasks: Array<string>
      done: boolean
    }

    const planAgent = agent<PhaseState, { tasks: Array<string>; done: boolean }>({
      name: "planner",
      provider: testProvider,
      output: taskSchema,
      prompt: (state) => `Plan for: ${state.goal}`,
      update: (output, draft) => {
        for (const task of output.tasks) {
          draft.tasks.push(task)
        }
        draft.done = output.done
      }
    })

    const w = workflow<PhaseState, string, Phases>({
      name: "phase-transition-test",
      initialState: { goal: "", tasks: [], done: false },
      start: (input, draft) => {
        draft.goal = input
      },
      phases: {
        planning: { run: planAgent, next: "done" },
        done: phase.terminal<PhaseState, Phases>()
      }
    })

    const runtime: RuntimeConfig = {
      mode: "playback",
      recorder: seedRecorder(fixtures),
      database: ":memory:"
    }

    // Use execute() to observe events
    const execution = execute(w, { input: "design system", runtime })

    const phaseEnteredNames: Array<string> = []
    for await (const event of execution) {
      if (event.name === EVENTS.PHASE_ENTERED) {
        phaseEnteredNames.push((event.payload as { phase: string }).phase)
      }
    }

    const result = await execution.result

    // Verify phase transitions occurred in order
    expect(phaseEnteredNames).toEqual(["planning", "done"])

    // Verify state was updated through the full pipeline
    expect(result.state.goal).toBe("design system")
    expect(result.state.tasks).toEqual(["task A", "task B"])
    expect(result.completed).toBe(true)
    expect(result.exitPhase).toBe("done")
  })

  it("multi-phase workflow transitions planning -> working -> done", async () => {
    type Phases = "planning" | "working" | "done"

    interface MultiState {
      goal: string
      plan: string
      result: string
    }

    const planSchema = z.object({ plan: z.string() })
    const workSchema = z.object({ result: z.string() })

    const planAgent = agent<MultiState, { plan: string }>({
      name: "planner",
      provider: testProvider,
      output: planSchema,
      prompt: (state) => `Plan: ${state.goal}`,
      update: (output, draft) => {
        draft.plan = output.plan
      }
    })

    const workAgent = agent<MultiState, { result: string }>({
      name: "worker",
      provider: testProvider,
      output: workSchema,
      prompt: (state) => `Work: ${state.plan}`,
      update: (output, draft) => {
        draft.result = output.result
      }
    })

    const fixtures: ReadonlyArray<SimpleFixture> = [
      {
        prompt: "Plan: build API",
        output: { plan: "Step 1: design routes" },
        outputSchema: planSchema,
        providerOptions
      },
      {
        prompt: "Work: Step 1: design routes",
        output: { result: "Routes designed" },
        outputSchema: workSchema,
        providerOptions
      }
    ]

    const w = workflow<MultiState, string, Phases>({
      name: "multi-phase-test",
      initialState: { goal: "", plan: "", result: "" },
      start: (input, draft) => {
        draft.goal = input
      },
      phases: {
        planning: { run: planAgent, next: "working" },
        working: { run: workAgent, next: "done" },
        done: phase.terminal<MultiState, Phases>()
      }
    })

    const phaseChanges = vi.fn()

    const result = await run(w, {
      input: "build API",
      runtime: {
        mode: "playback",
        recorder: seedRecorder(fixtures),
        database: ":memory:"
      },
      observer: { onPhaseChanged: phaseChanges }
    })

    // Verify all three phase transitions fired
    // First phase has fromPhase=undefined (no previous phase)
    expect(phaseChanges).toHaveBeenCalledTimes(3)
    expect(phaseChanges).toHaveBeenNthCalledWith(1, "planning", undefined)
    expect(phaseChanges).toHaveBeenNthCalledWith(2, "working", "planning")
    expect(phaseChanges).toHaveBeenNthCalledWith(3, "done", "working")

    // Verify state accumulated through all phases
    expect(result.state.goal).toBe("build API")
    expect(result.state.plan).toBe("Step 1: design routes")
    expect(result.state.result).toBe("Routes designed")
    expect(result.exitPhase).toBe("done")
  })
})
