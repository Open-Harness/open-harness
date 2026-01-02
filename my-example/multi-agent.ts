import { executeFlow, createHub, NodeRegistry, claudePack } from "../packages/kernel/src/index.js";
import { loadFlowYamlFile } from "../packages/kernel/src/flow/loader.js";

async function main() {
  console.log("🔄 Multi-Agent Workflow\n");
  console.log("Agent 1 (Researcher) → Agent 2 (Summarizer)\n");

  const flow = await loadFlowYamlFile(new URL("./multi-agent-flow.yaml", import.meta.url).pathname);

  const hub = createHub("multi-agent");
  await hub.start();

  hub.subscribe((event) => {
    if (event.type === "node:start") {
      console.log(`\n🤖 Starting: ${event.nodeId}`);
    } else if (event.type === "node:complete") {
      console.log(`✅ Completed: ${event.nodeId}`);
    }
  });

  const registry = new NodeRegistry();
  claudePack.register(registry);

  const ctx = {
    hub,
    phase: async (name, fn) => {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`Phase: ${name}`);
      console.log(`${'='.repeat(50)}`);
      return await fn();
    },
    task: async (id, fn) => fn(),
  };

  const result = await executeFlow(flow, registry, ctx);

  console.log("\n" + "=".repeat(50));
  console.log("📊 FINAL RESULT");
  console.log("=".repeat(50) + "\n");

  const researcherOutput = result.outputs.researcher as { text: string };
  const summarizerOutput = result.outputs.summarizer as { text: string };

  console.log("📝 Agent 1 - Researcher:");
  console.log(researcherOutput.text);
  console.log("\n" + "─".repeat(50));
  console.log("📝 Agent 2 - Summarizer:");
  console.log(summarizerOutput.text);

  await hub.stop();
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
