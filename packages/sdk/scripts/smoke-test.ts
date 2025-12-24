#!/usr/bin/env bun
/**
 * Smoke Test - Real-world SDK workflow verification
 *
 * This script:
 * 1. Creates a harness using real SDK agents (CodingAgent + ReviewAgent)
 * 2. Runs a simplified code + review workflow with real LLM calls
 * 3. Verifies the full harness lifecycle works correctly
 *
 * Works with:
 * - Anthropic subscription (no API key needed)
 * - API key (ANTHROPIC_API_KEY env var)
 *
 * Run with: bun packages/sdk/scripts/smoke-test.ts
 */

import {
	BaseHarness,
	CodingAgent,
	ReviewAgent,
	createContainer,
	type CodingResult,
	type StepYield,
} from "../src/index.js";
import type { ReviewResult } from "../src/agents/review-agent.js";

// ============================================
// Types
// ============================================

interface WorkflowState {
	task: string;
	phase: "coding" | "review" | "complete";
	codeResult: CodingResult | null;
	reviewResult: ReviewResult | null;
	iterations: number;
}

type WorkflowInput = { phase: "coding"; task: string } | { phase: "review"; code: CodingResult };
type WorkflowOutput = CodingResult | ReviewResult;

// ============================================
// Code Review Harness
// ============================================

class CodeReviewHarness extends BaseHarness<WorkflowState, WorkflowInput, WorkflowOutput> {
	private coder: CodingAgent;
	private reviewer: ReviewAgent;

	constructor(task: string) {
		super({
			initialState: {
				task,
				phase: "coding",
				codeResult: null,
				reviewResult: null,
				iterations: 0,
			},
		});

		// Create container with live runners
		const container = createContainer({ mode: "live" });
		this.coder = container.get(CodingAgent);
		this.reviewer = container.get(ReviewAgent);
	}

	protected async *execute(): AsyncGenerator<StepYield<WorkflowInput, WorkflowOutput>> {
		const state = this.state.getState();

		console.log("\n📝 Phase 1: Coding");
		console.log(`   Task: ${state.task}`);

		// Step 1: Code the task
		const codeResult = await this.coder.execute(state.task, "smoke-test-session", {
			onText: (_text: string, _event) => process.stdout.write("."),
			onToolCall: (name: string, _input, _event) => console.log(`\n   🔧 Tool: ${name}`),
		});

		console.log(`\n   ✅ Code result: ${codeResult.stopReason}`);

		this.state.updateState((s) => ({
			...s,
			phase: "review",
			codeResult,
			iterations: s.iterations + 1,
		}));

		yield {
			input: { phase: "coding", task: state.task },
			output: codeResult,
		};

		// Step 2: Review the code
		console.log("\n🔍 Phase 2: Review");

		const reviewResult = await this.reviewer.review(state.task, codeResult.summary, "smoke-test-session", {
			onText: (_text: string, _event) => process.stdout.write("."),
		});

		console.log(`\n   Decision: ${reviewResult.decision === "approve" ? "✅ Approved" : "❌ Rejected"}`);
		console.log(`   Feedback: ${reviewResult.feedback.slice(0, 100)}...`);

		this.state.updateState((s) => ({
			...s,
			phase: "complete",
			reviewResult,
		}));

		yield {
			input: { phase: "review", code: codeResult },
			output: reviewResult,
		};
	}

	override isComplete(): boolean {
		return this.state.getState().phase === "complete";
	}
}

// ============================================
// Main
// ============================================

async function main() {
	console.log("\n🧪 Open Harness SDK - Smoke Test");
	console.log("=".repeat(50));

	// Check auth method
	if (process.env.ANTHROPIC_API_KEY) {
		console.log("🔑 Using API key authentication");
	} else {
		console.log("👤 Using subscription authentication (no API key)");
	}

	// Simple task for smoke test
	const task = "Write a function that adds two numbers and returns the result";

	console.log(`\n📋 Task: "${task}"`);

	try {
		const harness = new CodeReviewHarness(task);
		await harness.run();

		const finalState = harness.getState();

		console.log("\n" + "=".repeat(50));
		console.log("📊 Results:");
		console.log(`   Steps completed: ${harness.getCurrentStep()}`);
		console.log(`   Code result: ${finalState.codeResult?.stopReason ?? "N/A"}`);
		console.log(`   Review decision: ${finalState.reviewResult?.decision ?? "N/A"}`);

		// Validate results
		if (!finalState.codeResult) {
			throw new Error("No code result produced");
		}
		if (!finalState.reviewResult) {
			throw new Error("No review result produced");
		}
		if (harness.getCurrentStep() !== 2) {
			throw new Error(`Expected 2 steps, got ${harness.getCurrentStep()}`);
		}

		console.log("\n✅ Smoke test passed!\n");
	} catch (error) {
		console.error("\n❌ Smoke test failed:", error);
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("Smoke test error:", error);
	process.exit(1);
});
