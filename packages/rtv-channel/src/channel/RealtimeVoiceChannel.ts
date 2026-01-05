import { RealtimeService, type VoiceMode } from "../core/RealtimeService";
import type { Attachment, BaseEvent, Hub } from "./types";

type VoiceCommand =
	| { type: "voice:input:start" }
	| { type: "voice:input:audio"; audio: string }
	| { type: "voice:input:commit" }
	| { type: "voice:response:cancel" }
	| { type: "voice:shutdown" };

type VoiceEvent =
	| { type: "voice:connected" }
	| { type: "voice:disconnected" }
	| {
			type: "voice:status";
			connected: boolean;
			talking: boolean;
			responseInProgress: boolean;
			mode: VoiceMode;
			statusLine: string;
	  }
	| { type: "voice:transcript"; text: string }
	| { type: "voice:assistant_text"; text: string }
	| { type: "voice:assistant_audio"; audio: string }
	| { type: "voice:mic_level"; level: number }
	| { type: "voice:spk_level"; level: number }
	| { type: "voice:event"; name: string }
	| { type: "voice:notice"; level: "info" | "warn"; message: string }
	| { type: "voice:error"; message: string };

export type RealtimeVoiceChannelConfig = {
	apiKey: string;
	model: string;
	voice: string;
	useLocalMic?: boolean;
	useLocalSpeaker?: boolean;
	errorLogPath?: string;
	logLevel?: string;
	wsUrl?: string;
};

export function createRealtimeVoiceChannel(
	config: RealtimeVoiceChannelConfig,
): Attachment {
	return (hub: Hub) => {
		const service = new RealtimeService({
			apiKey: config.apiKey,
			model: config.model,
			voice: config.voice,
			useLocalMic: config.useLocalMic ?? false,
			useLocalSpeaker: config.useLocalSpeaker ?? false,
			errorLogPath: config.errorLogPath,
			logLevel: config.logLevel,
			wsUrl: config.wsUrl,
		});

		const emit = (event: BaseEvent) => hub.emit(event);

		service.on("connected", () => emit({ type: "voice:connected" }));
		service.on("disconnected", () => emit({ type: "voice:disconnected" }));
		service.on("state", (state) =>
			emit({
				type: "voice:status",
				connected: state.connected,
				talking: state.talking,
				responseInProgress: state.responseInProgress,
				mode: state.mode,
				statusLine: state.statusLine,
			}),
		);
		service.on("mic_level", (level: number) =>
			emit({ type: "voice:mic_level", level }),
		);
		service.on("spk_level", (level: number) =>
			emit({ type: "voice:spk_level", level }),
		);
		service.on("assistant_audio", (pcm: Buffer) =>
			emit({ type: "voice:assistant_audio", audio: pcm.toString("base64") }),
		);
		service.on("event", (line: string) => emit({ type: "voice:event", name: line }));
		service.on("log", (event) => {
			if (event.kind === "user")
				emit({ type: "voice:transcript", text: event.text });
			else if (event.kind === "assistant" || event.kind === "assistant_text")
				emit({ type: "voice:assistant_text", text: event.text });
			else if (event.kind === "error")
				emit({ type: "voice:error", message: event.text });
			else
				emit({
					type: "voice:notice",
					level: event.kind === "warn" ? "warn" : "info",
					message: event.text,
				});
		});

		void service.start();

		const unsubscribe = hub.subscribe("voice:*", (evt) => {
			const event = evt.event as VoiceCommand;
			switch (event.type) {
				case "voice:input:start":
					void service.beginUserTurn();
					break;
				case "voice:input:audio": {
					const pcm = Buffer.from(event.audio, "base64");
					service.appendAudio(pcm);
					break;
				}
				case "voice:input:commit":
					void service.commitUserTurn();
					break;
				case "voice:response:cancel":
					void service.stopAssistantSpeech("cancelled");
					break;
				case "voice:shutdown":
					service.stop();
					break;
			}
		});

		return () => {
			unsubscribe();
			service.stop();
		};
	};
}
