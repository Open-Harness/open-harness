#!/usr/bin/env bun

import { createGithubChannel } from "../src/channel.js";
import type { EnrichedEvent, Hub } from "../src/types.js";

// Observable mock hub that logs all activity
class ObservableMockHub implements Hub {
	private listeners: Array<(event: EnrichedEvent) => void> = [];
	public status: "idle" | "running" | "complete" | "aborted" = "idle";
	public sessionActive = true;
	public aborts: Array<string | undefined> = [];
	public replies: Array<{ promptId: string; response: unknown }> = [];
	public emittedEvents: Array<{ type: string; [k: string]: unknown }> = [];

	subscribe(
		_filterOrListener: string | string[] | ((event: EnrichedEvent) => void),
		listener?: (event: EnrichedEvent) => void,
	): () => void {
		const actualListener =
			typeof _filterOrListener === "function"
				? _filterOrListener
				: (listener ?? (() => {}));
		this.listeners.push(actualListener);
		return () => {
			const index = this.listeners.indexOf(actualListener);
			if (index >= 0) {
				this.listeners.splice(index, 1);
			}
		};
	}

	emit(event: { type: string; [k: string]: unknown }): void {
		this.emittedEvents.push(event);
		console.log(`[HUB] ${event.type}`, event);
		const enriched: EnrichedEvent = {
			id: `evt-${Date.now()}`,
			timestamp: new Date(),
			context: { sessionId: "test-session" },
			event: event as EnrichedEvent["event"],
		};
		for (const listener of this.listeners) {
			listener(enriched);
		}
	}

	send(_message: string): void {}
	sendTo(_agent: string, _message: string): void {}
	sendToRun(_runId: string, _message: string): void {}

	reply(
		promptId: string,
		response: { content: string; timestamp: Date },
	): void {
		this.replies.push({ promptId, response });
		console.log(`[HUB] reply(${promptId})`, response);
	}

	abort(reason?: string): void {
		this.aborts.push(reason);
		console.log(`[HUB] abort(${reason || "no reason"})`);
	}

	scoped<T>(_context: unknown, fn: () => T): T {
		return fn();
	}

	current(): { sessionId?: string } {
		return { sessionId: "test-session" };
	}

	async *[Symbol.asyncIterator](): AsyncIterator<EnrichedEvent> {
		// Empty iterator
	}
}

async function createTestIssue(
	token: string,
	repo: string,
	title: string,
	body: string,
): Promise<{ number: number; html_url: string }> {
	const [owner, repoName] = repo.split("/");
	if (!owner || !repoName) {
		throw new Error(`Invalid repo format: ${repo}`);
	}

	const response = await fetch(
		`https://api.github.com/repos/${owner}/${repoName}/issues`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github.v3+json",
				"Content-Type": "application/json",
				"User-Agent": "github-channel-live-test",
			},
			body: JSON.stringify({ title, body }),
		},
	);

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to create issue: ${response.status} ${errorText}`);
	}

	const data = (await response.json()) as { number: number; html_url: string };
	return { number: data.number, html_url: data.html_url };
}

async function deleteIssue(
	token: string,
	repo: string,
	issueNumber: number,
): Promise<void> {
	const [owner, repoName] = repo.split("/");
	if (!owner || !repoName) {
		throw new Error(`Invalid repo format: ${repo}`);
	}

	const response = await fetch(
		`https://api.github.com/repos/${owner}/${repoName}/issues/${issueNumber}`,
		{
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github.v3+json",
				"Content-Type": "application/json",
				"User-Agent": "github-channel-live-test",
			},
			body: JSON.stringify({ state: "closed" }),
		},
	);

	if (!response.ok && response.status !== 404) {
		const errorText = await response.text();
		console.warn(`Failed to close issue: ${response.status} ${errorText}`);
	} else {
		console.log(`Closed issue #${issueNumber}`);
	}
}

function printTestInstructions(issueUrl: string): void {
	console.log(`\n${"=".repeat(60)}`);
	console.log("GitHub Channel Live Test");
	console.log("=".repeat(60));
	console.log(`\nIssue: ${issueUrl}\n`);
	console.log("The dashboard now shows a realistic workflow simulation:");
	console.log("- Phase: 'Gathering Requirements'");
	console.log("- Tasks in various states (done, running, pending)");
	console.log("- Active agent: 'Design Agent'");
	console.log("- Open prompt requiring your input");
	console.log("");
	console.log("=== Test Commands ===");
	console.log("Post these as comments on the issue:\n");
	console.log(
		"1. /status       - Show current status (no-op, already visible)",
	);
	console.log("2. /pause        - Pause the workflow");
	console.log("3. /resume       - Resume the workflow");
	console.log("4. /abort oops   - Abort the workflow with reason");
	console.log("5. /choose prompt-1 mobile-first - Answer the open prompt");
	console.log("6. /help         - Show command list");
	console.log("\n=== Test Reactions ===");
	console.log("Add these reactions to the dashboard comment:\n");
	console.log("- 👍  (+1) confirm/pause");
	console.log("- 🚀  (rocket) resume");
	console.log("- 👎  (-1) abort");
	console.log("- 👀  (eyes) status");
	console.log("- ❤️  (heart) retry");
	console.log("\nWatch the [HUB] logs above for dispatched commands.");
	console.log(`${"=".repeat(60)}\n`);
}

function waitForEnter(): Promise<void> {
	return new Promise((resolve) => {
		// Use readline for better compatibility (works in non-TTY environments)
		const readline = require("node:readline");
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		rl.question("", () => {
			rl.close();
			resolve();
		});
	});
}

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function simulateRealisticWorkflow(
	hub: ObservableMockHub,
): Promise<void> {
	// Wait a bit for dashboard to initialize
	await sleep(2000);

	console.log("Simulating realistic workflow state...");

	// Start a phase
	hub.emit({
		type: "phase:start",
		name: "Gathering Requirements",
		description: "Collecting and analyzing project requirements",
	});

	await sleep(500);

	// Add some tasks in different states
	hub.emit({
		type: "task:start",
		id: "task-1",
		summary: "Review project documentation",
	});

	await sleep(300);

	hub.emit({
		type: "task:start",
		id: "task-2",
		summary: "Identify stakeholders and gather feedback",
	});

	await sleep(400);

	hub.emit({
		type: "task:complete",
		id: "task-1",
		summary: "Review project documentation",
	});

	await sleep(300);

	hub.emit({
		type: "task:start",
		id: "task-3",
		summary: "Create initial design mockups",
	});

	// Add an agent with activity
	hub.emit({
		type: "agent:start",
		name: "Design Agent",
		role: "UI/UX Designer",
	});

	await sleep(300);

	hub.emit({
		type: "agent:text",
		name: "Design Agent",
		text: "Analyzing user requirements and creating wireframes...",
	});

	await sleep(400);

	hub.emit({
		type: "agent:text",
		name: "Design Agent",
		text: "Completed initial mockup for dashboard interface",
	});

	// Create an open prompt
	await sleep(300);

	hub.emit({
		type: "session:prompt",
		promptId: "prompt-1",
		prompt: "Should we prioritize mobile-first design or desktop experience?",
		choices: ["mobile-first", "desktop-first", "responsive"],
		from: "Design Agent",
	});

	// Add some narrative events for recent activity
	await sleep(200);

	hub.emit({
		type: "narrative",
		text: "Workflow initialized and running",
	});

	await sleep(200);

	hub.emit({
		type: "narrative",
		text: "Phase 'Gathering Requirements' started",
	});

	console.log("✅ Realistic workflow state simulated!");
}

function getRepoFromGit(): string | undefined {
	try {
		const { execSync } = require("node:child_process");
		const remote = execSync("git config --get remote.origin.url", {
			encoding: "utf-8",
			cwd: process.cwd(),
		}).trim();

		// Handle both https and ssh formats
		const match = remote.match(
			/(?:github\.com[:/]|git@github\.com:)([^/]+)\/([^/]+?)(?:\.git)?$/,
		);
		if (match) {
			return `${match[1]}/${match[2]}`;
		}
	} catch {
		// Ignore errors
	}
	return undefined;
}

async function main(): Promise<void> {
	const token = process.env.GITHUB_TOKEN;
	if (!token) {
		console.error("Error: Set GITHUB_TOKEN with repo scope");
		console.error("Example: GITHUB_TOKEN=ghp_xxx bun run scripts/live-test.ts");
		process.exit(1);
	}

	// Detect repo from git or use env var
	let repo = process.env.GITHUB_REPO;
	if (!repo) {
		repo = getRepoFromGit();
		if (!repo) {
			console.error(
				"Error: Could not detect repo from git. Set GITHUB_REPO env var.",
			);
			console.error("Example: GITHUB_REPO=owner/repo");
			process.exit(1);
		}
	}

	console.log("Creating test issue...");

	try {
		const issue = await createTestIssue(
			token,
			repo,
			"[AUTO-TEST] GitHub Channel Live Test - DELETE ME",
			"Automated test issue. Will be deleted after test completes.\n\nThis issue will be automatically closed when the test completes.",
		);

		console.log(`\n=== GitHub Channel Live Test ===`);
		console.log(`Issue: ${issue.html_url}\n`);

		// Create observable mock hub
		const hub = new ObservableMockHub();

		// Start channel
		const channel = createGithubChannel({
			repo,
			issueNumber: issue.number,
			tokenEnv: "GITHUB_TOKEN",
			pollIntervalMs: 3000,
			debounceMs: 1000,
			allowCommands: [
				"pause",
				"resume",
				"abort",
				"status",
				"reply",
				"choose",
				"help",
			],
		});

		const cleanup = channel(hub);

		// Wait for dashboard to appear
		console.log("Waiting for dashboard to initialize...");
		await sleep(2000);

		// Simulate realistic workflow state
		await simulateRealisticWorkflow(hub);

		// Print test instructions
		printTestInstructions(issue.html_url);

		// Wait for human
		console.log("\nPress Enter when done testing...");
		await waitForEnter();

		// Cleanup
		console.log("\nCleaning up...");
		if (cleanup) {
			await cleanup();
		}
		await deleteIssue(token, repo, issue.number);

		console.log("\n✅ Cleanup complete!");
		console.log(`\nSummary:`);
		console.log(`- Aborts: ${hub.aborts.length}`);
		console.log(`- Replies: ${hub.replies.length}`);
		console.log(`- Events: ${hub.emittedEvents.length}`);
	} catch (err) {
		console.error("Error:", err);
		process.exit(1);
	}
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
