import { describe, expect, test } from "bun:test";
import { createPartTracker } from "../../../src/server/transports/transforms";

describe("createPartTracker", () => {
  test("returns tracker with initial state", () => {
    const tracker = createPartTracker();
    expect(tracker.textStarted).toBe(false);
    expect(tracker.reasoningStarted).toBe(false);
  });
});
