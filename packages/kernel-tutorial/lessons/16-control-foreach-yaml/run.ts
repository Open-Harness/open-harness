/**
 * Lesson 16: control.foreach in Flow YAML
 *
 * Demonstrates using the control.foreach node for batch processing in YAML.
 *
 * Scenario: A security scanner that processes multiple source files,
 * checking each for common vulnerabilities. Each file gets its own
 * session for isolation.
 *
 * Primitives used:
 * - control.foreach node - iterates with session isolation
 * - session:start / session:end events - lifecycle tracking
 * - Flow YAML body execution - child nodes per iteration
 * - Custom tutorial.security_scan node - domain-specific processing
 *
 * Key pattern: YAML-based loops maintain session isolation automatically,
 * making batch processing clean and observable.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Attachment } from "@open-harness/kernel";
import { consoleChannel } from "../../src/channels/console-channel.js";
import { runFlowFile } from "../../src/flow-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Custom channel to track session lifecycle events.
 */
const sessionTracker: Attachment = (hub) => {
	const sessions: Array<{ type: string; sessionId: string; nodeId: string }> = [];

	const unsubStart = hub.subscribe("session:start", (event) => {
		const payload = event.event as { sessionId: string; nodeId: string };
		sessions.push({ type: "start", sessionId: payload.sessionId, nodeId: payload.nodeId });
		console.log(`  🔵 Session started: ${payload.sessionId.slice(0, 16)}...`);
	});

	const unsubEnd = hub.subscribe("session:end", (event) => {
		const payload = event.event as { sessionId: string; nodeId: string };
		sessions.push({ type: "end", sessionId: payload.sessionId, nodeId: payload.nodeId });
		console.log(`  🔴 Session ended: ${payload.sessionId.slice(0, 16)}...`);
	});

	return () => {
		unsubStart();
		unsubEnd();

		const starts = sessions.filter((s) => s.type === "start").length;
		const ends = sessions.filter((s) => s.type === "end").length;
		const uniqueSessions = new Set(sessions.map((s) => s.sessionId)).size;

		console.log("\n📊 Session Summary:");
		console.log(`   Sessions created: ${starts}`);
		console.log(`   Sessions ended: ${ends}`);
		console.log(`   Unique sessions: ${uniqueSessions}`);
	};
};

async function main() {
	console.log("Lesson 16: control.foreach in Flow YAML\n");
	console.log("Scenario: Batch security scan with session isolation\n");

	console.log("--- Processing Files ---\n");

	const outputs = await runFlowFile({
		filePath: resolve(__dirname, "flow.yaml"),
		attachments: [consoleChannel, sessionTracker],
	});

	console.log("\n--- Scan Results ---");

	const scanResults = outputs["scan_files"] as {
		iterations?: Array<{
			item: { path: string; content: string };
			sessionId: string;
			outputs: {
				scan_single_file?: { path: string; issues: string[]; severity: string };
			};
		}>;
	} | undefined;

	if (scanResults?.iterations) {
		for (const iteration of scanResults.iterations) {
			const { path } = iteration.item;
			const childOutput = iteration.outputs.scan_single_file;
			if (!childOutput) continue;
			const { issues, severity } = childOutput;

			if (issues.length > 0) {
				console.log(`\n❌ ${path} [${severity}]`);
				for (const issue of issues) {
					console.log(`   - ${issue}`);
				}
			} else {
				console.log(`\n✅ ${path} - No issues found`);
			}
		}
	}

	// Verify session isolation worked
	const iterationCount = scanResults?.iterations?.length ?? 0;
	if (iterationCount === 3) {
		console.log("\n✓ All 3 files processed with session isolation");
		console.log("✓ control.foreach node executed successfully in YAML");
	} else {
		console.error(`\n✗ Expected 3 iterations, got ${iterationCount}`);
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("Error:", error.message);
	process.exit(1);
});
