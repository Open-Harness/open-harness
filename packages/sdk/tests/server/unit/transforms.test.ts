import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RuntimeEvent } from "../../../src/core/events.js";
import {
  createPartTracker,
  transformErrorEvent,
  transformEvent,
  transformReasoningEvent,
  transformStepEvent,
  transformTextEvent,
  transformToolEvent,
} from "../../../src/server/transports/transforms";

describe("createPartTracker", () => {
  test("returns tracker with initial state", () => {
    const tracker = createPartTracker();
    expect(tracker.textStarted).toBe(false);
    expect(tracker.reasoningStarted).toBe(false);
  });
});
