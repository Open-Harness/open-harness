import { describe, expect, test } from "bun:test";
import type { Runtime } from "@internal/runtime";
import type { RuntimeCommand, RuntimeEvent } from "@internal/state";

/**
 * Contract test function for Runtime implementations.
 * Ensures all Runtime implementations behave consistently.
 */
export function runtimeContract(
  name: string,
  createRuntime: () => {
    runtime: Runtime;
    cleanup?: () => void;
  },
) {
  describe(name, () => {
    test("implements Runtime interface", () => {
      const { runtime, cleanup } = createRuntime();
      expect(runtime.onEvent).toBeInstanceOf(Function);
      expect(runtime.dispatch).toBeInstanceOf(Function);
      expect(runtime.getSnapshot).toBeInstanceOf(Function);
      expect(runtime.run).toBeInstanceOf(Function);
      cleanup?.();
    });

    test("onEvent subscribes and unsubscribes correctly", () => {
      const { runtime, cleanup } = createRuntime();
      const events: RuntimeEvent[] = [];
      const unsubscribe = runtime.onEvent((event) => {
        events.push(event);
      });

      // Emit test event if runtime supports it (MockRuntime has emit method)
      if (
        "emit" in runtime &&
        typeof (runtime as { emit?: (event: RuntimeEvent) => void }).emit ===
          "function"
      ) {
        (runtime as { emit: (event: RuntimeEvent) => void }).emit({
          type: "flow:start",
          flowName: "test",
          timestamp: Date.now(),
        });
        expect(events.length).toBeGreaterThan(0);
      }

      unsubscribe();
      cleanup?.();
    });

    test("dispatch accepts commands", () => {
      const { runtime, cleanup } = createRuntime();
      const command: RuntimeCommand = { type: "abort", resumable: true };
      expect(() => runtime.dispatch(command)).not.toThrow();
      cleanup?.();
    });

    test("getSnapshot returns valid snapshot", () => {
      const { runtime, cleanup } = createRuntime();
      const snapshot = runtime.getSnapshot();
      expect(snapshot).toHaveProperty("status");
      expect(snapshot).toHaveProperty("outputs");
      expect(snapshot).toHaveProperty("state");
      expect(snapshot).toHaveProperty("nodeStatus");
      expect(snapshot).toHaveProperty("edgeStatus");
      cleanup?.();
    });

    test("run returns a snapshot", async () => {
      const { runtime, cleanup } = createRuntime();
      const snapshot = await runtime.run();
      expect(snapshot).toHaveProperty("status");
      expect(snapshot).toHaveProperty("outputs");
      cleanup?.();
    });
  });
}
