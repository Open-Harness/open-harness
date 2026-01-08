#!/usr/bin/env bun

/**
 * Fixture Recording CLI
 *
 * Record real SDK responses for replay testing.
 *
 * Usage:
 *   bun run record                    # Record all variants
 *   bun run record --variant baseline # Record specific variant
 *   bun run record --cases add-numbers # Record specific cases
 *   bun run record --help             # Show help
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { InMemoryRecordingStore, runSuite } from "@open-harness/core";
import { promptComparisonSuite } from "./prompt-comparison.js";

const FIXTURES_DIR = join(import.meta.dir, "../../fixtures");

// Parse CLI arguments
const { values } = parseArgs({
	args: process.argv.slice(2),
	options: {
		variant: {
			type: "string",
			short: "v",
		},
		cases: {
			type: "string",
			short: "c",
		},
		help: {
			type: "boolean",
			short: "h",
			default: false,
		},
		"dry-run": {
			type: "boolean",
			default: false,
		},
	},
});

// Show help
if (values.help) {
	console.log(`
Fixture Recording CLI

Records real SDK responses for replay testing.
Fixtures are stored in fixtures/goldens/{variant}/{caseId}.json

Usage:
  bun run record [options]

Options:
  -v, --variant <id>     Record only specific variant
  -c, --cases <ids>      Comma-separated case IDs to record
  --dry-run              Show what would be recorded without actually recording
  -h, --help             Show this help message

Examples:
  bun run record                       # Record all variants and cases
  bun run record --variant baseline    # Record only baseline variant
  bun run record --cases add-numbers   # Record only specific cases
  bun run record --dry-run             # Preview what would be recorded
`);
	process.exit(0);
}

// Get suite config
const suiteConfig = promptComparisonSuite.config;

// Determine what to record
const variantsToRecord = values.variant
	? suiteConfig.variants.filter((v) => v.id === values.variant)
	: suiteConfig.variants;

const casesToRecord = values.cases ? values.cases.split(",").map((s) => s.trim()) : suiteConfig.cases.map((c) => c.id);

// Validate
if (variantsToRecord.length === 0) {
	console.error(`Variant not found: ${values.variant}`);
	process.exit(1);
}

const invalidCases = casesToRecord.filter((id) => !suiteConfig.cases.some((c) => c.id === id));
if (invalidCases.length > 0) {
	console.error(`Cases not found: ${invalidCases.join(", ")}`);
	process.exit(1);
}

console.log(`
================================================================================
Fixture Recording
================================================================================
Variants: ${variantsToRecord.map((v) => v.id).join(", ")}
Cases: ${casesToRecord.join(", ")}
Output: ${FIXTURES_DIR}
Dry Run: ${values["dry-run"] ? "Yes" : "No"}
================================================================================
`);

if (values["dry-run"]) {
	console.log("Would record the following fixtures:\n");
	for (const variant of variantsToRecord) {
		for (const caseId of casesToRecord) {
			const path = join(FIXTURES_DIR, "goldens", variant.id, `${caseId}__coder__inv0.json`);
			console.log(`  ${path}`);
		}
	}
	console.log("\nRun without --dry-run to actually record.");
	process.exit(0);
}

// Record fixtures
try {
	// Create recording store that captures responses
	const recordingStore = new InMemoryRecordingStore();
	const recordings: Map<string, { variant: string; caseId: string; data: unknown }> = new Map();

	// Run the suite in live mode to capture responses
	console.log("Running suite in live mode to capture responses...\n");

	for (const variant of variantsToRecord) {
		console.log(`Recording variant: ${variant.id}`);

		for (const caseId of casesToRecord) {
			const caseConfig = suiteConfig.cases.find((c) => c.id === caseId);
			if (!caseConfig) continue;

			console.log(`  Case: ${caseId}...`);

			try {
				// Run just this case
				const report = await runSuite(promptComparisonSuite, {
					mode: "live",
					filterCases: [caseId],
					recordingStore,
				});

				// Find the result for this variant
				const variantResult = report.matrixResult.variantResults.find((vr) => vr.variantId === variant.id);
				const caseResult = variantResult?.caseResults.find((cr) => cr.caseId === caseId);

				if (caseResult) {
					// Store the fixture data
					const fixtureKey = `${variant.id}/${caseId}`;
					recordings.set(fixtureKey, {
						variant: variant.id,
						caseId,
						data: {
							input: caseConfig.input,
							output: caseResult.artifact.snapshot.outputs,
							events: caseResult.artifact.events,
							scores: caseResult.scores,
							passed: caseResult.passed,
							recordedAt: new Date().toISOString(),
						},
					});
					console.log(`    Recorded (passed: ${caseResult.passed})`);
				} else {
					console.log(`    No result found`);
				}
			} catch (error) {
				console.log(`    Error: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}

	// Save fixtures to disk
	console.log("\nSaving fixtures to disk...\n");

	for (const [_key, recording] of recordings) {
		const fixturePath = join(FIXTURES_DIR, "goldens", recording.variant, `${recording.caseId}__coder__inv0.json`);

		// Ensure directory exists
		await mkdir(dirname(fixturePath), { recursive: true });

		// Write fixture
		await writeFile(fixturePath, JSON.stringify(recording.data, null, 2));
		console.log(`  Saved: ${fixturePath}`);
	}

	console.log(`
================================================================================
Recording Complete
================================================================================
Recorded ${recordings.size} fixtures.
Run 'bun run eval --mode replay' to replay from fixtures.
`);
} catch (error) {
	console.error("Error recording fixtures:", error);
	process.exit(1);
}
