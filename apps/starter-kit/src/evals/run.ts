#!/usr/bin/env bun
/**
 * Eval Runner CLI
 *
 * Run the prompt comparison eval suite in different modes.
 *
 * Usage:
 *   bun run eval --mode live          # Run with real API calls
 *   bun run eval --mode replay        # Run with recorded fixtures
 *   bun run eval --cases add-numbers  # Run specific cases
 *   bun run eval --tags smoke         # Run cases with specific tags
 *   bun run eval --help               # Show help
 */

import { parseArgs } from "node:util";
import { InMemoryRecordingStore, runSuite } from "@open-harness/core";
import { promptComparisonSuite } from "./prompt-comparison.js";

// Parse CLI arguments
const { values } = parseArgs({
	args: process.argv.slice(2),
	options: {
		mode: {
			type: "string",
			short: "m",
			default: "live",
		},
		cases: {
			type: "string",
			short: "c",
		},
		tags: {
			type: "string",
			short: "t",
		},
		baseline: {
			type: "string",
			short: "b",
		},
		help: {
			type: "boolean",
			short: "h",
			default: false,
		},
		verbose: {
			type: "boolean",
			short: "v",
			default: false,
		},
	},
});

// Show help
if (values.help) {
	console.log(`
Prompt Comparison Eval Runner

Usage:
  bun run eval [options]

Options:
  -m, --mode <mode>      Execution mode: live, replay, record (default: live)
  -c, --cases <ids>      Comma-separated case IDs to run
  -t, --tags <tags>      Comma-separated tags to filter cases
  -b, --baseline <id>    Override baseline variant ID
  -v, --verbose          Show detailed output
  -h, --help             Show this help message

Examples:
  bun run eval --mode live
  bun run eval --mode replay
  bun run eval --cases add-numbers,fizzbuzz
  bun run eval --tags smoke
  bun run eval --mode live --verbose
`);
	process.exit(0);
}

// Validate mode
const mode = values.mode as "live" | "replay" | "record";
if (!["live", "replay", "record"].includes(mode)) {
	console.error(`Invalid mode: ${values.mode}. Use live, replay, or record.`);
	process.exit(1);
}

// Parse filter options
const filterCases = values.cases?.split(",").map((s) => s.trim());
const filterTags = values.tags?.split(",").map((s) => s.trim());

// Run the suite
console.log(`
================================================================================
Prompt Comparison Eval
================================================================================
Mode: ${mode}
Cases: ${filterCases?.join(", ") ?? "all"}
Tags: ${filterTags?.join(", ") ?? "all"}
Baseline: ${values.baseline ?? "baseline"}
================================================================================
`);

try {
	const startTime = Date.now();

	// Run the suite
	const report = await runSuite(promptComparisonSuite, {
		mode,
		filterCases,
		filterTags,
		baseline: values.baseline,
		recordingStore: new InMemoryRecordingStore(),
	});

	const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

	// Print summary
	console.log(`
================================================================================
Results
================================================================================
Suite: ${report.suiteName}
Status: ${report.passed ? "PASSED" : "FAILED"}
Duration: ${elapsed}s

Summary:
  Cases: ${report.summary.passedCases}/${report.summary.totalCases} passed (${(report.summary.passRate * 100).toFixed(0)}%)
  Gates: ${report.summary.gatesPassed}/${report.summary.totalGates} passed
  Regressions: ${report.summary.regressions}

Gates:
${report.gateResults.map((g) => `  [${g.passed ? "PASS" : "FAIL"}] ${g.name}: ${g.message}`).join("\n")}
`);

	// Print variant results
	console.log(`
Variant Results:
----------------`);
	for (const vr of report.matrixResult.variantResults) {
		console.log(`
${vr.variantId}:
  Pass Rate: ${(vr.summary.passRate * 100).toFixed(0)}%
  Passed: ${vr.summary.passed}/${vr.summary.total}`);

		if (values.verbose) {
			for (const cr of vr.caseResults) {
				const status = cr.passed ? "PASS" : "FAIL";
				const latency = cr.scores.scores.find((s) => s.name === "latency")?.rawValue ?? "?";
				const cost = cr.scores.scores.find((s) => s.name === "cost")?.rawValue ?? "?";
				console.log(
					`    [${status}] ${cr.caseId}: ${latency}ms, $${typeof cost === "number" ? cost.toFixed(4) : cost}`,
				);
				if (!cr.passed && cr.error) {
					console.log(`         Error: ${cr.error}`);
				}
			}
		}
	}

	// Print comparison if available
	if (report.matrixResult.comparison) {
		const comp = report.matrixResult.comparison;
		console.log(`
Comparison (vs ${comp.baselineVariantId}):
-----------------------------------------
  Regressions: ${comp.regressions.length}
  Improvements: ${comp.improvements.length}`);

		if (comp.regressions.length > 0 && values.verbose) {
			console.log("\n  Regressions:");
			for (const r of comp.regressions) {
				console.log(`    - ${r.caseId}: ${r.description}`);
			}
		}
		if (comp.improvements.length > 0 && values.verbose) {
			console.log("\n  Improvements:");
			for (const i of comp.improvements) {
				console.log(`    + ${i.caseId}: ${i.description}`);
			}
		}
	}

	console.log(`
================================================================================
`);

	// Exit with appropriate code
	process.exit(report.passed ? 0 : 1);
} catch (error) {
	console.error("Error running eval:", error);
	process.exit(1);
}
