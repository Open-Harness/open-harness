/**
 * E2E Capture - Records a comprehensive session with ALL event types
 *
 * This script:
 * 1. Runs a session with <ultrathink> to trigger thinking
 * 2. Uses Task tool (subagent) to trigger tool_progress
 * 3. Resumes the session with /compact command
 * 4. Captures ALL SDK messages to a master fixture
 *
 * Run with: bun src/e2e-capture.ts
 */

import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { RecordedSession } from "../src/core/tokens.js";

// Capture all raw messages for the fixture
const capturedMessages: SDKMessage[] = [];

// Track which events we've seen
const eventsSeen = {
	session_start: false,
	text: false,
	thinking: false,
	tool_call: false,
	tool_result: false,
	tool_progress: false,
	compact_boundary: false,
	status: false,
	result: false,
};

function categorizeMessage(msg: SDKMessage): string {
	if (msg.type === "system") {
		if (msg.subtype === "init") {
			eventsSeen.session_start = true;
			return "session_start";
		}
		if (msg.subtype === "compact_boundary") {
			eventsSeen.compact_boundary = true;
			return "compact_boundary";
		}
		if (msg.subtype === "status") {
			eventsSeen.status = true;
			return `status:${msg.status}`;
		}
		return `system:${msg.subtype}`;
	}

	if (msg.type === "assistant") {
		const types: string[] = [];
		if (Array.isArray(msg.message?.content)) {
			for (const block of msg.message.content) {
				if (block.type === "text") {
					eventsSeen.text = true;
					types.push("text");
				} else if (block.type === "thinking") {
					eventsSeen.thinking = true;
					types.push("thinking");
				} else if (block.type === "tool_use") {
					eventsSeen.tool_call = true;
					types.push(`tool_call:${block.name}`);
				}
			}
		}
		return `assistant[${types.join(",")}]`;
	}

	if (msg.type === "user") {
		if (Array.isArray(msg.message?.content)) {
			for (const block of msg.message.content) {
				if (block.type === "tool_result") {
					eventsSeen.tool_result = true;
					return "tool_result";
				}
			}
		}
		return "user";
	}

	if (msg.type === "tool_progress") {
		eventsSeen.tool_progress = true;
		return `tool_progress:${msg.tool_name}`;
	}

	if (msg.type === "result") {
		eventsSeen.result = true;
		return `result:${msg.subtype}`;
	}

	return msg.type;
}

async function runCapture() {
	console.log("E2E Capture - Recording ALL event types\n");
	console.log(`${"=".repeat(60)}\n`);

	let capturedSessionId: string | null = null;

	// =========================================================================
	// PHASE 1: Run initial session with ultrathink + tools + Task subagent
	// =========================================================================
	console.log("PHASE 1: Initial session with ultrathink + Task subagent\n");
	console.log(`${"-".repeat(60)}\n`);

	// Request a Task subagent which should generate tool_progress events
	const initialPrompt = `<ultrathink>

I need you to do the following:

1. First, create a file at /tmp/e2e_test.txt with content "E2E test file"
2. Then use the Task tool to launch a subagent (type: "general") to do a simple task: 
   - description: "Count files"
   - prompt: "Run 'ls -la /tmp | wc -l' and report the count"
3. Read back the test file to verify
4. Delete the test file

Think carefully about each step.

</ultrathink>`;

	const stream1 = query({
		prompt: initialPrompt,
		options: {
			model: "sonnet",
			maxTurns: 15,
			permissionMode: "bypassPermissions",
			allowDangerouslySkipPermissions: true,
		},
	});

	for await (const msg of stream1) {
		capturedMessages.push(msg);
		const category = categorizeMessage(msg);
		console.log(`[${capturedMessages.length}] ${category}`);

		// Capture session ID from init message
		if (msg.type === "system" && msg.subtype === "init") {
			capturedSessionId = msg.session_id;
			console.log(`    Session ID: ${capturedSessionId}`);
			console.log(`    Model: ${msg.model}`);
		}
		if (msg.type === "tool_progress") {
			console.log(`    Tool: ${msg.tool_name}, Elapsed: ${msg.elapsed_time_seconds}s`);
		}
		if (msg.type === "result") {
			console.log(`    Turns: ${msg.num_turns}`);
		}
	}

	if (!capturedSessionId) {
		console.error("ERROR: No session ID captured!");
		return;
	}

	console.log(`\n${"-".repeat(60)}`);
	console.log(`\nPhase 1 complete. Session ID: ${capturedSessionId}\n`);

	// =========================================================================
	// PHASE 2: Resume session with /compact command
	// =========================================================================
	console.log("PHASE 2: Resume session with /compact\n");
	console.log(`${"-".repeat(60)}\n`);

	const stream2 = query({
		prompt: "/compact",
		options: {
			model: "sonnet",
			resume: capturedSessionId,
			permissionMode: "bypassPermissions",
			allowDangerouslySkipPermissions: true,
		},
	});

	for await (const msg of stream2) {
		capturedMessages.push(msg);
		const category = categorizeMessage(msg);
		console.log(`[${capturedMessages.length}] ${category}`);

		if (msg.type === "system" && msg.subtype === "compact_boundary") {
			console.log(`    Trigger: ${msg.compact_metadata.trigger}`);
			console.log(`    Pre-tokens: ${msg.compact_metadata.pre_tokens}`);
		}
		if (msg.type === "system" && msg.subtype === "status") {
			console.log(`    Status: ${msg.status}`);
		}
		if (msg.type === "result") {
			console.log(`    Turns: ${msg.num_turns}`);
		}
	}

	// =========================================================================
	// Summary and save
	// =========================================================================
	console.log(`\n${"=".repeat(60)}`);
	console.log("\nEvents captured:\n");

	const allEvents = [
		"session_start",
		"text",
		"thinking",
		"tool_call",
		"tool_result",
		"tool_progress",
		"compact_boundary",
		"status",
		"result",
	];

	let allCaptured = true;
	for (const event of allEvents) {
		const seen = eventsSeen[event as keyof typeof eventsSeen];
		const status = seen ? "[OK]" : "[--]";
		console.log(`${status} ${event}`);
		if (!seen) allCaptured = false;
	}

	// Save the fixture
	console.log(`\n${"=".repeat(60)}`);
	console.log("\nSaving fixture...\n");

	const fixture: RecordedSession = {
		prompt: "Multi-phase: ultrathink + Task subagent + /compact",
		options: {
			model: "sonnet",
		},
		messages: capturedMessages,
	};

	const fixtureDir = "./tests/fixtures/e2e";
	const fixturePath = `${fixtureDir}/master.jsonl`;

	await Bun.write(`${fixtureDir}/.keep`, "");
	await Bun.write(fixturePath, `${JSON.stringify(fixture)}\n`);

	console.log(`Fixture saved to: ${fixturePath}`);
	console.log(`Total messages captured: ${capturedMessages.length}`);

	// Save summary
	const summaryPath = `${fixtureDir}/master-summary.json`;
	const summary = {
		captured_at: new Date().toISOString(),
		session_id: capturedSessionId,
		total_messages: capturedMessages.length,
		message_types: capturedMessages.reduce(
			(acc, msg) => {
				const key = msg.type === "system" ? `system.${msg.subtype}` : msg.type;
				acc[key] = (acc[key] || 0) + 1;
				return acc;
			},
			{} as Record<string, number>,
		),
		events_seen: eventsSeen,
	};
	await Bun.write(summaryPath, JSON.stringify(summary, null, 2));
	console.log(`Summary saved to: ${summaryPath}`);

	console.log(`\n${"=".repeat(60)}`);
	if (allCaptured) {
		console.log("\nSUCCESS: ALL events captured!");
	} else {
		const missing = allEvents.filter((e) => !eventsSeen[e as keyof typeof eventsSeen]);
		console.log(`\nPARTIAL: Missing events: ${missing.join(", ")}`);
	}
}

runCapture().catch(console.error);
