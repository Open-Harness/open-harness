import { describe, expect, test } from "bun:test";
import { createRealtimeVoiceChannel } from "../src/channel/RealtimeVoiceChannel";
import { MockHub } from "./helpers/mock-hub";
import { createTestServer } from "./helpers/ws-server";

const waitForEvent = async (
	hub: MockHub,
	predicate: (eventType: string) => boolean,
	timeoutMs = 2000,
) => {
	const start = Date.now();
	for (;;) {
		const found = hub.events.find((evt) => predicate(evt.event.type));
		if (found) return found;
		if (Date.now() - start > timeoutMs) {
			throw new Error("Timed out waiting for hub event");
		}
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
};

describe("RealtimeVoiceChannel (ws integration)", () => {
	test("maps voice input commands to realtime messages", async () => {
		const server = await createTestServer();
		const hub = new MockHub();
		const cleanup = createRealtimeVoiceChannel({
			apiKey: "test-key",
			model: "test-model",
			voice: "test-voice",
			wsUrl: server.url,
			useLocalMic: false,
			useLocalSpeaker: false,
			logLevel: "silent",
			errorLogPath: "/dev/null",
		})(hub);

		await server.waitForMessage((msg) => msg.type === "session.update");

		hub.emit({ type: "voice:input:start" });
		await server.waitForMessage(
			(msg) => msg.type === "input_audio_buffer.clear",
		);

		const pcm = Buffer.from([1, 2, 3, 4]);
		hub.emit({ type: "voice:input:audio", audio: pcm.toString("base64") });
		await server.waitForMessage(
			(msg) => msg.type === "input_audio_buffer.append",
		);

		hub.emit({ type: "voice:input:commit" });
		await server.waitForMessage(
			(msg) => msg.type === "input_audio_buffer.commit",
		);
		await server.waitForMessage((msg) => msg.type === "response.create");

		if (cleanup) await cleanup();
		await server.close();
	});

	test("emits assistant text and audio events from realtime", async () => {
		const server = await createTestServer();
		const hub = new MockHub();
		const cleanup = createRealtimeVoiceChannel({
			apiKey: "test-key",
			model: "test-model",
			voice: "test-voice",
			wsUrl: server.url,
			useLocalMic: false,
			useLocalSpeaker: false,
			logLevel: "silent",
			errorLogPath: "/dev/null",
		})(hub);

		await server.waitForMessage((msg) => msg.type === "session.update");

		server.send({ type: "response.text.delta", delta: "Hello" });
		server.send({ type: "response.done" });

		const assistantEvent = await waitForEvent(
			hub,
			(type) => type === "voice:assistant_text",
		);
		expect((assistantEvent.event as { text: string }).text).toBe("Hello");

		const audio = Buffer.from([5, 6, 7, 8]).toString("base64");
		server.send({ type: "response.output_audio.delta", delta: audio });

		const audioEvent = await waitForEvent(
			hub,
			(type) => type === "voice:assistant_audio",
		);
		expect((audioEvent.event as { audio: string }).audio).toBe(audio);

		if (cleanup) await cleanup();
		await server.close();
	});
});
