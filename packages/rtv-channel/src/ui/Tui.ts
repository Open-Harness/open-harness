import blessed from "blessed";
import contrib from "blessed-contrib";
import type {
	LogEvent,
	RealtimeService,
	ServiceState,
} from "../core/RealtimeService";

export class Tui {
	private screen: blessed.Widgets.Screen;
	private transcript: contrib.Widgets.LogElement;
	private events: contrib.Widgets.LogElement;
	private status: blessed.Widgets.BoxElement;
	private micGauge: contrib.Widgets.GaugeElement;
	private spkGauge: contrib.Widgets.GaugeElement;

	constructor(private readonly service: RealtimeService) {
		this.screen = blessed.screen({
			smartCSR: true,
			title: "Realtime Voice TUI",
		});
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

		const help = grid.set(8, 8, 4, 4, blessed.box, {
			label: "Keys",
			border: "line",
			tags: true,
			content: [
				"{bold}space{/bold}: toggle talk",
				"{bold}m{/bold}: toggle mode",
				"{bold}s{/bold}: stop agent",
				"{bold}q{/bold}: quit",
				"",
				"Tip: use headphones",
			].join("\n"),
		}) as blessed.Widgets.BoxElement;

		this.screen.key(["q", "C-c"], () => this.shutdown());
		this.screen.key(["space"], () => this.service.toggleTalk());
		this.screen.key(["m", "M"], () => this.service.toggleMode());
		this.screen.key(["s"], () =>
			this.service.stopAssistantSpeech("interrupted"),
		);

		this.service.on("state", (state: ServiceState) => this.updateStatus(state));
		this.service.on("log", (event: LogEvent) => this.log(event));
		this.service.on("event", (line: string) => this.events.log(line));
		this.service.on("mic_level", (level: number) =>
			this.micGauge.setData([level]),
		);
		this.service.on("spk_level", (level: number) =>
			this.spkGauge.setData([level]),
		);

		this.screen.render();
	}

	private updateStatus(state: ServiceState) {
		this.status.setContent(
			[
				`{bold}conn{/bold}: ${
					state.connected ? "{green-fg}ok{/green-fg}" : "{red-fg}no{/red-fg}"
				}`,
				`{bold}model{/bold}: ${state.model}`,
				`{bold}voice{/bold}: ${state.voice}`,
				`{bold}mode{/bold}: ${state.mode}`,
				`{bold}mic{/bold}: ${
					state.talking ? "{yellow-fg}ACTIVE{/yellow-fg}" : "off"
				}`,
				`{bold}talking{/bold}: ${
					state.talking ? "{yellow-fg}yes{/yellow-fg}" : "no"
				}`,
				state.statusLine ? `\n${state.statusLine}` : "",
			].join("\n"),
		);
		this.screen.render();
	}

	private log(event: LogEvent) {
		switch (event.kind) {
			case "user":
				this.transcript.log(`{bold}You:{/bold} ${event.text}`);
				break;
			case "assistant":
				this.transcript.log(`{bold}AI:{/bold} ${event.text}`);
				break;
			case "assistant_text":
				this.transcript.log(`{bold}AI (text):{/bold} ${event.text}`);
				break;
			case "error":
				this.transcript.log(`{red-fg}{bold}${event.text}{/bold}{/red-fg}`);
				break;
			case "warn":
				this.transcript.log(`{yellow-fg}${event.text}{/yellow-fg}`);
				break;
			default:
				this.transcript.log(`{cyan-fg}${event.text}{/cyan-fg}`);
				break;
		}
		this.screen.render();
	}

	private shutdown() {
		this.service.stop();
		try {
			this.screen.destroy();
		} catch {}
		process.exit(0);
	}
}
