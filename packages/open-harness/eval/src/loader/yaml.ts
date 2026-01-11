/**
 * YAML dataset loader.
 *
 * Loads and validates eval datasets from YAML files.
 */

import { readFile, writeFile } from "node:fs/promises";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { SignalAssertion } from "../assertions/types.js";
import type { DatasetResult, EvalCase, EvalDataset, MatrixResult } from "../types.js";
import { EvalDatasetSchema, type ParsedEvalDataset } from "./schema.js";

/**
 * Load a dataset from a YAML file.
 *
 * @param path - Path to the YAML file
 * @returns Parsed and validated dataset
 * @throws Error if file not found or validation fails
 */
export async function loadDataset<TState = unknown>(path: string): Promise<EvalDataset<TState>> {
	const content = await readFile(path, "utf-8");
	const parsed = parseYaml(content);

	// Validate against schema
	const result = EvalDatasetSchema.safeParse(parsed);

	if (!result.success) {
		const errors = result.error.errors.map((e) => `  - ${e.path.join(".")}: ${e.message}`).join("\n");
		throw new Error(`Invalid dataset at ${path}:\n${errors}`);
	}

	// Cast to typed dataset
	return result.data as EvalDataset<TState>;
}

/**
 * Save a dataset to a YAML file.
 *
 * @param dataset - Dataset to save
 * @param path - Path to write to
 */
export async function saveDataset<TState>(dataset: EvalDataset<TState>, path: string): Promise<void> {
	const yaml = stringifyYaml(dataset, {
		indent: 2,
		lineWidth: 120,
	});
	await writeFile(path, yaml, "utf-8");
}

/**
 * Save eval results to a JSON file.
 *
 * @param result - Dataset or matrix result
 * @param path - Path to write to
 */
export async function saveResult(result: DatasetResult | MatrixResult, path: string): Promise<void> {
	const json = JSON.stringify(result, null, 2);
	await writeFile(path, json, "utf-8");
}

/**
 * Load eval results from a JSON file.
 *
 * @param path - Path to the JSON file
 * @returns Parsed result
 */
export async function loadResult<T = DatasetResult>(path: string): Promise<T> {
	const content = await readFile(path, "utf-8");
	return JSON.parse(content) as T;
}

/**
 * Parse a YAML string directly (useful for inline datasets).
 *
 * @param yaml - YAML string
 * @returns Parsed and validated dataset
 */
export function parseDataset<TState = unknown>(yaml: string): EvalDataset<TState> {
	const parsed = parseYaml(yaml);

	const result = EvalDatasetSchema.safeParse(parsed);

	if (!result.success) {
		const errors = result.error.errors.map((e) => `  - ${e.path.join(".")}: ${e.message}`).join("\n");
		throw new Error(`Invalid dataset:\n${errors}`);
	}

	return result.data as EvalDataset<TState>;
}
