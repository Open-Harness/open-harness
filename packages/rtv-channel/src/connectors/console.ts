import { RealtimeService, type RealtimeServiceConfig } from "../core/RealtimeService";
import { Tui } from "../ui/Tui";

export function createRealtimeConsoleConnector(
	config: RealtimeServiceConfig,
): () => void {
	const service = new RealtimeService(config);
	new Tui(service);
	void service.start();
	return () => service.stop();
}
