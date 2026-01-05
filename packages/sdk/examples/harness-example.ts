/**
 * Example: Using the createHarness() API for minimal boilerplate
 */

import { createHarness, parseFlowYaml, runFlow } from "../src/index.js";

const flow = parseFlowYaml(`
name: "simple"
nodes:
  - id: a
    type: constant
    input:
      value: "Hello World"
edges: []
`);

// Option 1: Simplest case - runFlow() does everything
console.log("=== Option 1: runFlow() - simplest ===");
const snapshot1 = await runFlow({ flow });
console.log("Result:", snapshot1.outputs.a);

// Option 2: createHarness() with more control
console.log("\n=== Option 2: createHarness() - full control ===");
const harness = createHarness({
  flow,
  onEvent: (event) => {
    console.log(`[${event.type}]`);
  },
});

const snapshot2 = await harness.run();
console.log("Result:", snapshot2.outputs.a);

// Access primitives if needed
console.log("\n=== Accessing primitives ===");
const snapshot3 = await harness.runtime.run();
console.log("Runtime snapshot:", snapshot3.status);

await harness.stop();
