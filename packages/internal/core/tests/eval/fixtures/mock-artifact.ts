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
