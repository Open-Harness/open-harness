import { executeFlow, createHub, NodeRegistry, corePack } from "../packages/kernel/src/index.js";
import { loadFlowYamlFile } from "../packages/kernel/src/flow/loader.js";

async function main() {
  console.log("Running my first flow...\n");

  // 1. Load the flow YAML
  const flow = await loadFlowYamlFile(new URL("./flow.yaml", import.meta.url).pathname);

  // 2. Create the event bus (Hub)
  const hub = createHub("my-example");
  await hub.start();

  // 3. Create a node registry and register the core pack
  const registry = new NodeRegistry();
  corePack.register(registry);

  // 5. Execute the flow
  const ctx = {
    hub,
    phase: async (name, fn) => {
      console.log(`\n>>> Phase: ${name}`);
      return await fn();
    },
    task: async (id, fn) => {
      console.log(`>>> Task: ${id}`);
      return await fn();
    },
  };

  const result = await executeFlow(flow, registry, ctx);

  console.log("\n✅ Flow complete!");
  console.log("Outputs:", result.outputs);

  await hub.stop();
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
