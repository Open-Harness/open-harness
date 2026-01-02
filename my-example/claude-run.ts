import { executeFlow, createHub, NodeRegistry, claudePack } from "../packages/kernel/src/index.js";
import { loadFlowYamlFile } from "../packages/kernel/src/flow/loader.js";

async function main() {
  console.log("🤖 Running Claude agent...\n");

  // Load the flow
  const flow = await loadFlowYamlFile(new URL("./claude-flow.yaml", import.meta.url).pathname);

  // Create the event bus
  const hub = createHub("claude-example");
  await hub.start();

  // Listen to ALL events to see what's happening
  hub.subscribe((event) => {
    console.log(`[Event] ${event.type}`);
  });

  // Register Claude pack
  const registry = new NodeRegistry();
  claudePack.register(registry);

  // Execute
  const ctx = {
    hub,
    phase: async (name, fn) => {
      console.log(`\n=== ${name} ===`);
      return await fn();
    },
    task: async (id, fn) => fn(),
  };

  const result = await executeFlow(flow, registry, ctx);

  console.log("\n📝 Claude's response:");
  console.log(result.outputs.thinker.text);

  await hub.stop();
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
