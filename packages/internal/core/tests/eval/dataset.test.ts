import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	loadDataset,
	loadDatasetFromFile,
	validateDataset,
	discoverDatasets,
	DatasetValidationError,
} from "../../src/eval/dataset.js";
import type { EvalDataset } from "../../src/eval/types.js";

describe("eval/dataset", () => {
	describe("loadDataset", () => {
		it("should load valid dataset JSON", () => {
			const json = {
				id: "test-dataset",
				workflowName: "test-workflow",
				version: "1.0.0",
				cases: [
					{
						id: "case-1",
						input: { prompt: "Hello" },
						assertions: [{ type: "behavior.no_errors" }],
					},
				],
			};

			const dataset = loadDataset(json);

			expect(dataset.id).toBe("test-dataset");
			expect(dataset.cases.length).toBe(1);
			expect(dataset.cases[0]!.id).toBe("case-1");
		});

		it("should throw on missing required field (id)", () => {
			const json = {
				workflowName: "test-workflow",
				version: "1.0.0",
				cases: [{ id: "case-1", input: {}, assertions: [] }],
			};

			expect(() => loadDataset(json)).toThrow(DatasetValidationError);
		});

		it("should throw on missing required field (workflowName)", () => {
			const json = {
				id: "test",
				version: "1.0.0",
				cases: [{ id: "case-1", input: {}, assertions: [] }],
			};

			expect(() => loadDataset(json)).toThrow(DatasetValidationError);
		});

		it("should throw on empty cases array", () => {
			const json = {
				id: "test",
				workflowName: "test",
				version: "1.0.0",
				cases: [],
			};

			expect(() => loadDataset(json)).toThrow(DatasetValidationError);
		});

		it("should throw on duplicate case IDs", () => {
			const json = {
				id: "test",
				workflowName: "test",
				version: "1.0.0",
				cases: [
					{ id: "same-id", input: {}, assertions: [] },
					{ id: "same-id", input: {}, assertions: [] },
				],
			};

			expect(() => loadDataset(json)).toThrow(DatasetValidationError);
		});

		it("should throw on invalid case ID format", () => {
			const json = {
				id: "test",
				workflowName: "test",
				version: "1.0.0",
				cases: [{ id: "invalid id with spaces", input: {}, assertions: [] }],
			};

			expect(() => loadDataset(json)).toThrow(DatasetValidationError);
		});

		it("should throw on invalid assertion type", () => {
			const json = {
				id: "test",
				workflowName: "test",
				version: "1.0.0",
				cases: [
					{
						id: "case-1",
						input: {},
						assertions: [{ type: "invalid.type" }],
					},
				],
			};

			expect(() => loadDataset(json)).toThrow(DatasetValidationError);
		});

		it("should accept all valid assertion types", () => {
			const json = {
				id: "test",
				workflowName: "test",
				version: "1.0.0",
				cases: [
					{
						id: "case-1",
						input: {},
						assertions: [
							{ type: "behavior.no_errors" },
							{ type: "output.contains", path: "outputs.main", value: "test" },
							{ type: "output.equals", path: "state.x", value: 42 },
							{ type: "metric.latency_ms.max", value: 30000 },
							{ type: "metric.total_cost_usd.max", value: 1.0 },
							{ type: "metric.tokens.input.max", value: 10000 },
							{ type: "metric.tokens.output.max", value: 5000 },
							{ type: "behavior.node_executed", nodeId: "main" },
							{ type: "behavior.node_invocations.max", nodeId: "main", value: 3 },
						],
					},
				],
			};

			const dataset = loadDataset(json);
			expect(dataset.cases[0]!.assertions.length).toBe(9);
		});

		it("should include error details in thrown exception", () => {
			const json = { invalid: "data" };

			try {
				loadDataset(json);
				expect.unreachable("Should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(DatasetValidationError);
				const validationError = error as DatasetValidationError;
				expect(validationError.issues.length).toBeGreaterThan(0);
			}
		});
	});

	describe("validateDataset", () => {
		it("should return valid for correct dataset", () => {
			const dataset: EvalDataset = {
				id: "test",
				workflowName: "test",
				version: "1.0.0",
				cases: [
					{
						id: "case-1",
						input: {},
						assertions: [{ type: "behavior.no_errors" }],
					},
				],
			};

			const result = validateDataset(dataset);

			expect(result.valid).toBe(true);
			expect(result.errors.length).toBe(0);
		});

		it("should return warning for duplicate case IDs", () => {
			// Note: validateDataset catches duplicates as warnings since dataset is already loaded
			const dataset: EvalDataset = {
				id: "test",
				workflowName: "test",
				version: "1.0.0",
				cases: [
					{ id: "case-1", input: {}, assertions: [] },
					{ id: "case-1", input: {}, assertions: [] },
				],
			};

			const result = validateDataset(dataset);

			expect(result.warnings.some((w) => w.includes("Duplicate"))).toBe(true);
		});

		it("should return warning for case without assertions", () => {
			const dataset: EvalDataset = {
				id: "test",
				workflowName: "test",
				version: "1.0.0",
				cases: [{ id: "case-1", input: {}, assertions: [] }],
			};

			const result = validateDataset(dataset);

			expect(result.warnings.some((w) => w.includes("no assertions"))).toBe(
				true,
			);
		});
	});

	describe("discoverDatasets", () => {
		let tempDir: string;

		beforeEach(async () => {
			tempDir = await mkdtemp(join(tmpdir(), "eval-test-"));
		});

		afterEach(async () => {
			await rm(tempDir, { recursive: true, force: true });
		});

		it("should find JSON files in directory", async () => {
			await writeFile(join(tempDir, "dataset1.json"), "{}");
			await writeFile(join(tempDir, "dataset2.json"), "{}");

			const files = await discoverDatasets(tempDir, fs, path);

			expect(files.length).toBe(2);
			expect(files.some((f) => f.endsWith("dataset1.json"))).toBe(true);
			expect(files.some((f) => f.endsWith("dataset2.json"))).toBe(true);
		});

		it("should ignore non-JSON files", async () => {
			await writeFile(join(tempDir, "dataset.json"), "{}");
			await writeFile(join(tempDir, "readme.md"), "# Readme");
			await writeFile(join(tempDir, "script.ts"), "// code");

			const files = await discoverDatasets(tempDir, fs, path);

			expect(files.length).toBe(1);
			expect(files[0]).toContain("dataset.json");
		});

		it("should return empty array for non-existent directory", async () => {
			const files = await discoverDatasets("/non/existent/path", fs, path);

			expect(files).toEqual([]);
		});
	});

	describe("loadDatasetFromFile", () => {
		let tempDir: string;

		beforeEach(async () => {
			tempDir = await mkdtemp(join(tmpdir(), "eval-test-"));
		});

		afterEach(async () => {
			await rm(tempDir, { recursive: true, force: true });
		});

		it("should load dataset from file path", async () => {
			const datasetJson = {
				id: "file-dataset",
				workflowName: "test",
				version: "1.0.0",
				cases: [{ id: "case-1", input: {}, assertions: [] }],
			};

			const filePath = join(tempDir, "test-dataset.json");
			await writeFile(filePath, JSON.stringify(datasetJson));

			const dataset = await loadDatasetFromFile(filePath, fs);

			expect(dataset.id).toBe("file-dataset");
		});
	});
});
