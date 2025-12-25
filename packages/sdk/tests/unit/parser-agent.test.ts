/**
 * ParserAgent Unit Tests
 *
 * Tests for the task parser agent with golden recording capture.
 * Uses subscription authentication (no API key needed).
 *
 * Run with: bun test tests/unit/parser-agent.test.ts
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { beforeAll, describe, expect, test } from "bun:test";
import { ParserAgent } from "../../src/providers/anthropic/agents/parser-agent.js";
import type { ParserAgentOutput } from "../../src/harness/task-harness-types.js";
import { createRecordingContainer, type RecordingRunner } from "../helpers/recording-wrapper.js";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");
const GOLDEN_DIR = path.resolve(__dirname, "../../recordings/golden/parser-agent");

// Ensure golden directory exists
beforeAll(async () => {
	await fs.mkdir(GOLDEN_DIR, { recursive: true });
});

describe("ParserAgent", () => {
	describe("parse() with recording", () => {
		test("parses sample tasks.md and captures golden recording", async () => {
			// Create recording container
			const { container, recorder } = createRecordingContainer("golden/parser-agent");
			const parser = container.get(ParserAgent);

			// Load sample tasks
			const tasksFilePath = path.join(FIXTURES_DIR, "sample-tasks.md");
			const tasksContent = await fs.readFile(tasksFilePath, "utf-8");

			// Track events
			const events: string[] = [];

			// Start capture
			recorder.startCapture("sample-tasks-basic");

			// Parse
			const result = await parser.parse(
				{ tasksFilePath, tasksContent },
				{
					onStart: () => events.push("start"),
					onText: () => events.push("text"),
					onComplete: () => events.push("complete"),
				},
			);

			// Save recording
			await recorder.saveCapture({ fixture: "sample-tasks.md" });

			// Validate structure
			expect(result).toBeDefined();
			expect(result.tasks).toBeInstanceOf(Array);
			expect(result.phases).toBeInstanceOf(Array);
			expect(result.warnings).toBeInstanceOf(Array);
			expect(result.metadata).toBeDefined();

			// Validate task count (sample has 8 tasks)
			expect(result.tasks.length).toBeGreaterThanOrEqual(7);

			// Validate first task
			const firstTask = result.tasks.find((t) => t.id === "T001");
			expect(firstTask).toBeDefined();
			expect(firstTask?.description).toContain("hello");
			expect(firstTask?.status).toBe("pending");

			// Validate completed task
			const completedTask = result.tasks.find((t) => t.id === "T002");
			expect(completedTask).toBeDefined();
			expect(completedTask?.status).toBe("complete");

			// Validate dependencies
			const taskWithDep = result.tasks.find((t) => t.id === "T004");
			expect(taskWithDep).toBeDefined();
			expect(taskWithDep?.dependencies).toContain("T001");

			// Validate phases
			expect(result.phases.length).toBeGreaterThanOrEqual(3);
			expect(result.phases[0]?.name).toContain("Setup");

			// Validate metadata
			expect(result.metadata.totalTasks).toBeGreaterThanOrEqual(7);
			expect(result.metadata.completeTasks).toBeGreaterThanOrEqual(1);
			expect(result.metadata.pendingTasks).toBeGreaterThanOrEqual(6);

			// Validate events
			expect(events).toContain("start");
			expect(events).toContain("complete");

			console.log("Parsed tasks:", result.tasks.length);
			console.log("Phases:", result.phases.map((p) => p.name));
			console.log("Warnings:", result.warnings);
		}, 60000);

		test("detects dependencies and flags with recording", async () => {
			const { container, recorder } = createRecordingContainer("golden/parser-agent");
			const parser = container.get(ParserAgent);

			const tasksFilePath = path.join(FIXTURES_DIR, "sample-tasks.md");
			const tasksContent = await fs.readFile(tasksFilePath, "utf-8");

			recorder.startCapture("sample-tasks-dependencies");
			const result = await parser.parse({ tasksFilePath, tasksContent });
			await recorder.saveCapture({ fixture: "sample-tasks.md", focus: "dependencies" });

			// Check parallel flag detection
			const parallelTask = result.tasks.find((t) => t.id === "T002" || t.id === "T005");
			expect(parallelTask?.flags.parallel).toBe(true);

			// Check dependency parsing
			const taskWithDeps = result.tasks.find((t) => t.dependencies.length > 0);
			expect(taskWithDeps).toBeDefined();

			console.log("Task with dependencies:", taskWithDeps?.id, "->", taskWithDeps?.dependencies);
		}, 60000);

		test("extracts validation criteria from Independent Test sections", async () => {
			const { container, recorder } = createRecordingContainer("golden/parser-agent");
			const parser = container.get(ParserAgent);

			const tasksFilePath = path.join(FIXTURES_DIR, "sample-tasks.md");
			const tasksContent = await fs.readFile(tasksFilePath, "utf-8");

			recorder.startCapture("sample-tasks-validation");
			const result = await parser.parse({ tasksFilePath, tasksContent });
			await recorder.saveCapture({ fixture: "sample-tasks.md", focus: "validation-criteria" });

			// Phase 2 has an "Independent Test" section
			const phase2Tasks = result.tasks.filter((t) => t.phaseNumber === 2);

			// At least one task should have validation criteria from the Independent Test
			const hasValidationCriteria = phase2Tasks.some(
				(t) => t.validationCriteria && t.validationCriteria.length > 0,
			);
			expect(hasValidationCriteria).toBe(true);

			console.log(
				"Phase 2 validation criteria:",
				phase2Tasks.map((t) => ({ id: t.id, criteria: t.validationCriteria })),
			);
		}, 60000);
	});

	describe("parseFile()", () => {
		test("reads file from disk and parses", async () => {
			const { container, recorder } = createRecordingContainer("golden/parser-agent");
			const parser = container.get(ParserAgent);

			const tasksFilePath = path.join(FIXTURES_DIR, "sample-tasks.md");

			recorder.startCapture("parseFile-sample");
			const result = await parser.parseFile(tasksFilePath);
			await recorder.saveCapture({ method: "parseFile" });

			expect(result).toBeDefined();
			expect(result.tasks.length).toBeGreaterThanOrEqual(7);
			expect(result.metadata.sourcePath).toBe(tasksFilePath);
		}, 60000);
	});

	describe("cycle detection", () => {
		test("detects and reports dependency cycles", async () => {
			const { container, recorder } = createRecordingContainer("golden/parser-agent");
			const parser = container.get(ParserAgent);

			// Create content with a cycle: T001 -> T002 -> T003 -> T001
			const cyclicContent = `# Cyclic Tasks

## Phase 1: Test

- [ ] T001 First task (depends on T003)
- [ ] T002 Second task (depends on T001)
- [ ] T003 Third task (depends on T002)
`;

			recorder.startCapture("cycle-detection");
			const result = await parser.parse({
				tasksFilePath: "test-cyclic.md",
				tasksContent: cyclicContent,
			});
			await recorder.saveCapture({ focus: "cycle-detection" });

			// Should detect and warn about cycle
			const hasCycleWarning = result.warnings.some((w) => w.toLowerCase().includes("cycle"));
			expect(hasCycleWarning).toBe(true);

			console.log("Cycle warnings:", result.warnings.filter((w) => w.includes("cycle")));
		}, 60000);
	});
});
