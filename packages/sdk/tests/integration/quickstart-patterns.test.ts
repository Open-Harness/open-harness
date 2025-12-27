/**
 * Quickstart Pattern Verification Tests (T042)
 *
 * SC-008 Ultimate Test: Verifies the patterns from quickstart.md work correctly.
 * Checks:
 * - At least 1 phase:start event emitted
 * - At least 1 narrative event with non-empty text
 * - run() completes without throwing
 *
 * Uses mock agents since real agents require API calls.
 *
 * @module tests/integration/quickstart-patterns
 */

import { describe, expect, test } from "bun:test";
import { injectable } from "@needle-di/core";
import { defineHarness, wrapAgent } from "../../src/index.js";
import type {
	FluentHarnessEvent,
	NarrativeEvent,
	PhaseEvent,
	RetryStartEvent,
	ParallelStartEvent,
} from "../../src/harness/event-types.js";

// ============================================================================
// MOCK AGENTS (Matching quickstart.md patterns)
// ============================================================================

// Mock for ParserAgent pattern
@injectable()
class MockParserAgent {
	async parseFile(path: string): Promise<{ tasks: Array<{ id: string; description: string }> }> {
		return {
			tasks: [
				{ id: "T001", description: "Build login form" },
				{ id: "T002", description: "Add validation" },
			],
		};
	}
}

// Mock for PlannerAgent pattern
@injectable()
class MockPlannerAgent {
	async plan(input: string): Promise<{ tasks: Array<{ description: string }> }> {
		return {
			tasks: [{ description: "Step 1: Setup" }, { description: "Step 2: Implement" }],
		};
	}
}

// Mock for CodingAgent pattern
@injectable()
class MockCodingAgent {
	async execute(task: string): Promise<{ summary: string }> {
		return { summary: `Implemented: ${task}` };
	}
}

// Mock for ReviewAgent pattern
@injectable()
class MockReviewAgent {
	async review(task: string, code: string): Promise<{ passed: boolean; feedback: string }> {
		return { passed: true, feedback: "Looks good!" };
	}
}

// ============================================================================
// LEVEL 1: SINGLE AGENT (One-liner) - quickstart.md pattern
// ============================================================================

describe("Level 1: Single Agent (wrapAgent)", () => {
	test("simplest usage - one-liner matches quickstart pattern", async () => {
		// From quickstart.md:
		// const result = await wrapAgent(CodingAgent).run('Write a hello world function');

		const result = wrapAgent(MockCodingAgent).run("Write a hello world function");

		// Await if async (mock is async)
		const resolved = await result;
		expect(resolved.summary).toBe("Implemented: Write a hello world function");
	});

	test("with event handling matches quickstart pattern", async () => {
		const narrativeTexts: string[] = [];

		// From quickstart.md:
		// await wrapAgent(CodingAgent)
		//   .on('narrative', (e) => console.log(`💭 ${e.text}`))
		//   .run('Write a hello world function');

		await wrapAgent(MockCodingAgent)
			.on("narrative", (e) => narrativeTexts.push((e as NarrativeEvent).text))
			.run("Write a hello world function");

		// SC-008: At least 1 narrative event with non-empty text
		expect(narrativeTexts.length).toBeGreaterThan(0);
		expect(narrativeTexts.some((t) => t.length > 0)).toBe(true);
	});
});

// ============================================================================
// LEVEL 2: SIMPLE WORKFLOW - quickstart.md pattern
// ============================================================================

describe("Level 2: Simple Workflow", () => {
	test("multi-agent workflow without state matches quickstart pattern", async () => {
		// From quickstart.md:
		// const SimpleWorkflow = defineHarness({
		//   agents: { planner: PlannerAgent, coder: CodingAgent },
		//   run: async ({ agents }, input: string) => {
		//     const plan = await agents.planner.plan(input);
		//     const result = await agents.coder.execute(plan.tasks[0].description);
		//     return result;
		//   },
		// });

		const SimpleWorkflow = defineHarness({
			agents: { planner: MockPlannerAgent, coder: MockCodingAgent },
			run: async ({ agents }, input: string) => {
				const plan = await agents.planner.plan(input);
				const result = await agents.coder.execute(plan.tasks[0]?.description ?? "");
				return result;
			},
		});

		// Usage: const result = await SimpleWorkflow.create().run('Build a todo app');
		const harnessResult = await SimpleWorkflow.create("Build a todo app").run();

		expect(harnessResult.result.summary).toBe("Implemented: Step 1: Setup");
	});
});

// ============================================================================
// LEVEL 3: FULL WORKFLOW - quickstart.md pattern
// ============================================================================

describe("Level 3: Full Workflow with State", () => {
	interface Task {
		id: string;
		description: string;
	}

	interface TaskResult {
		task: Task;
		result: { summary: string };
		review: { passed: boolean };
	}

	test("full workflow with phases and tasks matches quickstart pattern", async () => {
		const events: FluentHarnessEvent[] = [];

		// From quickstart.md (simplified):
		// const CodingWorkflow = defineHarness({
		//   name: 'coding-workflow',
		//   agents: { parser: ParserAgent, coder: CodingAgent, reviewer: ReviewAgent },
		//   state: (input) => ({ tasksPath: input.tasksPath, tasks: [], results: [] }),
		//   run: async ({ agents, state, phase, task, emit }) => { ... },
		// });

		const CodingWorkflow = defineHarness({
			name: "coding-workflow",

			agents: {
				parser: MockParserAgent,
				coder: MockCodingAgent,
				reviewer: MockReviewAgent,
			},

			state: (input: { tasksPath: string }) => ({
				tasksPath: input.tasksPath,
				tasks: [] as Task[],
				results: [] as TaskResult[],
			}),

			run: async ({ agents, state, phase, task, emit }) => {
				// Phase 1: Parse
				await phase("Parsing", async () => {
					const parsed = await agents.parser.parseFile(state.tasksPath);
					state.tasks = parsed.tasks;
					return { count: parsed.tasks.length };
				});

				// Phase 2: Execute
				await phase("Execution", async () => {
					for (const t of state.tasks) {
						await task(t.id, async () => {
							const result = await agents.coder.execute(t.description);
							const review = await agents.reviewer.review(t.description, result.summary);
							state.results.push({ task: t, result, review: { passed: review.passed } });
							return { passed: review.passed };
						});
					}
				});

				// Custom event
				emit("summary", {
					total: state.tasks.length,
					passed: state.results.filter((r) => r.review.passed).length,
				});

				return state.results;
			},
		});

		// Usage with event handlers (from quickstart):
		// harness
		//   .on('phase', (e) => console.log(...))
		//   .on('task', (e) => console.log(...))
		//   .on('narrative', (e) => console.log(...));

		const harnessResult = await CodingWorkflow.create({ tasksPath: "./tasks.md" })
			.on("phase", (e) => events.push(e))
			.on("task", (e) => events.push(e))
			.on("*", (e) => events.push(e))
			.run();

		// SC-008: run() completes without throwing
		expect(harnessResult.result.length).toBe(2);

		// SC-008: At least 1 phase:start event emitted
		const phaseEvents = events.filter((e) => e.type === "phase") as PhaseEvent[];
		const phaseStarts = phaseEvents.filter((e) => e.status === "start");
		expect(phaseStarts.length).toBeGreaterThanOrEqual(1);

		// Verify phase names
		const phaseNames = [...new Set(phaseEvents.map((e) => e.name))];
		expect(phaseNames).toContain("Parsing");
		expect(phaseNames).toContain("Execution");

		// Verify custom event was emitted
		const summaryEvent = events.find((e) => (e as { type: string }).type === "summary");
		expect(summaryEvent).toBeDefined();
	});
});

// ============================================================================
// CONTROL FLOW HELPERS - quickstart.md pattern
// ============================================================================

describe("Control Flow Helpers (retry, parallel)", () => {
	test("retry helper matches quickstart pattern", async () => {
		const events: FluentHarnessEvent[] = [];
		let attempts = 0;

		// From quickstart.md:
		// const result = await retry('coder-execute', () => agents.coder.execute(state.task), {
		//   retries: 3, minTimeout: 1000, maxTimeout: 5000
		// });

		const RetryWorkflow = defineHarness({
			agents: { coder: MockCodingAgent },
			run: async ({ agents, retry }) => {
				const result = await retry(
					"coder-execute",
					async () => {
						attempts++;
						if (attempts < 2) throw new Error("Retry me");
						return agents.coder.execute("task");
					},
					{ retries: 3, minTimeout: 10, maxTimeout: 50 },
				);
				return result;
			},
		});

		const harnessResult = await RetryWorkflow.create(undefined)
			.on("*", (e) => events.push(e))
			.run();

		expect(harnessResult.result.summary).toBe("Implemented: task");
		expect(attempts).toBe(2);

		// Verify retry events
		const retryStart = events.find((e) => e.type === "retry:start") as RetryStartEvent;
		expect(retryStart).toBeDefined();
		expect(retryStart.name).toBe("coder-execute");
	});

	test("parallel helper matches quickstart pattern", async () => {
		const events: FluentHarnessEvent[] = [];

		// From quickstart.md:
		// const reviews = await parallel('reviews',
		//   state.tasks.map(t => () => agents.reviewer.review(t)),
		//   { concurrency: 3 }
		// );

		const ParallelWorkflow = defineHarness({
			agents: { reviewer: MockReviewAgent },
			state: () => ({
				tasks: ["Task A", "Task B", "Task C"],
			}),
			run: async ({ agents, state, parallel }) => {
				const reviews = await parallel(
					"reviews",
					state.tasks.map((t) => () => agents.reviewer.review(t, "code")),
					{ concurrency: 3 },
				);
				return reviews;
			},
		});

		const harnessResult = await ParallelWorkflow.create(undefined)
			.on("*", (e) => events.push(e))
			.run();

		expect(harnessResult.result.length).toBe(3);
		expect(harnessResult.result.every((r) => r.passed)).toBe(true);

		// Verify parallel events
		const parallelStart = events.find((e) => e.type === "parallel:start") as ParallelStartEvent;
		expect(parallelStart).toBeDefined();
		expect(parallelStart.name).toBe("reviews");
		expect(parallelStart.total).toBe(3);
	});
});

// ============================================================================
// SC-008: ULTIMATE TEST
// ============================================================================

describe("SC-008: Ultimate Test", () => {
	test("coding workflow meets all SC-008 criteria", async () => {
		const events: FluentHarnessEvent[] = [];

		const UltimateWorkflow = defineHarness({
			name: "ultimate-test-workflow",
			agents: {
				parser: MockParserAgent,
				coder: MockCodingAgent,
				reviewer: MockReviewAgent,
			},
			state: (input: { path: string }) => ({
				path: input.path,
				tasks: [] as Array<{ id: string; description: string }>,
			}),
			run: async ({ agents, state, phase, emit }) => {
				await phase("Parse", async () => {
					const result = await agents.parser.parseFile(state.path);
					state.tasks = result.tasks;
					return { parsed: result.tasks.length };
				});

				await phase("Execute", async () => {
					for (const task of state.tasks) {
						const code = await agents.coder.execute(task.description);
						emit("narrative", { text: `Coded: ${task.id}`, agent: "MockCoder" });
					}
				});

				return "Ultimate test complete";
			},
		});

		// Criterion (c): run() completes without throwing
		const result = await UltimateWorkflow.create({ path: "./test.md" })
			.on("*", (e) => events.push(e))
			.run();

		expect(result.result).toBe("Ultimate test complete");

		// Criterion (a): At least 1 phase:start event emitted
		const phaseStarts = events.filter(
			(e) => e.type === "phase" && (e as PhaseEvent).status === "start",
		) as PhaseEvent[];
		expect(phaseStarts.length).toBeGreaterThanOrEqual(1);

		// Criterion (b): At least 1 narrative event with non-empty text
		const narrativeEvents = events.filter((e) => e.type === "narrative") as NarrativeEvent[];
		const nonEmptyNarratives = narrativeEvents.filter((e) => e.text && e.text.length > 0);
		expect(nonEmptyNarratives.length).toBeGreaterThanOrEqual(1);

		// Log for verification
		console.log("[SC-008] Phase starts:", phaseStarts.length);
		console.log("[SC-008] Narrative events:", narrativeEvents.length);
		console.log("[SC-008] Sample narrative:", narrativeEvents[0]?.text);
	});
});
