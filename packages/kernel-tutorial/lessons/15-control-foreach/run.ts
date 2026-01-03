/**
 * Lesson 15: Session Isolation with Batch Processing
 *
 * Demonstrates the session isolation pattern used by control.foreach:
 * - Fresh sessionId per iteration
 * - session:start and session:end events for lifecycle tracking
 * - Isolation between batch items
 *
 * Scenario: A batch code analyzer that processes multiple files,
 * creating a fresh session scope for each file to ensure isolation.
 *
 * Primitives used:
 * - createHub() - creates the event bus
 * - createSessionId() - generates unique session IDs
 * - AgentDefinition - defines agent behavior
 * - session:start / session:end events - lifecycle tracking
 */

import { type AgentDefinition, createHub, createSessionId } from "@open-harness/kernel";

interface FileInput {
	file: string;
	sessionId: string;
}

interface FileResult {
	file: string;
	issues: string[];
	score: number;
}

// Simulated file contents
const files: Record<string, string> = {
	"src/api/users.ts": 'db.query("SELECT * FROM users WHERE id = " + id)',
	"src/api/auth.ts": "if (user.password === password) { return true }",
	"src/utils/logger.ts": "export const logger = { log: console.log }",
};

/**
 * File analyzer agent.
 */
const AnalyzerAgent: AgentDefinition<FileInput, FileResult> = {
	name: "file-analyzer",
	async execute(input, ctx) {
		console.log(`  [Analyzer] Checking ${input.file}`);
		console.log(`  [Analyzer] Session: ${input.sessionId.slice(0, 16)}...`);

		const content = files[input.file] || "";
		const issues: string[] = [];
		let score = 100;

		if (content.includes("+ id")) {
			issues.push("SQL injection risk");
			score -= 30;
		}
		if (content.includes("=== password") || content.includes("== password")) {
			issues.push("Plain text password comparison");
			score -= 25;
		}

		if (issues.length === 0) {
			console.log("  [Analyzer] ✓ Clean");
		} else {
			console.log(`  [Analyzer] Found ${issues.length} issue(s)`);
		}

		return { file: input.file, issues, score };
	},
};

async function main() {
	console.log("Lesson 15: Session Isolation with Batch Processing\n");
	console.log("Scenario: Analyze multiple files with session isolation\n");

	const hub = createHub("batch-session");
	hub.startSession();

	const fileList = Object.keys(files);
	const results: FileResult[] = [];
	const sessionIds: string[] = [];

	// Track session lifecycle events
	const sessionEvents: Array<{ type: string; sessionId: string }> = [];
	hub.subscribe("session:start", (event) => {
		const payload = event.event as { sessionId: string };
		sessionEvents.push({ type: "start", sessionId: payload.sessionId });
	});
	hub.subscribe("session:end", (event) => {
		const payload = event.event as { sessionId: string };
		sessionEvents.push({ type: "end", sessionId: payload.sessionId });
	});

	console.log("--- Processing Files ---\n");

	// Process each file with a fresh session (like control.foreach would)
	for (const file of fileList) {
		// Create fresh session for this iteration
		const sessionId = createSessionId();
		sessionIds.push(sessionId);

		// Emit session:start
		hub.emit({
			type: "session:start",
			sessionId,
			nodeId: "batch-analyzer",
		});

		const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

		try {
			hub.emit({ type: "agent:start", agentName: "file-analyzer", runId });

			const result = await AnalyzerAgent.execute({ file, sessionId }, { hub, runId });
			results.push(result);

			hub.emit({ type: "agent:complete", agentName: "file-analyzer", success: true, runId });
		} finally {
			// Emit session:end
			hub.emit({
				type: "session:end",
				sessionId,
				nodeId: "batch-analyzer",
			});
		}

		console.log("");
	}

	// Summary
	console.log("--- Batch Analysis Summary ---");
	console.log(`Files analyzed: ${results.length}`);
	console.log(`Total issues: ${results.reduce((sum, r) => sum + r.issues.length, 0)}`);
	console.log(`Average score: ${(results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(0)}/100`);

	console.log("\n--- Per-File Results ---");
	for (const r of results) {
		console.log(`${r.file}: ${r.score}/100${r.issues.length ? " - " + r.issues.join(", ") : ""}`);
	}

	// Verify session isolation
	const uniqueSessions = new Set(sessionIds).size;
	const startEvents = sessionEvents.filter((e) => e.type === "start").length;
	const endEvents = sessionEvents.filter((e) => e.type === "end").length;

	console.log("\n--- Session Isolation ---");
	console.log(`Unique sessions: ${uniqueSessions}`);
	console.log(`session:start events: ${startEvents}`);
	console.log(`session:end events: ${endEvents}`);

	if (uniqueSessions === 3 && startEvents === 3 && endEvents === 3) {
		console.log("\n✓ Each iteration got a unique sessionId");
		console.log("✓ Session lifecycle events emitted correctly");
	} else {
		console.error("\n✗ Session isolation failed");
		process.exit(1);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
