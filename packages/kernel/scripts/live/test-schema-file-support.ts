/**
 * TEST outputSchemaFile SUPPORT IN claude.agent.ts
 *
 * This verifies the new outputSchemaFile feature works end-to-end through the node.
 *
 * Usage: bun packages/kernel/scripts/live/test-schema-file-support.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RuntimeCommand } from "../../src/core/events.js";
import { createClaudeNode } from "../../src/nodes/claude.agent.js";

const SCHEMA_DIR = resolve(import.meta.dir, "../../tests/fixtures/schemas");

// Create a mock context for the node
function createMockContext(nodeId: string) {
	const events: unknown[] = [];
	let agentSession: string | undefined;

	return {
		nodeId,
		runId: "test-run",
		emit: (event: unknown) => {
			events.push(event);
		},
		state: {
			get: () => undefined,
			set: () => {},
		},
		inbox: {
			next: () => undefined as RuntimeCommand | undefined,
		},
		getAgentSession: () => agentSession,
		setAgentSession: (id: string) => {
			agentSession = id;
		},
		resumeMessage: undefined,
		events,
	};
}

async function testInlineOutputFormat() {
	console.log(`\n${"=".repeat(80)}`);
	console.log("TEST 1: Inline outputFormat via options");
	console.log("=".repeat(80));

	const node = createClaudeNode();
	const ctx = createMockContext("test-inline");

	const schema = {
		type: "object" as const,
		properties: {
			greeting: { type: "string" as const },
		},
		required: ["greeting"],
	};

	try {
		const result = await node.run(ctx, {
			prompt: 'Say hello in JSON format: {"greeting": "Hello!"}',
			options: {
				maxTurns: 5,
				outputFormat: { type: "json_schema", schema },
			},
		});

		console.log("result.text:", result.text?.slice(0, 100));
		console.log("result.structuredOutput:", JSON.stringify(result.structuredOutput, null, 2));

		if (result.structuredOutput !== undefined) {
			console.log("\n✅ INLINE outputFormat WORKS!");
			return true;
		} else {
			console.log("\n❌ INLINE outputFormat FAILED: structuredOutput is undefined");
			return false;
		}
	} catch (error) {
		console.log("\n❌ Error:", error);
		return false;
	}
}

async function testOutputSchemaFile() {
	console.log(`\n${"=".repeat(80)}`);
	console.log("TEST 2: File-based outputSchemaFile");
	console.log("=".repeat(80));

	// Create the schema file
	mkdirSync(SCHEMA_DIR, { recursive: true });
	const schemaFilePath = resolve(SCHEMA_DIR, "greeting-schema.json");
	const schema = {
		type: "object",
		properties: {
			greeting: { type: "string" },
		},
		required: ["greeting"],
	};
	writeFileSync(schemaFilePath, JSON.stringify(schema, null, 2));
	console.log("Created schema file:", schemaFilePath);

	const node = createClaudeNode();
	const ctx = createMockContext("test-file");

	// Use relative path from cwd
	const relativePath = schemaFilePath.replace(`${process.cwd()}/`, "");
	console.log("Using relative path:", relativePath);

	try {
		const result = await node.run(ctx, {
			prompt: 'Say hello in JSON format: {"greeting": "Hello!"}',
			options: {
				maxTurns: 5,
				outputSchemaFile: relativePath,
			},
		});

		console.log("result.text:", result.text?.slice(0, 100));
		console.log("result.structuredOutput:", JSON.stringify(result.structuredOutput, null, 2));

		if (result.structuredOutput !== undefined) {
			console.log("\n✅ FILE-BASED outputSchemaFile WORKS!");
			return true;
		} else {
			console.log("\n❌ FILE-BASED outputSchemaFile FAILED: structuredOutput is undefined");
			return false;
		}
	} catch (error) {
		console.log("\n❌ Error:", error);
		return false;
	}
}

async function testMissingSchemaFile() {
	console.log(`\n${"=".repeat(80)}`);
	console.log("TEST 3: Missing schema file error handling");
	console.log("=".repeat(80));

	const node = createClaudeNode();
	const ctx = createMockContext("test-missing");

	try {
		await node.run(ctx, {
			prompt: "Say hello",
			options: {
				maxTurns: 5,
				outputSchemaFile: "./nonexistent-schema.json",
			},
		});
		console.log("\n❌ Should have thrown an error for missing file");
		return false;
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		if (errorMsg.includes("outputSchemaFile not found")) {
			console.log("\n✅ Correctly throws error for missing schema file");
			console.log("   Error:", errorMsg);
			return true;
		} else {
			console.log("\n❌ Wrong error type:", errorMsg);
			return false;
		}
	}
}

async function main() {
	console.log("=".repeat(80));
	console.log("VERIFYING outputSchemaFile IMPLEMENTATION IN claude.agent.ts");
	console.log("=".repeat(80));

	const test1 = await testInlineOutputFormat();
	const test2 = await testOutputSchemaFile();
	const test3 = await testMissingSchemaFile();

	console.log(`\n${"=".repeat(80)}`);
	console.log("SUMMARY");
	console.log("=".repeat(80));
	console.log(`Inline outputFormat:        ${test1 ? "✅ PASS" : "❌ FAIL"}`);
	console.log(`File-based outputSchemaFile: ${test2 ? "✅ PASS" : "❌ FAIL"}`);
	console.log(`Missing file error:          ${test3 ? "✅ PASS" : "❌ FAIL"}`);

	if (test1 && test2 && test3) {
		console.log("\n🎉 All tests passed! outputSchemaFile support is working.");
	}
}

main().catch(console.error);
