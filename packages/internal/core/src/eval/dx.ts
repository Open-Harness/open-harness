/**
 * DX layer for Open Harness eval system.
 *
 * Provides an ergonomic API for defining and running eval suites:
 *
 * - `defineSuite()` - Define a suite with cases, variants, and gates
 * - `variant()` - Create variant definitions
 * - `gates` - Pre-built gate factories
 * - `runSuite()` - Execute a suite and evaluate gates
 *
 * @example
 * ```ts
 * const suite = defineSuite({
 *   name: "coder-reviewer",
 *   flow: myWorkflowFactory,
 *   cases: [{ id: "test-1", input: { task: "..." } }],
 *   variants: [
 *     variant("claude/sonnet", { model: "claude-3-5-sonnet-latest" }),
 *     variant("claude/opus", { model: "claude-3-opus-latest" }),
 *   ],
 *   baseline: "claude/sonnet",
 *   gates: [gates.passRate(0.9), gates.noRegressions()],
 * });
 *
 * const report = await runSuite(suite, { mode: "replay" });
 * ```
 */

import { InMemoryRecordingStore } from "../recording/index.js";
import type { RecordingStore } from "../recording/index.js";
import type { RunStore } from "../persistence/index.js";
import { createEvalEngine } from "./engine.js";
import type { EvalDataset, EvalVariant, WorkflowFactory, MatrixResult } from "./types.js";
import type { RunMode } from "./runner.js";
import type {
	Suite,
	SuiteConfig,
	SuiteCase,
	SuiteRunOptions,
	SuiteReport,
	SuiteReportSummary,
	VariantDef,
	VariantOptions,
	Gate,
	GateResult,
} from "./dx-types.js";

// ============================================================================
// defineSuite
// ============================================================================

/**
 * Define an eval suite.
 *
 * Validates the configuration and prepares it for execution.
 *
 * @param config - Suite configuration
 * @returns Validated suite definition
 *
 * @example
 * ```ts
 * const suite = defineSuite({
 *   name: "my-workflow",
 *   flow: myWorkflowFactory,
 *   cases: [{ id: "basic", input: { task: "test" } }],
 *   variants: [variant("baseline", { model: "claude-3-5-sonnet-latest" })],
 * });
 * ```
 */
export function defineSuite(config: SuiteConfig): Suite {
	// Validate configuration
	if (!config.name || config.name.trim() === "") {
		throw new Error("Suite name is required");
	}
	if (!config.flow) {
		throw new Error("Suite flow factory is required");
	}
	if (!config.cases || config.cases.length === 0) {
		throw new Error("Suite must have at least one case");
	}
	if (!config.variants || config.variants.length === 0) {
		throw new Error("Suite must have at least one variant");
	}

	// Validate case IDs are unique
	const caseIds = new Set<string>();
	for (const c of config.cases) {
		if (caseIds.has(c.id)) {
			throw new Error(`Duplicate case ID: ${c.id}`);
		}
		caseIds.add(c.id);
	}

	// Validate variant IDs are unique
	const variantIds = new Set<string>();
	for (const v of config.variants) {
		if (variantIds.has(v.id)) {
			throw new Error(`Duplicate variant ID: ${v.id}`);
		}
		variantIds.add(v.id);
	}

	// Validate baseline exists if specified
	if (config.baseline && !variantIds.has(config.baseline)) {
		throw new Error(
			`Baseline variant "${config.baseline}" not found in variants`,
		);
	}

	return {
		config,
		validated: true,
	};
}

// ============================================================================
// variant
// ============================================================================

/**
 * Create a variant definition.
 *
 * @param id - Unique variant identifier
 * @param options - Variant configuration
 * @returns Variant definition
 *
 * @example
 * ```ts
 * // Simple variant with model
 * variant("claude/sonnet", { model: "claude-3-5-sonnet-latest" })
 *
 * // Variant with per-node model overrides
 * variant("mixed", {
 *   modelByNode: {
 *     coder: "claude-3-5-sonnet-latest",
 *     reviewer: "claude-3-opus-latest",
 *   }
 * })
 * ```
 */
export function variant(id: string, options: VariantOptions = {}): VariantDef {
	return {
		id,
		model: options.model,
		modelByNode: options.modelByNode,
		providerTypeByNode: options.providerTypeByNode,
		tags: options.tags,
		config: options.config,
	};
}

// ============================================================================
// gates
// ============================================================================

/**
 * Pre-built gate factories for common pass/fail conditions.
 */
export const gates = {
	/**
	 * Gate that passes if there are no regressions compared to baseline.
	 *
	 * @param options - Optional configuration
	 */
	noRegressions(options?: { allowMetricRegressions?: boolean }): Gate {
		return {
			name: "no-regressions",
			description: "No regressions compared to baseline",
			evaluate(result: MatrixResult): GateResult {
				if (!result.comparison) {
					return {
						name: "no-regressions",
						passed: true,
						message: "No baseline comparison available",
					};
				}

				const regressions = options?.allowMetricRegressions
					? result.comparison.regressions.filter((r) => r.type === "assertion")
					: result.comparison.regressions;

				const passed = regressions.length === 0;
				return {
					name: "no-regressions",
					passed,
					message: passed
						? "No regressions detected"
						: `${regressions.length} regression(s) detected`,
					details: {
						regressions: regressions.map((r) => ({
							caseId: r.caseId,
							type: r.type,
							description: r.description,
						})),
					},
				};
			},
		};
	},

	/**
	 * Gate that passes if pass rate meets the threshold.
	 *
	 * @param threshold - Minimum pass rate (0-1)
	 * @param options - Optional configuration
	 */
	passRate(threshold: number, options?: { perVariant?: boolean }): Gate {
		if (threshold < 0 || threshold > 1) {
			throw new Error("Pass rate threshold must be between 0 and 1");
		}

		return {
			name: "pass-rate",
			description: `Pass rate >= ${(threshold * 100).toFixed(0)}%`,
			evaluate(result: MatrixResult): GateResult {
				if (options?.perVariant) {
					// Check each variant individually
					const failures: string[] = [];
					for (const vr of result.variantResults) {
						if (vr.summary.passRate < threshold) {
							failures.push(
								`${vr.variantId}: ${(vr.summary.passRate * 100).toFixed(1)}%`,
							);
						}
					}
					const passed = failures.length === 0;
					return {
						name: "pass-rate",
						passed,
						message: passed
							? `All variants meet ${(threshold * 100).toFixed(0)}% pass rate`
							: `Variants below threshold: ${failures.join(", ")}`,
						details: { threshold, failures },
					};
				}

				// Check aggregate pass rate
				let totalPassed = 0;
				let totalCases = 0;
				for (const vr of result.variantResults) {
					totalPassed += vr.summary.passed;
					totalCases += vr.summary.total;
				}
				const actualRate = totalCases > 0 ? totalPassed / totalCases : 0;
				const passed = actualRate >= threshold;

				return {
					name: "pass-rate",
					passed,
					message: passed
						? `Pass rate ${(actualRate * 100).toFixed(1)}% >= ${(threshold * 100).toFixed(0)}%`
						: `Pass rate ${(actualRate * 100).toFixed(1)}% < ${(threshold * 100).toFixed(0)}%`,
					details: { threshold, actual: actualRate },
				};
			},
		};
	},

	/**
	 * Gate that passes if max latency is under the threshold.
	 *
	 * @param maxMs - Maximum latency in milliseconds
	 */
	latencyUnder(maxMs: number): Gate {
		return {
			name: "latency-under",
			description: `Max latency < ${maxMs}ms`,
			evaluate(result: MatrixResult): GateResult {
				let maxLatency = 0;
				let worstCase = "";
				let worstVariant = "";

				for (const vr of result.variantResults) {
					for (const cr of vr.caseResults) {
						const latencyScore = cr.scores.scores.find(
							(s) => s.name === "latency",
						);
						if (latencyScore?.rawValue && typeof latencyScore.rawValue === "number") {
							if (latencyScore.rawValue > maxLatency) {
								maxLatency = latencyScore.rawValue;
								worstCase = cr.caseId;
								worstVariant = cr.variantId;
							}
						}
					}
				}

				const passed = maxLatency < maxMs;
				return {
					name: "latency-under",
					passed,
					message: passed
						? `Max latency ${maxLatency}ms < ${maxMs}ms`
						: `Max latency ${maxLatency}ms >= ${maxMs}ms (${worstVariant}/${worstCase})`,
					details: { maxMs, actual: maxLatency, worstCase, worstVariant },
				};
			},
		};
	},

	/**
	 * Gate that passes if total cost is under the threshold.
	 *
	 * @param maxUsd - Maximum cost in USD
	 */
	costUnder(maxUsd: number): Gate {
		return {
			name: "cost-under",
			description: `Max cost < $${maxUsd}`,
			evaluate(result: MatrixResult): GateResult {
				let maxCost = 0;
				let worstCase = "";
				let worstVariant = "";

				for (const vr of result.variantResults) {
					for (const cr of vr.caseResults) {
						const costScore = cr.scores.scores.find((s) => s.name === "cost");
						if (costScore?.rawValue && typeof costScore.rawValue === "number") {
							if (costScore.rawValue > maxCost) {
								maxCost = costScore.rawValue;
								worstCase = cr.caseId;
								worstVariant = cr.variantId;
							}
						}
					}
				}

				const passed = maxCost < maxUsd;
				return {
					name: "cost-under",
					passed,
					message: passed
						? `Max cost $${maxCost.toFixed(4)} < $${maxUsd}`
						: `Max cost $${maxCost.toFixed(4)} >= $${maxUsd} (${worstVariant}/${worstCase})`,
					details: { maxUsd, actual: maxCost, worstCase, worstVariant },
				};
			},
		};
	},

	/**
	 * Gate that passes if all specified cases pass.
	 *
	 * @param caseIds - Case IDs that must pass
	 */
	requiredCases(caseIds: string[]): Gate {
		return {
			name: "required-cases",
			description: `Required cases: ${caseIds.join(", ")}`,
			evaluate(result: MatrixResult): GateResult {
				const failures: string[] = [];

				for (const caseId of caseIds) {
					for (const vr of result.variantResults) {
						const cr = vr.caseResults.find((c) => c.caseId === caseId);
						if (cr && !cr.passed) {
							failures.push(`${vr.variantId}/${caseId}`);
						}
					}
				}

				const passed = failures.length === 0;
				return {
					name: "required-cases",
					passed,
					message: passed
						? `All required cases passed`
						: `Required cases failed: ${failures.join(", ")}`,
					details: { required: caseIds, failures },
				};
			},
		};
	},

	/**
	 * Create a custom gate from a function.
	 *
	 * @param name - Gate name
	 * @param description - Gate description
	 * @param evaluateFn - Evaluation function
	 */
	custom(
		name: string,
		description: string,
		evaluateFn: (result: MatrixResult) => { passed: boolean; message: string; details?: Record<string, unknown> },
	): Gate {
		return {
			name,
			description,
			evaluate(result: MatrixResult): GateResult {
				const evalResult = evaluateFn(result);
				return {
					name,
					passed: evalResult.passed,
					message: evalResult.message,
					details: evalResult.details,
				};
			},
		};
	},
};

// ============================================================================
// runSuite
// ============================================================================

/**
 * Run an eval suite and evaluate gates.
 *
 * @param suite - Suite definition from defineSuite()
 * @param options - Run options
 * @returns Suite report with results and gate evaluations
 *
 * @example
 * ```ts
 * const report = await runSuite(suite, { mode: "replay" });
 *
 * if (!report.passed) {
 *   console.log("Suite failed!");
 *   for (const gate of report.gateResults) {
 *     if (!gate.passed) {
 *       console.log(`Gate "${gate.name}" failed: ${gate.message}`);
 *     }
 *   }
 * }
 * ```
 */
export async function runSuite(
	suite: Suite,
	options: SuiteRunOptions,
): Promise<SuiteReport> {
	const { config } = suite;

	// Build EvalDataset from suite config
	const dataset = buildDataset(config, options);

	// Build EvalVariants from suite config
	const variants = buildVariants(config, options);

	// Build WorkflowFactory adapter
	const workflowFactory = buildWorkflowFactory(config);

	// Determine baseline
	const baseline = options.baseline ?? config.baseline;

	// Create recording store (use provided or create in-memory)
	const recordingStore: RecordingStore =
		options.recordingStore ?? new InMemoryRecordingStore();

	// Create eval engine
	const engine = createEvalEngine({
		recordingStore,
		runStore: options.runStore,
		workflowFactory,
		scorers: config.scorers,
		hooks: config.hooks,
	});

	// Run the matrix
	const matrixResult = await engine.runMatrix({
		dataset,
		variants,
		mode: options.mode,
		baselineVariantId: baseline,
	});

	// Evaluate gates
	const gateResults = evaluateGates(config.gates ?? [], matrixResult);

	// Build summary
	const summary = buildSummary(matrixResult, gateResults);

	// Determine overall pass/fail
	const passed = gateResults.every((g) => g.passed);

	return {
		suiteName: config.name,
		matrixResult,
		gateResults,
		passed,
		summary,
	};
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Build EvalDataset from suite config.
 */
function buildDataset(config: SuiteConfig, options: SuiteRunOptions): EvalDataset {
	let cases = config.cases;

	// Filter by case IDs if specified
	if (options.filterCases && options.filterCases.length > 0) {
		const filterSet = new Set(options.filterCases);
		cases = cases.filter((c) => filterSet.has(c.id));
	}

	// Filter by tags if specified
	if (options.filterTags && options.filterTags.length > 0) {
		const filterSet = new Set(options.filterTags);
		cases = cases.filter((c) => c.tags?.some((t) => filterSet.has(t)));
	}

	return {
		id: config.name,
		workflowName: config.name,
		version: config.version ?? "1.0.0",
		cases: cases.map((c) => ({
			id: c.id,
			name: c.name,
			input: c.input,
			assertions: [...(config.defaultAssertions ?? []), ...(c.assertions ?? [])],
			tags: c.tags,
		})),
	};
}

/**
 * Build EvalVariants from suite config.
 */
function buildVariants(config: SuiteConfig, _options: SuiteRunOptions): EvalVariant[] {
	return config.variants.map((v) => ({
		id: v.id,
		providerTypeByNode: v.providerTypeByNode ?? {},
		modelByNode: v.model
			? {} // Will be applied via config
			: v.modelByNode ?? {},
		tags: v.tags,
	}));
}

/**
 * Build WorkflowFactory adapter from suite's flow factory.
 */
function buildWorkflowFactory(config: SuiteConfig): WorkflowFactory {
	return ({ datasetId, caseId, variantId, caseInput }) => {
		// Find the variant definition
		const variantDef = config.variants.find((v) => v.id === variantId);
		if (!variantDef) {
			throw new Error(`Variant "${variantId}" not found`);
		}

		// Call the suite's workflow factory
		return config.flow({
			caseId,
			caseInput: caseInput as Record<string, unknown>,
			variant: variantDef,
		});
	};
}

/**
 * Evaluate all gates against the matrix result.
 */
function evaluateGates(gates: Gate[], result: MatrixResult): GateResult[] {
	return gates.map((gate) => gate.evaluate(result));
}

/**
 * Build summary statistics from matrix result and gate results.
 */
function buildSummary(
	matrixResult: MatrixResult,
	gateResults: GateResult[],
): SuiteReportSummary {
	let totalCases = 0;
	let passedCases = 0;

	for (const vr of matrixResult.variantResults) {
		totalCases += vr.summary.total;
		passedCases += vr.summary.passed;
	}

	return {
		totalCases,
		passedCases,
		failedCases: totalCases - passedCases,
		passRate: totalCases > 0 ? passedCases / totalCases : 0,
		gatesPassed: gateResults.filter((g) => g.passed).length,
		totalGates: gateResults.length,
		regressions: matrixResult.comparison?.regressions.length ?? 0,
	};
}
