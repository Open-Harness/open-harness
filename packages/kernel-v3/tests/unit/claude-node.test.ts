import { describe, expect, test } from "bun:test";
import { join } from "path";
import { createMockQuery, createRuntime, DefaultNodeRegistry, parseFlowYaml } from "../../src/index.js";
import { createClaudeNode, resolveOutputSchema } from "../../src/nodes/claude.agent.js";
import type { FixtureFile } from "../../src/testing/mock-query.js";
import { FixtureSchema } from "../../src/testing/mock-query.js";

async function loadFixture(name: string): Promise<FixtureFile> {
	const fixturePath = new URL(`../fixtures/recordings/example/${name}.json`, import.meta.url);
	return FixtureSchema.parse(await Bun.file(fixturePath).json()) as FixtureFile;
}

async function runWithFixture(fixtureName: string, fixtureKey: string) {
	const flow = parseFlowYaml(`
name: "claude"
nodes:
  - id: agent
    type: claude.agent
    input:
      prompt: "fixture:${fixtureKey}"
edges: []
`);

	const fixture = await loadFixture(fixtureName);
	const mockQuery = createMockQuery({
		fixtures: { [fixtureKey]: fixture },
		selectFixtureKey: () => fixtureKey,
	});
	const claudeNode = createClaudeNode({ queryFn: mockQuery });

	const registry = new DefaultNodeRegistry();
	registry.register(claudeNode);

	const runtime = createRuntime({ flow, registry });
	const events: Array<{ type: string; [key: string]: unknown }> = [];
	runtime.onEvent((event) => {
		events.push(event);
	});

	const snapshot = await runtime.run();
	return { snapshot, events };
}

describe("claude node event emission", () => {
	describe("streaming text (agent:text:delta)", () => {
		test("emits agent:text:delta for stream_event with text_delta", async () => {
			const { events } = await runWithFixture("agent", "agent");

			const textDeltas = events.filter((e) => e.type === "agent:text:delta");
			expect(textDeltas.length).toBeGreaterThan(0);
			expect((textDeltas[0] as { content: string }).content).toBe("fixture ");
		});

		test("ALSO emits agent:text when streaming occurs (both events are emitted)", async () => {
			const { events } = await runWithFixture("agent", "agent");

			// Both delta and complete events should be emitted
			const textDeltas = events.filter((e) => e.type === "agent:text:delta");
			const textComplete = events.filter((e) => e.type === "agent:text");
			expect(textDeltas.length).toBeGreaterThan(0);
			expect(textComplete.length).toBeGreaterThan(0);
		});
	});

	describe("non-streaming text (agent:text only)", () => {
		test("emits agent:text for assistant message without stream_event", async () => {
			const { events } = await runWithFixture("agent-no-streaming", "no-streaming");

			const textComplete = events.filter((e) => e.type === "agent:text");
			expect(textComplete.length).toBeGreaterThan(0);
			expect((textComplete[0] as { content: string }).content).toBe("complete text without streaming");
		});

		test("does NOT emit agent:text:delta when no stream_event occurs", async () => {
			const { events } = await runWithFixture("agent-no-streaming", "no-streaming");

			// No stream_event means no deltas, but complete event is still emitted
			const textDeltas = events.filter((e) => e.type === "agent:text:delta");
			expect(textDeltas.length).toBe(0);
		});
	});

	describe("streaming thinking (agent:thinking:delta)", () => {
		test("emits agent:thinking:delta for stream_event with thinking_delta", async () => {
			const { events } = await runWithFixture("agent-thinking-stream", "thinking-stream");

			const thinkingDeltas = events.filter((e) => e.type === "agent:thinking:delta");
			expect(thinkingDeltas.length).toBeGreaterThan(0);
			expect((thinkingDeltas[0] as { content: string }).content).toBe("Let me think about this...");
		});

		test("emits both thinking deltas AND complete thinking events when streaming", async () => {
			const { events } = await runWithFixture("agent-thinking-stream", "thinking-stream");

			// Both delta and complete events should be emitted - not mutually exclusive
			const thinkingDeltas = events.filter((e) => e.type === "agent:thinking:delta");
			const textDeltas = events.filter((e) => e.type === "agent:text:delta");

			expect(thinkingDeltas.length).toBeGreaterThan(0);
			expect(textDeltas.length).toBeGreaterThan(0);
		});
	});

	describe("non-streaming thinking (agent:thinking only)", () => {
		test("emits agent:thinking for thinking block without stream_event", async () => {
			const { events } = await runWithFixture("agent-thinking-no-stream", "thinking-no-stream");

			const thinkingComplete = events.filter((e) => e.type === "agent:thinking");
			expect(thinkingComplete.length).toBeGreaterThan(0);
			expect((thinkingComplete[0] as { content: string }).content).toBe("Complete thinking block without streaming");
		});

		test("emits agent:text for text block without stream_event", async () => {
			const { events } = await runWithFixture("agent-thinking-no-stream", "thinking-no-stream");

			const textComplete = events.filter((e) => e.type === "agent:text");
			expect(textComplete.length).toBeGreaterThan(0);
			expect((textComplete[0] as { content: string }).content).toBe("answer with thinking block");
		});

		test("does NOT emit delta events when no stream_event occurs", async () => {
			const { events } = await runWithFixture("agent-thinking-no-stream", "thinking-no-stream");

			// No stream_event means no deltas, but complete events are still emitted
			const thinkingDeltas = events.filter((e) => e.type === "agent:thinking:delta");
			const textDeltas = events.filter((e) => e.type === "agent:text:delta");

			expect(thinkingDeltas.length).toBe(0);
			expect(textDeltas.length).toBe(0);
		});
	});

	describe("agent:complete always emitted", () => {
		test("emits agent:complete with result from streaming fixture", async () => {
			const { events, snapshot } = await runWithFixture("agent", "agent");

			const complete = events.find((e) => e.type === "agent:complete") as { result: string } | undefined;
			expect(complete).toBeDefined();
			expect(complete?.result).toBe("fixture done");
			expect((snapshot.outputs.agent as { text: string }).text).toBe("fixture done");
		});

		test("emits agent:complete with result from non-streaming fixture", async () => {
			const { events, snapshot } = await runWithFixture("agent-no-streaming", "no-streaming");

			const complete = events.find((e) => e.type === "agent:complete") as { result: string } | undefined;
			expect(complete).toBeDefined();
			expect(complete?.result).toBe("complete text without streaming");
			expect((snapshot.outputs.agent as { text: string }).text).toBe("complete text without streaming");
		});
	});

	describe("agent:start always emitted", () => {
		test("emits agent:start with sessionId and prompt", async () => {
			const { events } = await runWithFixture("agent", "agent");

			const start = events.find((e) => e.type === "agent:start") as {
				sessionId: string;
				prompt: string;
				timestamp: number;
			} | undefined;

			expect(start).toBeDefined();
			expect(start?.sessionId).toBe("sess-fixture-1");
			expect(start?.prompt).toBe("fixture:agent");
			expect(typeof start?.timestamp).toBe("number");
		});
	});
});

describe("resolveOutputSchema", () => {
	// Get the test fixtures directory path relative to cwd
	const fixturesDir = join(import.meta.dir, "../fixtures/schemas");

	describe("no options", () => {
		test("returns undefined when options is undefined", () => {
			expect(resolveOutputSchema(undefined)).toBeUndefined();
		});

		test("returns options as-is when no schema specified", () => {
			const result = resolveOutputSchema({ model: "claude-sonnet-4-20250514" });
			expect(result).toEqual({ model: "claude-sonnet-4-20250514" });
		});
	});

	describe("inline outputFormat", () => {
		test("passes through inline outputFormat directly", () => {
			const schema = { type: "object", properties: { test: { type: "string" } } };
			const result = resolveOutputSchema({
				outputFormat: { type: "json_schema", schema },
			});

			expect(result).toEqual({
				outputFormat: { type: "json_schema", schema },
			});
		});

		test("inline outputFormat takes precedence over outputSchemaFile", () => {
			const schema = { type: "object", properties: { inline: { type: "boolean" } } };
			const result = resolveOutputSchema({
				outputFormat: { type: "json_schema", schema },
				outputSchemaFile: join(fixturesDir, "greeting-schema.json"),
			});

			// inline format should win
			expect(result).toEqual({
				outputFormat: { type: "json_schema", schema },
			});
		});
	});

	describe("file-based outputSchemaFile", () => {
		test("loads schema from file and converts to outputFormat", () => {
			const result = resolveOutputSchema({
				outputSchemaFile: join(fixturesDir, "greeting-schema.json"),
			});

			expect(result).toEqual({
				outputFormat: {
					type: "json_schema",
					schema: {
						type: "object",
						properties: { greeting: { type: "string" } },
						required: ["greeting"],
					},
				},
			});
		});

		test("throws for missing file", () => {
			expect(() =>
				resolveOutputSchema({
					outputSchemaFile: "./nonexistent-schema.json",
				}),
			).toThrow("outputSchemaFile not found");
		});

		test("throws for invalid JSON", () => {
			// Create a path that exists but isn't valid JSON (use the test file itself)
			expect(() =>
				resolveOutputSchema({
					outputSchemaFile: join(fixturesDir, "../../../src/index.ts"),
				}),
			).toThrow("Failed to load outputSchemaFile");
		});

		test("preserves other SDK options when loading from file", () => {
			const result = resolveOutputSchema({
				outputSchemaFile: join(fixturesDir, "greeting-schema.json"),
				model: "claude-sonnet-4-20250514",
				maxTurns: 5,
			});

			expect(result).toMatchObject({
				model: "claude-sonnet-4-20250514",
				maxTurns: 5,
				outputFormat: {
					type: "json_schema",
					schema: expect.any(Object),
				},
			});
		});
	});
});
