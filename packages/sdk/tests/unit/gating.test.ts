import { describe, expect, test } from "bun:test";
import {
  createRuntime,
  DefaultNodeRegistry,
  parseFlowYaml,
} from "../../src/index.js";
import { constantNode, echoNode } from "../../src/nodes/index.js";

describe("edge gating", () => {
  test("gate any runs when at least one edge fires", async () => {
    const flow = parseFlowYaml(`
name: "gate-any"
nodes:
  - id: a
    type: constant
    input:
      value: "go"
  - id: b
    type: constant
    input:
      value: "stop"
  - id: c
    type: echo
    input:
      text: "{{ a.value }}"
edges:
  - from: a
    to: c
    gate: "any"
    when:
      equals:
        var: "a.value"
        value: "go"
  - from: b
    to: c
    gate: "any"
    when:
      equals:
        var: "b.value"
        value: "go"
`);

    const registry = new DefaultNodeRegistry();
    registry.register(constantNode);
    registry.register(echoNode);

    const snapshot = await createRuntime({ flow, registry }).run();
    expect(snapshot.outputs.c).toEqual({ text: "go" });
  });

  test("gate all skips when any edge is skipped", async () => {
    const flow = parseFlowYaml(`
name: "gate-all"
nodes:
  - id: a
    type: constant
    input:
      value: "go"
  - id: b
    type: constant
    input:
      value: "stop"
  - id: c
    type: echo
    input:
      text: "{{ a.value }}"
edges:
  - from: a
    to: c
    gate: "all"
    when:
      equals:
        var: "a.value"
        value: "go"
  - from: b
    to: c
    gate: "all"
    when:
      equals:
        var: "b.value"
        value: "go"
`);

    const registry = new DefaultNodeRegistry();
    registry.register(constantNode);
    registry.register(echoNode);

    const snapshot = await createRuntime({ flow, registry }).run();
    expect(snapshot.outputs.c).toEqual({ skipped: true, reason: "edge" });
  });
});
