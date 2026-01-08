/**
 * Simple Coder Workflow
 *
 * A minimal single-node workflow for demonstrating prompt comparison evals.
 * Takes a coding task as input and produces code as output.
 */

import type { FlowDefinition, NodeRegistry, RunMode, SuiteWorkflowFactory } from "@open-harness/core";
import { createClaudeNode } from "@open-harness/server";

/**
 * Input type for the simple coder workflow.
 */
export interface SimpleCoderInput {
	task: string;
}

/**
 * Creates a simple coder workflow for a given case and variant.
 *
 * The workflow consists of a single "coder" node that takes a coding task
 * and produces code output. The system prompt is configurable via variant config.
 *
 * @example
 * ```ts
 * const suite = defineSuite({
 *   name: "prompt-comparison",
 *   flow: simpleCoderWorkflow,
 *   cases: [{ id: "add-numbers", input: { task: "Write a function..." } }],
 *   variants: [
 *     variant("baseline", {
 *       model: "claude-sonnet-4-20250514",
 *       config: { systemPrompt: "You are a helpful coding assistant." }
 *     }),
 *   ],
 * });
 * ```
 */
export const simpleCoderWorkflow: SuiteWorkflowFactory = ({ caseInput, variant }) => {
	const input = caseInput as unknown as SimpleCoderInput;

	// Create the flow definition with a single coder node
	const flow: FlowDefinition = {
		name: "simple-coder",
		nodes: [
			{
				id: "coder",
				type: "claude.agent",
				input: {
					prompt: input.task,
					options: {
						model: variant.model ?? "claude-sonnet-4-20250514",
						systemPrompt: (variant.config?.systemPrompt as string) ?? undefined,
						maxTurns: 10, // Allow multi-turn for agentic behavior
					},
				},
			},
		],
		edges: [], // No edges for single-node workflow
	};

	return {
		flow,
		register(registry: NodeRegistry, _mode: RunMode): void {
			// Register the Claude node
			// In replay mode, we'd inject a mock - for now, always use live
			// TODO: Add replay support using _mode when fixtures are available
			const claudeNode = createClaudeNode({});
			registry.register(claudeNode);
		},
		primaryOutputNodeId: "coder",
	};
};
