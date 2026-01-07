import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import pino from "pino";
import WebSocket from "ws";

type AnyObj = Record<string, unknown>;

export type VoiceMode = "push-to-talk" | "conversation";

export type ServiceState = {
	connected: boolean;
	talking: boolean;
	responseInProgress: boolean;
	model: string;
	voice: string;
	mode: VoiceMode;
	statusLine: string;
};

export type LogEvent = {
	kind: "user" | "assistant" | "assistant_text" | "info" | "warn" | "error";
	text: string;
};

export type RealtimeServiceConfig = {
	apiKey: string;
	model: string;
	voice: string;
	sampleRate?: number;
	channels?: number;
	errorLogPath?: string;
	logLevel?: string;
	mode?: VoiceMode;
	useLocalMic?: boolean;
	useLocalSpeaker?: boolean;
	wsUrl?: string;
};

export class RealtimeService extends EventEmitter {
	private ws: WebSocket | null = null;
	private recorder: ChildProcessWithoutNullStreams | null = null;
	private player: ChildProcessWithoutNullStreams | null = null;
	private sentAudioThisTurn = false;
	private sentBytesThisTurn = 0;
	private assistantText = "";
	private assistantTranscript = "";
	private logger: pino.Logger;

	private readonly sampleRate: number;
	private readonly channels: number;
	private readonly wsUrl: string;
	private readonly useLocalMic: boolean;
	private readonly useLocalSpeaker: boolean;
	private readonly vadConfig = {
		type: "semantic_vad",
	};

	private state: ServiceState;

	constructor(private readonly config: RealtimeServiceConfig) {
		super();

		this.sampleRate = config.sampleRate ?? 24000;
		this.channels = config.channels ?? 1;
		this.wsUrl =
			config.wsUrl ??
			`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(
				config.model,
			)}`;
		this.useLocalMic = config.useLocalMic ?? true;
		this.useLocalSpeaker = config.useLocalSpeaker ?? true;

		this.state = {
			connected: false,
			talking: false,
			responseInProgress: false,
			model: config.model,
			voice: config.voice,
			mode: config.mode ?? "push-to-talk",
			statusLine: "booting",
		};

		const logLevel = config.logLevel ?? "info";
		const errorLogPath = config.errorLogPath ?? "realtime-errors.log";
		this.logger = pino(
			{ level: logLevel },
			pino.transport({
				targets: [
					{
						level: logLevel,
						target: "pino/file",
						options: { destination: errorLogPath, mkdir: true },
					},
				],
			}),
		);
	}

	async start(): Promise<void> {
		if (this.ws) return;

		this.updateState({ statusLine: "connecting" });
		this.ws = new WebSocket(this.wsUrl, {
			headers: { Authorization: `Bearer ${this.config.apiKey}` },
		});

		this.ws.on("open", async () => {
			this.updateState({ connected: true, statusLine: "booting audio..." });
			this.emit("connected");

			const hasSox = await this.cmdExists("sox");
			if ((this.useLocalMic || this.useLocalSpeaker) && !hasSox) {
				this.emitLog({
					kind: "error",
					text: "Missing `sox` (install via brew/apt).",
				});
				this.updateState({ statusLine: "ERROR: missing sox" });
				return;
			}

			if (this.useLocalMic) this.recorder = await this.startRecorder();
			if (this.useLocalSpeaker) this.player = await this.startPlayer();

			if (this.recorder) {
				this.recorder.stdout.on("data", (chunk: Buffer) => {
					this.appendAudio(chunk);
				});
			}

			if (this.state.mode === "conversation") {
				this.updateState({ talking: true });
			}

			this.updateState({ statusLine: "ready" });
			this.emitLog({
				kind: "info",
				text:
					this.state.mode === "conversation"
						? "Ready. VAD is on (mic active). Press SPACE to mute."
						: "Ready. Press SPACE to start/stop talking.",
			});

			this.wsSend({
				type: "session.update",
				session: {
					type: "realtime",
					model: this.config.model,
					output_modalities: ["audio"],
					audio: {
						input: {
							format: { type: "audio/pcm", rate: this.sampleRate },
							transcription: { model: "whisper-1" },
							turn_detection:
								this.state.mode === "conversation" ? this.vadConfig : null,
						},
						output: {
							format: { type: "audio/pcm", rate: this.sampleRate },
							voice: this.config.voice,
							speed: 1.0,
						},
					},
					instructions:
						"You are a helpful assistant. Speak naturally. Keep responses short unless asked otherwise.",
				},
			});
		});

		this.ws.on("message", async (data) => {
			const msg = this.safeJsonParse(data.toString());
			if (!msg) return;

			this.logEventLine(msg);
			const type = String(msg.type ?? "");

			if (type === "conversation.item.input_audio_transcription.completed") {
				const t = String((msg as AnyObj).transcript ?? "");
				if (t.trim()) this.emitLog({ kind: "user", text: t });
				return;
			}

			if (type === "response.text.delta") {
				const d = String((msg as AnyObj).delta ?? "");
				this.assistantText += d;
				return;
			}

			if (
				type === "response.output_audio_transcript.delta" ||
				type === "response.audio_transcript.delta"
			) {
				const d = String((msg as AnyObj).delta ?? "");
				this.assistantTranscript += d;
				return;
			}

			if (
				type === "response.output_audio_transcript.done" ||
				type === "response.audio_transcript.done"
			) {
				const final = this.assistantTranscript.trim();
				if (final) this.emitLog({ kind: "assistant", text: final });
				this.assistantTranscript = "";
				return;
			}

			if (
				type === "response.output_audio.delta" ||
				type === "response.audio.delta"
			) {
				const b64 = String((msg as AnyObj).delta ?? "");
				if (!b64) return;

				const pcm = Buffer.from(b64, "base64");
				this.emit("assistant_audio", pcm);
				this.emit("spk_level", this.rmsPercent(pcm));

				if (this.useLocalSpeaker) {
					if (!this.player || this.player.killed)
						this.player = await this.startPlayer();
					this.player.stdin.write(pcm);
				}
				return;
			}

			if (type === "response.done") {
				this.updateState({ responseInProgress: false, statusLine: "ready" });
				if (this.assistantText.trim()) {
					this.emitLog({
						kind: "assistant_text",
						text: this.assistantText.trim(),
					});
					this.assistantText = "";
				}
				return;
			}

			if (type === "error") {
				this.logger.error({ realtime: msg }, "realtime.error");
				const errObj = (msg as AnyObj).error as AnyObj | undefined;
				const errMsg =
					(errObj && (errObj.message as string | undefined)) ??
					JSON.stringify(msg);
				const errCode = errObj?.code ? ` (${String(errObj.code)})` : "";
				this.emitLog({
					kind: "error",
					text: `ERROR${errCode}: ${String(errMsg)}`,
				});
				this.updateState({ statusLine: "error" });
			}
		});

		this.ws.on("close", () => {
			this.updateState({ connected: false, statusLine: "ws closed" });
			this.emit("disconnected");
		});

		this.ws.on("error", (err) => {
			this.updateState({ connected: false, statusLine: "ws error" });
			this.emitLog({ kind: "error", text: `WS error: ${String(err)}` });
		});
	}

	async toggleTalk(): Promise<void> {
		if (!this.state.connected) return;

		if (this.state.mode === "conversation") {
			const talking = !this.state.talking;
			this.updateState({ talking, statusLine: talking ? "mic on" : "mic off" });
			this.emitLog({
				kind: "info",
				text: talking ? "Mic enabled (VAD)." : "Mic muted (VAD).",
			});
			return;
		}

		const talking = !this.state.talking;
		if (talking) {
			await this.beginUserTurn();
			return;
		}

		await this.commitUserTurn();
	}

	async stopAssistantSpeech(reason = "stopped"): Promise<void> {
		if (!this.state.connected) return;
		if (this.state.responseInProgress) this.wsSend({ type: "response.cancel" });
		await this.resetPlayer();
		this.assistantText = "";
		this.assistantTranscript = "";
		this.emitLog({ kind: "info", text: "Stopped agent speech." });
		this.updateState({ statusLine: reason });
	}

	stop(): void {
		try {
			this.ws?.close();
		} catch {}
		try {
			this.recorder?.kill("SIGKILL");
		} catch {}
		try {
			this.player?.kill("SIGKILL");
		} catch {}
		this.ws = null;
	}

	getState(): ServiceState {
		return { ...this.state };
	}

	async beginUserTurn(): Promise<void> {
		if (!this.state.connected) return;
		this.sentAudioThisTurn = false;
		this.sentBytesThisTurn = 0;

		if (this.state.responseInProgress) {
			this.wsSend({ type: "response.cancel" });
		}

		this.wsSend({ type: "input_audio_buffer.clear" });
		await this.resetPlayer();

		this.updateState({ talking: true, statusLine: "recording" });
		this.emitLog({
			kind: "info",
			text: "Talking... (press SPACE to stop)",
		});
	}

	appendAudio(pcm: Buffer): void {
		if (!this.state.talking) return;
		if (pcm.length === 0) return;
		this.emit("mic_level", this.rmsPercent(pcm));
		this.sentAudioThisTurn = true;
		this.sentBytesThisTurn += pcm.length;
		this.wsSend({
			type: "input_audio_buffer.append",
			audio: pcm.toString("base64"),
		});
	}

	async commitUserTurn(): Promise<void> {
		if (!this.state.connected) return;

		if (this.state.mode === "conversation") {
			this.emitLog({
				kind: "info",
				text: "Commit ignored in VAD mode.",
			});
			return;
		}

		this.emitLog({
			kind: "info",
			text: "Sent. waiting for response...",
		});
		this.updateState({ statusLine: "thinking", talking: false });

		if (!this.sentAudioThisTurn || this.sentBytesThisTurn === 0) {
			this.emitLog({
				kind: "warn",
				text: "No audio captured this turn (mic muted / permissions / device?).",
			});
			this.updateState({ statusLine: "ready" });
			return;
		}

		this.wsSend({ type: "input_audio_buffer.commit" });
		this.wsSend({
			type: "response.create",
			response: { output_modalities: ["audio"] },
		});
		this.updateState({ responseInProgress: true });
	}

	async setMode(mode: VoiceMode): Promise<void> {
		if (this.state.mode === mode) return;
		this.updateState({ mode });
		this.emitLog({
			kind: "info",
			text:
				mode === "conversation"
					? "Mode set to conversation (VAD on)."
					: "Mode set to push-to-talk.",
		});

		if (mode === "conversation") {
			this.updateState({ talking: true });
		} else {
			this.updateState({ talking: false });
		}

		this.applyMode();
	}

	async toggleMode(): Promise<void> {
		const next =
			this.state.mode === "push-to-talk" ? "conversation" : "push-to-talk";
		await this.setMode(next);
	}

	private emitLog(event: LogEvent) {
		this.emit("log", event);
	}

	private updateState(partial: Partial<ServiceState>) {
		this.state = { ...this.state, ...partial };
		this.emit("state", this.getState());
	}

	private wsSend(payload: AnyObj) {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
		this.ws.send(JSON.stringify(payload));
	}

	private applyMode() {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
		this.wsSend({
			type: "session.update",
			session: {
				type: "realtime",
				audio: {
					input: {
						turn_detection:
							this.state.mode === "conversation" ? this.vadConfig : null,
					},
				},
			},
		});
	}

	private rmsPercent(pcm16le: Buffer): number {
		const n = Math.floor(pcm16le.length / 2);
		if (n <= 0) return 0;
		let sumSq = 0;
		for (let i = 0; i < n; i++) {
			const s = pcm16le.readInt16LE(i * 2) / 32768;
			sumSq += s * s;
		}
		const rms = Math.sqrt(sumSq / n);
		return Math.max(0, Math.min(100, Math.round(rms * 220)));
	}

	private cmdExists(cmd: string): Promise<boolean> {
		return new Promise((resolve) => {
			const p = spawn("bash", ["-lc", `command -v ${cmd} >/dev/null 2>&1`]);
			p.on("exit", (code) => resolve(code === 0));
		});
	}

	private async startRecorder(): Promise<ChildProcessWithoutNullStreams> {
		const p = spawn("sox", [
			"-q",
			"-d",
			"-c",
			String(this.channels),
			"-r",
			String(this.sampleRate),
			"-b",
			"16",
			"-e",
			"signed-integer",
			"-t",
			"raw",
			"-",
		]);
		p.stderr.on("data", (d) =>
			this.emit("event", `rec stderr: ${String(d).trim()}`),
		);
		return p;
	}

	private async startPlayer(): Promise<ChildProcessWithoutNullStreams> {
		const p = spawn("sox", [
			"-q",
			"-t",
			"raw",
			"-b",
			"16",
			"-e",
			"signed-integer",
			"-c",
			String(this.channels),
			"-r",
			String(this.sampleRate),
			"-",
			"-d",
		]);
		p.stderr.on("data", (d) =>
			this.emit("event", `spk stderr: ${String(d).trim()}`),
		);
		return p;
	}

	private async resetPlayer() {
		if (!this.useLocalSpeaker) return;
		try {
			this.player?.kill("SIGKILL");
		} catch {}
		this.player = await this.startPlayer();
	}

	private safeJsonParse(s: string): AnyObj | null {
		try {
			return JSON.parse(s) as AnyObj;
		} catch {
			return null;
		}
	}

	private logEventLine(obj: AnyObj) {
		const t = String(obj.type ?? "unknown");
		if (t === "response.output_audio.delta" || t === "response.audio.delta")
			return;
		this.emit("event", t);
	}
}
