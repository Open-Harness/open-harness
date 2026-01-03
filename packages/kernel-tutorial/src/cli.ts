#!/usr/bin/env bun

/**
 * Minimal CLI runner for YAML flows
 *
 * Usage:
 *   bun run flow-run --file path/to/flow.yaml
 *   bun run flow-run --file path/to/flow.yaml --input.key=value
 */

import { parseArgs } from "node:util";
import { loadFlowYamlFile } from "@open-harness/kernel";
import { consoleChannel } from "./channels/console-channel.js";
import { buildRegistry, loadNodePacks } from "./flow-runner.js";
import { runFlowRuntime } from "./runtime.js";

function parseInputOverrides(inputArgs: string[]): Record<string, unknown> {
	const overrides: Record<string, unknown> = {};

	for (const arg of inputArgs) {
		if (!arg.startsWith("--input.")) {
			continue;
		}

		const keyValue = arg.slice("--input.".length);
		const [key, ...valueParts] = keyValue.split("=");
		const value = valueParts.join("=");

		// Try to parse as JSON, fallback to string
		try {
			overrides[key] = JSON.parse(value);
		} catch {
			overrides[key] = value;
		}
	}

	return overrides;
}

async function main() {
	const { values, positionals } = parseArgs({
		options: {
			file: {
				type: "string",
				short: "f",
			},
			config: {
				type: "string",
				short: "c",
			},
			help: {
				type: "boolean",
				short: "h",
			},
		},
		allowPositionals: true,
		strict: false,
	});

	if (values.help || !values.file) {
		console.log(`
Usage: bun run flow-run --file <path> [--input.key=value ...]

Options:
  --file, -f    Path to YAML flow file (required)
  --config, -c  Path to oh.config.ts (default: ./oh.config.ts)
  --input.*     Override flow inputs (e.g., --input.feature="Build app")
  --help, -h    Show this help message

Examples:
  bun run flow-run --file lessons/01-flow-hello/flow.yaml
  bun run flow-run --file my-flow.yaml --input.feature="Build TODO app"
		`);
		process.exit(values.help ? 0 : 1);
	}

	const filePath = values.file;
	const inputOverrides = parseInputOverrides(positionals);

	console.log(`🚀 Running flow: ${filePath}\n`);

	try {
		// Load YAML with promptFile support
		const flow = await loadFlowYamlFile(filePath);
		const requestedPacks = flow.flow.nodePacks;
		if (!requestedPacks || requestedPacks.length === 0) {
			throw new Error("Flow YAML must declare flow.nodePacks (e.g. [core, claude])");
		}

		const availablePacks = await loadNodePacks(values.config);

		const registry = buildRegistry(requestedPacks, availablePacks);
		const result = await runFlowRuntime({
			flow,
			registry,
			inputOverrides,
			attachments: [consoleChannel],
		});

		console.log("\n📊 Flow Results:");
		console.log(JSON.stringify(result.outputs, null, 2));
	} catch (error) {
		console.error("❌ Error:", error);
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
