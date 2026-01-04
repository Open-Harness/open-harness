/**
 * REPRODUCTION SCRIPT FOR ISSUE #54
 *
 * This script proves that structured_output is undefined when no outputFormat is provided.
 *
 * Expected behavior per SDK docs (https://platform.claude.com/docs/en/agent-sdk/structured-outputs):
 * - Without outputFormat: result.structured_output === undefined
 * - With outputFormat: { type: 'json_schema', schema: ... }
 *   result.structured_output contains parsed JSON
 *
 * Usage: bun packages/kernel-v3/scripts/live/reproduce-issue-54.ts
 */

import type { SDKResultMessage, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";

async function reproduceIssue54() {
	console.log("=".repeat(80));
	console.log("ISSUE #54 REPRODUCTION - structuredOutput Not Populating");
	console.log("=".repeat(80));
	console.log();

	// This is similar to what the planner node in agent-loop.yaml does:
	// It asks Claude to return JSON in the response text, expecting it to
	// appear in structured_output. But without outputFormat, it won't.
	const prompt = `Return a JSON object with this exact structure:
{
  "tasks": [
    { "id": "task-1", "title": "First task" },
    { "id": "task-2", "title": "Second task" }
  ]
}

Only return the JSON, nothing else.`;

	console.log("PROMPT:");
	console.log("-".repeat(40));
	console.log(prompt);
	console.log("-".repeat(40));
	console.log();

	console.log("TEST 1: WITHOUT outputFormat (current behavior in agent-loop.yaml)");
	console.log("-".repeat(40));

	let result1: SDKResultMessage | undefined;

	// Run WITHOUT outputFormat - this is how agent-loop.yaml works
	const queryStream1 = query({
		prompt,
		options: {
			maxTurns: 1,
		},
	});

	for await (const message of queryStream1) {
		if ((message as { type?: string }).type === "result") {
			result1 = message as SDKResultMessage;
		}
	}

	if (result1) {
		console.log("result.result (text):", result1.result?.slice(0, 200));
		console.log("result.structured_output:", result1.structured_output);
		console.log();

		if (result1.structured_output === undefined) {
			console.log("❌ ISSUE CONFIRMED: structured_output is undefined!");
			console.log("   The flow expects {{ planner.structuredOutput.tasks }}");
			console.log("   But structuredOutput is undefined, so binding resolution FAILS");
			console.log("   Error: 'Missing binding path: planner.structuredOutput.tasks'");
		} else {
			console.log("✅ structured_output is populated:", result1.structured_output);
		}
	}

	console.log();
	console.log("TEST 2: WITH outputFormat (correct approach per SDK docs)");
	console.log("-".repeat(40));

	// Now run WITH outputFormat - this is the correct way per SDK docs
	const taskSchema = {
		type: "object" as const,
		properties: {
			tasks: {
				type: "array" as const,
				items: {
					type: "object" as const,
					properties: {
						id: { type: "string" as const },
						title: { type: "string" as const },
					},
					required: ["id", "title"],
				},
			},
		},
		required: ["tasks"],
	};

	let result2: SDKResultMessage | undefined;
	const allMessages2: SDKMessage[] = [];

	try {
		const queryStream2 = query({
			prompt,
			options: {
				maxTurns: 1,
				outputFormat: { type: "json_schema", schema: taskSchema },
			},
		});

		for await (const message of queryStream2) {
			allMessages2.push(message);
			if ((message as { type?: string }).type === "result") {
				result2 = message as SDKResultMessage;
			}
		}

		console.log("Total messages received:", allMessages2.length);
		console.log("Message types:", allMessages2.map((m) => (m as { type?: string }).type));

		if (result2) {
			console.log("result.result (text):", result2.result?.slice(0, 200));
			console.log("result.structured_output:", JSON.stringify(result2.structured_output, null, 2));
			console.log("result.subtype:", result2.subtype);
			console.log();

			if (result2.structured_output !== undefined) {
				console.log("✅ WITH outputFormat: structured_output is populated!");
				console.log("   The flow CAN access {{ planner.structuredOutput.tasks }}");
			} else {
				console.log("❌ Even with outputFormat, structured_output is undefined");
				console.log("   Full result:", JSON.stringify(result2, null, 2).slice(0, 500));
			}
		} else {
			console.log("❌ No result message received!");
			console.log("All messages:", JSON.stringify(allMessages2, null, 2).slice(0, 1000));
		}
	} catch (error) {
		console.log("❌ Error with outputFormat:", error);
	}

	console.log();
	console.log("=".repeat(80));
	console.log("CONCLUSION");
	console.log("=".repeat(80));
	console.log();
	console.log("Issue #54 is CONFIRMED: structuredOutput is undefined without proper SDK config.");
	console.log();
	console.log("ROOT CAUSE:");
	console.log("The flow agent-loop.yaml uses {{ planner.structuredOutput.tasks }} in forEach");
	console.log("but the claude.agent node doesn't pass outputFormat to the SDK.");
	console.log("Therefore structuredOutput is always undefined.");
	console.log();
	console.log("FIX OPTIONS:");
	console.log("1. Add outputFormat support to ClaudeAgentInput.options");
	console.log("2. Parse JSON from text response and populate structuredOutput");
	console.log("3. Add outputSchemaFile support to load schemas from files");
}

reproduceIssue54().catch((error) => {
	console.error("Reproduction failed:", error);
	process.exit(1);
});
