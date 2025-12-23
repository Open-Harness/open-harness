/**
 * Utility functions for autonomous agent example
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TaskInput } from "../../../workflow/task-list.js";

// ============================================
// Types
// ============================================

export type FeatureTest = {
	id: string;
	category: "functional" | "style";
	description: string;
	steps: string[];
	status: "pending" | "completed" | "failed";
	result?: {
		completedAt?: string;
		failedAt?: string;
		sessionId?: string;
		notes?: string;
		error?: string;
	};
};

// ============================================
// File Operations
// ============================================

/**
 * Load feature list from JSON file
 */
export function loadFeatureList(projectDir: string): FeatureTest[] {
	const featureListPath = join(projectDir, "feature_list.json");

	if (!existsSync(featureListPath)) {
		return [];
	}

	try {
		const content = readFileSync(featureListPath, "utf-8");
		return JSON.parse(content) as FeatureTest[];
	} catch (error) {
		console.error("Error loading feature_list.json:", error);
		return [];
	}
}

/**
 * Save feature list to JSON file
 */
export function saveFeatureList(projectDir: string, features: FeatureTest[]): void {
	const featureListPath = join(projectDir, "feature_list.json");
	writeFileSync(featureListPath, JSON.stringify(features, null, 2));
}

/**
 * Convert feature tests to TaskList format
 */
export function featuresToTasks(features: FeatureTest[]): TaskInput[] {
	return features.map((feature) => ({
		id: feature.id,
		description: feature.description,
		metadata: {
			category: feature.category,
			steps: feature.steps,
			status: feature.status,
			result: feature.result,
		},
	}));
}

/**
 * Update feature status in JSON file
 */
export function updateFeatureStatus(
	projectDir: string,
	featureId: string,
	status: "completed" | "failed",
	result?: FeatureTest["result"],
): void {
	const features = loadFeatureList(projectDir);
	const feature = features.find((f) => f.id === featureId);

	if (!feature) {
		console.warn(`Feature ${featureId} not found`);
		return;
	}

	feature.status = status;
	feature.result = result;

	saveFeatureList(projectDir, features);
}

/**
 * Check if feature list exists
 */
export function featureListExists(projectDir: string): boolean {
	return existsSync(join(projectDir, "feature_list.json"));
}

/**
 * Load progress notes
 */
export function loadProgressNotes(projectDir: string): string {
	const progressPath = join(projectDir, "claude-progress.txt");

	if (!existsSync(progressPath)) {
		return "";
	}

	return readFileSync(progressPath, "utf-8");
}

/**
 * Update progress notes
 */
export function updateProgressNotes(projectDir: string, sessionNumber: number, notes: string): void {
	const progressPath = join(projectDir, "claude-progress.txt");
	const timestamp = new Date().toISOString();

	const content = `
Session ${sessionNumber} - ${timestamp}
${"=".repeat(50)}

${notes}

`.trimStart();

	// Append to existing content
	const existing = existsSync(progressPath) ? readFileSync(progressPath, "utf-8") : "";

	writeFileSync(progressPath, existing + content);
}

/**
 * Get progress statistics
 */
export function getProgressStats(projectDir: string): {
	total: number;
	completed: number;
	failed: number;
	pending: number;
	percentComplete: number;
} {
	const features = loadFeatureList(projectDir);

	const total = features.length;
	const completed = features.filter((f) => f.status === "completed").length;
	const failed = features.filter((f) => f.status === "failed").length;
	const pending = features.filter((f) => f.status === "pending").length;
	const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;

	return {
		total,
		completed,
		failed,
		pending,
		percentComplete,
	};
}

/**
 * Copy app spec to project directory
 */
export function copyAppSpecToProject(projectDir: string): void {
	const sourceSpec = join(import.meta.dir, "../prompts/app_spec.txt");
	const targetSpec = join(projectDir, "app_spec.txt");

	if (existsSync(sourceSpec)) {
		const content = readFileSync(sourceSpec, "utf-8");
		writeFileSync(targetSpec, content);
	}
}

/**
 * Print progress summary
 */
export function printProgressSummary(projectDir: string): void {
	const stats = getProgressStats(projectDir);

	console.log(`\n${"=".repeat(50)}`);
	console.log("  PROGRESS SUMMARY");
	console.log("=".repeat(50));
	console.log(`Total Features: ${stats.total}`);
	console.log(`✅ Completed: ${stats.completed}`);
	console.log(`❌ Failed: ${stats.failed}`);
	console.log(`⏳ Pending: ${stats.pending}`);
	console.log(`📊 Progress: ${stats.percentComplete}%`);
	console.log(`${"=".repeat(50)}\n`);
}
