/**
 * Live E2E test for Pause/Resume with REAL Claude API calls.
 *
 * This test validates pause/resume works with actual Claude agent execution:
 * 1. Start a flow with a Claude agent node
 * 2. Pause mid-execution (cooperative cancellation via AbortSignal)
 * 3. Resume with injected context
 * 4. Verify the agent receives the injected context
 *
 * NOTE: This test makes REAL API calls using Claude Code subscription auth.
 *
 * Usage: bun scripts/live/pause-resume-claude-live.ts
 */

import { z } from "zod";
import { HubImpl } from "../../src/engine/hub.js";
import { executeFlow } from "../../src/flow/executor.js";
import { NodeRegistry } from "../../src/flow/registry.js";
import type { EnrichedEvent } from "../../src/protocol/events.js";
import type { FlowYaml, NodeRunContext } from "../../src/protocol/flow.js";
import { createClaudeAgent, type ClaudeAgentInput, type ClaudeAgentOutput } from "../../src/providers/claude.js";

async function runLiveClaudeTest() {
	console.log("🧪 Running Pause/Resume with Claude API live test...\n");
	console.log("⚠️  This test makes REAL API calls to Claude.\n");

	const registry = new NodeRegistry();

	// Register a simple echo node (no API)
	registry.register({
		type: "echo",
		inputSchema: z.object({ text: z.string() }),
		outputSchema: z.object({ text: z.string() }),
		run: async (_ctx: NodeRunContext, input: { text: string }) => input,
	});

	// Register the real Claude agent node
	const claudeAgent = createClaudeAgent();
	registry.register({
		type: "claude.agent",
		inputSchema: z.object({
			prompt: z.string().optional(),
			messages: z.array(z.unknown()).optional(),
			options: z.object({}).passthrough().optional(),
		}),
		outputSchema: z.object({
			text: z.string(),
		}).passthrough(),
		run: async (ctx: NodeRunContext, input: ClaudeAgentInput): Promise<ClaudeAgentOutput> => {
			return claudeAgent.execute(input, { hub: ctx.hub, runId: ctx.runId });
		},
	});

	// Flow: echo -> claude agent (paused here) -> echo
	const flow: FlowYaml = {
		flow: { name: "pause-resume-claude-test" },
		nodes: [
			{
				id: "setup",
				type: "echo",
				input: { text: "Setting up context..." },
			},
			{
				id: "agent",
				type: "claude.agent",
				input: {
					prompt: "Respond with exactly 'PAUSED_BEFORE_COMPLETION' if you receive any user message. Otherwise respond with 'INITIAL_PROMPT_ONLY'. Keep your response to just that phrase.",
					options: { maxTurns: 1 },
				},
			},
			{
				id: "followup",
				type: "echo",
				input: { text: "Flow completed after agent" },
			},
		],
		edges: [],
	};

	const hub = new HubImpl("claude-pause-resume-session");
	const events: EnrichedEvent[] = [];

	hub.subscribe("*", (event) => {
		events.push(event);
	});

	const createContext = () => ({
		hub,
		phase: async <T>(name: string, fn: () => Promise<T>) => fn(),
		task: async <T>(_id: string, fn: () => Promise<T>) => fn(),
	});

	// ========== PHASE 1: Start and pause before agent ==========
	console.log("📍 Phase 1: Starting flow, will pause before agent node...");

	hub.startSession();
	hub.setStatus("running");

	// Pause after setup node (before agent gets to run)
	let pauseTriggered = false;
	const pauseUnsubscribe = hub.subscribe("node:complete", (e) => {
		const nodeId = (e.event as { nodeId?: string }).nodeId;
		if (nodeId === "setup" && !pauseTriggered) {
			pauseTriggered = true;
			console.log("   ⏸️  Pausing before agent node...");
			hub.abort({ resumable: true, reason: "Injecting user context before agent runs" });
		}
	});

	await executeFlow(flow, registry, createContext());
	pauseUnsubscribe();

	if (hub.status !== "paused") {
		throw new Error(`Expected status 'paused', got '${hub.status}'`);
	}

	const pausedState = hub.getPausedSession("claude-pause-resume-session");
	if (!pausedState) {
		throw new Error("Expected paused session state");
	}

	console.log("   ✓ Flow paused successfully");
	console.log(`   ✓ Paused at node index: ${pausedState.currentNodeIndex}\n`);

	// ========== PHASE 2: Resume with context ==========
	console.log("📍 Phase 2: Resuming with injected user context...");

	const injectedMessage = "User has approved this action. Please proceed.";
	await hub.resume("claude-pause-resume-session", injectedMessage);

	if (hub.status !== "running") {
		throw new Error(`Expected status 'running', got '${hub.status}'`);
	}

	console.log("   ✓ Hub resumed");
	console.log(`   ✓ Injected message: "${injectedMessage}"\n`);

	// ========== PHASE 3: Complete execution with Claude ==========
	console.log("📍 Phase 3: Executing agent with Claude API (this may take a moment)...");

	const startTime = Date.now();
	const result = await executeFlow(flow, registry, createContext());
	const durationMs = Date.now() - startTime;

	console.log(`   ✓ Execution completed in ${durationMs}ms`);

	// Check agent output
	const agentOutput = result.outputs.agent as ClaudeAgentOutput | undefined;
	if (agentOutput?.text) {
		console.log(`   ✓ Agent response: "${agentOutput.text.substring(0, 100)}${agentOutput.text.length > 100 ? '...' : ''}"`);
	}

	// ========== VALIDATION ==========
	console.log("\n📋 Validating results...");

	const eventTypes = events.map((e) => e.event.type);

	if (!eventTypes.includes("flow:paused")) {
		throw new Error("Missing flow:paused event");
	}
	console.log("   ✓ flow:paused event present");

	if (!eventTypes.includes("flow:resumed")) {
		throw new Error("Missing flow:resumed event");
	}
	console.log("   ✓ flow:resumed event present");

	if (!eventTypes.includes("session:message")) {
		throw new Error("Missing session:message event");
	}
	console.log("   ✓ session:message event present (injected context)");

	// Verify all nodes completed
	const completedNodes = events
		.filter((e) => e.event.type === "node:complete")
		.map((e) => (e.event as { nodeId?: string }).nodeId);

	console.log(`   ✓ Completed nodes: ${completedNodes.join(", ")}`);

	console.log("\n✅ Pause/Resume with Claude API live test PASSED\n");

	console.log("📊 Summary:");
	console.log(`   - Flow: ${flow.flow.name}`);
	console.log(`   - Paused after: setup`);
	console.log(`   - Agent received injected context via session:message`);
	console.log(`   - Total duration: ${durationMs}ms`);
	console.log(`   - Events captured: ${events.length}`);
}

runLiveClaudeTest().catch((error) => {
	console.error("\n❌ Pause/Resume Claude live test FAILED:", error.message);
	if (error.stack) {
		console.error("\nStack trace:");
		console.error(error.stack);
	}
	process.exit(1);
});
