/**
 * Simple Reactive Agent Example
 *
 * This minimal example demonstrates the core v0.3.0 reactive API:
 * - createWorkflow() factory for typed agents
 * - activateOn signal patterns
 * - when guards for conditional activation
 * - emits declarations for signal output
 * - endWhen termination conditions
 *
 * Run: bun run examples/simple-reactive/index.ts
 */

import { ClaudeHarness, createWorkflow } from "@open-harness/core";
import { render } from "../lib/render.js";

// =============================================================================
// 1. Define your state type
// =============================================================================

type GreetingState = {
	name: string;
	greeting: string | null;
	uppercase: boolean;
};

// =============================================================================
// 2. Create a typed harness factory
// =============================================================================

const { agent, runReactive } = createWorkflow<GreetingState>();

// =============================================================================
// 3. Define reactive agents
// =============================================================================

/**
 * Greeter agent - creates a personalized greeting
 */
const greeter = agent({
	prompt: `You are a friendly greeter. Create a warm, personalized greeting for {{ state.name }}.
Keep it brief (one sentence). Just output the greeting, nothing else.`,

	// Activate when workflow starts
	activateOn: ["workflow:start"],

	// Declare what signals this agent emits
	emits: ["greeting:created"],

	// Only activate if we have a name
	when: (ctx) => ctx.state.name.length > 0,

	// No updates here - greeter output is intermediate
});

/**
 * Transformer agent - transforms the greeting based on state
 */
const transformer = agent({
	prompt: `Take this greeting and make it {{ state.uppercase ? "ALL UPPERCASE" : "more enthusiastic with exclamation marks" }}.
Input: {{ signal.payload.output }}
Output only the transformed text.`,

	// Activate when greeter finishes
	activateOn: ["greeting:created"],

	// Declare output
	emits: ["greeting:transformed"],

	// Update state.greeting with transformer output
	// This enables the endWhen condition to trigger
	updates: "greeting",
});

// =============================================================================
// 4. Run the harness
// =============================================================================

async function main() {
	render.banner("Simple Reactive Example", "Demonstrating the core v0.3.0 reactive API.");

	const harness = new ClaudeHarness({
		model: "claude-sonnet-4-20250514",
	});

	const result = await runReactive({
		agents: { greeter, transformer },
		state: {
			name: "World",
			greeting: null,
			uppercase: true,
		},
		harness,
		endWhen: (state) => state.greeting !== null,
		// Infrastructure logging happens automatically via Pino
	});

	// =============================================================================
	// 5. Inspect results (user-facing output via render)
	// =============================================================================

	render.section("Results");
	render.metric("Duration", `${result.metrics.durationMs}ms`);
	render.metric("Activations", result.metrics.activations);
	render.metric("Terminated early", result.terminatedEarly);

	render.section("Signal Flow");
	for (const signal of result.signals) {
		const payload = signal.payload as Record<string, unknown>;
		const agent = payload?.agent ?? "system";
		render.text(`[${agent}] ${signal.name}`);
	}

	render.section("Final State");
	render.metric("Name", result.state.name);
	render.metric("Uppercase", result.state.uppercase);

	// The greeting contains the full provider output
	// Extract the text content for display
	const greetingOutput = result.state.greeting as { content?: string } | string | null;
	const greetingText =
		typeof greetingOutput === "string" ? greetingOutput : (greetingOutput?.content ?? "(no greeting)");
	render.metric("Greeting", greetingText);
}

main().catch((err) => render.error(err.message));
