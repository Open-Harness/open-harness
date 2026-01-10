import { describe, expect, test } from "bun:test";
import type { RuntimeEvent } from "../../src/core/events.js";
import {
  createDefaultRegistry,
  createHarness,
  parseFlowYaml,
  runFlow,
} from "../../src/index.js";

describe("harness integration", () => {
  test("createHarness with defaults", async () => {
    const flow = parseFlowYaml(`
name: "simple"
nodes:
  - id: a
    type: constant
    input:
      value: "Hello"
  - id: b
    type: echo
    input:
      text: "{{ a.value }}"
edges:
  - from: a
    to: b
`);

    const harness = createHarness({ flow });
    const snapshot = await harness.run();

    expect(snapshot.outputs.a).toEqual({ value: "Hello" });
    expect(snapshot.outputs.b).toEqual({ text: "Hello" });
  });

  test("createHarness exposes primitives", async () => {
    const flow = parseFlowYaml(`
name: "simple"
nodes:
  - id: a
    type: echo
    input:
      text: "test"
edges: []
`);

    const harness = createHarness({ flow });

    // Runtime should be accessible
    expect(harness.runtime).toBeDefined();

    // onEvent should work
    const events: RuntimeEvent[] = [];
    harness.runtime.onEvent((event) => {
      events.push(event);
    });

    await harness.run();

    const types = events.map((e) => e.type);
    expect(types).toContain("flow:start");
    expect(types).toContain("node:start");
    expect(types).toContain("flow:complete");
  });

  test("createHarness with event handler", async () => {
    const flow = parseFlowYaml(`
name: "simple"
nodes:
  - id: a
    type: echo
    input:
      text: "test"
edges: []
`);

    const events: RuntimeEvent[] = [];
    const harness = createHarness({
      flow,
      onEvent: (event) => {
        events.push(event);
      },
    });

    await harness.run();

    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.type).toBe("flow:start");
  });

  test("createDefaultRegistry includes standard nodes", async () => {
    const registry = createDefaultRegistry();

    // Should have standard nodes
    expect(registry.has("constant")).toBe(true);
    expect(registry.has("echo")).toBe(true);
    expect(registry.has("claude.agent")).toBe(true);

    // Use registry with flow
    const flow = parseFlowYaml(`
name: "test"
nodes:
  - id: a
    type: constant
    input:
      value: "test"
edges: []
`);

    const harness = createHarness({
      flow,
      registry,
    });

    await harness.run();
    expect(harness.runtime.getSnapshot().outputs.a).toEqual({ value: "test" });
  });

  test("runFlow convenience function", async () => {
    const flow = parseFlowYaml(`
name: "simple"
nodes:
  - id: a
    type: constant
    input:
      value: "Hello"
edges: []
`);

    // Simplest possible API
    const snapshot = await runFlow({ flow });

    expect(snapshot.outputs.a).toEqual({ value: "Hello" });
  });

  test("runFlow with input", async () => {
    const flow = parseFlowYaml(`
name: "test"
nodes:
  - id: a
    type: echo
    input:
      text: "{{ flow.input.message }}"
edges: []
`);

    const snapshot = await runFlow({
      flow,
      input: { message: "World" },
    });

    expect(snapshot.outputs.a).toEqual({ text: "World" });
  });

  test("runFlow with event handler", async () => {
    const flow = parseFlowYaml(`
name: "simple"
nodes:
  - id: a
    type: echo
    input:
      text: "test"
edges: []
`);

    const events: RuntimeEvent[] = [];
    await runFlow({
      flow,
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(events.length).toBeGreaterThan(0);
  });

  test("createHarness with WebSocket transport", async () => {
    const flow = parseFlowYaml(`
name: "simple"
nodes:
  - id: a
    type: constant
    input:
      value: "test"
edges: []
`);

    const harness = createHarness({
      flow,
      transport: {
        websocket: { port: 9999 }, // unused port
      },
    });

    expect(harness.transport).toBeDefined();

    await harness.run();
    await harness.stop();
  });

  test("runFlow accepts plain object registry", async () => {
    const flow = parseFlowYaml(`
name: "simple"
nodes:
  - id: a
    type: custom.node
    input:
      text: "{{ flow.input.message }}"
edges: []
`);

    const customNode: {
      type: string;
      run: (
        _ctx: unknown,
        input: { text: string },
      ) => Promise<{ result: string }>;
    } = {
      type: "custom.node",
      run: async (_ctx: unknown, input: { text: string }) => ({
        result: input.text.toUpperCase(),
      }),
    };

    const snapshot = await runFlow({
      flow,
      registry: { [customNode.type]: customNode },
      input: { message: "hello" },
    });

    expect(snapshot.outputs.a).toEqual({ result: "HELLO" });
  });
});
