import { describe, expect, test } from "bun:test";
import type { Options, Query, SDKMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { NodeTypeDefinition } from "@open-harness/core";
import { createRuntime, DefaultNodeRegistry, parseFlowYaml } from "@open-harness/core";
import { createClaudeNode } from "../../src/index.js";

type QueryFactory = (params: { prompt: string | AsyncIterable<SDKUserMessage>; options?: Options }) => Query;

function attachQueryStubs(iterator: AsyncGenerator<SDKMessage>): Query {
	const query = iterator as Query;
	query.interrupt = async () => {};
	query.setPermissionMode = async () => {};
	query.setModel = async () => {};
	query.setMaxThinkingTokens = async () => {};
	query.supportedCommands = async () => [];
	query.supportedModels = async () => [];
	query.mcpServerStatus = async () => [];
	query.accountInfo = async () => ({}) as Query["accountInfo"] extends () => Promise<infer T> ? T : never;
	query.rewindFiles = async () => {};
	query.setMcpServers = async () => ({ added: [], removed: [], errors: {} });
	query.streamInput = async () => {};
	return query;
}

function createInterruptibleQuery(): QueryFactory {
	return () => {
		let interrupted = false;
		const iterator = (async function* () {
			yield {
				type: "stream_event",
				event: {
					type: "content_block_delta",
					delta: { type: "text_delta", text: "Hi" },
				},
			} as SDKMessage;
			while (!interrupted) {
				await new Promise<void>((resolve) => setTimeout(resolve, 5));
			}
		})();
		const query = attachQueryStubs(iterator);
		query.interrupt = async () => {
			interrupted = true;
		};
		return query;
	};
}

function createAbortableQuery(): QueryFactory {
	return ({ options }) => {
		const signal = options?.abortController?.signal;
		const iterator = (async function* () {
			yield {
				type: "stream_event",
				event: {
					type: "content_block_delta",
					delta: { type: "text_delta", text: "Hi" },
				},
			} as SDKMessage;
			if (!signal) return;
			await new Promise<void>((_, reject) => {
				if (signal.aborted) {
					const abortError = new Error("Aborted");
					abortError.name = "AbortError";
					reject(abortError);
					return;
				}
				signal.addEventListener(
					"abort",
					() => {
						const abortError = new Error("Aborted");
						abortError.name = "AbortError";
						reject(abortError);
					},
					{ once: true },
				);
			});
		})();
		const query = attachQueryStubs(iterator);
		return query;
	};
}

describe("cancellation", () => {
	test("pause interrupts claude node and emits agent:paused", async () => {
		const flow = parseFlowYaml(`
name: "pause"
nodes:
  - id: agent
    type: claude.agent
    input:
      prompt: "pause"
edges: []
`);

		const registry = new DefaultNodeRegistry();
		registry.register(createClaudeNode({ queryFn: createInterruptibleQuery() }));

		const runtime = createRuntime({ flow, registry });
		const events: Array<{ type: string }> = [];
		runtime.onEvent((event) => {
			events.push(event);
			// Trigger pause on streaming delta (not agent:text which requires assistant message)
			if (event.type === "agent:text:delta") {
				runtime.dispatch({ type: "abort", resumable: true });
			}
		});

		const snapshot = await runtime.run();
		expect(snapshot.status).toBe("paused");
		expect(snapshot.nodeStatus.agent).toBe("running");

		// Note: output.text is no longer set on pause - SDK maintains history via sessionId
		// Consumers needing partial text should accumulate from agent:text:delta events
		const output = snapshot.outputs.agent as { paused?: boolean; sessionId?: string } | undefined;
		expect(output?.paused).toBe(true);
		expect(events.some((event) => event.type === "agent:paused")).toBe(true);
	});

	test("abort interrupts claude node and emits agent:aborted", async () => {
		const flow = parseFlowYaml(`
name: "abort"
nodes:
  - id: agent
    type: claude.agent
    input:
      prompt: "abort"
edges: []
`);

		const registry = new DefaultNodeRegistry();
		registry.register(createClaudeNode({ queryFn: createAbortableQuery() }));

		const runtime = createRuntime({ flow, registry });
		const events: Array<{ type: string }> = [];
		runtime.onEvent((event) => {
			events.push(event);
			// Trigger abort on streaming delta (not agent:text which requires assistant message)
			if (event.type === "agent:text:delta") {
				runtime.dispatch({ type: "abort", resumable: false });
			}
		});

		const snapshot = await runtime.run();
		expect(snapshot.status).toBe("aborted");
		expect(snapshot.nodeStatus.agent).toBe("running");
		expect(snapshot.outputs.agent).toBeUndefined();
		expect(events.some((event) => event.type === "agent:aborted")).toBe(true);
	});

	test("cancel context fires onCancel callbacks", async () => {
		const flow = parseFlowYaml(`
name: "cancel"
nodes:
  - id: wait
    type: wait
    input: {}
edges: []
`);

		let cancelReason: string | undefined;
		let markStarted: (() => void) | null = null;
		const started = new Promise<void>((resolve) => {
			markStarted = resolve;
		});
		const waitNode: NodeTypeDefinition<Record<string, never>, { done: boolean }> = {
			type: "wait",
			run: async (ctx) => {
				markStarted?.();
				markStarted = null;
				return await new Promise<{ done: boolean }>((resolve) => {
					const done = () => resolve({ done: true });
					ctx.cancel.onCancel(() => {
						cancelReason = ctx.cancel.reason;
						done();
					});
					if (ctx.cancel.cancelled) {
						cancelReason = ctx.cancel.reason;
						done();
					}
				});
			},
		};

		const registry = new DefaultNodeRegistry();
		registry.register(waitNode);

		const runtime = createRuntime({ flow, registry });
		const runPromise = runtime.run();
		await started;
		runtime.dispatch({ type: "abort", resumable: true });
		const snapshot = await runPromise;
		expect(snapshot.status).toBe("paused");
		expect(cancelReason).toBe("pause");
	});
});
