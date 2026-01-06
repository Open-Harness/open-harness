/**
 * Authoritative live test for flow loader (promptFile + nodePacks).
 *
 * Usage: bun scripts/live/flow-loader-live.ts
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadFlowYamlFile } from "../../src/flow/loader.js";

async function runLiveTest() {
	console.log("🧪 Running Flow loader live test...");

	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);
	const fixturesRoot = join(__dirname, "..", "..", "tests", "fixtures");
	const scratchDir = join(fixturesRoot, "scratch", "flow-loader-live");
	const flowPath = join(scratchDir, "flow.yaml");
	const promptPath = join("..", "..", "prompt-files", "ask.txt");

	await mkdir(scratchDir, { recursive: true });

	const source = [
		"flow:",
		"  name: loader-live",
		"  nodePacks: [core]",
		"nodes:",
		"  - id: ask",
		"    type: echo",
		"    input:",
		`      promptFile: "${promptPath}"`,
		"edges: []",
		"",
	].join("\n");

	await writeFile(flowPath, source, "utf-8");

	try {
		const flow = await loadFlowYamlFile(flowPath);
		const nodePacks = flow.flow.nodePacks ?? [];
		if (!nodePacks.includes("core")) {
			throw new Error("nodePacks missing or did not include core");
		}

		const ask = flow.nodes.find((node) => node.id === "ask");
		if (!ask || !("prompt" in ask.input)) {
			throw new Error("promptFile was not resolved into prompt");
		}
		if ("promptFile" in ask.input) {
			throw new Error("promptFile should not remain after resolution");
		}
	} finally {
		await rm(scratchDir, { recursive: true, force: true });
	}

	console.log("✅ Flow loader live test passed");
}

runLiveTest().catch((error) => {
	console.error("❌ Flow loader live test failed:", error);
	process.exit(1);
});
