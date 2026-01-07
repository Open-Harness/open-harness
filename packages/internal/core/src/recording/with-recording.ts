import type { ExecutionContext } from "../providers/context.js";
import type { StreamEvent } from "../providers/events.js";
import type { ProviderTrait } from "../providers/trait.js";
import { createRecordedEvent } from "./normalize.js";
import type { Recording, RecordingMetadata } from "./types.js";
import type { RecordingStore } from "./store.js";

export type RecordingMode = "live" | "record" | "replay" | "passthrough";

export type RecordingHashFn<TInput> = (input: TInput) => string;
export type RecordingIdFn<TInput> = (input: TInput, inputHash: string) => string;
export type RecordingMetadataFn<TInput> = (
	input: TInput,
) => Omit<RecordingMetadata, "providerType" | "createdAt" | "inputHash">;

export type WithRecordingOptions<TInput> = {
	mode: RecordingMode;
	store?: RecordingStore;
	recordingId?: string;
	getInputHash?: RecordingHashFn<TInput>;
	getRecordingId?: RecordingIdFn<TInput>;
	getMetadata?: RecordingMetadataFn<TInput>;
	now?: () => number;
};

export function withRecording<TInput, TOutput>(
	trait: ProviderTrait<TInput, TOutput>,
	options: WithRecordingOptions<TInput>,
): ProviderTrait<TInput, TOutput> {
	return {
		...trait,
		async *execute(input: TInput, ctx: ExecutionContext): AsyncGenerator<StreamEvent, TOutput> {
			const mode = options.mode;

			if (mode === "live") {
				return await runProvider(trait, input, ctx);
			}

			if (mode === "replay") {
				return await replayProvider(trait, options, input, ctx);
			}

			if (mode === "passthrough") {
				return await runProvider(trait, input, ctx);
			}

			const store = options.store;
			if (!store) {
				throw new Error("RecordingStore is required for record mode");
			}

			return await recordProvider(trait, options, input, ctx, store);
		},
	};
}

async function runProvider<TInput, TOutput>(
	trait: ProviderTrait<TInput, TOutput>,
	input: TInput,
	ctx: ExecutionContext,
): Promise<TOutput> {
	const generator = trait.execute(input, ctx);
	// Providers should emit events via ctx.emit. Yields are ignored.
	while (true) {
		const result = await generator.next();
		if (result.done) {
			if (result.value === undefined) {
				throw new Error("Provider returned no output");
			}
			return result.value;
		}
	}
}

async function recordProvider<TInput, TOutput>(
	trait: ProviderTrait<TInput, TOutput>,
	options: WithRecordingOptions<TInput>,
	input: TInput,
	ctx: ExecutionContext,
	store: RecordingStore,
): Promise<TOutput> {
	const inputHash = options.getInputHash?.(input);
	if (!inputHash) {
		throw new Error("inputHash is required for recording");
	}

	const recordingId =
		options.recordingId ?? options.getRecordingId?.(input, inputHash) ?? inputHash;

	const now = options.now ?? Date.now;
	const metadata: RecordingMetadata = {
		providerType: trait.type,
		createdAt: new Date(now()).toISOString(),
		inputHash,
		...options.getMetadata?.(input),
	};

	const events: Recording<TOutput>["events"] = [];
	let seq = 0;

	const recordingCtx: ExecutionContext = {
		signal: ctx.signal,
		emit: (event) => {
			const recorded = createRecordedEvent((seq += 1), event, now());
			events.push(recorded);
			ctx.emit(event);
		},
	};

	try {
		const output = await runProvider(trait, input, recordingCtx);
		await store.save({
			id: recordingId,
			metadata,
			events,
			output,
		});
		return output;
	} catch (error) {
		const recordingError = {
			code: "EXECUTION_ERROR",
			message: errorMessage(error),
		};
		await store.save({
			id: recordingId,
			metadata,
			events,
			error: recordingError,
		});
		throw error;
	}
}

async function replayProvider<TInput, TOutput>(
	trait: ProviderTrait<TInput, TOutput>,
	options: WithRecordingOptions<TInput>,
	input: TInput,
	ctx: ExecutionContext,
): Promise<TOutput> {
	const store = options.store;
	if (!store) {
		throw new Error("RecordingStore is required for replay mode");
	}

	const inputHash = options.getInputHash?.(input);
	const recordingId =
		options.recordingId ??
		(inputHash ? options.getRecordingId?.(input, inputHash) ?? inputHash : undefined);

	if (!recordingId) {
		throw new Error("recordingId is required for replay mode");
	}

	const recording = await store.load<TOutput>(recordingId);
	if (!recording) {
		throw new Error(`Recording not found: ${recordingId}`);
	}

	for (const recorded of recording.events) {
		if (ctx.signal.aborted) {
			throw new Error("Aborted");
		}
		ctx.emit(recorded.event);
	}

	if (recording.error) {
		throw new Error(recording.error.message);
	}

	if (recording.output === undefined) {
		throw new Error("Recording has no output");
	}

	return recording.output;
}

function errorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}
