import { describe, expect, test } from "bun:test";
import { createHub } from "../../src/engine/hub.js";
import { executeFlow } from "../../src/flow/executor.js";
import { echoNode } from "../../src/flow/nodes/echo.js";
import { NodeRegistry } from "../../src/flow/registry.js";
import type { FlowYaml, NodeTypeDefinition } from "../../src/protocol/flow.js";

const passthroughSchema = { parse: (value: unknown) => value };

describe("Flow policy enforcement", () => {
	test("retries a flaky node and succeeds", async () => {
		let attempts = 0;
		const flakyNode: NodeTypeDefinition<{ label: string }, { label: string }> =
			{
				type: "flaky",
				inputSchema: passthroughSchema,
				outputSchema: passthroughSchema,
				run: async (_ctx, input) => {
					attempts += 1;
					if (attempts < 2) {
						throw new Error("flaky failure");
					}
					return { label: input.label };
				},
			};

		const registry = new NodeRegistry();
		registry.register(flakyNode);
		registry.register(echoNode);

		const flow: FlowYaml = {
			flow: { name: "policy-retry" },
			nodes: [
				{
					id: "flaky",
					type: "flaky",
					input: { label: "ok" },
					policy: { retry: { maxAttempts: 2, backoffMs: 0 } },
				},
				{
					id: "echo",
					type: "echo",
					input: { text: "{{flaky.label}}" },
				},
			],
			edges: [{ from: "flaky", to: "echo" }],
		};

		const hub = createHub("policy-retry");
		const phase = async <T>(_name: string, fn: () => Promise<T>) => fn();
		const task = async <T>(_id: string, fn: () => Promise<T>) => fn();

		const result = await executeFlow(flow, registry, { hub, phase, task });

		expect(attempts).toBe(2);
		expect(result.outputs.flaky).toEqual({ label: "ok" });
		expect(result.outputs.echo).toEqual({ text: "ok" });
	});

	test("timeout records error marker and continues when allowed", async () => {
		const slowNode: NodeTypeDefinition<{ ms: number }, { waited: number }> = {
			type: "slow",
			inputSchema: passthroughSchema,
			outputSchema: passthroughSchema,
			run: async (_ctx, input) => {
				await new Promise<void>((resolve) => {
					setTimeout(resolve, input.ms);
				});
				return { waited: input.ms };
			},
		};

		const registry = new NodeRegistry();
		registry.register(slowNode);
		registry.register(echoNode);

		const flow: FlowYaml = {
			flow: { name: "policy-timeout" },
			nodes: [
				{
					id: "slow",
					type: "slow",
					input: { ms: 30 },
					policy: { timeoutMs: 5, continueOnError: true },
				},
				{
					id: "echo",
					type: "echo",
					input: { text: "done" },
				},
			],
			edges: [{ from: "slow", to: "echo" }],
		};

		const hub = createHub("policy-timeout");
		const phase = async <T>(_name: string, fn: () => Promise<T>) => fn();
		const task = async <T>(_id: string, fn: () => Promise<T>) => fn();

		const result = await executeFlow(flow, registry, { hub, phase, task });

		expect(result.outputs.slow).toMatchObject({ failed: true });
		expect(result.outputs.echo).toEqual({ text: "done" });
	});

	test("failFast false continues on failure without continueOnError", async () => {
		const failNode: NodeTypeDefinition<{ label: string }, { label: string }> = {
			type: "fail",
			inputSchema: passthroughSchema,
			outputSchema: passthroughSchema,
			run: async (_ctx, input) => {
				throw new Error(`fail:${input.label}`);
			},
		};

		const registry = new NodeRegistry();
		registry.register(failNode);
		registry.register(echoNode);

		const flow: FlowYaml = {
			flow: { name: "policy-failfast-false", policy: { failFast: false } },
			nodes: [
				{
					id: "fail",
					type: "fail",
					input: { label: "x" },
				},
				{
					id: "echo",
					type: "echo",
					input: { text: "still running" },
				},
			],
			edges: [{ from: "fail", to: "echo" }],
		};

		const hub = createHub("policy-failfast-false");
		const phase = async <T>(_name: string, fn: () => Promise<T>) => fn();
		const task = async <T>(_id: string, fn: () => Promise<T>) => fn();

		const result = await executeFlow(flow, registry, { hub, phase, task });

		expect(result.outputs.fail).toMatchObject({ failed: true });
		expect(result.outputs.echo).toEqual({ text: "still running" });
	});

	test("failFast true aborts when continueOnError is false", async () => {
		const failNode: NodeTypeDefinition<{ label: string }, { label: string }> = {
			type: "fail",
			inputSchema: passthroughSchema,
			outputSchema: passthroughSchema,
			run: async (_ctx, input) => {
				throw new Error(`fail:${input.label}`);
			},
		};

		const registry = new NodeRegistry();
		registry.register(failNode);

		const flow: FlowYaml = {
			flow: { name: "policy-failfast-true", policy: { failFast: true } },
			nodes: [
				{
					id: "fail",
					type: "fail",
					input: { label: "x" },
				},
			],
			edges: [],
		};

		const hub = createHub("policy-failfast-true");
		const phase = async <T>(_name: string, fn: () => Promise<T>) => fn();
		const task = async <T>(_id: string, fn: () => Promise<T>) => fn();

		let threw = false;
		try {
			await executeFlow(flow, registry, { hub, phase, task });
		} catch {
			threw = true;
		}

		expect(threw).toBe(true);
	});
});
