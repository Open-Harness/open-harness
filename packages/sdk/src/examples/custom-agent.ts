/**
 * Example: Custom Agent Creation
 *
 * Shows THREE ways to create custom agents:
 * 1. Simple config-based agent (easiest)
 * 2. Config with state and template variables
 * 3. Class-based agent (most powerful)
 */

import type { IAgentRunner } from "../core/tokens.js";
import { BaseAgent, createAgent } from "../index.js";

// ============================================
// Method 1: Simple Config-Based Agent
// ============================================

async function simpleConfigAgent() {
	console.log("=== Method 1: Simple Config Agent ===\n");

	const summarizer = createAgent({
		name: "Summarizer",
		prompt: "You are a text summarization expert. Summarize the following in 2-3 sentences: {{text}}",
		model: "haiku",
	});

	await summarizer.run("Dependency injection is a design pattern...", "session_1", {
		callbacks: {
			onText: (content) => console.log(`Summary: ${content}`),
		},
	});
}

// ============================================
// Method 2: Config with State
// ============================================

async function configWithState() {
	console.log("\n=== Method 2: Config with State ===\n");

	const expert = createAgent({
		name: "DomainExpert",
		prompt: "You are a {{domain}} expert with {{years}} years of experience. Answer this: {{question}}",
		model: "haiku",
		state: {
			domain: "TypeScript",
			years: 10,
		},
	});

	await expert.run("What is dependency injection?", "session_2", {
		callbacks: {
			onText: (content) => console.log(`Expert: ${content}`),
		},
	});
}

// ============================================
// Method 3: Class-Based Agent (Advanced)
// ============================================

class DataAnalyzer extends BaseAgent {
	private analysisHistory: string[] = [];

	constructor(runner: IAgentRunner) {
		super("DataAnalyzer", runner);
	}

	/**
	 * Analyze data with custom logic
	 */
	async analyze(data: Record<string, unknown>, sessionId: string): Promise<string> {
		const prompt = `Analyze this data and provide insights: ${JSON.stringify(data)}`;

		let analysis = "";

		await this.run(prompt, sessionId, {
			model: "haiku",
			maxTurns: 1,
			callbacks: {
				onText: (content) => {
					analysis = content;
					console.log(`Analysis: ${content}`);
				},
			},
		});

		// Custom: store history
		this.analysisHistory.push(analysis);

		return analysis;
	}

	/**
	 * Get analysis history
	 */
	getHistory(): string[] {
		return [...this.analysisHistory];
	}
}

async function classBasedAgent() {
	console.log("\n=== Method 3: Class-Based Agent ===\n");

	const analyzer = createAgent(DataAnalyzer) as DataAnalyzer;

	await analyzer.analyze({ sales: 1000, revenue: 50000, customers: 42 }, "session_3");

	console.log("\nHistory:", analyzer.getHistory().length, "analyses");
}

// ============================================
// Run All Examples
// ============================================

async function runCustomAgentExamples() {
	console.log("Custom Agent Examples\n");

	await simpleConfigAgent();
	await configWithState();
	await classBasedAgent();

	console.log("\n✓ All custom agent examples complete!");
}

if (import.meta.main) {
	runCustomAgentExamples().catch(console.error);
}

export { runCustomAgentExamples };
