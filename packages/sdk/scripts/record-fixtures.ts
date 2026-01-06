import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import {
  createRuntime,
  DefaultNodeRegistry,
  parseFlowYaml,
} from "../src/index.js";
import {
  createClaudeNode,
  type FixtureFile,
  createMockQuery,
} from "../src/server/providers/index.js";
import { constantNode, echoNode } from "../src/nodes/index.js";

const args = parseArgs(process.argv.slice(2));
if (!args.flow || !args.outDir) {
  console.error(
    "Usage: bun scripts/record-fixtures.ts --flow <path> --out <dir> [--input <json>]",
  );
  process.exit(1);
}

// Parse flow input if provided
const flowInput: Record<string, unknown> = args.input
  ? JSON.parse(args.input)
  : {};

const flowPath = resolve(process.cwd(), args.flow);
const outDir = resolve(process.cwd(), args.outDir);

const flowText = await Bun.file(flowPath).text();
const flow = parseFlowYaml(flowText);

const recordings = new Map<string, FixtureFile>();

const claudeNode = createClaudeNode({
  record: ({ nodeId, input, output, events }) => {
    const entry = recordings.get(nodeId) ?? { calls: [] };
    entry.calls.push({
      input,
      output: {
        ...output,
        text: output.text ?? "",
      },
      events: events as SDKMessage[],
    });
    recordings.set(nodeId, entry);
  },
});

const registry = new DefaultNodeRegistry();
registry.register(constantNode);
registry.register(echoNode);
registry.register(claudeNode);

console.log(`Recording fixtures for flow: ${flow.name}`);
console.log(`Input: ${JSON.stringify(flowInput)}`);

const runtime = createRuntime({ flow, registry });

// Log events during recording
runtime.onEvent((event) => {
  if (event.type === "node:start") {
    console.log(`  → Starting node: ${(event as { nodeId: string }).nodeId}`);
  }
  if (event.type === "node:complete") {
    console.log(`  ✓ Completed node: ${(event as { nodeId: string }).nodeId}`);
  }
  if (event.type === "agent:text:delta") {
    process.stdout.write(".");
  }
  if (event.type === "node:error") {
    console.error(`  ✗ Error in node:`, event);
  }
  if (event.type === "flow:complete" && event.status === "failed") {
    console.error(`  ✗ Flow failed:`, event);
  }
});

await runtime.run(flowInput);

await mkdir(outDir, { recursive: true });
for (const [nodeId, fixture] of recordings.entries()) {
  const outPath = join(outDir, `${nodeId}.json`);
  await writeFile(outPath, JSON.stringify(fixture, null, 2));
  console.log(`wrote ${outPath}`);
}

function parseArgs(argv: string[]): {
  flow?: string;
  outDir?: string;
  input?: string;
} {
  const parsed: { flow?: string; outDir?: string; input?: string } = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--flow") {
      parsed.flow = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--out") {
      parsed.outDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--input") {
      parsed.input = argv[i + 1];
      i += 1;
    }
  }
  return parsed;
}
