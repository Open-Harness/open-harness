#!/usr/bin/env bun

/**
 * Fixture Recording Script
 *
 * Records REAL Claude SDK sessions and captures all events to JSON fixture files.
 * These fixtures are used for integration testing without hitting the live SDK.
 *
 * CRITICAL: This script MUST be run against the LIVE Claude SDK to capture
 * authentic responses. Do NOT manually create fixture files.
 *
 * Usage:
 *   bun run scripts/record-fixtures.ts
 *   bun run scripts/record-fixtures.ts --scenario text-streaming
 *   bun run scripts/record-fixtures.ts --all
 *
 * @module @core-v2/scripts/record-fixtures
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";

// ============================================================================
// Types
// ============================================================================

interface RecordedMessage {
	/** The raw SDK message */
	message: SDKMessage;
	/** Timestamp when received (relative to recording start) */
	relativeTimestamp: number;
	/** Message index in the sequence */
	index: number;
}

interface Fixture {
	/** Fixture metadata */
	metadata: {
		/** Scenario name */
		scenario: string;
		/** When the fixture was recorded */
		recordedAt: string;
		/** Model used for recording */
		model: string;
		/** Duration of the recording in milliseconds */
		durationMs: number;
		/** Number of messages captured */
		messageCount: number;
		/** SDK version */
		sdkVersion: string;
		/** Description of the scenario */
		description: string;
	};
	/** The prompt used */
	prompt: string;
	/** All recorded SDK messages in order */
	messages: RecordedMessage[];
	/** Final result summary */
	result: {
		/** Final text response */
		text?: string;
		/** Session ID from SDK */
		sessionId?: string;
		/** Whether structured output was used */
		hasStructuredOutput: boolean;
		/** Tool calls made (names only) */
		toolCallsMade: string[];
	};
}

interface ScenarioDefinition {
	/** Scenario identifier (used for filename) */
	name: string;
	/** Human-readable description */
	description: string;
	/** The prompt to send */
	prompt: string;
	/** Optional SDK options */
	options?: {
		maxTurns?: number;
		outputFormat?: { type: "json_schema"; schema: unknown };
	};
}

// ============================================================================
// Constants
// ============================================================================

const FIXTURES_DIR = path.join(import.meta.dirname, "../tests/fixtures/golden");
const MODEL = "claude-sonnet-4-20250514";
const SDK_VERSION = "0.2.5";

// ============================================================================
// Scenario Definitions
// ============================================================================

/**
 * All scenarios to record. Each scenario tests a different SDK capability.
 */
const SCENARIOS: ScenarioDefinition[] = [
	{
		name: "text-simple",
		description: "Simple text response without streaming deltas",
		prompt: "What is 2 + 2? Answer with just the number.",
	},
	{
		name: "text-streaming",
		description: "Text response with streaming deltas (longer response)",
		prompt: "Explain the Fibonacci sequence in 2-3 sentences. Include the first 5 numbers.",
	},
	{
		name: "text-multiline",
		description: "Multi-line text response with formatting",
		prompt: `List exactly 3 benefits of unit testing:
1. (first benefit)
2. (second benefit)
3. (third benefit)`,
	},
	{
		name: "structured-output",
		description: "Response with structured JSON output using outputSchema",
		prompt: "Extract the person's name and age from this text: 'John Smith is 30 years old.'",
		options: {
			outputFormat: {
				type: "json_schema",
				schema: {
					type: "object",
					properties: {
						name: { type: "string", description: "The person's full name" },
						age: { type: "number", description: "The person's age" },
					},
					required: ["name", "age"],
				},
			},
		},
	},
	{
		name: "multi-turn",
		description: "Multi-turn conversation maintaining context",
		prompt: "Remember the number 42. Just acknowledge that you've remembered it.",
	},
];

// ============================================================================
// Recording Functions
// ============================================================================

/**
 * Records a single scenario against the live Claude SDK.
 */
async function recordScenario(scenario: ScenarioDefinition): Promise<Fixture> {
	console.log(`\n📹 Recording scenario: ${scenario.name}`);
	console.log(`   Description: ${scenario.description}`);
	console.log(`   Prompt: "${scenario.prompt.substring(0, 50)}..."`);

	const messages: RecordedMessage[] = [];
	const startTime = Date.now();
	let index = 0;
	let finalText = "";
	let sessionId: string | undefined;
	let hasStructuredOutput = false;
	const toolCallsMade: string[] = [];

	try {
		const queryStream = query({
			prompt: scenario.prompt,
			options: {
				model: MODEL,
				maxTurns: scenario.options?.maxTurns ?? 1,
				persistSession: false,
				includePartialMessages: true,
				permissionMode: "bypassPermissions",
				allowDangerouslySkipPermissions: true,
				...(scenario.options?.outputFormat ? { outputFormat: scenario.options.outputFormat } : {}),
			},
		});

		for await (const message of queryStream) {
			const sdkMessage = message as SDKMessage;
			const relativeTimestamp = Date.now() - startTime;

			messages.push({
				message: sdkMessage,
				relativeTimestamp,
				index: index++,
			});

			// Extract data for result summary
			if (sdkMessage.type === "result") {
				const result = sdkMessage as {
					result?: string;
					session_id?: string;
					structured_output?: unknown;
				};
				if (result.result) {
					finalText = result.result;
				}
				if (result.session_id) {
					sessionId = result.session_id;
				}
				if (result.structured_output !== undefined) {
					hasStructuredOutput = true;
				}
			}

			// Track text deltas for final text
			if (sdkMessage.type === "stream_event") {
				const streamEvent = (sdkMessage as { event?: { type?: string; delta?: { type?: string; text?: string } } })
					.event;
				if (streamEvent?.type === "content_block_delta") {
					const delta = streamEvent.delta;
					if (delta?.type === "text_delta" && delta.text) {
						finalText += delta.text;
					}
				}
			}

			// Track tool calls
			if (sdkMessage.type === "assistant") {
				const content = (sdkMessage as { message?: { content?: unknown[] } }).message?.content;
				if (Array.isArray(content)) {
					for (const block of content) {
						const b = block as { type?: string; name?: string };
						if (b.type === "tool_use" && b.name) {
							toolCallsMade.push(b.name);
						}
					}
				}
			}

			// Log progress
			console.log(`   [${index}] ${sdkMessage.type} (+${relativeTimestamp}ms)`);
		}

		const durationMs = Date.now() - startTime;
		console.log(`   ✅ Recorded ${messages.length} messages in ${durationMs}ms`);

		return {
			metadata: {
				scenario: scenario.name,
				recordedAt: new Date().toISOString(),
				model: MODEL,
				durationMs,
				messageCount: messages.length,
				sdkVersion: SDK_VERSION,
				description: scenario.description,
			},
			prompt: scenario.prompt,
			messages,
			result: {
				text: finalText || undefined,
				sessionId,
				hasStructuredOutput,
				toolCallsMade,
			},
		};
	} catch (error) {
		console.error(`   ❌ Error recording scenario: ${error}`);
		throw error;
	}
}

/**
 * Saves a fixture to the fixtures directory.
 */
async function saveFixture(fixture: Fixture): Promise<string> {
	// Ensure fixtures directory exists
	await fs.promises.mkdir(FIXTURES_DIR, { recursive: true });

	const filename = `${fixture.metadata.scenario}.json`;
	const filepath = path.join(FIXTURES_DIR, filename);

	await fs.promises.writeFile(filepath, JSON.stringify(fixture, null, 2), "utf-8");

	console.log(`   💾 Saved to: ${filepath}`);
	return filepath;
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
	const args = process.argv.slice(2);
	let scenariosToRecord: ScenarioDefinition[];

	if (args.includes("--all")) {
		scenariosToRecord = SCENARIOS;
	} else if (args.includes("--scenario")) {
		const scenarioIndex = args.indexOf("--scenario");
		const scenarioName = args[scenarioIndex + 1];
		const scenario = SCENARIOS.find((s) => s.name === scenarioName);
		if (!scenario) {
			console.error(`❌ Unknown scenario: ${scenarioName}`);
			console.error(`   Available scenarios: ${SCENARIOS.map((s) => s.name).join(", ")}`);
			process.exit(1);
		}
		scenariosToRecord = [scenario];
	} else {
		// Default: record all scenarios
		scenariosToRecord = SCENARIOS;
	}

	console.log("╔══════════════════════════════════════════════════════════════╗");
	console.log("║       Core V2 Fixture Recording Script                       ║");
	console.log("║       Recording REAL Claude SDK responses                    ║");
	console.log("╚══════════════════════════════════════════════════════════════╝");
	console.log("");
	console.log(`📁 Fixtures directory: ${FIXTURES_DIR}`);
	console.log(`🤖 Model: ${MODEL}`);
	console.log(`📦 SDK Version: ${SDK_VERSION}`);
	console.log(`📋 Scenarios to record: ${scenariosToRecord.length}`);

	const results: { scenario: string; success: boolean; filepath?: string; error?: string }[] = [];

	for (const scenario of scenariosToRecord) {
		try {
			const fixture = await recordScenario(scenario);
			const filepath = await saveFixture(fixture);
			results.push({ scenario: scenario.name, success: true, filepath });
		} catch (error) {
			results.push({
				scenario: scenario.name,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	// Summary
	console.log("\n╔══════════════════════════════════════════════════════════════╗");
	console.log("║                    Recording Summary                          ║");
	console.log("╚══════════════════════════════════════════════════════════════╝");

	const successful = results.filter((r) => r.success);
	const failed = results.filter((r) => !r.success);

	console.log(`\n✅ Successful: ${successful.length}/${results.length}`);
	for (const r of successful) {
		console.log(`   • ${r.scenario} → ${r.filepath}`);
	}

	if (failed.length > 0) {
		console.log(`\n❌ Failed: ${failed.length}/${results.length}`);
		for (const r of failed) {
			console.log(`   • ${r.scenario}: ${r.error}`);
		}
	}

	// Exit with error if any failed
	if (failed.length > 0) {
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
