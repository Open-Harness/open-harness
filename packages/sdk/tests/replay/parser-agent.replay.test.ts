/**
 * ParserAgent Replay Tests
 *
 * Tests that replay golden recordings without making API calls.
 * These tests run fast and are deterministic.
 *
 * Run with: bun test tests/replay/parser-agent.replay.test.ts
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { describe, expect, test } from "bun:test";
import { ParserAgent } from "../../src/providers/anthropic/agents/parser-agent.js";
import { createReplayContainer } from "../helpers/replay-runner.js";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");

describe("ParserAgent Replay", () => {
	describe("parse() from recording", () => {
		test("replays sample-tasks-basic recording", async () => {
			// Create replay container with the recorded session
			const { container, replayer } = await createReplayContainer(
				"golden/parser-agent",
				"sample-tasks-basic",
			);
			const parser = container.get(ParserAgent);

			// Load sample tasks (same input as recorded)
			const tasksFilePath = path.join(FIXTURES_DIR, "sample-tasks.md");
			const tasksContent = await fs.readFile(tasksFilePath, "utf-8");

			// Track events
			const events: string[] = [];

			// Parse - this will replay the recording, not call the API
			const result = await parser.parse(
				{ tasksFilePath, tasksContent },
				{
					onStart: () => events.push("start"),
					onText: () => events.push("text"),
					onComplete: () => events.push("complete"),
				},
			);

			// Validate structure (same assertions as live test)
			expect(result).toBeDefined();
			expect(result.tasks).toBeInstanceOf(Array);
			expect(result.phases).toBeInstanceOf(Array);
			expect(result.warnings).toBeInstanceOf(Array);
			expect(result.metadata).toBeDefined();

			// Validate task count
			expect(result.tasks.length).toBeGreaterThanOrEqual(7);

			// Validate first task
			const firstTask = result.tasks.find((t) => t.id === "T001");
			expect(firstTask).toBeDefined();
			expect(firstTask?.description).toContain("hello");
			expect(firstTask?.status).toBe("pending");

			// Validate events
			expect(events).toContain("start");
			expect(events).toContain("complete");

			console.log("[REPLAY] Parsed tasks:", result.tasks.length);
			console.log("[REPLAY] Messages replayed:", replayer.getSession()?.messages.length);
		});

		test("replays sample-tasks-dependencies recording", async () => {
			const { container, replayer } = await createReplayContainer(
				"golden/parser-agent",
				"sample-tasks-dependencies",
			);
			const parser = container.get(ParserAgent);

			const tasksFilePath = path.join(FIXTURES_DIR, "sample-tasks.md");
			const tasksContent = await fs.readFile(tasksFilePath, "utf-8");

			const result = await parser.parse({ tasksFilePath, tasksContent });

			// Check parallel flag detection
			const parallelTask = result.tasks.find((t) => t.id === "T002" || t.id === "T005");
			expect(parallelTask?.flags.parallel).toBe(true);

			// Check dependency parsing
			const taskWithDeps = result.tasks.find((t) => t.dependencies.length > 0);
			expect(taskWithDeps).toBeDefined();

			console.log("[REPLAY] Task with dependencies:", taskWithDeps?.id, "->", taskWithDeps?.dependencies);
		});

		test("replays cycle-detection recording", async () => {
			const { container, replayer } = await createReplayContainer(
				"golden/parser-agent",
				"cycle-detection",
			);
			const parser = container.get(ParserAgent);

			const cyclicContent = `# Cyclic Tasks

## Phase 1: Test

- [ ] T001 First task (depends on T003)
- [ ] T002 Second task (depends on T001)
- [ ] T003 Third task (depends on T002)
`;

			const result = await parser.parse({
				tasksFilePath: "test-cyclic.md",
				tasksContent: cyclicContent,
			});

			// Should detect and warn about cycle
			const hasCycleWarning = result.warnings.some((w) => w.toLowerCase().includes("cycle"));
			expect(hasCycleWarning).toBe(true);

			console.log("[REPLAY] Cycle warnings:", result.warnings.filter((w) => w.includes("cycle")));
		});
	});
});
