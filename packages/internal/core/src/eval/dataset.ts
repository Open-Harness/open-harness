/**
 * Dataset loading and validation for the eval system.
 *
 * Datasets are JSON files containing test cases for workflow evaluation.
 * This module provides loading, validation, and discovery utilities.
 */

import { type ZodType, z } from "zod";
import type { Assertion, EvalCase, EvalDataset, ValidationResult } from "./types.js";

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Schema for output.contains assertion.
 */
const OutputContainsAssertionSchema = z.object({
	type: z.literal("output.contains"),
	path: z.string().min(1, "Path is required"),
	value: z.string(),
});

/**
 * Schema for output.equals assertion.
 */
const OutputEqualsAssertionSchema = z.object({
	type: z.literal("output.equals"),
	path: z.string().min(1, "Path is required"),
	value: z.unknown(),
});

/**
 * Schema for metric.latency_ms.max assertion.
 */
const MetricLatencyMaxAssertionSchema = z.object({
	type: z.literal("metric.latency_ms.max"),
	value: z.number().positive("Latency must be positive"),
});

/**
 * Schema for metric.total_cost_usd.max assertion.
 */
const MetricCostMaxAssertionSchema = z.object({
	type: z.literal("metric.total_cost_usd.max"),
	value: z.number().nonnegative("Cost must be non-negative"),
});

/**
 * Schema for metric.tokens.input.max assertion.
 */
const MetricInputTokensMaxAssertionSchema = z.object({
	type: z.literal("metric.tokens.input.max"),
	value: z.number().int().positive("Token count must be a positive integer"),
});

/**
 * Schema for metric.tokens.output.max assertion.
 */
const MetricOutputTokensMaxAssertionSchema = z.object({
	type: z.literal("metric.tokens.output.max"),
	value: z.number().int().positive("Token count must be a positive integer"),
});

/**
 * Schema for behavior.no_errors assertion.
 */
const BehaviorNoErrorsAssertionSchema = z.object({
	type: z.literal("behavior.no_errors"),
});

/**
 * Schema for behavior.node_executed assertion.
 */
const BehaviorNodeExecutedAssertionSchema = z.object({
	type: z.literal("behavior.node_executed"),
	nodeId: z.string().min(1, "Node ID is required"),
});

/**
 * Schema for behavior.node_invocations.max assertion.
 */
const BehaviorNodeInvocationsMaxAssertionSchema = z.object({
	type: z.literal("behavior.node_invocations.max"),
	nodeId: z.string().min(1, "Node ID is required"),
	value: z.number().int().positive("Invocation count must be a positive integer"),
});

/**
 * Combined schema for all assertion types.
 */
export const AssertionSchema: ZodType<Assertion> = z.discriminatedUnion("type", [
	OutputContainsAssertionSchema,
	OutputEqualsAssertionSchema,
	MetricLatencyMaxAssertionSchema,
	MetricCostMaxAssertionSchema,
	MetricInputTokensMaxAssertionSchema,
	MetricOutputTokensMaxAssertionSchema,
	BehaviorNoErrorsAssertionSchema,
	BehaviorNodeExecutedAssertionSchema,
	BehaviorNodeInvocationsMaxAssertionSchema,
]);

/**
 * Schema for a single eval case.
 */
export const EvalCaseSchema: ZodType<EvalCase> = z.object({
	id: z
		.string()
		.min(1, "Case ID is required")
		.regex(/^[a-zA-Z0-9_-]+$/, "Case ID must be filesystem-safe (alphanumeric, hyphens, underscores only)"),
	name: z.string().optional(),
	input: z.unknown(),
	assertions: z.array(AssertionSchema),
	tags: z.array(z.string()).optional(),
});

/**
 * Schema for an eval dataset.
 */
export const EvalDatasetSchema: ZodType<EvalDataset> = z
	.object({
		id: z
			.string()
			.min(1, "Dataset ID is required")
			.regex(/^[a-zA-Z0-9._-]+$/, "Dataset ID must be filesystem-safe (alphanumeric, dots, hyphens, underscores only)"),
		workflowName: z.string().min(1, "Workflow name is required"),
		version: z.string().min(1, "Version is required"),
		cases: z.array(EvalCaseSchema).min(1, "At least one case is required"),
	})
	.superRefine((data, ctx) => {
		// Check for duplicate case IDs
		const caseIds = data.cases.map((c) => c.id);
		const seen = new Set<string>();
		const duplicates: string[] = [];

		for (const id of caseIds) {
			if (seen.has(id)) {
				duplicates.push(id);
			}
			seen.add(id);
		}

		if (duplicates.length > 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `Duplicate case IDs found: ${duplicates.join(", ")}`,
				path: ["cases"],
			});
		}
	});

// ============================================================================
// Loading and validation functions
// ============================================================================

/**
 * Error thrown when dataset validation fails.
 */
export class DatasetValidationError extends Error {
	constructor(
		message: string,
		public readonly issues: z.ZodIssue[],
	) {
		super(message);
		this.name = "DatasetValidationError";
	}
}

/**
 * Load and validate a dataset from JSON.
 *
 * @param json - Raw JSON data (already parsed)
 * @returns Validated EvalDataset
 * @throws DatasetValidationError if validation fails
 */
export function loadDataset(json: unknown): EvalDataset {
	const result = EvalDatasetSchema.safeParse(json);

	if (!result.success) {
		const messages = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
		throw new DatasetValidationError(`Dataset validation failed:\n${messages.join("\n")}`, result.error.issues);
	}

	return result.data;
}

/**
 * Validate a dataset and return detailed results.
 *
 * Unlike loadDataset(), this function returns validation results
 * instead of throwing, and includes warnings for non-critical issues.
 *
 * @param dataset - Dataset to validate
 * @returns Validation result with errors and warnings
 */
export function validateDataset(dataset: EvalDataset): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Re-validate to ensure consistency
	const result = EvalDatasetSchema.safeParse(dataset);
	if (!result.success) {
		for (const issue of result.error.issues) {
			errors.push(`${issue.path.join(".")}: ${issue.message}`);
		}
	}

	// Additional semantic validations (warnings)
	const caseIds = dataset.cases.map((c) => c.id);
	const seen = new Set<string>();
	for (const id of caseIds) {
		if (seen.has(id)) {
			warnings.push(`Duplicate case ID: ${id}`);
		}
		seen.add(id);
	}

	// Check for cases without assertions
	for (const evalCase of dataset.cases) {
		if (evalCase.assertions.length === 0) {
			warnings.push(`Case "${evalCase.id}" has no assertions`);
		}
	}

	// Check for inconsistent tag usage
	const allTags = new Set<string>();
	for (const evalCase of dataset.cases) {
		if (evalCase.tags) {
			for (const tag of evalCase.tags) {
				allTags.add(tag);
			}
		}
	}

	// Warn about tags used only once (might be typos)
	const tagCounts = new Map<string, number>();
	for (const evalCase of dataset.cases) {
		if (evalCase.tags) {
			for (const tag of evalCase.tags) {
				tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
			}
		}
	}

	for (const [tag, count] of tagCounts) {
		if (count === 1 && dataset.cases.length > 3) {
			warnings.push(`Tag "${tag}" is only used in one case (possible typo?)`);
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}

// ============================================================================
// File system utilities (Node.js only)
// ============================================================================

/**
 * Helper to discover dataset files in a directory.
 *
 * NOTE: This function requires Node.js and is intended for use in scripts,
 * not browser environments. Use directly with:
 *
 * ```ts
 * import { discoverDatasets } from "@internal/core/eval/dataset";
 * const files = await discoverDatasets(dir, fs, path);
 * ```
 *
 * @param dir - Directory to search
 * @param fs - Node.js fs/promises module
 * @param path - Node.js path module
 * @returns Array of file paths
 */
export async function discoverDatasets(
	dir: string,
	fs: { readdir: (path: string) => Promise<string[]> },
	path: { join: (...paths: string[]) => string },
): Promise<string[]> {
	try {
		const files = await fs.readdir(dir);
		return files.filter((file: string) => file.endsWith(".json")).map((file: string) => path.join(dir, file));
	} catch (error) {
		// Directory doesn't exist or can't be read
		if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
			return [];
		}
		throw error;
	}
}

/**
 * Helper to load a dataset from a file path.
 *
 * NOTE: This function requires Node.js and is intended for use in scripts,
 * not browser environments. Use directly with:
 *
 * ```ts
 * import { loadDatasetFromFile } from "@internal/core/eval/dataset";
 * import * as fs from "node:fs/promises";
 * const dataset = await loadDatasetFromFile(filePath, fs);
 * ```
 *
 * @param filePath - Path to JSON dataset file
 * @param fs - Node.js fs/promises module
 * @returns Validated EvalDataset
 * @throws DatasetValidationError if validation fails
 */
export async function loadDatasetFromFile(
	filePath: string,
	fs: { readFile: (path: string, encoding: string) => Promise<string> },
): Promise<EvalDataset> {
	const content = await fs.readFile(filePath, "utf-8");
	const json = JSON.parse(content) as unknown;
	return loadDataset(json);
}
