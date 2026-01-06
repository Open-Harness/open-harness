import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RuntimeEvent } from "../../core/events.js";
import {
  createPartTracker,
  transformErrorEvent,
  transformEvent,
  transformReasoningEvent,
  transformStepEvent,
  transformTextEvent,
  transformToolEvent,
} from "../../src/server/transports/transforms.js";

describe("createPartTracker", () => {
  test("returns tracker with initial state", () => {
    const tracker = createPartTracker();
    expect(tracker.textStarted).toBe(false);
    expect(tracker.reasoningStarted).toBe(false);
  });
});

describe("transformTextEvent", () => {
  test("first delta emits start + delta", () => {
    const tracker = createPartTracker();
    const chunks = transformTextEvent(
      { type: "agent:text:delta", nodeId: "n1", runId: "r1", content: "Hello" },
      tracker,
      "msg-1",
    );

    expect(chunks).toEqual([
      { type: "text-start", id: "msg-1" },
      { type: "text-delta", id: "msg-1", delta: "Hello" },
    ]);
    expect(tracker.textStarted).toBe(true);
  });

  test("subsequent delta emits only delta", () => {
    const tracker = createPartTracker();
    tracker.textStarted = true;

    const chunks = transformTextEvent(
      {
        type: "agent:text:delta",
        nodeId: "n1",
        runId: "r1",
        content: " world",
      },
      tracker,
      "msg-1",
    );

    expect(chunks).toEqual([
      { type: "text-delta", id: "msg-1", delta: " world" },
    ]);
  });

  test("complete event emits end", () => {
    const tracker = createPartTracker();
    tracker.textStarted = true;

    const chunks = transformTextEvent(
      { type: "agent:text", nodeId: "n1", runId: "r1", content: "Hello world" },
      tracker,
      "msg-1",
    );

    expect(chunks).toEqual([{ type: "text-end", id: "msg-1" }]);
  });
});

describe("transformReasoningEvent", () => {
  test("first delta emits start + delta when sendReasoning is true", () => {
    const tracker = createPartTracker();
    const chunks = transformReasoningEvent(
      {
        type: "agent:thinking:delta",
        nodeId: "n1",
        runId: "r1",
        content: "Let me think",
      },
      tracker,
      "msg-1",
      { sendReasoning: true },
    );

    expect(chunks).toEqual([
      { type: "reasoning-start", id: "msg-1" },
      { type: "reasoning-delta", id: "msg-1", delta: "Let me think" },
    ]);
    expect(tracker.reasoningStarted).toBe(true);
  });

  test("returns empty array when sendReasoning is false", () => {
    const tracker = createPartTracker();
    const chunks = transformReasoningEvent(
      {
        type: "agent:thinking:delta",
        nodeId: "n1",
        runId: "r1",
        content: "Let me think",
      },
      tracker,
      "msg-1",
      { sendReasoning: false },
    );

    expect(chunks).toEqual([]);
    expect(tracker.reasoningStarted).toBe(false);
  });

  test("complete event emits end", () => {
    const tracker = createPartTracker();
    tracker.reasoningStarted = true;

    const chunks = transformReasoningEvent(
      {
        type: "agent:thinking",
        nodeId: "n1",
        runId: "r1",
        content: "Done thinking",
      },
      tracker,
      "msg-1",
      { sendReasoning: true },
    );

    expect(chunks).toEqual([{ type: "reasoning-end", id: "msg-1" }]);
  });
});

describe("transformToolEvent", () => {
  test("emits input-available and output-available chunks", () => {
    const chunks = transformToolEvent(
      {
        type: "agent:tool",
        nodeId: "n1",
        runId: "r1",
        toolName: "search",
        toolInput: { query: "test" },
        toolOutput: { results: [] },
      },
      "msg-1",
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      type: "tool-input-available",
      toolName: "search",
      input: { query: "test" },
    });
    expect(chunks[1]).toMatchObject({
      type: "tool-output-available",
      output: { results: [] },
    });
    expect((chunks[0] as { toolCallId: string }).toolCallId).toBe(
      (chunks[1] as { toolCallId: string }).toolCallId,
    );
  });

  test("handles tool errors", () => {
    const chunks = transformToolEvent(
      {
        type: "agent:tool",
        nodeId: "n1",
        runId: "r1",
        toolName: "search",
        toolInput: { query: "test" },
        toolOutput: {},
        error: "Tool failed",
      },
      "msg-1",
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      type: "tool-input-available",
      toolName: "search",
    });
    expect(chunks[1]).toMatchObject({
      type: "error",
      errorText: "Tool failed",
    });
  });
});

describe("transformStepEvent", () => {
  test("emits step-start when sendStepMarkers is true", () => {
    const chunks = transformStepEvent(
      { type: "node:start" },
      { sendStepMarkers: true },
    );

    expect(chunks).toHaveLength(1);
    expect((chunks[0] as { type: string }).type).toBe("step-start");
  });

  test("returns empty array when sendStepMarkers is false", () => {
    const chunks = transformStepEvent(
      { type: "node:start" },
      { sendStepMarkers: false },
    );

    expect(chunks).toEqual([]);
  });
});

describe("transformErrorEvent", () => {
  test("emits error chunk with message from agent:error", () => {
    const chunks = transformErrorEvent({
      type: "agent:error",
      message: "Invalid input",
    });

    expect(chunks).toEqual([{ type: "error", errorText: "Invalid input" }]);
  });

  test("emits error chunk with error from node:error", () => {
    const chunks = transformErrorEvent({
      type: "node:error",
      error: "Node execution failed",
    });

    expect(chunks).toEqual([
      { type: "error", errorText: "Node execution failed" },
    ]);
  });

  test("emits error chunk with reason from agent:aborted", () => {
    const chunks = transformErrorEvent({
      type: "agent:aborted",
      reason: "User cancelled",
    });

    expect(chunks).toEqual([{ type: "error", errorText: "User cancelled" }]);
  });

  test("handles missing error messages gracefully", () => {
    const chunks = transformErrorEvent({
      type: "agent:error",
    });

    expect(chunks).toEqual([{ type: "error", errorText: "An error occurred" }]);
  });
});

describe("transformEvent", () => {
  test("routes text events correctly", () => {
    const tracker = createPartTracker();
    const options = {
      sendReasoning: true,
      sendStepMarkers: true,
      sendFlowMetadata: false,
      sendNodeOutputs: false,
      generateMessageId: () => "msg-1",
    };

    const chunks = transformEvent(
      {
        type: "agent:text:delta",
        nodeId: "n1",
        runId: "r1",
        content: "Hello",
        timestamp: Date.now(),
      },
      tracker,
      "msg-1",
      options,
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.type).toBe("text-start");
    expect(chunks[1]?.type).toBe("text-delta");
  });

  test("routes reasoning events correctly", () => {
    const tracker = createPartTracker();
    const options = {
      sendReasoning: true,
      sendStepMarkers: true,
      sendFlowMetadata: false,
      sendNodeOutputs: false,
      generateMessageId: () => "msg-1",
    };

    const chunks = transformEvent(
      {
        type: "agent:thinking:delta",
        nodeId: "n1",
        runId: "r1",
        content: "Thinking",
        timestamp: Date.now(),
      },
      tracker,
      "msg-1",
      options,
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.type).toBe("reasoning-start");
    expect(chunks[1]?.type).toBe("reasoning-delta");
  });

  test("routes tool events correctly", () => {
    const tracker = createPartTracker();
    const options = {
      sendReasoning: true,
      sendStepMarkers: true,
      sendFlowMetadata: false,
      sendNodeOutputs: false,
      generateMessageId: () => "msg-1",
    };

    const chunks = transformEvent(
      {
        type: "agent:tool",
        nodeId: "n1",
        runId: "r1",
        toolName: "search",
        toolInput: { query: "test" },
        toolOutput: { results: [] },
        timestamp: Date.now(),
      },
      tracker,
      "msg-1",
      options,
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.type).toBe("tool-input-available");
    expect(chunks[1]?.type).toBe("tool-output-available");
  });

  test("routes step events correctly", () => {
    const tracker = createPartTracker();
    const options = {
      sendReasoning: true,
      sendStepMarkers: true,
      sendFlowMetadata: false,
      sendNodeOutputs: false,
      generateMessageId: () => "msg-1",
    };

    const chunks = transformEvent(
      {
        type: "node:start",
        nodeId: "n1",
        runId: "r1",
        timestamp: Date.now(),
      },
      tracker,
      "msg-1",
      options,
    );

    expect(chunks).toHaveLength(1);
    expect((chunks[0] as { type: string })?.type).toBe("step-start");
  });

  test("returns empty array for unmapped events", () => {
    const tracker = createPartTracker();
    const options = {
      sendReasoning: true,
      sendStepMarkers: true,
      sendFlowMetadata: false,
      sendNodeOutputs: false,
      generateMessageId: () => "msg-1",
    };

    const chunks = transformEvent(
      {
        type: "flow:start",
        flowName: "test",
        timestamp: Date.now(),
      },
      tracker,
      "msg-1",
      options,
    );

    expect(chunks).toEqual([]);
  });
});

describe("transformEvent with real captured events", () => {
  const fixturePath = resolve(
    process.cwd(),
    "tests/server/fixtures/runtime-events.json",
  );
  const events = JSON.parse(
    readFileSync(fixturePath, "utf-8"),
  ) as RuntimeEvent[];

  test("transforms real agent:text:delta events", () => {
    const tracker = createPartTracker();
    const options = {
      sendReasoning: true,
      sendStepMarkers: true,
      sendFlowMetadata: false,
      sendNodeOutputs: false,
      generateMessageId: () => "msg-real",
    };

    const textDeltaEvents = events.filter((e) => e.type === "agent:text:delta");
    expect(textDeltaEvents.length).toBeGreaterThan(0);

    // First delta should emit start + delta
    const firstDelta = textDeltaEvents[0];
    if (!firstDelta) {
      throw new Error("No text delta events found");
    }
    const chunks = transformEvent(firstDelta, tracker, "msg-real", options);

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]?.type).toBe("text-start");
    if (chunks.length > 1) {
      expect(chunks[1]?.type).toBe("text-delta");
    }
  });

  test("transforms real agent:thinking:delta events", () => {
    const tracker = createPartTracker();
    const options = {
      sendReasoning: true,
      sendStepMarkers: true,
      sendFlowMetadata: false,
      sendNodeOutputs: false,
      generateMessageId: () => "msg-real",
    };

    const thinkingDeltaEvents = events.filter(
      (e) => e.type === "agent:thinking:delta",
    );
    expect(thinkingDeltaEvents.length).toBeGreaterThan(0);

    // First delta should emit start + delta
    const firstDelta = thinkingDeltaEvents[0];
    if (!firstDelta) {
      throw new Error("No thinking delta events found");
    }
    const chunks = transformEvent(firstDelta, tracker, "msg-real", options);

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]?.type).toBe("reasoning-start");
    if (chunks.length > 1) {
      expect(chunks[1]?.type).toBe("reasoning-delta");
    }
  });

  test("transforms real agent:tool events", () => {
    const tracker = createPartTracker();
    const options = {
      sendReasoning: true,
      sendStepMarkers: true,
      sendFlowMetadata: false,
      sendNodeOutputs: false,
      generateMessageId: () => "msg-real",
    };

    const toolEvents = events.filter((e) => e.type === "agent:tool");
    expect(toolEvents.length).toBeGreaterThan(0);

    const toolEvent = toolEvents[0];
    if (!toolEvent) {
      throw new Error("No tool events found");
    }
    const chunks = transformEvent(toolEvent, tracker, "msg-real", options);

    expect(chunks.length).toBe(2);
    expect(chunks[0]?.type).toBe("tool-input-available");
    expect(chunks[1]?.type).toBe("tool-output-available");
  });

  test("transforms real agent:complete event", () => {
    const completeEvents = events.filter((e) => e.type === "agent:complete");
    expect(completeEvents.length).toBe(1);

    const completeEvent = completeEvents[0];
    if (!completeEvent) {
      throw new Error("No complete event found");
    }
    if (completeEvent.type === "agent:complete") {
      expect(completeEvent.result).toBeDefined();
      expect(completeEvent.usage).toBeDefined();
    }
  });

  test("processes full event sequence from real capture", () => {
    const tracker = createPartTracker();
    const options = {
      sendReasoning: true,
      sendStepMarkers: true,
      sendFlowMetadata: false,
      sendNodeOutputs: false,
      generateMessageId: () => "msg-real",
    };

    const allChunks: unknown[] = [];
    for (const event of events) {
      const chunks = transformEvent(event, tracker, "msg-real", options);
      allChunks.push(...chunks);
    }

    // Should have produced chunks from agent events
    expect(allChunks.length).toBeGreaterThan(0);

    // Verify we have text chunks
    const textChunks = allChunks.filter(
      (c) =>
        typeof c === "object" &&
        c !== null &&
        "type" in c &&
        (c.type === "text-start" ||
          c.type === "text-delta" ||
          c.type === "text-end"),
    );
    expect(textChunks.length).toBeGreaterThan(0);

    // Verify we have reasoning chunks
    const reasoningChunks = allChunks.filter(
      (c) =>
        typeof c === "object" &&
        c !== null &&
        "type" in c &&
        (c.type === "reasoning-start" ||
          c.type === "reasoning-delta" ||
          c.type === "reasoning-end"),
    );
    expect(reasoningChunks.length).toBeGreaterThan(0);

    // Verify we have tool chunks
    const toolChunks = allChunks.filter(
      (c) =>
        typeof c === "object" &&
        c !== null &&
        "type" in c &&
        (c.type === "tool-input-available" ||
          c.type === "tool-output-available"),
    );
    expect(toolChunks.length).toBeGreaterThan(0);
  });
});
