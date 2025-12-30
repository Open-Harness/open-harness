/**
 * Authoritative live test for Flow parsing and validation.
 *
 * Usage: bun scripts/live/flow-live.ts
 */

import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFlowYaml } from "../../src/flow/parser.js";

async function runLiveTest() {
	console.log("🧪 Running Flow live test...");

	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);
	const fixturesDir = join(__dirname, "..", "..", "tests", "fixtures", "flow");
	const entries = await readdir(fixturesDir);
	const yamlFiles = entries.filter((entry) => entry.endsWith(".yaml"));

	let passed = 0;
	let failed = 0;

	for (const file of yamlFiles) {
		try {
			const path = join(fixturesDir, file);
			const content = await readFile(path, "utf-8");
			parseFlowYaml(content);
			console.log(`  ✓ ${file}`);
			passed++;
		} catch (error) {
			console.error(`  ✗ ${file} error:`, error);
			failed++;
		}
	}

	console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

	if (failed > 0) {
		console.error("❌ Live test failed");
		process.exit(1);
	}

	console.log("✅ All live tests passed");
}

runLiveTest().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
