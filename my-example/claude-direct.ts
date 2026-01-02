// Example: Using Claude agents directly (no flow YAML)
import { createHub, claudePack, NodeRegistry } from "../packages/kernel/src/index.js";

async function main() {
  console.log("Running Claude agent directly...\n");

  // Create the event bus
  const hub = createHub("claude-example");
  await hub.start();

  // Listen to events
  hub.subscribe((event) => {
    console.log(`Event:`, event);
  });

  // Get the Claude node definition
  const registry = new NodeRegistry();
  claudePack.register(registry);
  const claudeNode = registry.get("claude.agent");

  // Execute the Claude node
  const ctx = {
    hub,
    runId: `run-${Date.now()}`,
    phase: async (name, fn) => fn(),
    task: async (id, fn) => fn(),
  };

  const result = await claudeNode.run(ctx, {
    prompt: "What is Open Harness in one sentence?",
  }) as { text: string };

  console.log("\n✅ Claude response:");
  console.log(result.text);

  await hub.stop();
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
