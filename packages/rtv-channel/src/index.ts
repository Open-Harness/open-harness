import { createRealtimeConsoleConnector } from "./connectors/console";
import { createConsoleVoiceChannel } from "./channel/ConsoleVoiceChannel";

export { createRealtimeVoiceChannel } from "./channel/RealtimeVoiceChannel";
export { createConsoleVoiceChannel } from "./channel/ConsoleVoiceChannel";
export { RealtimeService } from "./core/RealtimeService";
export { createRealtimeConsoleConnector } from "./connectors/console";
export { Tui } from "./ui/Tui";

if (import.meta.main) {
	const API_KEY = process.env.OPENAI_API_KEY;
	if (!API_KEY) throw new Error("Missing OPENAI_API_KEY");

	const MODEL = process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime";
	const VOICE = process.env.OPENAI_VOICE ?? "marin";
	const MODE =
		process.env.REALTIME_MODE === "conversation"
			? "conversation"
			: "push-to-talk";

	createRealtimeConsoleConnector({
		apiKey: API_KEY,
		model: MODEL,
		voice: VOICE,
		mode: MODE,
		errorLogPath: process.env.REALTIME_ERROR_LOG,
		logLevel: process.env.LOG_LEVEL,
	});
}
