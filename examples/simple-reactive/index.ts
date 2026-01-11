/**
 * Simple Reactive Agent Example
 *
 * This minimal example demonstrates the core v0.3.0 reactive API:
 * - createHarness() factory for typed agents
 * - activateOn signal patterns
 * - when guards for conditional activation
 * - emits declarations for signal output
 * - endWhen termination conditions
 *
 * Run: bun run examples/simple-reactive/index.ts
 */

import { ClaudeProvider, createHarness } from "@open-harness/core";

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

const { agent, runReactive } = createHarness<GreetingState>();

// =============================================================================
// 3. Define reactive agents
// =============================================================================

/**
 * Greeter agent - creates a personalized greeting
 */
const greeter = agent({
	prompt: `You are a friendly greeter. Create a warm, personalized greeting for {{ state.name }}.
Keep it brief (one sentence). Just output the greeting, nothing else.`,

	// Activate when harness starts
	activateOn: ["harness:start"],

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
	console.log("Starting Simple Reactive Example...\n");

	const provider = new ClaudeProvider({
		model: "claude-sonnet-4-20250514",
	});

	const result = await runReactive({
		agents: { greeter, transformer },
		state: {
			name: "World",
			greeting: null,
			uppercase: true,
		},
		provider,
		endWhen: (state) => state.greeting !== null,
	});

	// =============================================================================
	// 5. Inspect results
	// =============================================================================

	console.log("=== Results ===\n");
	console.log(`Duration: ${result.metrics.durationMs}ms`);
	console.log(`Activations: ${result.metrics.activations}`);
	console.log(`Terminated early: ${result.terminatedEarly}`);

	console.log("\n=== Signal Flow ===\n");
	for (const signal of result.signals) {
		const payload = signal.payload as Record<string, unknown>;
		const agent = payload?.agent ?? "system";
		console.log(`[${agent}] ${signal.name}`);
	}

	console.log("\n=== Final State ===\n");
	console.log(`Name: ${result.state.name}`);
	console.log(`Uppercase: ${result.state.uppercase}`);

	// The greeting contains the full provider output
	// Extract the text content for display
	const greetingOutput = result.state.greeting as { content?: string } | string | null;
	const greetingText =
		typeof greetingOutput === "string" ? greetingOutput : (greetingOutput?.content ?? "(no greeting)");
	console.log(`Greeting: ${greetingText}`);
}

main().catch(console.error);
