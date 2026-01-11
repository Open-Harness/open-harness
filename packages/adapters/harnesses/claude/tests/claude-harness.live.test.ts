/**
 * Live integration tests for ClaudeHarness
 *
 * These tests run against the real Claude SDK to:
 * 1. Verify real signal emission patterns
 * 2. Record fixtures for replay tests
 *
 * Run with: LIVE_SDK=1 bun test tests/claude-harness.live.test.ts
 */

import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { MemorySignalStore } from "@internal/signals";
import { HARNESS_SIGNALS } from "@internal/signals-core";
import { ClaudeHarness, type ClaudeHarnessInput } from "../src/claude-harness.js";
import { collectSignals, createTestContext, isLiveTest } from "./setup.js";

// ============================================================================
// Fixture Recording Helpers
// ============================================================================

const FIXTURES_DIR = path.join(import.meta.dir, "fixtures");

async function ensureFixturesDir() {
	if (!fs.existsSync(FIXTURES_DIR)) {
		fs.mkdirSync(FIXTURES_DIR, { recursive: true });
	}
}

async function saveFixture(name: string, data: unknown) {
	await ensureFixturesDir();
	const filePath = path.join(FIXTURES_DIR, `${name}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	console.log(`Saved fixture: ${filePath}`);
}

// ============================================================================
// Live Integration Tests
// ============================================================================

describe("ClaudeHarness Live Integration", () => {
	describe("basic query", () => {
		test.skipIf(!isLiveTest())(
			"records simple text response",
			async () => {
				const harness = new ClaudeHarness();
				const store = new MemorySignalStore();

				const input: ClaudeHarnessInput = {
					messages: [{ role: "user", content: "Say exactly: Hello, world!" }],
				};
				const ctx = createTestContext();

				// Record signals
				const recordingId = await store.create({
					name: "basic-text-response",
					harnessType: "claude",
				});

				const { signals } = await collectSignals(harness.run(input, ctx));

				for (const signal of signals) {
					await store.append(recordingId, signal);
				}
				await store.finalize(recordingId);

				// Verify signal sequence
				expect(signals[0].name).toBe(HARNESS_SIGNALS.START);
				expect(signals[signals.length - 1].name).toBe(HARNESS_SIGNALS.END);

				// Should have text:delta signals
				const textDeltas = signals.filter((s) => s.name === HARNESS_SIGNALS.TEXT_DELTA);
				expect(textDeltas.length).toBeGreaterThan(0);

				// Should have text:complete
				const textComplete = signals.find((s) => s.name === HARNESS_SIGNALS.TEXT_COMPLETE);
				expect(textComplete).toBeDefined();

				// Save fixture
				const recording = await store.load(recordingId);
				await saveFixture("basic-text-response", recording);

				console.log("Recorded", signals.length, "signals");
			},
			60000,
		);

		test.skipIf(!isLiveTest())(
			"records streaming text deltas",
			async () => {
				const harness = new ClaudeHarness();
				const store = new MemorySignalStore();

				const input: ClaudeHarnessInput = {
					messages: [
						{
							role: "user",
							content: "Count from 1 to 5, putting each number on its own line. Nothing else.",
						},
					],
				};
				const ctx = createTestContext();

				const recordingId = await store.create({
					name: "streaming-text",
					harnessType: "claude",
				});

				const { signals, result } = await collectSignals(harness.run(input, ctx));

				for (const signal of signals) {
					await store.append(recordingId, signal);
				}
				await store.finalize(recordingId);

				// Verify we got multiple text:delta signals (streaming)
				const textDeltas = signals.filter((s) => s.name === HARNESS_SIGNALS.TEXT_DELTA);
				expect(textDeltas.length).toBeGreaterThan(1);

				// Text should contain numbers
				expect(result.content).toContain("1");
				expect(result.content).toContain("5");

				// Save fixture
				const recording = await store.load(recordingId);
				await saveFixture("streaming-text", recording);

				console.log("Recorded", textDeltas.length, "text deltas");
			},
			60000,
		);
	});

	describe("session management", () => {
		test.skipIf(!isLiveTest())(
			"records session ID from response",
			async () => {
				const harness = new ClaudeHarness();
				const store = new MemorySignalStore();

				const input: ClaudeHarnessInput = {
					messages: [{ role: "user", content: "What is 2+2? Answer with just the number." }],
				};
				const ctx = createTestContext();

				const recordingId = await store.create({
					name: "session-id",
					harnessType: "claude",
				});

				const { signals, result } = await collectSignals(harness.run(input, ctx));

				for (const signal of signals) {
					await store.append(recordingId, signal);
				}
				await store.finalize(recordingId);

				// Result should have session ID
				expect(result.sessionId).toBeDefined();
				expect(typeof result.sessionId).toBe("string");
				expect(result.sessionId!.length).toBeGreaterThan(0);

				// Save fixture
				const recording = await store.load(recordingId);
				await saveFixture("session-id", recording);

				console.log("Session ID:", result.sessionId);
			},
			60000,
		);
	});

	describe("usage tracking", () => {
		test.skipIf(!isLiveTest())(
			"records token usage",
			async () => {
				const harness = new ClaudeHarness();
				const store = new MemorySignalStore();

				const input: ClaudeHarnessInput = {
					messages: [{ role: "user", content: "Hi" }],
				};
				const ctx = createTestContext();

				const recordingId = await store.create({
					name: "token-usage",
					harnessType: "claude",
				});

				const { signals, result } = await collectSignals(harness.run(input, ctx));

				for (const signal of signals) {
					await store.append(recordingId, signal);
				}
				await store.finalize(recordingId);

				// Result should have usage
				expect(result.usage).toBeDefined();
				expect(result.usage!.inputTokens).toBeGreaterThan(0);
				expect(result.usage!.outputTokens).toBeGreaterThan(0);
				expect(result.usage!.totalTokens).toBe(result.usage!.inputTokens + result.usage!.outputTokens);

				// Save fixture
				const recording = await store.load(recordingId);
				await saveFixture("token-usage", recording);

				console.log("Usage:", result.usage);
			},
			60000,
		);
	});

	describe("signal ordering", () => {
		test.skipIf(!isLiveTest())(
			"harness:start is always first, harness:end is always last",
			async () => {
				const harness = new ClaudeHarness();

				const input: ClaudeHarnessInput = {
					messages: [{ role: "user", content: "Hello" }],
				};
				const ctx = createTestContext();

				const { signals } = await collectSignals(harness.run(input, ctx));

				expect(signals[0].name).toBe(HARNESS_SIGNALS.START);
				expect(signals[signals.length - 1].name).toBe(HARNESS_SIGNALS.END);

				// text:complete should come before harness:end
				const textCompleteIndex = signals.findIndex((s) => s.name === HARNESS_SIGNALS.TEXT_COMPLETE);
				const endIndex = signals.length - 1;

				if (textCompleteIndex !== -1) {
					expect(textCompleteIndex).toBeLessThan(endIndex);
				}
			},
			60000,
		);

		test.skipIf(!isLiveTest())(
			"text:delta signals come before text:complete",
			async () => {
				const harness = new ClaudeHarness();

				const input: ClaudeHarnessInput = {
					messages: [{ role: "user", content: "Write a short sentence." }],
				};
				const ctx = createTestContext();

				const { signals } = await collectSignals(harness.run(input, ctx));

				const textDeltas = signals
					.map((s, i) => ({ signal: s, index: i }))
					.filter(({ signal }) => signal.name === HARNESS_SIGNALS.TEXT_DELTA);

				const textComplete = signals.findIndex((s) => s.name === HARNESS_SIGNALS.TEXT_COMPLETE);

				// All text:delta should come before text:complete
				for (const { index } of textDeltas) {
					expect(index).toBeLessThan(textComplete);
				}
			},
			60000,
		);
	});

	describe("source tracking", () => {
		test.skipIf(!isLiveTest())(
			"all signals have source.harness = claude",
			async () => {
				const harness = new ClaudeHarness();

				const input: ClaudeHarnessInput = {
					messages: [{ role: "user", content: "Test" }],
				};
				const ctx = createTestContext();

				const { signals } = await collectSignals(harness.run(input, ctx));

				for (const signal of signals) {
					expect(signal.source?.harness).toBe("claude");
				}
			},
			60000,
		);
	});

	describe("harness:end payload", () => {
		test.skipIf(!isLiveTest())(
			"includes durationMs and output",
			async () => {
				const harness = new ClaudeHarness();

				const input: ClaudeHarnessInput = {
					messages: [{ role: "user", content: "Hi" }],
				};
				const ctx = createTestContext();

				const { signals } = await collectSignals(harness.run(input, ctx));

				const endSignal = signals.find((s) => s.name === HARNESS_SIGNALS.END);
				expect(endSignal).toBeDefined();

				const payload = endSignal!.payload as { durationMs: number; output: unknown };
				expect(payload.durationMs).toBeGreaterThan(0);
				expect(payload.output).toBeDefined();
			},
			60000,
		);
	});
});

// ============================================================================
// Fixture-based Replay Tests
// ============================================================================

describe("ClaudeHarness Fixture Replay", () => {
	test.skip("replays basic-text-response fixture", async () => {
		// This test uses pre-recorded fixtures
		// Skip if fixture doesn't exist
		const fixturePath = path.join(FIXTURES_DIR, "basic-text-response.json");
		if (!fs.existsSync(fixturePath)) {
			console.log("Fixture not found. Run live tests first to generate.");
			return;
		}

		const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
		expect(fixture.signals).toBeDefined();
		expect(fixture.signals.length).toBeGreaterThan(0);

		// Verify signal structure
		for (const signal of fixture.signals) {
			expect(signal.name).toBeDefined();
			expect(signal.payload).toBeDefined();
			expect(signal.timestamp).toBeDefined();
		}
	});
});
