/**
 * Unit tests for dependency-resolver.ts
 *
 * Tests topological sorting, cycle detection, and dependency validation.
 * Pure logic tests - no LLM calls required.
 */

import { describe, expect, test } from "bun:test";
import {
	detectCycles,
	getReadyTasks,
	resolveDependencies,
	validateDependencies,
} from "../../src/harness/dependency-resolver.js";

describe("dependency-resolver", () => {
	describe("resolveDependencies", () => {
		test("sorts tasks with no dependencies", () => {
			const tasks = [
				{ id: "T001", dependencies: [] },
				{ id: "T002", dependencies: [] },
				{ id: "T003", dependencies: [] },
			];

			const result = resolveDependencies(tasks);

			expect(result.success).toBe(true);
			expect(result.sorted).toHaveLength(3);
			expect(result.cycles).toHaveLength(0);
			expect(result.unsortable).toHaveLength(0);
		});

		test("sorts linear dependency chain", () => {
			const tasks = [
				{ id: "T003", dependencies: ["T002"] },
				{ id: "T001", dependencies: [] },
				{ id: "T002", dependencies: ["T001"] },
			];

			const result = resolveDependencies(tasks);

			expect(result.success).toBe(true);
			expect(result.sorted).toEqual(["T001", "T002", "T003"]);
		});

		test("handles diamond dependency pattern", () => {
			// T001 → T002 → T004
			//      ↘ T003 ↗
			const tasks = [
				{ id: "T001", dependencies: [] },
				{ id: "T002", dependencies: ["T001"] },
				{ id: "T003", dependencies: ["T001"] },
				{ id: "T004", dependencies: ["T002", "T003"] },
			];

			const result = resolveDependencies(tasks);

			expect(result.success).toBe(true);
			expect(result.sorted[0]).toBe("T001");
			expect(result.sorted[3]).toBe("T004");
			// T002 and T003 can be in either order
			expect(result.sorted.slice(1, 3).sort()).toEqual(["T002", "T003"]);
		});

		test("detects simple cycle", () => {
			const tasks = [
				{ id: "T001", dependencies: ["T002"] },
				{ id: "T002", dependencies: ["T001"] },
			];

			const result = resolveDependencies(tasks);

			expect(result.success).toBe(false);
			expect(result.unsortable).toContain("T001");
			expect(result.unsortable).toContain("T002");
		});

		test("detects longer cycle", () => {
			const tasks = [
				{ id: "T001", dependencies: ["T003"] },
				{ id: "T002", dependencies: ["T001"] },
				{ id: "T003", dependencies: ["T002"] },
			];

			const result = resolveDependencies(tasks);

			expect(result.success).toBe(false);
			expect(result.unsortable).toHaveLength(3);
		});

		test("handles partial cycle with sortable tasks", () => {
			const tasks = [
				{ id: "T001", dependencies: [] }, // Can be sorted
				{ id: "T002", dependencies: ["T001", "T003"] }, // In cycle
				{ id: "T003", dependencies: ["T002"] }, // In cycle
			];

			const result = resolveDependencies(tasks);

			expect(result.success).toBe(false);
			expect(result.sorted).toContain("T001");
			expect(result.unsortable).toContain("T002");
			expect(result.unsortable).toContain("T003");
		});

		test("ignores missing dependencies", () => {
			const tasks = [
				{ id: "T001", dependencies: ["T000"] }, // T000 doesn't exist
				{ id: "T002", dependencies: ["T001"] },
			];

			const result = resolveDependencies(tasks);

			expect(result.success).toBe(true);
			expect(result.sorted).toEqual(["T001", "T002"]);
		});

		test("handles empty task list", () => {
			const result = resolveDependencies([]);

			expect(result.success).toBe(true);
			expect(result.sorted).toEqual([]);
		});

		test("handles single task", () => {
			const tasks = [{ id: "T001", dependencies: [] }];

			const result = resolveDependencies(tasks);

			expect(result.success).toBe(true);
			expect(result.sorted).toEqual(["T001"]);
		});

		test("handles self-referencing task", () => {
			const tasks = [{ id: "T001", dependencies: ["T001"] }];

			const result = resolveDependencies(tasks);

			expect(result.success).toBe(false);
			expect(result.unsortable).toContain("T001");
		});
	});

	describe("detectCycles", () => {
		test("returns empty array for acyclic graph", () => {
			const tasks = [
				{ id: "T001", dependencies: [] },
				{ id: "T002", dependencies: ["T001"] },
				{ id: "T003", dependencies: ["T002"] },
			];

			const cycles = detectCycles(tasks);

			expect(cycles).toHaveLength(0);
		});

		test("detects two-node cycle", () => {
			const tasks = [
				{ id: "T001", dependencies: ["T002"] },
				{ id: "T002", dependencies: ["T001"] },
			];

			const cycles = detectCycles(tasks);

			expect(cycles.length).toBeGreaterThan(0);
		});

		test("detects three-node cycle", () => {
			const tasks = [
				{ id: "T001", dependencies: ["T002"] },
				{ id: "T002", dependencies: ["T003"] },
				{ id: "T003", dependencies: ["T001"] },
			];

			const cycles = detectCycles(tasks);

			expect(cycles.length).toBeGreaterThan(0);
		});
	});

	describe("getReadyTasks", () => {
		test("returns tasks with no dependencies", () => {
			const tasks = [
				{ id: "T001", dependencies: [], status: "pending" as const },
				{ id: "T002", dependencies: ["T001"], status: "pending" as const },
				{ id: "T003", dependencies: [], status: "pending" as const },
			];

			const ready = getReadyTasks(tasks, new Set());

			expect(ready).toContain("T001");
			expect(ready).toContain("T003");
			expect(ready).not.toContain("T002");
		});

		test("returns tasks whose dependencies are complete", () => {
			const tasks = [
				{ id: "T001", dependencies: [], status: "complete" as const },
				{ id: "T002", dependencies: ["T001"], status: "pending" as const },
				{ id: "T003", dependencies: ["T001", "T002"], status: "pending" as const },
			];

			const completedIds = new Set(["T001"]);
			const ready = getReadyTasks(tasks, completedIds);

			expect(ready).toContain("T002");
			expect(ready).not.toContain("T003"); // T002 not complete yet
		});

		test("excludes already complete tasks", () => {
			const tasks = [
				{ id: "T001", dependencies: [], status: "complete" as const },
				{ id: "T002", dependencies: [], status: "pending" as const },
			];

			const ready = getReadyTasks(tasks, new Set());

			expect(ready).not.toContain("T001");
			expect(ready).toContain("T002");
		});

		test("returns empty array when all tasks blocked", () => {
			const tasks = [
				{ id: "T001", dependencies: ["T002"], status: "pending" as const },
				{ id: "T002", dependencies: ["T001"], status: "pending" as const },
			];

			const ready = getReadyTasks(tasks, new Set());

			expect(ready).toHaveLength(0);
		});
	});

	describe("validateDependencies", () => {
		test("returns empty array for valid dependencies", () => {
			const tasks = [
				{ id: "T001", dependencies: [] },
				{ id: "T002", dependencies: ["T001"] },
			];

			const warnings = validateDependencies(tasks);

			expect(warnings).toHaveLength(0);
		});

		test("warns about missing dependency references", () => {
			const tasks = [
				{ id: "T001", dependencies: ["T000"] }, // T000 doesn't exist
				{ id: "T002", dependencies: ["T001", "T999"] }, // T999 doesn't exist
			];

			const warnings = validateDependencies(tasks);

			expect(warnings).toHaveLength(2);
			expect(warnings[0]).toContain("T001");
			expect(warnings[0]).toContain("T000");
			expect(warnings[1]).toContain("T002");
			expect(warnings[1]).toContain("T999");
		});

		test("handles empty task list", () => {
			const warnings = validateDependencies([]);

			expect(warnings).toHaveLength(0);
		});
	});
});
