/**
 * Tests for Engine/agent.ts
 *
 * Validates the agent() factory function, AgentDef types,
 * and behavioral assertions verifying update() mutates state
 * within a full workflow execution pipeline.
 */

import { describe, expect, it } from "vitest"
import { z } from "zod"

import { agent, type AgentDef } from "../src/Engine/agent.js"
import { run } from "../src/Engine/run.js"
import type { Draft } from "../src/Engine/types.js"
import { workflow } from "../src/Engine/workflow.js"
import { seedRecorder, type SimpleFixture } from "./helpers/test-provider.js"

// ─────────────────────────────────────────────────────────────────
// Test State and Output types
// ─────────────────────────────────────────────────────────────────

interface TestState {
  goal: string
  items: Array<string>
  count: number
}

const TestOutputSchema = z.object({
  newItems: z.array(z.string()),
  done: z.boolean()
})

type TestOutput = z.infer<typeof TestOutputSchema>

interface TestContext {
  itemIndex: number
  itemValue: string
}

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe("agent() factory", () => {
  describe("validation", () => {
    it("throws if name is missing", () => {
      expect(() => {
        agent({
          name: "",
          model: "test",
          output: z.string(),
          prompt: () => "test",
          update: () => {}
        })
      }).toThrow("Agent requires 'name' field")
    })

    it("throws if model is missing", () => {
      expect(() => {
        agent({
          name: "test-agent",
          model: "",
          output: z.string(),
          prompt: () => "test",
          update: () => {}
        })
      }).toThrow("Agent \"test-agent\" requires 'model' field")
    })

    it("throws if output schema is missing", () => {
      expect(() => {
        agent({
          name: "test-agent",
          model: "claude-sonnet-4-5",
          output: undefined as unknown as z.ZodType<unknown>,
          prompt: () => "test",
          update: () => {}
        })
      }).toThrow("Agent \"test-agent\" requires 'output' schema")
    })

    it("throws if prompt is missing", () => {
      expect(() => {
        agent({
          name: "test-agent",
          model: "claude-sonnet-4-5",
          output: z.string(),
          prompt: undefined as unknown as () => string,
          update: () => {}
        })
      }).toThrow("Agent \"test-agent\" requires 'prompt' function")
    })

    it("throws if update is missing", () => {
      expect(() => {
        agent({
          name: "test-agent",
          model: "claude-sonnet-4-5",
          output: z.string(),
          prompt: () => "test",
          update: undefined as unknown as () => void
        })
      }).toThrow("Agent \"test-agent\" requires 'update' function")
    })
  })

  describe("simple agent (no context)", () => {
    it("creates agent with all required fields", () => {
      const planner = agent<TestState, TestOutput>({
        name: "planner",
        model: "claude-sonnet-4-5",
        output: TestOutputSchema,
        prompt: (state: TestState) => `Plan for: ${state.goal}`,
        update: (output: TestOutput, draft: TestState) => {
          for (const item of output.newItems) {
            draft.items.push(item)
          }
        }
      })

      expect(planner.name).toBe("planner")
      expect(planner.model).toBe("claude-sonnet-4-5")
      expect(planner.output).toBe(TestOutputSchema)
      expect(typeof planner.prompt).toBe("function")
      expect(typeof planner.update).toBe("function")
    })

    it("supports optional options field", () => {
      const agentWithOptions = agent<TestState, TestOutput>({
        name: "with-options",
        model: "claude-sonnet-4-5",
        options: {
          tools: [{ type: "preset", preset: "claude_code" }],
          temperature: 0.7
        },
        output: TestOutputSchema,
        prompt: (state: TestState) => `Plan: ${state.goal}`,
        update: (output: TestOutput, draft: TestState) => {
          draft.items = output.newItems
        }
      })

      expect(agentWithOptions.options).toEqual({
        tools: [{ type: "preset", preset: "claude_code" }],
        temperature: 0.7
      })
    })

    it("prompt function receives state", () => {
      const state: TestState = { goal: "test-goal", items: [], count: 0 }

      const testAgent = agent<TestState, TestOutput>({
        name: "test",
        model: "claude-sonnet-4-5",
        output: TestOutputSchema,
        prompt: (s: TestState) => `Goal: ${s.goal}, Count: ${s.count}`,
        update: () => {}
      })

      const prompt = testAgent.prompt(state)
      expect(prompt).toBe("Goal: test-goal, Count: 0")
    })

    it("update function receives output and draft", () => {
      const output: TestOutput = { newItems: ["a", "b"], done: false }
      const draftState: TestState = { goal: "test", items: [], count: 0 }

      const testAgent = agent<TestState, TestOutput>({
        name: "test",
        model: "claude-sonnet-4-5",
        output: TestOutputSchema,
        prompt: () => "test",
        update: (o: TestOutput, draft: TestState) => {
          for (const item of o.newItems) {
            draft.items.push(item)
          }
          draft.count += o.newItems.length
        }
      })

      // Simulate calling update (in real code, this is wrapped with Immer)
      testAgent.update(output, draftState as Draft<TestState>)

      expect(draftState.items).toEqual(["a", "b"])
      expect(draftState.count).toBe(2)
    })
  })

  describe("contextual agent (with context)", () => {
    it("creates agent with context type", () => {
      const worker = agent<TestState, { result: string }, TestContext>({
        name: "worker",
        model: "claude-sonnet-4-5",
        output: z.object({ result: z.string() }),
        prompt: (state: TestState, ctx: TestContext) => `Process item ${ctx.itemIndex}: ${ctx.itemValue}`,
        update: (output: { result: string }, draft: TestState, ctx: TestContext) => {
          draft.items[ctx.itemIndex] = output.result
        }
      })

      expect(worker.name).toBe("worker")
      expect(typeof worker.prompt).toBe("function")
      expect(typeof worker.update).toBe("function")
    })

    it("prompt function receives state and context", () => {
      const state: TestState = { goal: "test", items: ["x", "y"], count: 2 }
      const ctx: TestContext = { itemIndex: 1, itemValue: "y" }

      const worker = agent<TestState, { result: string }, TestContext>({
        name: "worker",
        model: "claude-sonnet-4-5",
        output: z.object({ result: z.string() }),
        prompt: (s: TestState, c: TestContext) => `Item ${c.itemIndex} (${c.itemValue}) for: ${s.goal}`,
        update: () => {}
      })

      const prompt = worker.prompt(state, ctx)
      expect(prompt).toBe("Item 1 (y) for: test")
    })

    it("update function receives output, draft, and context", () => {
      const output = { result: "processed" }
      const draftState: TestState = { goal: "test", items: ["a", "b"], count: 2 }
      const ctx: TestContext = { itemIndex: 0, itemValue: "a" }

      const worker = agent<TestState, { result: string }, TestContext>({
        name: "worker",
        model: "claude-sonnet-4-5",
        output: z.object({ result: z.string() }),
        prompt: () => "test",
        update: (o: { result: string }, draft: TestState, c: TestContext) => {
          draft.items[c.itemIndex] = o.result
        }
      })

      worker.update(output, draftState as Draft<TestState>, ctx)
      expect(draftState.items[0]).toBe("processed")
    })
  })

  describe("returns correct structure", () => {
    it("returns the definition object unchanged", () => {
      const def = {
        name: "test",
        model: "claude-sonnet-4-5",
        output: z.string(),
        prompt: () => "test",
        update: () => {}
      }

      const result = agent(def)

      expect(result.name).toBe(def.name)
      expect(result.model).toBe(def.model)
      expect(result.output).toBe(def.output)
      expect(result.prompt).toBe(def.prompt)
      expect(result.update).toBe(def.update)
    })
  })
})

describe("AgentDef type (compile-time)", () => {
  // These are compile-time checks - if the file compiles, the types work

  it("AgentDef can be assigned from agent()", () => {
    const testAgent: AgentDef<TestState, TestOutput, void> = agent<TestState, TestOutput>({
      name: "test",
      model: "claude-sonnet-4-5",
      output: TestOutputSchema,
      prompt: () => "test",
      update: () => {}
    })

    expect(testAgent.name).toBe("test")
  })

  it("AgentDef with context can be assigned", () => {
    const contextualAgent: AgentDef<TestState, TestOutput, TestContext> = agent<TestState, TestOutput, TestContext>({
      name: "contextual",
      model: "claude-sonnet-4-5",
      output: TestOutputSchema,
      prompt: (state: TestState, ctx: TestContext) => `${state.goal} ${ctx.itemValue}`,
      update: (output: TestOutput, draft: TestState, ctx: TestContext) => {
        draft.items[ctx.itemIndex] = output.newItems[0] ?? ""
      }
    })

    expect(contextualAgent.name).toBe("contextual")
  })
})

describe("Zod schema integration", () => {
  it("output schema validates correctly", () => {
    const testAgent = agent<TestState, TestOutput>({
      name: "test",
      model: "claude-sonnet-4-5",
      output: TestOutputSchema,
      prompt: () => "test",
      update: () => {}
    })

    // Valid output
    const validResult = testAgent.output.safeParse({
      newItems: ["a", "b"],
      done: true
    })
    expect(validResult.success).toBe(true)

    // Invalid output
    const invalidResult = testAgent.output.safeParse({
      newItems: "not-an-array",
      done: "not-a-boolean"
    })
    expect(invalidResult.success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────
// Behavioral: Agent executes in a workflow and update() mutates state
// ─────────────────────────────────────────────────────────────────

describe("agent behavioral (workflow execution)", () => {
  const plannerSchema = z.object({
    newItems: z.array(z.string()),
    done: z.boolean()
  })
  const providerOptions = { model: "claude-sonnet-4-5" }

  const plannerAgent = agent<TestState, TestOutput>({
    name: "planner",
    model: "claude-sonnet-4-5",
    output: plannerSchema,
    prompt: (state: TestState) => `Plan for: ${state.goal}`,
    update: (output: TestOutput, draft: TestState) => {
      for (const item of output.newItems) {
        draft.items.push(item)
      }
      draft.count += output.newItems.length
    }
  })

  const fixtures: ReadonlyArray<SimpleFixture> = [
    {
      prompt: "Plan for: build an API",
      output: { newItems: ["design endpoints", "write handlers"], done: true },
      text: "Planning...",
      outputSchema: plannerSchema,
      providerOptions
    }
  ]

  const playbackDummy = {
    name: "playback-dummy",
    stream: () => {
      throw new Error("playbackDummyProvider called - recording not found")
    }
  }

  it("update() mutates state through full workflow execution pipeline", async () => {
    const testWorkflow = workflow<TestState>({
      name: "agent-behavioral-test",
      initialState: { goal: "", items: [], count: 0 },
      start: (input, draft) => {
        draft.goal = input
      },
      agent: plannerAgent,
      until: () => true // Single iteration
    })

    const result = await run(testWorkflow, {
      input: "build an API",
      runtime: {
        providers: { "claude-sonnet-4-5": playbackDummy },
        mode: "playback",
        recorder: seedRecorder(fixtures),
        database: ":memory:"
      }
    })

    // Verify that agent.update() actually mutated the workflow state
    expect(result.state.goal).toBe("build an API")
    expect(result.state.items).toEqual(["design endpoints", "write handlers"])
    expect(result.state.count).toBe(2)
  })

  it("agent prompt receives current state during execution", async () => {
    // The fixture expects "Plan for: build an API" which is generated
    // by prompt(state) using state.goal set by start()
    const testWorkflow = workflow<TestState>({
      name: "prompt-state-test",
      initialState: { goal: "", items: [], count: 0 },
      start: (input, draft) => {
        draft.goal = input
      },
      agent: plannerAgent,
      until: () => true
    })

    // If the prompt didn't correctly receive state, the fixture lookup
    // would fail because the hash wouldn't match
    const result = await run(testWorkflow, {
      input: "build an API",
      runtime: {
        providers: { "claude-sonnet-4-5": playbackDummy },
        mode: "playback",
        recorder: seedRecorder(fixtures),
        database: ":memory:"
      }
    })

    expect(result.completed).toBe(true)
  })
})
