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
import { defineHarness } from "../src/engine/harness.js";
import type { EnrichedEvent } from "../src/protocol/events.js";
import type { Attachment, HarnessFactory, HarnessInstance } from "../src/protocol/harness.js";
import type { HubFixture, HarnessFixture } from "../tests/helpers/fixture-loader.js";

const [component, fixtureName] = process.argv.slice(2);

if (!component || !fixtureName) {
	console.error(
		"Usage: bun scripts/record-fixture.ts <component> <fixture-name>",
	);
	process.exit(1);
}

function createHarnessWithSessionId<TInput, TState, TResult>(
	factory: HarnessFactory<TInput, TState, TResult>,
	input: TInput,
	sessionId: string,
): HarnessInstance<TState, TResult> {
	return (factory as HarnessFactory<TInput, TState, TResult> & {
		create(
			input: TInput,
			options?: { sessionIdOverride?: string },
		): HarnessInstance<TState, TResult>;
	}).create(input, { sessionIdOverride: sessionId });
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

// Define Harness scenarios
const harnessScenarios: Record<string, () => Promise<HarnessFixture>> = {
	factory: async () => {
		const sessionId = "record-harness-factory";
		const harnessFactory = defineHarness({
			name: "test-harness",
			agents: {},
			state: (input: { value: number }) => ({ count: input.value }),
			run: async () => ({ ok: true }),
		});

		const instance = createHarnessWithSessionId(
			harnessFactory,
			{ value: 42 },
			sessionId,
		);
		const received: EnrichedEvent[] = [];

		instance.subscribe("*", (event) => {
			received.push(event);
		});

		await new Promise((resolve) => setTimeout(resolve, 10));

		return {
			sessionId,
			scenario: "factory",
			steps: [
				{
					type: "create",
					name: "test-harness",
					input: { value: 42 },
				},
			],
			expect: {
				state: { count: 42 },
				events: received.map((e) => ({
					event: e.event,
					context: e.context,
				})),
			},
			metadata: {
				recordedAt: new Date().toISOString(),
				component: "harness",
				description: "Harness factory creates instances with correct state",
			},
		};
	},

	attachment: async () => {
		const sessionId = "record-harness-attachment";
		const harnessFactory = defineHarness({
			name: "test-harness",
			agents: {},
			state: () => ({}),
			run: async () => ({ ok: true }),
		});

		const instance = createHarnessWithSessionId(
			harnessFactory,
			{},
			sessionId,
		);
		const received: EnrichedEvent[] = [];
		let attachmentReceivedHub = false;

		const attachment: Attachment = (hub) => {
			attachmentReceivedHub = true;
			return hub.subscribe("*", (event) => {
				received.push(event);
			});
		};

		instance.attach(attachment);
		instance.emit({ type: "test:event" });

		await new Promise((resolve) => setTimeout(resolve, 10));

		return {
			sessionId,
			scenario: "attachment",
			steps: [
				{
					type: "create",
					name: "test-harness",
					input: {},
				},
				{
					type: "attach",
				},
				{
					type: "emit",
					event: { type: "test:event" },
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
				component: "harness",
				description: "Attachments receive hub and can subscribe",
			},
		};
	},

	session: async () => {
		const sessionId = "record-harness-session";
		const harnessFactory = defineHarness({
			name: "test-harness",
			agents: {},
			state: () => ({}),
			run: async ({ session }) => {
				// Session context should be available
				return { hasSession: session !== undefined };
			},
		});

		const instance = createHarnessWithSessionId(
			harnessFactory,
			{},
			sessionId,
		);
		const received: EnrichedEvent[] = [];

		instance.subscribe("*", (event) => {
			received.push(event);
		});

		instance.startSession();
		instance.send("test message");

		await new Promise((resolve) => setTimeout(resolve, 10));

		return {
			sessionId,
			scenario: "session",
			steps: [
				{
					type: "create",
					name: "test-harness",
					input: {},
				},
				{
					type: "startSession",
				},
				{
					type: "send",
					message: "test message",
				},
			],
			expect: {
				sessionActive: true,
				events: received
					.filter((e) => e.event.type === "session:message")
					.map((e) => ({
						event: e.event,
						context: e.context,
					})),
			},
			metadata: {
				recordedAt: new Date().toISOString(),
				component: "harness",
				description: "startSession enables command handling",
			},
		};
	},

	"run-lifecycle": async () => {
		const sessionId = "record-harness-run-lifecycle";
		const harnessFactory = defineHarness({
			name: "test-harness",
			agents: {},
			state: () => ({ initialized: true }),
			run: async () => ({ result: "success" }),
		});

		const instance = createHarnessWithSessionId(
			harnessFactory,
			{},
			sessionId,
		);
		const received: EnrichedEvent[] = [];

		instance.subscribe("*", (event) => {
			received.push(event);
		});

		const result = await instance.run();

		return {
			sessionId,
			scenario: "run-lifecycle",
			steps: [
				{
					type: "create",
					name: "test-harness",
					input: {},
				},
				{
					type: "run",
				},
			],
			expect: {
				events: received.map((e) => ({
					event: e.event,
					context: e.context,
				})),
				result: result.result,
				state: result.state,
				status: result.status,
			},
			metadata: {
				recordedAt: new Date().toISOString(),
				component: "harness",
				description: "run executes and returns HarnessResult with lifecycle events",
			},
		};
	},

	"phase-task": async () => {
		const sessionId = "record-harness-phase-task";
		const harnessFactory = defineHarness({
			name: "test-harness",
			agents: {},
			state: () => ({}),
			run: async ({ phase, task, emit }) => {
				await phase("Planning", async () => {
					await task("plan", async () => {
						emit({ type: "custom:event", data: "test" });
						return "planned";
					});
				});
				return { ok: true };
			},
		});

		const instance = createHarnessWithSessionId(
			harnessFactory,
			{},
			sessionId,
		);
		const received: EnrichedEvent[] = [];

		instance.subscribe("*", (event) => {
			received.push(event);
		});

		await instance.run();

		return {
			sessionId,
			scenario: "phase-task",
			steps: [
				{
					type: "create",
					name: "test-harness",
					input: {},
				},
				{
					type: "run",
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
				component: "harness",
				description: "phase and task helpers propagate context",
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
	} else if (component === "harness") {
		const scenarioFn = harnessScenarios[fixtureName];
		if (!scenarioFn) {
			console.error(`Unknown Harness fixture: ${fixtureName}`);
			console.error(
				`Available fixtures: ${Object.keys(harnessScenarios).join(", ")}`,
			);
			process.exit(1);
		}

		const fixture = await scenarioFn();

		// Write to scratch directory
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
		console.error(`Supported components: hub, harness`);
		process.exit(1);
	}
}

recordFixture().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
