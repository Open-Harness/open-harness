import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import {
	createRuntime,
	DefaultNodeRegistry,
	parseFlowYaml,
} from "../src/index.js";
import { createClaudeNode } from "../src/nodes/claude.agent.js";
import { constantNode, echoNode } from "../src/nodes/index.js";
import type { FixtureFile } from "../src/testing/mock-query.js";

const args = parseArgs(process.argv.slice(2));
if (!args.flow || !args.outDir) {
	console.error(
		"Usage: bun scripts/record-fixtures.ts --flow <path> --out <dir>",
	);
	process.exit(1);
}

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
			output,
			events: events as SDKMessage[],
		});
		recordings.set(nodeId, entry);
	},
});

const registry = new DefaultNodeRegistry();
registry.register(constantNode);
registry.register(echoNode);
registry.register(claudeNode);

const runtime = createRuntime({ flow, registry });
await runtime.run();

await mkdir(outDir, { recursive: true });
for (const [nodeId, fixture] of recordings.entries()) {
	const outPath = join(outDir, `${nodeId}.json`);
	await writeFile(outPath, JSON.stringify(fixture, null, 2));
	console.log(`wrote ${outPath}`);
}

function parseArgs(argv: string[]): { flow?: string; outDir?: string } {
	const parsed: { flow?: string; outDir?: string } = {};
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
		}
	}
	return parsed;
}
