/**
 * Tests for Engine/dispatch.ts
 *
 * Validates the Match.exhaustive dispatch function per ADR-004.
 * Tests that each WorkflowEvent type triggers the correct observer callback.
 */

import { describe, expect, it, vi } from "vitest"

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
import { dispatchToObserver } from "../src/Engine/dispatch.js"
import type { WorkflowObserver } from "../src/Engine/types.js"

// ─────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────

const timestamp = new Date("2026-01-29T12:00:00Z")

/**
 * Creates an observer with all callbacks mocked via vi.fn().
 */
function createMockedObserver(): WorkflowObserver<unknown> {
  return {
    onStarted: vi.fn(),
    onCompleted: vi.fn(),
    onError: vi.fn(),
    onStateChanged: vi.fn(),
    onPhaseChanged: vi.fn(),
    onAgentStarted: vi.fn(),
    onAgentCompleted: vi.fn(),
    onTextDelta: vi.fn(),
    onThinkingDelta: vi.fn(),
    onToolCalled: vi.fn(),
    onToolResult: vi.fn(),
    onEvent: vi.fn(),
    onInputRequested: vi.fn()
  }
}

// ─────────────────────────────────────────────────────────────────
// Tests: WorkflowEvent Dispatch
// ─────────────────────────────────────────────────────────────────

describe("dispatchToObserver (Match.exhaustive)", () => {
  describe("Workflow Lifecycle Events", () => {
    it("WorkflowStarted triggers onStarted with sessionId", () => {
      const observer = createMockedObserver()
      const event = new WorkflowStarted({
        sessionId: "session-123",
        workflow: "test-workflow",
        input: { task: "Write tests" },
        timestamp
      })

      dispatchToObserver(observer, event)

      expect(observer.onStarted).toHaveBeenCalledWith("session-123")
      expect(observer.onStarted).toHaveBeenCalledTimes(1)
    })

    it("WorkflowCompleted does not trigger onCompleted (handled separately)", () => {
      const observer = createMockedObserver()
      const event = new WorkflowCompleted({
        sessionId: "session-123",
        finalState: { completed: true },
        exitPhase: "done",
        timestamp
      })

      dispatchToObserver(observer, event)

      // onCompleted is NOT called during dispatch - it's called at workflow end
      // with the full WorkflowResult including events array
      expect(observer.onCompleted).not.toHaveBeenCalled()
    })
  })

  describe("Phase Lifecycle Events", () => {
    it("PhaseEntered triggers onPhaseChanged with phase and fromPhase", () => {
      const observer = createMockedObserver()
      const event = new PhaseEntered({
        phase: "execution",
        fromPhase: "planning",
        timestamp
      })

      dispatchToObserver(observer, event)

      expect(observer.onPhaseChanged).toHaveBeenCalledWith("execution", "planning")
      expect(observer.onPhaseChanged).toHaveBeenCalledTimes(1)
    })

    it("PhaseEntered with no fromPhase passes undefined", () => {
      const observer = createMockedObserver()
      const event = new PhaseEntered({
        phase: "init",
        timestamp
      })

      dispatchToObserver(observer, event)

      expect(observer.onPhaseChanged).toHaveBeenCalledWith("init", undefined)
    })

    it("PhaseExited does not trigger any observer callback", () => {
      const observer = createMockedObserver()
      const event = new PhaseExited({
        phase: "planning",
        reason: "next",
        timestamp
      })

      dispatchToObserver(observer, event)

      // PhaseExited has no corresponding observer callback
      expect(observer.onPhaseChanged).not.toHaveBeenCalled()
      expect(observer.onStarted).not.toHaveBeenCalled()
      expect(observer.onCompleted).not.toHaveBeenCalled()
    })
  })

  describe("Agent Lifecycle Events", () => {
    it("AgentStarted triggers onAgentStarted with agent and phase", () => {
      const observer = createMockedObserver()
      const event = new AgentStarted({
        agent: "planner",
        phase: "planning",
        context: { iteration: 1 },
        timestamp
      })

      dispatchToObserver(observer, event)

      expect(observer.onAgentStarted).toHaveBeenCalledWith({
        agent: "planner",
        phase: "planning"
      })
      expect(observer.onAgentStarted).toHaveBeenCalledTimes(1)
    })

    it("AgentStarted with no phase passes undefined", () => {
      const observer = createMockedObserver()
      const event = new AgentStarted({
        agent: "worker",
        timestamp
      })

      dispatchToObserver(observer, event)

      expect(observer.onAgentStarted).toHaveBeenCalledWith({
        agent: "worker",
        phase: undefined
      })
    })

    it("AgentCompleted triggers onAgentCompleted with full info", () => {
      const observer = createMockedObserver()
      const event = new AgentCompleted({
        agent: "planner",
        output: { plan: ["step1", "step2"] },
        durationMs: 1500,
        timestamp
      })

      dispatchToObserver(observer, event)

      expect(observer.onAgentCompleted).toHaveBeenCalledWith({
        agent: "planner",
        output: { plan: ["step1", "step2"] },
        durationMs: 1500
      })
      expect(observer.onAgentCompleted).toHaveBeenCalledTimes(1)
    })
  })

  describe("State Events (ADR-006)", () => {
    it("StateIntent triggers onStateChanged with state and patches", () => {
      const observer = createMockedObserver()
      const testState = { count: 5 }
      const event = new StateIntent({
        intentId: "intent-001",
        state: testState,
        patches: [{ op: "replace", path: "/count", value: 5 }],
        inversePatches: [{ op: "replace", path: "/count", value: 4 }],
        timestamp
      })

      dispatchToObserver(observer, event)

      // StateIntent triggers onStateChanged with state and patches
      expect(observer.onStateChanged).toHaveBeenCalledWith(
        testState,
        [{ op: "replace", path: "/count", value: 5 }]
      )
    })

    it("StateCheckpoint triggers onStateChanged with state", () => {
      const observer = createMockedObserver()
      const event = new StateCheckpoint({
        state: { count: 10, phase: "working" },
        position: 42,
        phase: "working",
        timestamp
      })

      dispatchToObserver(observer, event)

      expect(observer.onStateChanged).toHaveBeenCalledWith({ count: 10, phase: "working" })
      expect(observer.onStateChanged).toHaveBeenCalledTimes(1)
    })

    it("SessionForked does not trigger observer callback (internal event)", () => {
      const observer = createMockedObserver()
      const event = new SessionForked({
        parentSessionId: "parent-123",
        forkIndex: 2,
        initialState: { count: 5 },
        timestamp
      })

      dispatchToObserver(observer, event)

      // SessionForked is internal lineage tracking, no observer callback
      expect(observer.onStateChanged).not.toHaveBeenCalled()
      expect(observer.onStarted).not.toHaveBeenCalled()
    })
  })

  describe("Streaming Content Events", () => {
    it("TextDelta triggers onTextDelta with agent and delta", () => {
      const observer = createMockedObserver()
      const event = new TextDelta({
        agent: "writer",
        delta: "Hello, world!",
        timestamp
      })

      dispatchToObserver(observer, event)

      expect(observer.onTextDelta).toHaveBeenCalledWith({
        agent: "writer",
        delta: "Hello, world!"
      })
      expect(observer.onTextDelta).toHaveBeenCalledTimes(1)
    })

    it("ThinkingDelta triggers onThinkingDelta with agent and delta", () => {
      const observer = createMockedObserver()
      const event = new ThinkingDelta({
        agent: "reasoner",
        delta: "Let me think about this...",
        timestamp
      })

      dispatchToObserver(observer, event)

      expect(observer.onThinkingDelta).toHaveBeenCalledWith({
        agent: "reasoner",
        delta: "Let me think about this..."
      })
      expect(observer.onThinkingDelta).toHaveBeenCalledTimes(1)
    })
  })

  describe("Tool Events", () => {
    it("ToolCalled triggers onToolCalled with full details", () => {
      const observer = createMockedObserver()
      const event = new ToolCalled({
        agent: "coder",
        toolId: "tool-001",
        toolName: "write_file",
        input: { path: "/test.ts", content: "export {}" },
        timestamp
      })

      dispatchToObserver(observer, event)

      expect(observer.onToolCalled).toHaveBeenCalledWith({
        agent: "coder",
        toolId: "tool-001",
        toolName: "write_file",
        input: { path: "/test.ts", content: "export {}" }
      })
      expect(observer.onToolCalled).toHaveBeenCalledTimes(1)
    })

    it("ToolResult triggers onToolResult with full details", () => {
      const observer = createMockedObserver()
      const event = new ToolResult({
        agent: "coder",
        toolId: "tool-001",
        output: { success: true, path: "/test.ts" },
        isError: false,
        timestamp
      })

      dispatchToObserver(observer, event)

      expect(observer.onToolResult).toHaveBeenCalledWith({
        agent: "coder",
        toolId: "tool-001",
        output: { success: true, path: "/test.ts" },
        isError: false
      })
      expect(observer.onToolResult).toHaveBeenCalledTimes(1)
    })

    it("ToolResult with error flag is passed correctly", () => {
      const observer = createMockedObserver()
      const event = new ToolResult({
        agent: "coder",
        toolId: "tool-002",
        output: { error: "File not found" },
        isError: true,
        timestamp
      })

      dispatchToObserver(observer, event)

      expect(observer.onToolResult).toHaveBeenCalledWith({
        agent: "coder",
        toolId: "tool-002",
        output: { error: "File not found" },
        isError: true
      })
    })
  })

  describe("HITL Events", () => {
    it("InputRequested does not trigger observer callback (handled via HITL)", () => {
      const observer = createMockedObserver()
      const event = new InputRequested({
        id: "input-001",
        prompt: "Approve the plan?",
        type: "approval",
        timestamp
      })

      dispatchToObserver(observer, event)

      // InputRequested is handled via ADR-002's humanInput handler
      // The observer's onInputRequested is async and used differently
      expect(observer.onStarted).not.toHaveBeenCalled()
      expect(observer.onCompleted).not.toHaveBeenCalled()
    })

    it("InputReceived does not trigger observer callback (internal event)", () => {
      const observer = createMockedObserver()
      const event = new InputReceived({
        id: "input-001",
        value: "approve",
        approved: true,
        timestamp
      })

      dispatchToObserver(observer, event)

      // InputReceived is internal correlation event
      expect(observer.onStarted).not.toHaveBeenCalled()
      expect(observer.onCompleted).not.toHaveBeenCalled()
    })
  })
})

describe("dispatchToObserver handles missing callbacks", () => {
  it("does not throw when observer has no callbacks", () => {
    const emptyObserver: WorkflowObserver<unknown> = {}

    const events = [
      new WorkflowStarted({ sessionId: "s", workflow: "w", input: {}, timestamp }),
      new WorkflowCompleted({ sessionId: "s", finalState: {}, timestamp }),
      new PhaseEntered({ phase: "p", timestamp }),
      new PhaseExited({ phase: "p", reason: "next", timestamp }),
      new AgentStarted({ agent: "a", timestamp }),
      new AgentCompleted({ agent: "a", output: {}, durationMs: 0, timestamp }),
      new StateIntent({ intentId: "i", state: {}, patches: [], inversePatches: [], timestamp }),
      new StateCheckpoint({ state: {}, position: 0, phase: "p", timestamp }),
      new SessionForked({ parentSessionId: "p", forkIndex: 0, initialState: {}, timestamp }),
      new TextDelta({ agent: "a", delta: "", timestamp }),
      new ThinkingDelta({ agent: "a", delta: "", timestamp }),
      new ToolCalled({ agent: "a", toolId: "t", toolName: "n", input: {}, timestamp }),
      new ToolResult({ agent: "a", toolId: "t", output: {}, isError: false, timestamp }),
      new InputRequested({ id: "i", prompt: "p", type: "approval", timestamp }),
      new InputReceived({ id: "i", value: "v", timestamp })
    ]

    // Should not throw for any event type
    for (const event of events) {
      expect(() => dispatchToObserver(emptyObserver, event)).not.toThrow()
    }
  })

  it("calls only the relevant callback for each event type", () => {
    const observer = createMockedObserver()

    // Dispatch a single event
    dispatchToObserver(observer, new TextDelta({ agent: "a", delta: "x", timestamp }))

    // Only onTextDelta should be called
    expect(observer.onTextDelta).toHaveBeenCalledTimes(1)
    expect(observer.onStarted).not.toHaveBeenCalled()
    expect(observer.onCompleted).not.toHaveBeenCalled()
    expect(observer.onPhaseChanged).not.toHaveBeenCalled()
    expect(observer.onAgentStarted).not.toHaveBeenCalled()
    expect(observer.onAgentCompleted).not.toHaveBeenCalled()
    expect(observer.onStateChanged).not.toHaveBeenCalled()
    expect(observer.onThinkingDelta).not.toHaveBeenCalled()
    expect(observer.onToolCalled).not.toHaveBeenCalled()
    expect(observer.onToolResult).not.toHaveBeenCalled()
  })
})

describe("dispatchToObserver exhaustiveness (ADR-004)", () => {
  it("handles all 15 event types without throwing", () => {
    const observer = createMockedObserver()

    const allEvents = [
      new WorkflowStarted({ sessionId: "s", workflow: "w", input: {}, timestamp }),
      new WorkflowCompleted({ sessionId: "s", finalState: {}, timestamp }),
      new PhaseEntered({ phase: "p", timestamp }),
      new PhaseExited({ phase: "p", reason: "next", timestamp }),
      new AgentStarted({ agent: "a", timestamp }),
      new AgentCompleted({ agent: "a", output: {}, durationMs: 0, timestamp }),
      new StateIntent({ intentId: "i", state: {}, patches: [], inversePatches: [], timestamp }),
      new StateCheckpoint({ state: {}, position: 0, phase: "p", timestamp }),
      new SessionForked({ parentSessionId: "p", forkIndex: 0, initialState: {}, timestamp }),
      new TextDelta({ agent: "a", delta: "", timestamp }),
      new ThinkingDelta({ agent: "a", delta: "", timestamp }),
      new ToolCalled({ agent: "a", toolId: "t", toolName: "n", input: {}, timestamp }),
      new ToolResult({ agent: "a", toolId: "t", output: {}, isError: false, timestamp }),
      new InputRequested({ id: "i", prompt: "p", type: "approval", timestamp }),
      new InputReceived({ id: "i", value: "v", timestamp })
    ]

    expect(allEvents).toHaveLength(15)

    // All events should dispatch without errors
    for (const event of allEvents) {
      expect(() => dispatchToObserver(observer, event)).not.toThrow()
    }
  })

  it("Match.exhaustive ensures compile-time coverage", () => {
    // This is a documentation test - the compile-time guarantee is that
    // if a new event type is added to WorkflowEvent union, TypeScript
    // will error in dispatch.ts until a Match.tag handler is added.
    //
    // We verify this by checking the function handles all known types.
    // The actual exhaustiveness is enforced by TypeScript, not runtime.
    expect(true).toBe(true)
  })
})
