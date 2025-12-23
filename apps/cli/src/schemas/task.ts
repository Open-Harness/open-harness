/**
 * Task Schema - Extensible base for workflow tasks
 *
 * Defines the core task structure with extensible metadata
 * for different workflow types.
 */

import { z } from "zod";

// ============================================
// Base Task Schema
// ============================================

export const TaskStatusSchema = z.enum(["pending", "in_progress", "completed", "failed"]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const BaseTaskSchema = z.object({
	id: z.string(),
	status: TaskStatusSchema,
	priority: z.number().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export type BaseTask = z.infer<typeof BaseTaskSchema>;

// ============================================
// Test Case Task Schema (Autonomous Agent)
// ============================================

export const TestCaseResultSchema = z.object({
	completedAt: z.string().optional(),
	failedAt: z.string().optional(),
	sessionId: z.string().optional(),
	notes: z.string().optional(),
	error: z.string().optional(),
});

export type TestCaseResult = z.infer<typeof TestCaseResultSchema>;

export const TestCaseCategorySchema = z.enum(["functional", "style"]);
export type TestCaseCategory = z.infer<typeof TestCaseCategorySchema>;

export const TestCaseTaskSchema = z.object({
	id: z.string(),
	category: TestCaseCategorySchema,
	description: z.string(),
	steps: z.array(z.string()),
	status: TaskStatusSchema,
	result: TestCaseResultSchema.optional(),
});

export type TestCaseTask = z.infer<typeof TestCaseTaskSchema>;

// ============================================
// Progress Statistics
// ============================================

export interface ProgressStats {
	total: number;
	completed: number;
	failed: number;
	pending: number;
	inProgress: number;
	percentComplete: number;
}

/**
 * Calculate progress statistics from an array of tasks
 * Uses single pass O(n) instead of multiple filter passes
 */
export function calculateProgress<T extends { status: TaskStatus }>(tasks: T[]): ProgressStats {
	const total = tasks.length;
	let completed = 0;
	let failed = 0;
	let pending = 0;
	let inProgress = 0;

	for (const task of tasks) {
		switch (task.status) {
			case "completed":
				completed++;
				break;
			case "failed":
				failed++;
				break;
			case "pending":
				pending++;
				break;
			case "in_progress":
				inProgress++;
				break;
		}
	}

	const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;

	return {
		total,
		completed,
		failed,
		pending,
		inProgress,
		percentComplete,
	};
}
