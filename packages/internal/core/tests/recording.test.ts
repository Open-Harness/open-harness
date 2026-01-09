import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { ExecutionContext } from "../src/providers/context.js";
import type { ProviderTrait } from "../src/providers/trait.js";
import type { StreamEvent } from "../src/providers/events.js";
import { InMemoryRecordingStore } from "../src/recording/memory-store.js";
import { withRecording } from "../src/recording/with-recording.js";

type TestInput = { prompt: string };
type TestOutput = { text: string };

const testTrait: ProviderTrait<TestInput, TestOutput> = {
	type: "test.provider",
	displayName: "Test Provider",
	capabilities: { streaming: true, structuredOutput: true },
	inputSchema: z.object({ prompt: z.string() }),
	outputSchema: z.object({ text: z.string() }),
	async *execute(input, ctx): AsyncGenerator<StreamEvent, TestOutput> {
		ctx.emit({ type: "text", content: "hello", delta: true });
		ctx.emit({ type: "text", content: "world", delta: true });
		return { text: input.prompt };
	},
};

async function runTrait<TInput, TOutput>(
	trait: ProviderTrait<TInput, TOutput>,
	input: TInput,
	ctx: ExecutionContext,
): Promise<TOutput> {
	const generator = trait.execute(input, ctx);
	const result = await generator.next();
	if (!result.done) {
		throw new Error("Provider yielded unexpectedly");
	}
	return result.value as TOutput;
}

function createContext() {
	const events: StreamEvent[] = [];
	const ctx: ExecutionContext = {
		signal: new AbortController().signal,
		emit: (event) => {
			events.push(event);
		},
	};
	return { ctx, events };
}

describe("withRecording", () => {
	test("records and replays events/output", async () => {
		const store = new InMemoryRecordingStore();
		const now = () => 1_700_000_000_000;

		const { ctx: recordCtx, events: recordEvents } = createContext();
		const recordTrait = withRecording(testTrait, {
			mode: "record",
			store,
			getInputHash: () => "hash-1",
			now,
		});
		const output = await runTrait(recordTrait, { prompt: "hi" }, recordCtx);
		expect(output).toEqual({ text: "hi" });
		expect(recordEvents.map((event) => event.type)).toEqual(["text", "text"]);

		const recording = await store.load<TestOutput>("hash-1");
		expect(recording?.metadata).toEqual({
			providerType: "test.provider",
			createdAt: new Date(now()).toISOString(),
			inputHash: "hash-1",
		});
		expect(recording?.events.map((event) => event.seq)).toEqual([1, 2]);

		const { ctx: replayCtx, events: replayEvents } = createContext();
		const replayTrait = withRecording(testTrait, {
			mode: "replay",
			store,
			recordingId: "hash-1",
		});
		const replayOutput = await runTrait(replayTrait, { prompt: "ignored" }, replayCtx);
		expect(replayOutput).toEqual({ text: "hi" });
		expect(replayEvents.map((event) => event.type)).toEqual(["text", "text"]);
	});

	test("record mode requires inputHash", async () => {
		const store = new InMemoryRecordingStore();
		const recordTrait = withRecording(testTrait, { mode: "record", store });
		const { ctx } = createContext();
		await expect(runTrait(recordTrait, { prompt: "hi" }, ctx)).rejects.toThrow(
			"inputHash is required for recording",
		);
	});
});

describe("InMemoryRecordingStore", () => {
	test("lists recordings by query", async () => {
		const store = new InMemoryRecordingStore();
		await store.save({
			id: "rec-1",
			metadata: {
				providerType: "provider-a",
				createdAt: new Date(0).toISOString(),
				inputHash: "hash-1",
			},
			events: [],
			output: { text: "one" },
		});
		await store.save({
			id: "rec-2",
			metadata: {
				providerType: "provider-b",
				createdAt: new Date(0).toISOString(),
				inputHash: "hash-2",
			},
			events: [],
			output: { text: "two" },
		});

		const all = await store.list();
		expect(all).toHaveLength(2);

		const providerFiltered = await store.list({ providerType: "provider-a" });
		expect(providerFiltered).toHaveLength(1);
		expect(providerFiltered[0]?.inputHash).toBe("hash-1");

		const hashFiltered = await store.list({ inputHash: "hash-2" });
		expect(hashFiltered).toHaveLength(1);
		expect(hashFiltered[0]?.providerType).toBe("provider-b");
	});
});
