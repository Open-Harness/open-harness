/**
 * Mock artifact helpers for eval tests.
 *
 * Provides utilities to create mock EvalArtifacts for testing
 * assertions and scorers without running actual workflows.
 */

import type { RuntimeEvent } from "../../../src/state/events.js";
import type { RunSnapshot } from "../../../src/state/snapshot.js";
import type { EvalArtifact } from "../../../src/eval/types.js";

/**
 * Options for creating a mock artifact.
 */
export type MockArtifactOptions = {
	runId?: string;
	outputs?: Record<string, unknown>;
	state?: Record<string, unknown>;
	nodeStatus?: Record<string, "pending" | "running" | "done" | "failed">;
	events?: RuntimeEvent[];
	// Shorthand options for common patterns
	nodes?: {
		nodeId: string;
		durationMs?: number;
		totalCostUsd?: number;
		inputTokens?: number;
		outputTokens?: number;
		result?: string;
		error?: string;
	}[];
};

/**
 * Create a mock EvalArtifact for testing.
 *
 * @param options - Configuration options
 * @returns Mock artifact
 */
export function createMockArtifact(options?: MockArtifactOptions): EvalArtifact {
	const runId = options?.runId ?? "test-run-123";
	const now = Date.now();

	// Build events from shorthand nodes
	const events: RuntimeEvent[] = options?.events ?? [];
	const outputs: Record<string, unknown> = options?.outputs ?? {};
	const nodeStatus: Record<string, "pending" | "running" | "done" | "failed"> =
		options?.nodeStatus ?? {};

	if (options?.nodes) {
		// Add flow:start
		events.push({
			type: "flow:start",
			flowName: "test-workflow",
			timestamp: now,
		});

		for (const node of options.nodes) {
			// Add node:start
			events.push({
				type: "node:start",
				nodeId: node.nodeId,
				runId,
				timestamp: now,
			});

			// Add agent:start
			events.push({
				type: "agent:start",
				nodeId: node.nodeId,
				runId,
				sessionId: `session-${node.nodeId}`,
				prompt: "Test prompt",
				timestamp: now,
			});

			if (node.error) {
				// Add error event
				events.push({
					type: "agent:error",
					nodeId: node.nodeId,
					runId,
					errorType: "ExecutionError",
					message: node.error,
					timestamp: now + (node.durationMs ?? 1000),
				});
				nodeStatus[node.nodeId] = "failed";
			} else {
				// Add completion event
				events.push({
					type: "agent:complete",
					nodeId: node.nodeId,
					runId,
					result: node.result ?? "Test result",
					usage: {
						inputTokens: node.inputTokens ?? 100,
						outputTokens: node.outputTokens ?? 50,
					},
					totalCostUsd: node.totalCostUsd ?? 0.001,
					durationMs: node.durationMs ?? 1000,
					numTurns: 1,
					timestamp: now + (node.durationMs ?? 1000),
				});

				// Add node:complete
				events.push({
					type: "node:complete",
					nodeId: node.nodeId,
					runId,
					output: node.result ?? "Test result",
					timestamp: now + (node.durationMs ?? 1000),
				});

				outputs[node.nodeId] = { text: node.result ?? "Test result" };
				nodeStatus[node.nodeId] = "done";
			}
		}

		// Add flow:complete
		events.push({
			type: "flow:complete",
			flowName: "test-workflow",
			status: "complete",
			timestamp: now + 5000,
		});
	}

	const snapshot: RunSnapshot = {
		runId,
		status: "complete",
		outputs,
		state: options?.state ?? {},
		nodeStatus,
		edgeStatus: {},
		loopCounters: {},
		inbox: [],
		agentSessions: {},
	};

	return {
		runId,
		snapshot,
		events,
	};
}

/**
 * Create a minimal successful artifact.
 */
export function createSuccessfulArtifact(
	nodeId = "main",
	result = "Hello world",
): EvalArtifact {
	return createMockArtifact({
		nodes: [
			{
				nodeId,
				result,
				durationMs: 1500,
				totalCostUsd: 0.01,
				inputTokens: 200,
				outputTokens: 100,
			},
		],
	});
}

/**
 * Create an artifact with an error.
 */
export function createErrorArtifact(
	nodeId = "main",
	error = "Something went wrong",
): EvalArtifact {
	return createMockArtifact({
		nodes: [
			{
				nodeId,
				error,
				durationMs: 500,
			},
		],
	});
}

/**
 * Create an artifact with multiple nodes.
 */
export function createMultiNodeArtifact(): EvalArtifact {
	return createMockArtifact({
		nodes: [
			{
				nodeId: "coder",
				result: "function hello() { return 'world'; }",
				durationMs: 2000,
				totalCostUsd: 0.02,
				inputTokens: 500,
				outputTokens: 200,
			},
			{
				nodeId: "reviewer",
				result: "LGTM - code is correct and well-formatted",
				durationMs: 1500,
				totalCostUsd: 0.015,
				inputTokens: 400,
				outputTokens: 100,
			},
		],
	});
}

/**
 * Create an artifact with high resource usage.
 */
export function createHighUsageArtifact(): EvalArtifact {
	return createMockArtifact({
		nodes: [
			{
				nodeId: "expensive-node",
				result: "Generated content",
				durationMs: 45000,
				totalCostUsd: 2.5,
				inputTokens: 50000,
				outputTokens: 25000,
			},
		],
	});
}

// ============================================================================
// Phase 7: Workflow factory and recording store mocks
// ============================================================================

import type { NodeRegistry, NodeTypeDefinition } from "../../../src/nodes/index.js";
import type { RecordingStore, RecordingListQuery } from "../../../src/recording/store.js";
import type { Recording, RecordingMetadata } from "../../../src/recording/types.js";
import type { FlowDefinition } from "../../../src/state/index.js";
import type { WorkflowFactory, EvalDataset, EvalVariant, CaseResult, DatasetResult } from "../../../src/eval/types.js";

/**
 * Create a mock workflow factory for testing.
 *
 * Returns a simple flow with a single "mock" node that produces deterministic output.
 */
export function createMockWorkflowFactory(options?: {
	primaryOutputNodeId?: string;
	nodeOutput?: (input: unknown) => unknown;
}): WorkflowFactory {
	return ({ datasetId, caseId, variantId, caseInput }) => ({
		flow: {
			name: `mock-workflow-${datasetId}`,
			nodes: [
				{
					id: options?.primaryOutputNodeId ?? "main",
					type: "mock",
					input: caseInput as Record<string, unknown>,
				},
			],
			edges: [],
		} satisfies FlowDefinition,
		register(registry: NodeRegistry, mode: "record" | "replay" | "live") {
			// Create a mock node type
			const mockNodeDef: NodeTypeDefinition<Record<string, unknown>, Record<string, unknown>> = {
				type: "mock",
				async run(ctx, input) {
					// Emit agent events for metrics
					ctx.emit({
						type: "agent:start",
						nodeId: ctx.nodeId,
						runId: ctx.runId,
						sessionId: `session-${ctx.nodeId}`,
						prompt: "test",
					});

					// Use custom output or default
					let result: unknown;
					try {
						result = options?.nodeOutput?.(input) ?? { text: `Mock output for ${caseId}` };
					} catch (error) {
						// Emit agent:error event so behavior.no_errors assertion detects it
						ctx.emit({
							type: "agent:error",
							nodeId: ctx.nodeId,
							runId: ctx.runId,
							errorType: "ExecutionError",
							message: error instanceof Error ? error.message : String(error),
						});
						throw error;
					}

					ctx.emit({
						type: "agent:complete",
						nodeId: ctx.nodeId,
						runId: ctx.runId,
						result: typeof result === "string" ? result : JSON.stringify(result),
						usage: { inputTokens: 100, outputTokens: 50 },
						totalCostUsd: 0.001,
						durationMs: 1000,
						numTurns: 1,
					});

					return result as Record<string, unknown>;
				},
			};
			registry.register(mockNodeDef);
		},
		primaryOutputNodeId: options?.primaryOutputNodeId ?? "main",
	});
}

/**
 * Create a mock recording store for testing.
 */
export function createMockRecordingStore(): RecordingStore {
	const recordings = new Map<string, Recording<unknown>>();

	return {
		async save<T>(recording: Recording<T>): Promise<void> {
			recordings.set(recording.id, recording as Recording<unknown>);
		},

		async load<T>(id: string): Promise<Recording<T> | null> {
			const recording = recordings.get(id);
			return (recording as Recording<T> | undefined) ?? null;
		},

		async list(query?: RecordingListQuery): Promise<RecordingMetadata[]> {
			const results: RecordingMetadata[] = [];
			for (const recording of recordings.values()) {
				const metadata = recording.metadata;
				if (query?.providerType && metadata.providerType !== query.providerType) {
					continue;
				}
				if (query?.inputHash && metadata.inputHash !== query.inputHash) {
					continue;
				}
				results.push(metadata);
			}
			return results;
		},
	};
}

/**
 * Create a mock dataset for testing.
 */
export function createMockDataset(options?: {
	id?: string;
	numCases?: number;
	workflowName?: string;
}): EvalDataset {
	const numCases = options?.numCases ?? 3;
	const cases = [];

	for (let i = 0; i < numCases; i++) {
		cases.push({
			id: `case-${i + 1}`,
			name: `Test Case ${i + 1}`,
			input: { prompt: `Test input ${i + 1}` },
			assertions: [
				{ type: "behavior.no_errors" as const },
				{ type: "metric.latency_ms.max" as const, value: 30000 },
			],
			tags: i === 0 ? ["smoke"] : undefined,
		});
	}

	return {
		id: options?.id ?? "test-dataset",
		workflowName: options?.workflowName ?? "mock-workflow",
		version: "1.0.0",
		cases,
	};
}

/**
 * Create a mock variant for testing.
 */
export function createMockVariant(options?: {
	id?: string;
	providerType?: string;
	isBaseline?: boolean;
}): EvalVariant {
	return {
		id: options?.id ?? "mock-variant",
		providerTypeByNode: {
			main: options?.providerType ?? "mock",
		},
		tags: options?.isBaseline ? ["baseline"] : undefined,
	};
}

/**
 * Create a mock CaseResult for testing compare functions.
 */
export function createMockCaseResult(options?: {
	caseId?: string;
	variantId?: string;
	passed?: boolean;
	overallScore?: number;
	durationMs?: number;
	costUsd?: number;
	error?: string;
}): CaseResult {
	const artifact = createMockArtifact({
		nodes: [
			{
				nodeId: "main",
				result: options?.passed !== false ? "Success" : undefined,
				error: options?.passed === false ? (options?.error ?? "Test failure") : undefined,
				durationMs: options?.durationMs ?? 1000,
				totalCostUsd: options?.costUsd ?? 0.001,
				inputTokens: 100,
				outputTokens: 50,
			},
		],
	});

	return {
		caseId: options?.caseId ?? "test-case",
		variantId: options?.variantId ?? "test-variant",
		artifact,
		assertionResults: [
			{
				assertion: { type: "behavior.no_errors" },
				passed: options?.passed ?? true,
				message: options?.passed === false ? "Errors found" : undefined,
			},
		],
		scores: {
			overall: options?.overallScore ?? (options?.passed !== false ? 0.8 : 0.2),
			scores: [
				{ name: "latency", value: 0.9, rawValue: options?.durationMs ?? 1000 },
				{ name: "cost", value: 0.95, rawValue: options?.costUsd ?? 0.001 },
			],
		},
		passed: options?.passed ?? true,
		error: options?.error,
	};
}

/**
 * Create a mock DatasetResult for testing compare and report functions.
 */
export function createMockDatasetResult(options?: {
	datasetId?: string;
	variantId?: string;
	numCases?: number;
	passRate?: number;
}): DatasetResult {
	const numCases = options?.numCases ?? 3;
	const passRate = options?.passRate ?? 1.0;
	const numPassing = Math.round(numCases * passRate);

	const caseResults: CaseResult[] = [];
	for (let i = 0; i < numCases; i++) {
		caseResults.push(
			createMockCaseResult({
				caseId: `case-${i + 1}`,
				variantId: options?.variantId ?? "test-variant",
				passed: i < numPassing,
			}),
		);
	}

	return {
		datasetId: options?.datasetId ?? "test-dataset",
		variantId: options?.variantId ?? "test-variant",
		caseResults,
		summary: {
			total: numCases,
			passed: numPassing,
			failed: numCases - numPassing,
			passRate,
		},
	};
}
