import { describe, expect, test } from "bun:test";
import type {
	RecordedEvent,
	Recording,
	RecordingMetadata,
	RecordingStore,
} from "@open-harness/core";

export function sampleRecordingMetadata(
	providerType: string,
	inputHash: string,
): RecordingMetadata {
	return {
		providerType,
		createdAt: new Date(0).toISOString(),
		inputHash,
	};
}

export function sampleRecordedEvent(
	seq: number,
	content: string,
): RecordedEvent {
	return {
		seq,
		timestamp: seq * 1000,
		event: { type: "text", content, delta: true },
	};
}

export function sampleRecording(
	id: string,
	providerType: string,
): Recording<{ text: string }> {
	return {
		id,
		metadata: sampleRecordingMetadata(providerType, `hash-${id}`),
		events: [sampleRecordedEvent(1, "first"), sampleRecordedEvent(2, "second")],
		output: { text: `output-${id}` },
	};
}

export function recordingStoreContract(
	name: string,
	createStore: () => { store: RecordingStore; cleanup?: () => void },
) {
	describe(name, () => {
		test("save/load recordings with ordered events", async () => {
			const { store, cleanup } = createStore();
			const recording = sampleRecording("rec-1", "provider-a");
			await store.save(recording);

			const loaded = await store.load<{ text: string }>("rec-1");
			expect(loaded).not.toBeNull();
			expect(loaded?.metadata).toEqual(recording.metadata);
			expect(loaded?.output).toEqual(recording.output);
			expect(loaded?.events.map((event) => event.seq)).toEqual([1, 2]);
			expect(loaded?.events[0]?.event).toEqual(
				expect.objectContaining({ type: "text", content: "first" }),
			);
			cleanup?.();
		});

		test("list filters by providerType and inputHash", async () => {
			const { store, cleanup } = createStore();
			await store.save(sampleRecording("rec-1", "provider-a"));
			await store.save(sampleRecording("rec-2", "provider-b"));

			const all = await store.list();
			expect(all).toHaveLength(2);

			const providerFiltered = await store.list({ providerType: "provider-a" });
			expect(providerFiltered).toHaveLength(1);
			expect(providerFiltered[0]?.providerType).toBe("provider-a");

			const hashFiltered = await store.list({ inputHash: "hash-rec-2" });
			expect(hashFiltered).toHaveLength(1);
			expect(hashFiltered[0]?.inputHash).toBe("hash-rec-2");
			cleanup?.();
		});
	});
}
