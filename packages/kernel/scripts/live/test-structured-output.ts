/**
 * TEST BOTH STRUCTURED OUTPUT APPROACHES
 *
 * Tests:
 * 1. Inline schema via outputFormat in options
 * 2. File-based schema via outputSchemaFile (needs implementation)
 *
 * Usage: bun packages/kernel/scripts/live/test-structured-output.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SDKMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";

const SCHEMA_DIR = resolve(import.meta.dir, "../../tests/fixtures/schemas");

// Simple schema for testing
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

// Reviewer schema
const reviewerSchema = {
	type: "object" as const,
	properties: {
		passed: { type: "boolean" as const },
		feedback: { type: "string" as const },
		issues: {
			type: "array" as const,
			items: { type: "string" as const },
		},
	},
	required: ["passed", "feedback"],
};

async function testInlineSchema(): Promise<boolean> {
	console.log(`\n${"=".repeat(80)}`);
	console.log("TEST 1: INLINE SCHEMA via outputFormat");
	console.log("=".repeat(80));

	const prompt = `You are a task planner. Break down "Add user authentication" into tasks.

Return ONLY valid JSON matching this structure (no markdown, no explanation):
{"tasks": [{"id": "task-1", "title": "..."}]}`;

	console.log("Prompt:", `${prompt.slice(0, 100)}...`);
	console.log("Schema:", JSON.stringify(taskSchema, null, 2));

	let result: SDKResultMessage | undefined;
	const allMessages: SDKMessage[] = [];

	try {
		const queryStream = query({
			prompt,
			options: {
				maxTurns: 5, // Need more turns for structured output validation
				outputFormat: { type: "json_schema", schema: taskSchema },
			},
		});

		for await (const message of queryStream) {
			allMessages.push(message);
			if ((message as { type?: string }).type === "result") {
				result = message as SDKResultMessage;
			}
		}

		console.log(
			"\nMessage types received:",
			allMessages.map((m) => (m as { type?: string }).type),
		);

		if (result) {
			if (result.subtype === "success") {
				console.log("result.subtype:", result.subtype);
				console.log("result.result (text):", result.result?.slice(0, 200));
				console.log("result.structured_output:", JSON.stringify(result.structured_output, null, 2));

				if (result.structured_output !== undefined) {
					console.log("\n✅ INLINE SCHEMA WORKS! structured_output is populated");
					return true;
				} else {
					console.log("\n❌ INLINE SCHEMA FAILED: structured_output is undefined");
					console.log("   subtype:", result.subtype);
					return false;
				}
			} else {
				console.log("\n❌ Result is not success, subtype:", result.subtype);
				return false;
			}
		} else {
			console.log("\n❌ No result message received");
			return false;
		}
	} catch (error) {
		console.log("\n❌ Error:", error);
		return false;
	}
}

async function testFileBasedSchema(): Promise<boolean> {
	console.log(`\n${"=".repeat(80)}`);
	console.log("TEST 2: FILE-BASED SCHEMA via outputSchemaFile");
	console.log("=".repeat(80));

	// First, create the schema file
	mkdirSync(SCHEMA_DIR, { recursive: true });
	const schemaFilePath = resolve(SCHEMA_DIR, "reviewer-schema.json");
	writeFileSync(schemaFilePath, JSON.stringify(reviewerSchema, null, 2));
	console.log("Created schema file:", schemaFilePath);

	// Load the schema from file (simulating what claude.agent.ts should do)
	const loadedSchema = JSON.parse(readFileSync(schemaFilePath, "utf-8"));
	console.log("Loaded schema:", JSON.stringify(loadedSchema, null, 2));

	const prompt = `Review this code implementation:
\`\`\`typescript
function add(a: number, b: number): number {
  return a + b;
}
\`\`\`

Return ONLY valid JSON (no markdown):
{"passed": true/false, "feedback": "...", "issues": [...]}`;

	console.log("Prompt:", `${prompt.slice(0, 100)}...`);

	let result: SDKResultMessage | undefined;
	const allMessages: SDKMessage[] = [];

	try {
		const queryStream = query({
			prompt,
			options: {
				maxTurns: 5, // Need more turns for structured output validation
				outputFormat: { type: "json_schema", schema: loadedSchema },
			},
		});

		for await (const message of queryStream) {
			allMessages.push(message);
			if ((message as { type?: string }).type === "result") {
				result = message as SDKResultMessage;
			}
		}

		console.log(
			"\nMessage types received:",
			allMessages.map((m) => (m as { type?: string }).type),
		);

		if (result) {
			if (result.subtype === "success") {
				console.log("result.subtype:", result.subtype);
				console.log("result.result (text):", result.result?.slice(0, 200));
				console.log("result.structured_output:", JSON.stringify(result.structured_output, null, 2));

				if (result.structured_output !== undefined) {
					console.log("\n✅ FILE-BASED SCHEMA WORKS! structured_output is populated");
					console.log("   This proves outputSchemaFile can work if we add file loading to claude.agent.ts");
					return true;
				} else {
					console.log("\n❌ FILE-BASED SCHEMA FAILED: structured_output is undefined");
					console.log("   subtype:", result.subtype);
					return false;
				}
			} else {
				console.log("\n❌ Result is not success, subtype:", result.subtype);
				return false;
			}
		} else {
			console.log("\n❌ No result message received");
			return false;
		}
	} catch (error) {
		console.log("\n❌ Error:", error);
		return false;
	}
}

async function testWithoutSchema(): Promise<void> {
	console.log(`\n${"=".repeat(80)}`);
	console.log("TEST 0: WITHOUT SCHEMA (baseline - should fail)");
	console.log("=".repeat(80));

	const prompt = `Return a simple JSON: {"hello": "world"}`;

	let result: SDKResultMessage | undefined;

	const queryStream = query({
		prompt,
		options: { maxTurns: 1 },
	});

	for await (const message of queryStream) {
		if ((message as { type?: string }).type === "result") {
			result = message as SDKResultMessage;
		}
	}

	if (result) {
		if (result.subtype === "success") {
			console.log("result.result (text):", result.result?.slice(0, 100));
			console.log("result.structured_output:", result.structured_output);

			if (result.structured_output === undefined) {
				console.log("\n✅ BASELINE CONFIRMED: Without schema, structured_output is undefined");
			} else {
				console.log("\n⚠️  UNEXPECTED: structured_output is populated without schema!");
			}
		} else {
			console.log("\n❌ Result is not success, subtype:", result.subtype);
		}
	}
}

async function main() {
	console.log("=".repeat(80));
	console.log("STRUCTURED OUTPUT VERIFICATION TESTS");
	console.log("=".repeat(80));
	console.log("Testing both inline and file-based schema approaches...\n");

	// Test 0: Baseline without schema
	await testWithoutSchema();

	// Test 1: Inline schema
	const inlineResult = await testInlineSchema();

	// Test 2: File-based schema
	const fileResult = await testFileBasedSchema();

	// Summary
	console.log(`\n${"=".repeat(80)}`);
	console.log("SUMMARY");
	console.log("=".repeat(80));
	console.log(`Inline schema:     ${inlineResult ? "✅ PASS" : "❌ FAIL"}`);
	console.log(`File-based schema: ${fileResult ? "✅ PASS" : "❌ FAIL"}`);

	if (inlineResult && fileResult) {
		console.log("\n🎉 Both approaches work with the SDK!");
		console.log("   Next: Implement outputSchemaFile resolution in claude.agent.ts");
	} else if (!inlineResult && !fileResult) {
		console.log("\n⚠️  Neither approach works - SDK may not support outputFormat yet");
		console.log("   Check SDK version and documentation");
	}
}

main().catch(console.error);
