/**
 * Record a fixture scenario to scratch/ directory.
 *
 * Usage: bun scripts/record-fixture.ts <component> <fixture-name>
 *
 * Example: bun scripts/record-fixture.ts hub subscribe-basic
 *
 * This script:
 * 1. Executes the scenario (component-specific)
 * 2. Captures events/state
 * 3. Writes to tests/fixtures/scratch/<component>/<fixture-name>.jsonl
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHub, type HubImpl } from "../src/engine/hub.js";
import type { EnrichedEvent } from "../src/protocol/events.js";
import type { HubFixture } from "../tests/helpers/fixture-loader.js";

const [component, fixtureName] = process.argv.slice(2);

if (!component || !fixtureName) {
	console.error(
		"Usage: bun scripts/record-fixture.ts <component> <fixture-name>",
	);
	process.exit(1);
}

// Define Hub scenarios
const hubScenarios: Record<string, () => Promise<HubFixture>> = {
	"subscribe-basic": async () => {
		const hub = createHub("record-subscribe-basic");
		const received: EnrichedEvent[] = [];

		hub.subscribe("*", (event) => {
			received.push(event);
		});

		hub.emit({ type: "harness:start", name: "test" });

		await new Promise((resolve) => setTimeout(resolve, 10));

		return {
			sessionId: "record-subscribe-basic",
			scenario: "subscribe-basic",
			steps: [
				{
					type: "emit",
					event: { type: "harness:start", name: "test" },
				},
			],
			expect: {
				events: received.map((e) => ({
					event: e.event,
					context: e.context,
				})),
			},
			metadata: {
				recordedAt: new Date().toISOString(),
				component: "hub",
				description: "Basic subscription scenario",
			},
		};
	},

	"subscribe-filter": async () => {
		const hub = createHub("record-subscribe-filter");
		const received: EnrichedEvent[] = [];

		hub.subscribe("agent:*", (event) => {
			received.push(event);
		});

		hub.emit({ type: "agent:start", agentName: "test", runId: "run-1" });
		hub.emit({ type: "harness:start", name: "test" });

		await new Promise((resolve) => setTimeout(resolve, 10));

		return {
			sessionId: "record-subscribe-filter",
			scenario: "subscribe-filter",
			steps: [
				{
					type: "emit",
					event: { type: "agent:start", agentName: "test", runId: "run-1" },
				},
				{
					type: "emit",
					event: { type: "harness:start", name: "test" },
				},
			],
			expect: {
				events: received.map((e) => ({
					event: e.event,
					context: e.context,
				})),
			},
			metadata: {
				recordedAt: new Date().toISOString(),
				component: "hub",
				description: "Event filtering scenario",
			},
		};
	},

	"scoped-context": async () => {
		const hub = createHub("record-scoped-context");
		const received: EnrichedEvent[] = [];

		hub.subscribe("*", (event) => {
			received.push(event);
		});

		await hub.scoped({ phase: { name: "Planning" } }, async () => {
			hub.emit({ type: "phase:start", name: "Planning" });
		});

		await new Promise((resolve) => setTimeout(resolve, 10));

		return {
			sessionId: "record-scoped-context",
			scenario: "scoped-context",
			steps: [
				{
					type: "emit",
					event: { type: "phase:start", name: "Planning" },
					contextOverride: { phase: { name: "Planning" } },
				},
			],
			expect: {
				events: received.map((e) => ({
					event: e.event,
					context: e.context,
				})),
			},
			metadata: {
				recordedAt: new Date().toISOString(),
				component: "hub",
				description: "Context scoping scenario",
			},
		};
	},

	unsubscribe: async () => {
		const hub = createHub("record-unsubscribe");
		const received: EnrichedEvent[] = [];

		const unsubscribe = hub.subscribe("*", (event) => {
			received.push(event);
		});

		hub.emit({ type: "harness:start", name: "test" });
		unsubscribe();
		hub.emit({ type: "harness:complete", success: true, durationMs: 100 });

		await new Promise((resolve) => setTimeout(resolve, 10));

		return {
			sessionId: "record-unsubscribe",
			scenario: "unsubscribe",
			steps: [
				{
					type: "emit",
					event: { type: "harness:start", name: "test" },
				},
				// Note: unsubscribe is handled by test logic, not a step
				{
					type: "emit",
					event: { type: "harness:complete", success: true, durationMs: 100 },
				},
			],
			expect: {
				events: received.map((e) => ({
					event: e.event,
					context: e.context,
				})),
			},
			metadata: {
				recordedAt: new Date().toISOString(),
				component: "hub",
				description: "Unsubscribe scenario",
			},
		};
	},

	"async-iteration": async () => {
		const hub = createHub("record-async-iteration");
		const received: EnrichedEvent[] = [];

		(async () => {
			for await (const event of hub) {
				received.push(event);
				if (received.length >= 2) break;
			}
		})();

		hub.emit({ type: "harness:start", name: "test" });
		hub.emit({ type: "harness:complete", success: true, durationMs: 100 });

		await new Promise((resolve) => setTimeout(resolve, 50));

		return {
			sessionId: "record-async-iteration",
			scenario: "async-iteration",
			steps: [
				{
					type: "emit",
					event: { type: "harness:start", name: "test" },
				},
				{
					type: "emit",
					event: { type: "harness:complete", success: true, durationMs: 100 },
				},
			],
			expect: {
				events: received.map((e) => ({
					event: e.event,
					context: e.context,
				})),
			},
			metadata: {
				recordedAt: new Date().toISOString(),
				component: "hub",
				description: "Async iteration scenario",
			},
		};
	},

	commands: async () => {
		const hub = createHub("record-commands");
		const received: EnrichedEvent[] = [];

		hub.subscribe("session:*", (event) => {
			received.push(event);
		});

		// Commands should be no-ops if session not active
		hub.send("message");
		hub.sendTo("agent", "message");
		hub.sendToRun("runId", "message");

		// Activate session
		(hub as HubImpl).startSession();

		hub.send("message");
		hub.sendTo("agent", "message");
		hub.sendToRun("runId", "message");

		await new Promise((resolve) => setTimeout(resolve, 10));

		return {
			sessionId: "record-commands",
			scenario: "commands",
			steps: [
				{
					type: "send",
					message: "message",
				},
				{
					type: "sendTo",
					agent: "agent",
					message: "message",
				},
				{
					type: "sendToRun",
					runId: "runId",
					message: "message",
				},
				{
					type: "startSession",
				},
				{
					type: "send",
					message: "message",
				},
				{
					type: "sendTo",
					agent: "agent",
					message: "message",
				},
				{
					type: "sendToRun",
					runId: "runId",
					message: "message",
				},
			],
			expect: {
				events: received.map((e) => ({
					event: e.event,
					context: e.context,
				})),
			},
			metadata: {
				recordedAt: new Date().toISOString(),
				component: "hub",
				description: "Commands scenario",
			},
		};
	},

	status: async () => {
		const hub = createHub("record-status");

		(hub as HubImpl).startSession();
		const afterStartSessionActive = hub.sessionActive;

		(hub as HubImpl).setStatus("running");
		const afterSetStatus = hub.status;

		await new Promise((resolve) => setTimeout(resolve, 10));

		return {
			sessionId: "record-status",
			scenario: "status",
			steps: [
				{
					type: "startSession",
				},
				{
					type: "setStatus",
					status: "running",
				},
			],
			expect: {
				status: finalStatus,
				sessionActive: afterStartSessionActive,
			},
			metadata: {
				recordedAt: new Date().toISOString(),
				component: "hub",
				description: "Status tracking scenario",
			},
		};
	},
};

async function recordFixture() {
	if (component === "hub") {
		const scenarioFn = hubScenarios[fixtureName];
		if (!scenarioFn) {
			console.error(`Unknown Hub fixture: ${fixtureName}`);
			console.error(
				`Available fixtures: ${Object.keys(hubScenarios).join(", ")}`,
			);
			process.exit(1);
		}

		const fixture = await scenarioFn();

		// Write to scratch directory
		// Script is in packages/kernel/scripts/, so go up one level to get to packages/kernel/
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);
		const kernelDir = join(__dirname, "..");
		const scratchDir = join(kernelDir, "tests/fixtures/scratch", component);
		await mkdir(scratchDir, { recursive: true });

		const fixturePath = join(scratchDir, `${fixtureName}.jsonl`);
		const jsonl = `${JSON.stringify(fixture)}\n`;

		await writeFile(fixturePath, jsonl, "utf-8");

		console.log(`✅ Recorded fixture to: ${fixturePath}`);
		console.log(`📝 Review and promote to golden/ when ready`);
	} else {
		console.error(`Unknown component: ${component}`);
		console.error(`Supported components: hub`);
		process.exit(1);
	}
}

recordFixture().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
