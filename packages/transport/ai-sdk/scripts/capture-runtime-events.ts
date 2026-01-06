import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClaudeNode, createMockQuery, type FixtureFile, type FixtureSet } from "@open-harness/provider-anthropic";
import type { RuntimeEvent } from "@open-harness/sdk";
import { createRuntime, DefaultNodeRegistry, parseFlowYaml } from "@open-harness/sdk";

/**
 * Captures RuntimeEvents by replaying a fixture through the Open Harness runtime.
 *
 * Usage:
 *   bun run scripts/capture-runtime-events.ts
 */
async function main() {
	// Get the script's directory to resolve paths relative to it
	const scriptDir = dirname(fileURLToPath(import.meta.url));
	const packageRoot = resolve(scriptDir, "..");

	const fixturePath = resolve(packageRoot, "tests/fixtures/raw-sdk-capture.fixture.json");
	const outputPath = resolve(packageRoot, "tests/fixtures/runtime-events.json");

	console.log(`Reading fixture from: ${fixturePath}`);
	const fixtureFile = JSON.parse(readFileSync(fixturePath, "utf-8")) as FixtureFile;

	// Extract the prompt from the first call
	const firstCall = fixtureFile.calls[0];
	if (!firstCall) {
		throw new Error("Fixture file has no calls");
	}

	const prompt = typeof firstCall.input.prompt === "string" ? firstCall.input.prompt : "test prompt";

	// Create fixture set keyed by prompt
	const fixtureSet: FixtureSet = {
		[prompt]: fixtureFile,
	};

	// Create mock query that replays the fixture
	const mockQuery = createMockQuery({
		fixtures: fixtureSet,
		selectFixtureKey: () => prompt,
	});

	// Create Claude node with mock query
	const claudeNode = createClaudeNode({
		queryFn: mockQuery,
	});

	// Create registry and register the node
	const registry = new DefaultNodeRegistry();
	registry.register(claudeNode);

	// Create a simple flow that uses the claude node
	// Use YAML literal block scalar to handle multiline prompts
	const promptYaml = prompt.includes("\n")
		? `      prompt: |\n${prompt
				.split("\n")
				.map((line: string) => `        ${line}`)
				.join("\n")}`
		: `      prompt: "${prompt.replace(/"/g, '\\"')}"`;

	const flow = parseFlowYaml(`
name: "capture-events"
nodes:
  - id: agent
    type: claude.agent
    input:
${promptYaml}
edges: []
`);

	// Create runtime
	const runtime = createRuntime({ flow, registry });

	// Capture all events
	const events: RuntimeEvent[] = [];

	runtime.onEvent((event) => {
		events.push(event);
		console.log(`  📡 ${event.type}`);
	});

	console.log("Running flow to capture events...\n");

	try {
		await runtime.run();
	} catch (error) {
		console.error("Error during runtime execution:", error);
		throw error;
	}

	// Ensure output directory exists
	mkdirSync(dirname(outputPath), { recursive: true });

	// Save captured events
	console.log(`\nWriting ${events.length} events to: ${outputPath}`);
	writeFileSync(outputPath, JSON.stringify(events, null, 2), "utf-8");

	console.log("Capture complete!");
	console.log(`  Total events: ${events.length}`);
	console.log(`  Agent events: ${events.filter((e) => e.type.startsWith("agent:")).length}`);
	console.log(`  Node events: ${events.filter((e) => e.type.startsWith("node:")).length}`);
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
