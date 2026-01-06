import type { RuntimeCommand } from "@open-harness/sdk";
import type { NextRequest } from "next/server";
import { eventStreams, getRuntime, runtimes } from "@/lib/runtime-manager";

export async function POST(request: NextRequest) {
	try {
		const command = (await request.json()) as RuntimeCommand;

		if (command.type === "send" && command.runId) {
			const rt = getRuntime(command.runId);
			rt.dispatch(command);

			// Run the flow to process the message (don't await - let it run in background)
			rt.run()
				.then(() => {
					// Close the stream and clean up
					const stream = eventStreams.get(command.runId);
					if (stream) {
						try {
							stream.close();
						} catch {
							// Stream might already be closed
						}
						eventStreams.delete(command.runId);
					}
					runtimes.delete(command.runId);
				})
				.catch((error) => {
					console.error("[Runtime] Error running flow:", error);
					const stream = eventStreams.get(command.runId);
					if (stream) {
						try {
							stream.close();
						} catch {
							// Stream might already be closed
						}
						eventStreams.delete(command.runId);
					}
					runtimes.delete(command.runId);
				});
		}

		return new Response(JSON.stringify({ success: true }), {
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("[API] Error handling command:", error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}
