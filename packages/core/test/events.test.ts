/**
 * Tests for Domain/Events.ts
 *
 * Validates the new Data.TaggedClass event definitions per ADR-004.
 */

import { Match } from "effect"
import { describe, expect, it } from "vitest"

import type { WorkflowEvent, WorkflowEventTag } from "../src/Domain/Events.js"
import {
  AgentCompleted,
  AgentStarted,
  InputReceived,
  InputRequested,
  PhaseEntered,
  PhaseExited,
  SessionForked,
  StateCheckpoint,
  StateIntent,
  TextDelta,
  ThinkingDelta,
  ToolCalled,
  ToolResult,
  WorkflowCompleted,
  WorkflowStarted
} from "../src/Domain/Events.js"

describe("WorkflowEvent Data.TaggedClass definitions", () => {
  const timestamp = new Date("2026-01-29T12:00:00Z")

  describe("Workflow Lifecycle Events", () => {
    it("WorkflowStarted has correct _tag and fields", () => {
      const event = new WorkflowStarted({
        sessionId: "session-123",
        workflow: "task-planner",
        input: { task: "Write tests" },
        timestamp
      })

      expect(event._tag).toBe("WorkflowStarted")
      expect(event.sessionId).toBe("session-123")
      expect(event.workflow).toBe("task-planner")
      expect(event.input).toEqual({ task: "Write tests" })
      expect(event.timestamp).toBe(timestamp)
    })

    it("WorkflowCompleted has correct _tag and fields", () => {
      const event = new WorkflowCompleted({
        sessionId: "session-123",
        finalState: { completed: true },
        exitPhase: "done",
        timestamp
      })

      expect(event._tag).toBe("WorkflowCompleted")
      expect(event.sessionId).toBe("session-123")
      expect(event.finalState).toEqual({ completed: true })
      expect(event.exitPhase).toBe("done")
    })

    it("WorkflowCompleted exitPhase is optional", () => {
      const event = new WorkflowCompleted({
        sessionId: "session-123",
        finalState: {},
        timestamp
      })

      expect(event.exitPhase).toBeUndefined()
    })
  })

  describe("Phase Lifecycle Events", () => {
    it("PhaseEntered has correct _tag and fields", () => {
      const event = new PhaseEntered({
        phase: "planning",
        fromPhase: "init",
        timestamp
      })

      expect(event._tag).toBe("PhaseEntered")
      expect(event.phase).toBe("planning")
      expect(event.fromPhase).toBe("init")
    })

    it("PhaseEntered fromPhase is optional", () => {
      const event = new PhaseEntered({
        phase: "init",
        timestamp
      })

      expect(event.fromPhase).toBeUndefined()
    })

    it("PhaseExited has correct _tag and fields", () => {
      const event = new PhaseExited({
        phase: "planning",
        reason: "next",
        timestamp
      })

      expect(event._tag).toBe("PhaseExited")
      expect(event.phase).toBe("planning")
      expect(event.reason).toBe("next")
    })

    it("PhaseExited reason is a union type", () => {
      const reasons: Array<PhaseExited["reason"]> = ["next", "terminal", "error"]
      expect(reasons).toHaveLength(3)
    })
  })

  describe("Agent Lifecycle Events", () => {
    it("AgentStarted has correct _tag and fields", () => {
      const event = new AgentStarted({
        agent: "planner",
        phase: "planning",
        context: { iteration: 1 },
        timestamp
      })

      expect(event._tag).toBe("AgentStarted")
      expect(event.agent).toBe("planner")
      expect(event.phase).toBe("planning")
      expect(event.context).toEqual({ iteration: 1 })
    })

    it("AgentStarted phase and context are optional", () => {
      const event = new AgentStarted({
        agent: "worker",
        timestamp
      })

      expect(event.phase).toBeUndefined()
      expect(event.context).toBeUndefined()
    })

    it("AgentCompleted has correct _tag and fields", () => {
      const event = new AgentCompleted({
        agent: "planner",
        output: { plan: ["step1", "step2"] },
        durationMs: 1500,
        timestamp
      })

      expect(event._tag).toBe("AgentCompleted")
      expect(event.agent).toBe("planner")
      expect(event.output).toEqual({ plan: ["step1", "step2"] })
      expect(event.durationMs).toBe(1500)
    })
  })

  describe("State Events (ADR-006)", () => {
    it("StateIntent has correct _tag and fields", () => {
      const event = new StateIntent({
        intentId: "intent-001",
        patches: [{ op: "replace", path: "/count", value: 5 }],
        inversePatches: [{ op: "replace", path: "/count", value: 4 }],
        timestamp
      })

      expect(event._tag).toBe("StateIntent")
      expect(event.intentId).toBe("intent-001")
      expect(event.patches).toHaveLength(1)
      expect(event.inversePatches).toHaveLength(1)
    })

    it("StateCheckpoint has correct _tag and fields", () => {
      const event = new StateCheckpoint({
        state: { count: 10, phase: "working" },
        position: 42,
        phase: "working",
        timestamp
      })

      expect(event._tag).toBe("StateCheckpoint")
      expect(event.state).toEqual({ count: 10, phase: "working" })
      expect(event.position).toBe(42)
      expect(event.phase).toBe("working")
    })

    it("SessionForked has correct _tag and fields", () => {
      const event = new SessionForked({
        parentSessionId: "parent-123",
        forkIndex: 2,
        initialState: { count: 5 },
        timestamp
      })

      expect(event._tag).toBe("SessionForked")
      expect(event.parentSessionId).toBe("parent-123")
      expect(event.forkIndex).toBe(2)
      expect(event.initialState).toEqual({ count: 5 })
    })
  })

  describe("Streaming Content Events", () => {
    it("TextDelta has correct _tag and fields", () => {
      const event = new TextDelta({
        agent: "writer",
        delta: "Hello, ",
        timestamp
      })

      expect(event._tag).toBe("TextDelta")
      expect(event.agent).toBe("writer")
      expect(event.delta).toBe("Hello, ")
    })

    it("ThinkingDelta has correct _tag and fields", () => {
      const event = new ThinkingDelta({
        agent: "reasoner",
        delta: "Let me think...",
        timestamp
      })

      expect(event._tag).toBe("ThinkingDelta")
      expect(event.agent).toBe("reasoner")
      expect(event.delta).toBe("Let me think...")
    })
  })

  describe("Tool Events", () => {
    it("ToolCalled has correct _tag and fields", () => {
      const event = new ToolCalled({
        agent: "coder",
        toolId: "tool-001",
        toolName: "write_file",
        input: { path: "/test.ts", content: "export {}" },
        timestamp
      })

      expect(event._tag).toBe("ToolCalled")
      expect(event.agent).toBe("coder")
      expect(event.toolId).toBe("tool-001")
      expect(event.toolName).toBe("write_file")
      expect(event.input).toEqual({ path: "/test.ts", content: "export {}" })
    })

    it("ToolResult has correct _tag and fields", () => {
      const event = new ToolResult({
        agent: "coder",
        toolId: "tool-001",
        output: { success: true },
        isError: false,
        timestamp
      })

      expect(event._tag).toBe("ToolResult")
      expect(event.agent).toBe("coder")
      expect(event.toolId).toBe("tool-001")
      expect(event.output).toEqual({ success: true })
      expect(event.isError).toBe(false)
    })

    it("ToolResult can represent errors", () => {
      const event = new ToolResult({
        agent: "coder",
        toolId: "tool-002",
        output: { error: "File not found" },
        isError: true,
        timestamp
      })

      expect(event.isError).toBe(true)
    })
  })

  describe("HITL Events", () => {
    it("InputRequested has correct _tag and fields", () => {
      const event = new InputRequested({
        id: "input-001",
        prompt: "Approve the plan?",
        type: "approval",
        timestamp
      })

      expect(event._tag).toBe("InputRequested")
      expect(event.id).toBe("input-001")
      expect(event.prompt).toBe("Approve the plan?")
      expect(event.type).toBe("approval")
      expect(event.options).toBeUndefined()
    })

    it("InputRequested supports choice type with options", () => {
      const event = new InputRequested({
        id: "input-002",
        prompt: "Select priority",
        type: "choice",
        options: ["low", "medium", "high"],
        timestamp
      })

      expect(event.type).toBe("choice")
      expect(event.options).toEqual(["low", "medium", "high"])
    })

    it("InputReceived has correct _tag and fields", () => {
      const event = new InputReceived({
        id: "input-001",
        value: "approve",
        approved: true,
        timestamp
      })

      expect(event._tag).toBe("InputReceived")
      expect(event.id).toBe("input-001")
      expect(event.value).toBe("approve")
      expect(event.approved).toBe(true)
    })

    it("InputReceived approved is optional", () => {
      const event = new InputReceived({
        id: "input-002",
        value: "high",
        timestamp
      })

      expect(event.approved).toBeUndefined()
    })
  })
})

describe("WorkflowEvent union type", () => {
  const timestamp = new Date()

  it("all 15 event types are part of the union", () => {
    const events: Array<WorkflowEvent> = [
      new WorkflowStarted({ sessionId: "s", workflow: "w", input: {}, timestamp }),
      new WorkflowCompleted({ sessionId: "s", finalState: {}, timestamp }),
      new PhaseEntered({ phase: "p", timestamp }),
      new PhaseExited({ phase: "p", reason: "next", timestamp }),
      new AgentStarted({ agent: "a", timestamp }),
      new AgentCompleted({ agent: "a", output: {}, durationMs: 0, timestamp }),
      new StateIntent({ intentId: "i", patches: [], inversePatches: [], timestamp }),
      new StateCheckpoint({ state: {}, position: 0, phase: "p", timestamp }),
      new SessionForked({ parentSessionId: "p", forkIndex: 0, initialState: {}, timestamp }),
      new TextDelta({ agent: "a", delta: "", timestamp }),
      new ThinkingDelta({ agent: "a", delta: "", timestamp }),
      new ToolCalled({ agent: "a", toolId: "t", toolName: "n", input: {}, timestamp }),
      new ToolResult({ agent: "a", toolId: "t", output: {}, isError: false, timestamp }),
      new InputRequested({ id: "i", prompt: "p", type: "approval", timestamp }),
      new InputReceived({ id: "i", value: "v", timestamp })
    ]

    expect(events).toHaveLength(15)
  })

  it("WorkflowEventTag extracts all _tag literals", () => {
    // Compile-time check: if this compiles, the type works
    const tags: Array<WorkflowEventTag> = [
      "WorkflowStarted",
      "WorkflowCompleted",
      "PhaseEntered",
      "PhaseExited",
      "AgentStarted",
      "AgentCompleted",
      "StateIntent",
      "StateCheckpoint",
      "SessionForked",
      "TextDelta",
      "ThinkingDelta",
      "ToolCalled",
      "ToolResult",
      "InputRequested",
      "InputReceived"
    ]

    expect(tags).toHaveLength(15)
  })
})

describe("Match.exhaustive compatibility (ADR-004)", () => {
  const timestamp = new Date()

  it("Match.value with Match.tag handles all event types", () => {
    const events: Array<WorkflowEvent> = [
      new WorkflowStarted({ sessionId: "s", workflow: "w", input: {}, timestamp }),
      new AgentCompleted({ agent: "a", output: {}, durationMs: 100, timestamp }),
      new TextDelta({ agent: "a", delta: "hello", timestamp })
    ]

    const results = events.map((event) =>
      Match.value(event).pipe(
        Match.tag("WorkflowStarted", (e) => `started:${e.sessionId}`),
        Match.tag("WorkflowCompleted", (e) => `completed:${e.sessionId}`),
        Match.tag("PhaseEntered", (e) => `phase:${e.phase}`),
        Match.tag("PhaseExited", (e) => `phase-exit:${e.phase}`),
        Match.tag("AgentStarted", (e) => `agent-start:${e.agent}`),
        Match.tag("AgentCompleted", (e) => `agent-done:${e.agent}`),
        Match.tag("StateIntent", (e) => `intent:${e.intentId}`),
        Match.tag("StateCheckpoint", (e) => `checkpoint:${e.position}`),
        Match.tag("SessionForked", (e) => `forked:${e.forkIndex}`),
        Match.tag("TextDelta", (e) => `text:${e.delta}`),
        Match.tag("ThinkingDelta", (e) => `thinking:${e.delta}`),
        Match.tag("ToolCalled", (e) => `tool:${e.toolName}`),
        Match.tag("ToolResult", (e) => `result:${e.toolId}`),
        Match.tag("InputRequested", (e) => `input:${e.id}`),
        Match.tag("InputReceived", (e) => `received:${e.id}`),
        Match.exhaustive
      )
    )

    expect(results).toEqual([
      "started:s",
      "agent-done:a",
      "text:hello"
    ])
  })

  it("Match.exhaustive would cause compile error if tag missing", () => {
    // This test documents the behavior - if you remove a Match.tag case above,
    // TypeScript will report a compile error because Match.exhaustive requires
    // all cases to be handled.
    //
    // We can't test for compile errors at runtime, but this test documents
    // that the union type and Match.exhaustive work together correctly.
    expect(true).toBe(true)
  })
})

describe("Data.TaggedClass structural equality", () => {
  const timestamp = new Date("2026-01-29T12:00:00Z")

  it("events with same fields are equal", () => {
    const event1 = new WorkflowStarted({
      sessionId: "session-123",
      workflow: "task-planner",
      input: { task: "Write tests" },
      timestamp
    })

    const event2 = new WorkflowStarted({
      sessionId: "session-123",
      workflow: "task-planner",
      input: { task: "Write tests" },
      timestamp
    })

    // Data.TaggedClass provides structural equality
    expect(event1).toEqual(event2)
  })

  it("events with different fields are not equal", () => {
    const event1 = new WorkflowStarted({
      sessionId: "session-123",
      workflow: "task-planner",
      input: {},
      timestamp
    })

    const event2 = new WorkflowStarted({
      sessionId: "session-456",
      workflow: "task-planner",
      input: {},
      timestamp
    })

    expect(event1).not.toEqual(event2)
  })
})
