import blessed from "blessed";
import contrib from "blessed-contrib";
import type { Attachment, Hub } from "./types";

type VoiceMode = "push-to-talk" | "conversation";

type VoiceStatusEvent = {
	type: "voice:status";
	connected: boolean;
	talking: boolean;
	responseInProgress: boolean;
	mode: VoiceMode;
	statusLine: string;
};

type VoiceEvent =
	| { type: "voice:transcript"; text: string }
	| { type: "voice:assistant_text"; text: string }
	| { type: "voice:assistant_audio"; audio: string }
	| { type: "voice:mic_level"; level: number }
	| { type: "voice:spk_level"; level: number }
	| { type: "voice:event"; name: string }
	| { type: "voice:notice"; level: "info" | "warn"; message: string }
	| { type: "voice:error"; message: string }
	| { type: "voice:connected" }
	| { type: "voice:disconnected" }
	| VoiceStatusEvent;

type UiState = {
	mode: VoiceMode;
	talking: boolean;
	connected: boolean;
	statusLine: string;
};

class VoiceTui {
	private screen: blessed.Widgets.Screen;
	private transcript: contrib.Widgets.LogElement;
	private events: contrib.Widgets.LogElement;
	private status: blessed.Widgets.BoxElement;
	private micGauge: contrib.Widgets.GaugeElement;
	private spkGauge: contrib.Widgets.GaugeElement;
	private recording = false;
	private state: UiState = {
		mode: "push-to-talk",
		talking: false,
		connected: false,
		statusLine: "",
	};

	constructor(private readonly hub: Hub) {
		this.screen = blessed.screen({ smartCSR: true, title: "Voice Channel TUI" });
		const grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

		this.transcript = grid.set(0, 0, 8, 8, contrib.log, {
			label: "Transcript",
			border: "line",
			fg: "white",
			tags: true,
		}) as contrib.Widgets.LogElement;

		this.events = grid.set(8, 0, 4, 8, contrib.log, {
			label: "Events",
			border: "line",
			fg: "white",
		}) as contrib.Widgets.LogElement;

		this.status = grid.set(0, 8, 4, 4, blessed.box, {
			label: "Status",
			border: "line",
			tags: true,
			content: "",
		}) as blessed.Widgets.BoxElement;

		this.micGauge = grid.set(4, 8, 2, 4, contrib.gauge, {
			label: "Mic Level",
			border: "line",
		}) as contrib.Widgets.GaugeElement;

		this.spkGauge = grid.set(6, 8, 2, 4, contrib.gauge, {
			label: "Spk Level",
			border: "line",
		}) as contrib.Widgets.GaugeElement;

		grid.set(8, 8, 4, 4, blessed.box, {
			label: "Keys",
			border: "line",
			tags: true,
			content: [
				"{bold}space{/bold}: toggle talk",
				"{bold}s{/bold}: stop agent",
				"{bold}q{/bold}: quit",
				"",
				"Mode: push-to-talk only",
			].join("\n"),
		});

		this.screen.key(["q", "C-c"], () => this.shutdown());
		this.screen.key(["space"], () => this.toggleTalk());
		this.screen.key(["s"], () => this.hub.emit({ type: "voice:response:cancel" }));

		this.renderStatus();
		this.screen.render();
	}

	handleEvent(event: VoiceEvent) {
		switch (event.type) {
			case "voice:status":
				this.state = {
					mode: event.mode,
					talking: event.talking,
					connected: event.connected,
					statusLine: event.statusLine,
				};
				this.renderStatus();
				break;
			case "voice:connected":
				this.state.connected = true;
				this.renderStatus();
				break;
			case "voice:disconnected":
				this.state.connected = false;
				this.renderStatus();
				break;
			case "voice:transcript":
				this.transcript.log(`{bold}You:{/bold} ${event.text}`);
				break;
			case "voice:assistant_text":
				this.transcript.log(`{bold}AI:{/bold} ${event.text}`);
				break;
			case "voice:notice":
				this.transcript.log(
					event.level === "warn"
						? `{yellow-fg}${event.message}{/yellow-fg}`
						: `{cyan-fg}${event.message}{/cyan-fg}`,
				);
				break;
			case "voice:error":
				this.transcript.log(
					`{red-fg}{bold}${event.message}{/bold}{/red-fg}`,
				);
				break;
			case "voice:event":
				this.events.log(event.name);
				break;
			case "voice:mic_level":
				this.micGauge.setData([event.level]);
				break;
			case "voice:spk_level":
				this.spkGauge.setData([event.level]);
				break;
			case "voice:assistant_audio":
				break;
		}
		this.screen.render();
	}

	private toggleTalk() {
		if (!this.recording) {
			this.hub.emit({ type: "voice:input:start" });
			this.recording = true;
			return;
		}

		this.hub.emit({ type: "voice:input:commit" });
		this.recording = false;
	}

	private renderStatus() {
		this.status.setContent(
			[
				`{bold}conn{/bold}: ${
					this.state.connected
						? "{green-fg}ok{/green-fg}"
						: "{red-fg}no{/red-fg}"
				}`,
				`{bold}mode{/bold}: ${this.state.mode}`,
				`{bold}mic{/bold}: ${
					this.state.talking ? "{yellow-fg}ACTIVE{/yellow-fg}" : "off"
				}`,
				this.state.statusLine ? `\n${this.state.statusLine}` : "",
			].join("\n"),
		);
	}

	destroy() {
		try {
			this.screen.destroy();
		} catch {}
	}

	private shutdown() {
		this.hub.emit({ type: "voice:shutdown" });
		this.destroy();
		process.exit(0);
	}
}

export function createConsoleVoiceChannel(): Attachment {
	return (hub: Hub) => {
		const ui = new VoiceTui(hub);
		const unsubscribe = hub.subscribe("voice:*", (evt) =>
			ui.handleEvent(evt.event as VoiceEvent),
		);
		return () => {
			unsubscribe();
			ui.destroy();
		};
	};
}
