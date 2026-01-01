/**
 * Lesson 05: Flow When + Policy
 *
 * Demonstrates conditional execution and error handling policies.
 *
 * Scenario: An API health check pipeline that:
 * - Only pings services that are enabled (when conditions)
 * - Retries flaky network calls (retry policy)
 * - Times out slow services without blocking the pipeline (timeout + continueOnError)
 *
 * Primitives used:
 * - when: Conditional node execution based on runtime values
 * - policy.retry: Automatic retry with backoff for transient failures
 * - policy.timeoutMs: Maximum execution time per node
 * - policy.continueOnError: Allow pipeline to continue despite failures
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { consoleChannel } from "../../src/channels/console-channel.js";
import { runFlowFile } from "../../src/flow-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
	console.log("Lesson 05: API Health Check Pipeline\n");
	console.log("Scenario: Check health of multiple services with different policies\n");
	console.log("Services:");
	console.log("  • auth     - enabled, flaky (will retry)");
	console.log("  • payments - enabled, slow (will timeout but continue)");
	console.log("  • legacy   - disabled (will be skipped)\n");

	const outputs = await runFlowFile({
		filePath: resolve(__dirname, "flow.yaml"),
		attachments: [consoleChannel],
	});

	console.log("\n--- Health Check Results ---\n");

	// Check auth service result
	const authResult = outputs["ping_auth"] as { label: string; attempt: number } | undefined;
	if (authResult) {
		console.log(`✓ Auth service: OK (succeeded on attempt ${authResult.attempt})`);
	}

	// Check payments service result (expected to timeout)
	const paymentsResult = outputs["ping_payments"] as { failed?: boolean } | undefined;
	if (paymentsResult?.failed) {
		console.log("⚠ Payments service: TIMEOUT (but pipeline continued)");
	}

	// Check legacy service (should be skipped)
	const legacyResult = outputs["ping_legacy"] as { skipped?: boolean } | undefined;
	if (legacyResult?.skipped) {
		console.log("○ Legacy service: SKIPPED (disabled in config)");
	}

	// Verify the policies worked as expected
	const authWorked = authResult?.attempt === 2; // Flaky node succeeds on 2nd attempt
	const paymentsTimedOut = paymentsResult?.failed === true;
	const legacySkipped = legacyResult?.skipped === true;

	if (authWorked && paymentsTimedOut && legacySkipped) {
		console.log("\n✓ All policies demonstrated successfully:");
		console.log("  • retry: Auth service recovered from transient failure");
		console.log("  • timeout + continueOnError: Slow service didn't block pipeline");
		console.log("  • when: Disabled service was correctly skipped");
	}
}

main().catch((error) => {
	console.error("Error:", error.message);
	process.exit(1);
});
