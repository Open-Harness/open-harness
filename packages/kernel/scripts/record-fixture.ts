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
import { AgentInboxImpl } from "../src/engine/inbox.js";
import type { AgentDefinition } from "../src/protocol/agent.js";
import type { EnrichedEvent } from "../src/protocol/events.js";
import { createClaudeAgent } from "../src/providers/claude.js";
import type {
	AgentFixture,
	FlowFixture,
	HubFixture,
	ProviderFixture,
} from "../tests/helpers/fixture-loader.js";

const [component, fixtureName] = process.argv.slice(2);

if (!component || !fixtureName) {
	console.error(
		"Usage: bun scripts/record-fixture.ts <component> <fixture-name>",
	);
	process.exit(1);
}

async function withFrozenTime<T>(fn: () => Promise<T>): Promise<T> {
	const originalNow = Date.now;
	const frozen = Date.now();
	Date.now = () => frozen;
	try {
		return await fn();
	} finally {
		Date.now = originalNow;
	}
}

type AgentRuntime = {
	hub: HubImpl;
	executeAgent: <TIn, TOut>(
		agent: AgentDefinition<TIn, TOut>,
		input: TIn,
	) => Promise<{ runId: string; output: TOut }>;
	close: () => void;
};

function createAgentRuntime(sessionId: string): AgentRuntime {
	const hub = createHub(sessionId) as HubImpl;
	hub.startSession();

	const inboxes = new Map<string, AgentInboxImpl>();
	let runCounter = 0;

	const unsubscribe = hub.subscribe("session:message", (event) => {
		const payload = event.event as { runId?: string; content?: string };
		if (!payload.runId || payload.content === undefined) return;
		const inbox = inboxes.get(payload.runId);
		if (inbox) {
			inbox.push(payload.content);
		}
	});

	const executeAgent = async <TIn, TOut>(
		agent: AgentDefinition<TIn, TOut>,
		input: TIn,
	): Promise<{ runId: string; output: TOut }> => {
		const runId = `run-${runCounter++}`;
		const inbox = new AgentInboxImpl();
		inboxes.set(runId, inbox);

		if (!agent.emitsStartComplete) {
			hub.emit({ type: "agent:start", agentName: agent.name, runId });
		}

		try {
			const output = await agent.execute(input, { hub, inbox, runId });
			if (!agent.emitsStartComplete) {
				hub.emit({
					type: "agent:complete",
					agentName: agent.name,
					success: true,
					runId,
				});
			}
			return { runId, output };
		} catch (error) {
			if (!agent.emitsStartComplete) {
				hub.emit({
					type: "agent:complete",
					agentName: agent.name,
					success: false,
					runId,
				});
			}
			throw error;
		}
	};

	return {
		hub,
		executeAgent,
		close: () => {
			unsubscribe();
		},
	};
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
		const finalStatus = hub.status;

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

// Define Agent scenarios
const agentScenarios: Record<string, () => Promise<AgentFixture>> = {
	"inbox-basic": async () => {
		const sessionId = "record-agent-inbox-basic";
		const agent: AgentDefinition<
			{ label: string },
			{ first: string; drained: string[]; iter: string }
		> = {
			name: "receiver",
			execute: async (input, ctx) => {
				const first = await Promise.race([
					ctx.inbox.pop(),
					new Promise<{ content: string; timestamp: Date }>((resolve) => {
						setTimeout(
							() =>
								resolve({
									content: `timeout:${input.label}:pop`,
									timestamp: new Date(),
								}),
							100,
						);
					}),
				]);

				const drained = ctx.inbox.drain();
				const iterator = ctx.inbox[Symbol.asyncIterator]();
				const iterResult = await Promise.race([
					iterator.next(),
					new Promise<IteratorResult<{ content: string; timestamp: Date }>>(
						(resolve) => {
							setTimeout(
								() =>
									resolve({
										value: {
											content: `timeout:${input.label}:iter`,
											timestamp: new Date(),
										},
										done: false,
									}),
								100,
							);
						},
					),
				]);

				return {
					first: first.content,
					drained: drained.map((message) => message.content),
					iter: iterResult.value.content,
				};
			},
		};

		const runtime = createAgentRuntime(sessionId);
		const received: EnrichedEvent[] = [];

		runtime.hub.subscribe("*", (event) => {
			received.push(event);
		});

		runtime.hub.setStatus("running");
		runtime.hub.emit({ type: "harness:start", name: "test-runtime" });

		let runId: string | null = null;
		const unsubscribe = runtime.hub.subscribe("agent:start", (event) => {
			runId = (event.event as { runId: string }).runId;
			runtime.hub.sendToRun(runId, "first");
			runtime.hub.sendToRun(runId, "second");
			setTimeout(() => {
				if (runId) {
					runtime.hub.sendToRun(runId, "third");
				}
			}, 10);
		});

		const execution = await runtime.executeAgent(agent, { label: "basic" });
		unsubscribe();

		runtime.hub.emit({
			type: "harness:complete",
			success: true,
			durationMs: 0,
		});
		runtime.hub.setStatus("complete");
		runtime.close();

		const result = { runId: execution.runId, result: execution.output };

		return {
			sessionId,
			scenario: "inbox-basic",
			steps: [
				{
					type: "create",
					name: "test-runtime",
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
				result,
			},
			metadata: {
				recordedAt: new Date().toISOString(),
				component: "agent",
				description: "Agent inbox supports pop, drain, and async iteration",
			},
		};
	},

	"runid-uniqueness": async () => {
		const sessionId = "record-agent-runid-uniqueness";
		const agent: AgentDefinition<
			{ label: string },
			{ runId: string; message: string }
		> = {
			name: "receiver",
			execute: async (input, ctx) => {
				const message = await Promise.race([
					ctx.inbox.pop(),
					new Promise<{ content: string; timestamp: Date }>((resolve) => {
						setTimeout(
							() =>
								resolve({
									content: `timeout:${input.label}`,
									timestamp: new Date(),
								}),
							100,
						);
					}),
				]);
				return { runId: ctx.runId, message: message.content };
			},
		};

		const runtime = createAgentRuntime(sessionId);
		const received: EnrichedEvent[] = [];

		runtime.hub.subscribe("*", (event) => {
			received.push(event);
		});

		runtime.hub.setStatus("running");
		runtime.hub.emit({ type: "harness:start", name: "test-runtime" });

		const runIds: string[] = [];
		const unsubscribe = runtime.hub.subscribe("agent:start", (event) => {
			const runId = (event.event as { runId: string }).runId;
			runIds.push(runId);
			runtime.hub.sendToRun(runId, `message:${runId}`);
		});

		const results = await Promise.all([
			runtime.executeAgent(agent, { label: "one" }),
			runtime.executeAgent(agent, { label: "two" }),
		]);

		unsubscribe();

		runtime.hub.emit({
			type: "harness:complete",
			success: true,
			durationMs: 0,
		});
		runtime.hub.setStatus("complete");
		runtime.close();

		const result = {
			runIds,
			results: results.map((entry) => entry.output),
		};

		return {
			sessionId,
			scenario: "runid-uniqueness",
			steps: [
				{
					type: "create",
					name: "test-runtime",
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
				result,
			},
			metadata: {
				recordedAt: new Date().toISOString(),
				component: "agent",
				description: "RunId is unique per execution and routes correctly",
			},
		};
	},
};

// Define Flow scenarios
const flowScenarios: Record<string, () => Promise<FlowFixture>> = {
	"flowspec-structure": async () => {
		const sessionId = "record-flow-flowspec-structure";
		return {
			sessionId,
			scenario: "flowspec-structure",
			cases: [
				{
					name: "minimal",
					input: { name: "demo" },
					valid: true,
					expected: { name: "demo", version: 1, policy: { failFast: true } },
				},
				{
					name: "full",
					input: {
						name: "demo",
						version: 2,
						description: "desc",
						input: { country: "Benin" },
						policy: { failFast: false },
					},
					valid: true,
					expected: {
						name: "demo",
						version: 2,
						description: "desc",
						input: { country: "Benin" },
						policy: { failFast: false },
					},
				},
				{
					name: "missing-name",
					input: { version: 1 },
					valid: false,
				},
			],
			metadata: {
				recordedAt: new Date().toISOString(),
				component: "flow",
				description: "FlowSpec structure validation cases",
			},
		};
	},

	"nodespec-structure": async () => {
		const sessionId = "record-flow-nodespec-structure";
		return {
			sessionId,
			scenario: "nodespec-structure",
			cases: [
				{
					name: "valid",
					input: { id: "facts", type: "echo", input: { text: "hi" } },
					valid: true,
				},
				{
					name: "invalid-id",
					input: { id: "1bad", type: "echo", input: {} },
					valid: false,
				},
				{
					name: "missing-input",
					input: { id: "facts", type: "echo" },
					valid: false,
				},
			],
			metadata: {
				recordedAt: new Date().toISOString(),
				component: "flow",
				description: "NodeSpec structure validation cases",
			},
		};
	},

	"when-expr": async () => {
		const sessionId = "record-flow-when-expr";
		return {
			sessionId,
			scenario: "when-expr",
			cases: [
				{
					name: "equals",
					input: { equals: { var: "facts.ok", value: true } },
					valid: true,
				},
				{
					name: "not",
					input: { not: { equals: { var: "facts.ok", value: true } } },
					valid: true,
				},
				{
					name: "and",
					input: {
						and: [
							{ equals: { var: "a", value: 1 } },
							{ equals: { var: "b", value: 2 } },
						],
					},
					valid: true,
				},
				{
					name: "or",
					input: {
						or: [
							{ equals: { var: "a", value: 1 } },
							{ equals: { var: "b", value: 2 } },
						],
					},
					valid: true,
				},
				{
					name: "invalid",
					input: { equals: { value: true } },
					valid: false,
				},
			],
			metadata: {
				recordedAt: new Date().toISOString(),
				component: "flow",
				description: "WhenExpr grammar cases",
			},
		};
	},

	"binding-paths": async () => {
		const sessionId = "record-flow-binding-paths";
		return {
			sessionId,
			scenario: "binding-paths",
			context: {
				flow: { input: { country: "Benin" } },
				facts: { capital: "Porto-Novo" },
				isFrench: { value: true },
			},
			cases: [
				{
					name: "strict",
					template: "{{flow.input.country}}",
					expected: "Benin",
				},
				{
					name: "node-path",
					template: "Capital: {{facts.capital}}",
					expected: "Capital: Porto-Novo",
				},
				{
					name: "optional-missing",
					template: "{{?missing}}",
					expected: "",
				},
				{
					name: "default-missing",
					template: '{{missing | default:"Unknown"}}',
					expected: "Unknown",
				},
				{
					name: "strict-missing",
					template: "{{missing}}",
					error: true,
				},
			],
			metadata: {
				recordedAt: new Date().toISOString(),
				component: "flow",
				description: "Binding path resolution cases",
			},
		};
	},

	edges: async () => {
		const sessionId = "record-flow-edges";
		return {
			sessionId,
			scenario: "edges",
			cases: [
				{
					name: "valid",
					input: {
						flow: { name: "demo" },
						nodes: [
							{ id: "a", type: "echo", input: { text: "a" } },
							{ id: "b", type: "echo", input: { text: "b" } },
						],
						edges: [{ from: "a", to: "b" }],
					},
					valid: true,
				},
				{
					name: "missing-edge-target",
					input: {
						flow: { name: "demo" },
						nodes: [{ id: "a", type: "echo", input: { text: "a" } }],
						edges: [{ from: "a", to: "missing" }],
					},
					valid: false,
				},
				{
					name: "missing-edges-array",
					input: {
						flow: { name: "demo" },
						nodes: [{ id: "a", type: "echo", input: { text: "a" } }],
					},
					valid: false,
				},
			],
			metadata: {
				recordedAt: new Date().toISOString(),
				component: "flow",
				description: "Edge validation cases",
			},
		};
	},

	"node-policy": async () => {
		const sessionId = "record-flow-node-policy";
		return {
			sessionId,
			scenario: "node-policy",
			cases: [
				{
					name: "timeout",
					input: { timeoutMs: 1000 },
					valid: true,
				},
				{
					name: "retry",
					input: { retry: { maxAttempts: 2, backoffMs: 50 } },
					valid: true,
				},
				{
					name: "continue",
					input: { continueOnError: true },
					valid: true,
				},
				{
					name: "invalid-retry",
					input: { retry: { maxAttempts: 0 } },
					valid: false,
				},
			],
			metadata: {
				recordedAt: new Date().toISOString(),
				component: "flow",
				description: "NodePolicy validation cases",
			},
		};
	},

	"flowyaml-structure": async () => {
		const sessionId = "record-flow-flowyaml-structure";
		return {
			sessionId,
			scenario: "flowyaml-structure",
			cases: [
				{
					name: "valid",
					input: {
						flow: { name: "demo" },
						nodes: [{ id: "a", type: "echo", input: { text: "a" } }],
						edges: [],
					},
					valid: true,
				},
				{
					name: "duplicate-ids",
					input: {
						flow: { name: "demo" },
						nodes: [
							{ id: "a", type: "echo", input: { text: "a" } },
							{ id: "a", type: "echo", input: { text: "b" } },
						],
						edges: [],
					},
					valid: false,
				},
				{
					name: "missing-nodes",
					input: { flow: { name: "demo" }, edges: [] },
					valid: false,
				},
			],
			metadata: {
				recordedAt: new Date().toISOString(),
				component: "flow",
				description: "FlowYaml structure validation cases",
			},
		};
	},
};

// Define Provider scenarios
const providerScenarios: Record<
	string,
	Record<string, () => Promise<ProviderFixture>>
> = {
	claude: {
		agent: async () => {
			const sessionId = "record-provider-claude-agent";
			const prompt = "Say hello";
			const agent = createClaudeAgent({
				replay: (input) =>
					input.prompt === prompt ? { text: "Hello!" } : undefined,
			});
			const hub = createHub(sessionId);
			const inbox = new AgentInboxImpl();
			const output = await agent.execute(
				{ prompt },
				{ hub, inbox, runId: "run-0" },
			);

			return {
				sessionId,
				scenario: "agent",
				cases: [
					{
						name: "basic",
						input: { prompt },
						expected: output,
					},
				],
				metadata: {
					recordedAt: new Date().toISOString(),
					component: "providers/claude",
					description: "Claude agent replay output",
				},
			};
		},
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

		const fixture = await withFrozenTime(scenarioFn);

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
	} else if (component === "agent") {
		const scenarioFn = agentScenarios[fixtureName];
		if (!scenarioFn) {
			console.error(`Unknown Agent fixture: ${fixtureName}`);
			console.error(
				`Available fixtures: ${Object.keys(agentScenarios).join(", ")}`,
			);
			process.exit(1);
		}

		const fixture = await withFrozenTime(scenarioFn);

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
	} else if (component === "flow") {
		const scenarioFn = flowScenarios[fixtureName];
		if (!scenarioFn) {
			console.error(`Unknown Flow fixture: ${fixtureName}`);
			console.error(
				`Available fixtures: ${Object.keys(flowScenarios).join(", ")}`,
			);
			process.exit(1);
		}

		const fixture = await withFrozenTime(scenarioFn);

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
	} else if (component.startsWith("providers/")) {
		const providerName = component.split("/")[1];
		const scenarios = providerName
			? providerScenarios[providerName]
			: undefined;
		const scenarioFn = scenarios?.[fixtureName];
		if (!scenarioFn) {
			console.error(`Unknown Provider fixture: ${component}/${fixtureName}`);
			console.error(
				`Available fixtures: ${Object.keys(providerScenarios)
					.map((name) => `providers/${name}`)
					.join(", ")}`,
			);
			process.exit(1);
		}

		const fixture = await withFrozenTime(scenarioFn);

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
		console.error(`Supported components: hub, agent, flow, providers/<name>`);
		process.exit(1);
	}
}

recordFixture().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
