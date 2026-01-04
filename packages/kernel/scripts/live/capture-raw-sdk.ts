/**
 * RAW SDK MESSAGE CAPTURE
 *
 * This script captures EVERY message the SDK sends to prove:
 * 1. What message types arrive during streaming
 * 2. Whether 'assistant' messages come alongside 'stream_event'
 * 3. What thinking, text, and tool events look like
 *
 * Uses "ultrathink" to trigger extended thinking mode.
 * Requests a tool call to capture tool events.
 *
 * Usage: bun scripts/live/capture-raw-sdk.ts
 */

import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";

interface CapturedMessage {
	index: number;
	type: string;
	raw: SDKMessage;
}

async function captureRawSdkMessages() {
	console.log("=".repeat(80));
	console.log("RAW SDK MESSAGE CAPTURE - PROVING WHAT THE SDK ACTUALLY SENDS");
	console.log("=".repeat(80));
	console.log();

	const messages: CapturedMessage[] = [];
	let messageIndex = 0;

	// Prompt that triggers: thinking (ultrathink), tool use, and text output
	const prompt = `ultrathink

First, use the Read tool to read ./package.json (just show me the name field).
Then tell me what 15 * 17 equals.`;

	console.log("PROMPT:");
	console.log("-".repeat(40));
	console.log(prompt);
	console.log("-".repeat(40));
	console.log();

	console.log("CAPTURING ALL SDK MESSAGES (async generator)...");
	console.log();

	try {
		// query() returns an AsyncGenerator - iterate it properly
		const queryStream = query({
			prompt,
			options: {
				maxTurns: 3,
				includePartialMessages: true, // Enable streaming events
			},
		});

		// Iterate the async generator
		for await (const sdkMessage of queryStream) {
			const msg: CapturedMessage = {
				index: messageIndex++,
				type: (sdkMessage as { type?: string }).type ?? "unknown",
				raw: sdkMessage,
			};
			messages.push(msg);

			// Log each message as it arrives
			console.log(`[${msg.index}] TYPE: ${msg.type}`);
			const jsonStr = JSON.stringify(sdkMessage, null, 2);
			console.log(jsonStr.slice(0, 1000));
			if (jsonStr.length > 1000) {
				console.log("... (truncated)");
			}
			console.log();
		}

		console.log("=".repeat(80));
		console.log("CAPTURE COMPLETE - ANALYSIS");
		console.log("=".repeat(80));
		console.log();

		// Categorize messages by type
		const messagesByType: Record<string, CapturedMessage[]> = {};
		for (const msg of messages) {
			const type = msg.type;
			if (!messagesByType[type]) {
				messagesByType[type] = [];
			}
			messagesByType[type]!.push(msg);
		}

		console.log("MESSAGE TYPE COUNTS:");
		for (const [type, msgs] of Object.entries(messagesByType)) {
			console.log(`  ${type}: ${msgs.length}`);
		}
		console.log();

		// Analyze stream_event subtypes
		const streamEvents = messagesByType.stream_event ?? [];
		const streamSubtypes: Record<string, number> = {};
		for (const se of streamEvents) {
			const event = (se.raw as { event?: { type?: string } }).event;
			const subtype = event?.type ?? "unknown";
			streamSubtypes[subtype] = (streamSubtypes[subtype] ?? 0) + 1;
		}

		if (Object.keys(streamSubtypes).length > 0) {
			console.log("STREAM_EVENT SUBTYPES:");
			for (const [subtype, count] of Object.entries(streamSubtypes)) {
				console.log(`  ${subtype}: ${count}`);
			}
			console.log();
		}

		// Check for delta types within content_block_delta
		const contentBlockDeltas = streamEvents.filter((m) => {
			const event = (m.raw as { event?: { type?: string } }).event;
			return event?.type === "content_block_delta";
		});

		const deltaTypes: Record<string, number> = {};
		for (const cbd of contentBlockDeltas) {
			const event = (cbd.raw as { event?: { delta?: { type?: string } } }).event;
			const deltaType = event?.delta?.type ?? "unknown";
			deltaTypes[deltaType] = (deltaTypes[deltaType] ?? 0) + 1;
		}

		if (Object.keys(deltaTypes).length > 0) {
			console.log("DELTA TYPES (from content_block_delta):");
			for (const [deltaType, count] of Object.entries(deltaTypes)) {
				console.log(`  ${deltaType}: ${count}`);
			}
			console.log();
		}

		// THE CRITICAL QUESTION
		console.log("=".repeat(80));
		console.log("CRITICAL VERIFICATION");
		console.log("=".repeat(80));
		console.log();

		const hasStreamEvents = streamEvents.length > 0;
		const hasAssistantMessages = (messagesByType.assistant ?? []).length > 0;
		const hasResultMessages = (messagesByType.result ?? []).length > 0;
		const hasTextDeltas = (deltaTypes.text_delta ?? 0) > 0;
		const hasThinkingDeltas = (deltaTypes.thinking_delta ?? 0) > 0;

		console.log(`✓ stream_event messages: ${hasStreamEvents} (count: ${streamEvents.length})`);
		console.log(`✓ assistant messages: ${hasAssistantMessages} (count: ${(messagesByType.assistant ?? []).length})`);
		console.log(`✓ result messages: ${hasResultMessages} (count: ${(messagesByType.result ?? []).length})`);
		console.log(`✓ text_delta in stream: ${hasTextDeltas} (count: ${deltaTypes.text_delta ?? 0})`);
		console.log(`✓ thinking_delta in stream: ${hasThinkingDeltas} (count: ${deltaTypes.thinking_delta ?? 0})`);
		console.log();

		if (hasStreamEvents && hasAssistantMessages) {
			console.log("✅ VERIFIED: SDK sends BOTH stream_event AND assistant messages");
			console.log("   Our design of emitting both delta and complete events is VALID.");
		} else if (hasStreamEvents && !hasAssistantMessages) {
			console.log("❌ PROBLEM: SDK sends stream_event but NO assistant message");
			console.log("   agent:text will never emit during streaming - DESIGN FAILS!");
		} else if (!hasStreamEvents && hasAssistantMessages) {
			console.log("⚠️  No streaming: SDK only sent assistant messages (no stream_event)");
			console.log("   Check includePartialMessages option.");
		} else {
			console.log("⚠️  UNEXPECTED: Check the raw output above");
		}
		console.log();

		// Examine assistant message structure
		const assistantMessages = messagesByType.assistant ?? [];
		if (assistantMessages.length > 0) {
			console.log("ASSISTANT MESSAGE STRUCTURE:");
			for (const am of assistantMessages) {
				const raw = am.raw as { message?: { content?: unknown } };
				const contentType = typeof raw.message?.content;
				console.log(`  [${am.index}] content type: ${contentType}`);
				if (Array.isArray(raw.message?.content)) {
					const blocks = raw.message.content as Array<{ type?: string }>;
					console.log(`       content blocks: ${blocks.map((b) => b.type).join(", ")}`);
				} else if (typeof raw.message?.content === "string") {
					console.log(`       string: "${(raw.message.content as string).slice(0, 80)}..."`);
				}
			}
			console.log();
		}

		// Result message
		const resultMessages = messagesByType.result ?? [];
		if (resultMessages.length > 0) {
			console.log("RESULT MESSAGE:");
			const firstResult = resultMessages[0];
			if (firstResult) {
				const result = firstResult.raw as { result?: string; duration_ms?: number; num_turns?: number };
				console.log(`  Result text: "${(result.result ?? "").slice(0, 100)}..."`);
				console.log(`  Duration: ${result.duration_ms}ms`);
				console.log(`  Turns: ${result.num_turns}`);
				console.log();
			}
		}

		// Write raw capture to file
		const captureFile =
			"/Users/abuusama/conductor/workspaces/open-harness/nashville/packages/kernel-v3/tests/fixtures/recordings/captured/raw-sdk-capture.json";

		await Bun.write(
			captureFile,
			JSON.stringify(
				{
					prompt,
					totalMessages: messages.length,
					messageTypes: Object.fromEntries(Object.entries(messagesByType).map(([k, v]) => [k, v.length])),
					streamSubtypes,
					deltaTypes,
					messages: messages.map((m) => m.raw),
				},
				null,
				2,
			),
		);

		console.log(`📁 Raw capture saved to: ${captureFile}`);
		console.log();
		console.log("Use this captured data to create REAL fixtures!");
	} catch (error) {
		console.error("CAPTURE FAILED:", error);
		process.exit(1);
	}
}

captureRawSdkMessages().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
