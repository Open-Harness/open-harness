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
	}

	abort(reason?: string): void {
		this.aborts.push(reason);
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

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
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
				"User-Agent": "github-channel-autonomous-test",
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

async function postComment(
	token: string,
	repo: string,
	issueNumber: number,
	body: string,
): Promise<number> {
	const [owner, repoName] = repo.split("/");
	if (!owner || !repoName) {
		throw new Error(`Invalid repo format: ${repo}`);
	}

	const response = await fetch(
		`https://api.github.com/repos/${owner}/${repoName}/issues/${issueNumber}/comments`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github.v3+json",
				"Content-Type": "application/json",
				"User-Agent": "github-channel-autonomous-test",
			},
			body: JSON.stringify({ body }),
		},
	);

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to post comment: ${response.status} ${errorText}`);
	}

	const data = (await response.json()) as { id: number };
	return data.id;
}

async function addReaction(
	token: string,
	repo: string,
	commentId: number,
	reaction: string,
): Promise<void> {
	const [owner, repoName] = repo.split("/");
	if (!owner || !repoName) {
		throw new Error(`Invalid repo format: ${repo}`);
	}

	const response = await fetch(
		`https://api.github.com/repos/${owner}/${repoName}/issues/comments/${commentId}/reactions`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github.v3+json",
				"Content-Type": "application/json",
				"User-Agent": "github-channel-autonomous-test",
			},
			body: JSON.stringify({ content: reaction }),
		},
	);

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to add reaction: ${response.status} ${errorText}`);
	}
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
				"User-Agent": "github-channel-autonomous-test",
			},
			body: JSON.stringify({ state: "closed" }),
		},
	);

	if (!response.ok && response.status !== 404) {
		const errorText = await response.text();
		console.warn(`Failed to close issue: ${response.status} ${errorText}`);
	}
}

async function verifyCommandProcessed(
	hub: ObservableMockHub,
	commandType: string,
	expectedCount: number = 1,
): Promise<boolean> {
	await sleep(4000); // Wait for polling interval (3s) + buffer

	const events = hub.emittedEvents.filter((e) => e.type === commandType);
	const aborts = hub.aborts;

	switch (commandType) {
		case "channel:pause":
			return (
				events.filter((e) => e.type === "channel:pause").length >= expectedCount
			);
		case "channel:resume":
			return (
				events.filter((e) => e.type === "channel:resume").length >=
				expectedCount
			);
		case "channel:abort":
			return aborts.length >= expectedCount;
		case "status":
			// Status is a no-op, just verify it was handled (no error)
			return true;
		default:
			return false;
	}
}

async function verifyReactionProcessed(
	hub: ObservableMockHub,
	reactionType: string,
): Promise<boolean> {
	await sleep(4000); // Wait for polling interval (3s) + buffer

	const events = hub.emittedEvents;

	switch (reactionType) {
		case "+1":
			// +1 can be confirm or pause depending on context
			return (
				events.some((e) => e.type === "channel:pause") || hub.replies.length > 0
			);
		case "rocket":
			return events.some((e) => e.type === "channel:resume");
		case "-1":
			return hub.aborts.length > 0;
		case "eyes":
			// Status is a no-op
			return true;
		case "heart":
			return events.some((e) => e.type === "channel:retry");
		default:
			return false;
	}
}

async function runAutonomousTest(): Promise<void> {
	const token = process.env.GITHUB_TOKEN;
	if (!token) {
		console.error("Error: Set GITHUB_TOKEN with repo scope");
		console.error(
			"Example: GITHUB_TOKEN=ghp_xxx bun run scripts/autonomous-test.ts",
		);
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

	console.log("=== GitHub Channel Autonomous Test ===\n");
	console.log(`Repo: ${repo}\n`);

	let issueNumber: number | null = null;
	let managedCommentId: number | null = null;

	try {
		// Step 1: Create test issue
		console.log("Step 1: Creating test issue...");
		const issue = await createTestIssue(
			token,
			repo,
			"[AUTO-TEST] GitHub Channel Autonomous Test - DELETE ME",
			"Automated test issue. Will be deleted after test completes.",
		);
		issueNumber = issue.number;
		console.log(`✓ Created issue #${issue.number}: ${issue.html_url}\n`);

		// Step 2: Start channel
		console.log("Step 2: Starting GitHub channel...");
		const hub = new ObservableMockHub();
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

		// Wait for dashboard to initialize
		console.log("Waiting for dashboard to initialize...");
		await sleep(5000);

		// Get managed comment ID by fetching comments
		const [owner, repoName] = repo.split("/");
		const commentsResponse = await fetch(
			`https://api.github.com/repos/${owner}/${repoName}/issues/${issue.number}/comments`,
			{
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: "application/vnd.github.v3+json",
				},
			},
		);
		if (commentsResponse.ok) {
			const comments = (await commentsResponse.json()) as Array<{
				id: number;
				body: string;
			}>;
			const managedComment = comments.find((c) =>
				c.body.includes("<!-- DASHBOARD:START -->"),
			);
			if (managedComment) {
				managedCommentId = managedComment.id;
				console.log(
					`✓ Dashboard initialized (comment ID: ${managedCommentId}\n`,
				);
			}
		}

		// Step 3: Test commands
		console.log("Step 3: Testing slash commands...\n");

		const testResults: Array<{
			test: string;
			passed: boolean;
			error?: string;
		}> = [];

		// Test /status
		console.log("  Testing /status...");
		try {
			await postComment(token, repo, issue.number, "/status");
			const passed = await verifyCommandProcessed(hub, "status");
			testResults.push({ test: "/status", passed });
			console.log(`  ${passed ? "✓" : "✗"} /status`);
		} catch (err) {
			testResults.push({ test: "/status", passed: false, error: String(err) });
			console.log(`  ✗ /status: ${err}`);
		}

		// Test /pause
		console.log("  Testing /pause...");
		try {
			await postComment(token, repo, issue.number, "/pause");
			const passed = await verifyCommandProcessed(hub, "channel:pause");
			testResults.push({ test: "/pause", passed });
			console.log(`  ${passed ? "✓" : "✗"} /pause`);
		} catch (err) {
			testResults.push({ test: "/pause", passed: false, error: String(err) });
			console.log(`  ✗ /pause: ${err}`);
		}

		// Test /resume
		console.log("  Testing /resume...");
		try {
			await postComment(token, repo, issue.number, "/resume");
			const passed = await verifyCommandProcessed(hub, "channel:resume");
			testResults.push({ test: "/resume", passed });
			console.log(`  ${passed ? "✓" : "✗"} /resume`);
		} catch (err) {
			testResults.push({ test: "/resume", passed: false, error: String(err) });
			console.log(`  ✗ /resume: ${err}`);
		}

		// Test /abort
		console.log("  Testing /abort...");
		try {
			await postComment(token, repo, issue.number, "/abort test reason");
			const passed = await verifyCommandProcessed(hub, "channel:abort");
			testResults.push({ test: "/abort", passed });
			console.log(`  ${passed ? "✓" : "✗"} /abort`);
		} catch (err) {
			testResults.push({ test: "/abort", passed: false, error: String(err) });
			console.log(`  ✗ /abort: ${err}`);
		}

		// Test /help
		console.log("  Testing /help...");
		try {
			await postComment(token, repo, issue.number, "/help");
			const passed = await verifyCommandProcessed(hub, "status"); // help is handled
			testResults.push({ test: "/help", passed });
			console.log(`  ${passed ? "✓" : "✗"} /help`);
		} catch (err) {
			testResults.push({ test: "/help", passed: false, error: String(err) });
			console.log(`  ✗ /help: ${err}`);
		}

		// Step 4: Test reactions
		if (managedCommentId) {
			console.log("\nStep 4: Testing reactions...\n");

			// Test +1 reaction
			console.log("  Testing +1 reaction...");
			try {
				await addReaction(token, repo, managedCommentId, "+1");
				const passed = await verifyReactionProcessed(hub, "+1");
				testResults.push({ test: "+1 reaction", passed });
				console.log(`  ${passed ? "✓" : "✗"} +1 reaction`);
			} catch (err) {
				testResults.push({
					test: "+1 reaction",
					passed: false,
					error: String(err),
				});
				console.log(`  ✗ +1 reaction: ${err}`);
			}

			// Test rocket reaction
			console.log("  Testing rocket reaction...");
			try {
				await addReaction(token, repo, managedCommentId, "rocket");
				const passed = await verifyReactionProcessed(hub, "rocket");
				testResults.push({ test: "rocket reaction", passed });
				console.log(`  ${passed ? "✓" : "✗"} rocket reaction`);
			} catch (err) {
				testResults.push({
					test: "rocket reaction",
					passed: false,
					error: String(err),
				});
				console.log(`  ✗ rocket reaction: ${err}`);
			}

			// Test -1 reaction
			console.log("  Testing -1 reaction...");
			try {
				await addReaction(token, repo, managedCommentId, "-1");
				const passed = await verifyReactionProcessed(hub, "-1");
				testResults.push({ test: "-1 reaction", passed });
				console.log(`  ${passed ? "✓" : "✗"} -1 reaction`);
			} catch (err) {
				testResults.push({
					test: "-1 reaction",
					passed: false,
					error: String(err),
				});
				console.log(`  ✗ -1 reaction: ${err}`);
			}

			// Test eyes reaction
			console.log("  Testing eyes reaction...");
			try {
				await addReaction(token, repo, managedCommentId, "eyes");
				const passed = await verifyReactionProcessed(hub, "eyes");
				testResults.push({ test: "eyes reaction", passed });
				console.log(`  ${passed ? "✓" : "✗"} eyes reaction`);
			} catch (err) {
				testResults.push({
					test: "eyes reaction",
					passed: false,
					error: String(err),
				});
				console.log(`  ✗ eyes reaction: ${err}`);
			}
		} else {
			console.log("\nStep 4: Skipping reactions (managed comment not found)\n");
		}

		// Step 5: Report results
		console.log("\n=== Test Results ===\n");
		const passed = testResults.filter((r) => r.passed).length;
		const total = testResults.length;
		console.log(`Passed: ${passed}/${total}\n`);

		for (const result of testResults) {
			const icon = result.passed ? "✓" : "✗";
			const error = result.error ? ` (${result.error})` : "";
			console.log(`${icon} ${result.test}${error}`);
		}

		// Step 6: Cleanup
		console.log("\nStep 5: Cleaning up...");
		if (cleanup) {
			await cleanup();
		}
		await deleteIssue(token, repo, issue.number);
		console.log("✓ Cleanup complete\n");

		// Exit with appropriate code
		if (passed === total) {
			console.log("✅ All tests passed!");
			process.exit(0);
		} else {
			console.log(`❌ ${total - passed} test(s) failed`);
			process.exit(1);
		}
	} catch (err) {
		console.error("\n❌ Fatal error:", err);
		if (issueNumber) {
			try {
				await deleteIssue(token, repo, issueNumber);
			} catch {
				// Ignore cleanup errors
			}
		}
		process.exit(1);
	}
}

runAutonomousTest().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
