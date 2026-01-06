import type { NextRequest } from "next/server";
import { connectEventStream } from "@/lib/runtime-manager";

export async function GET(request: NextRequest) {
	const runId = request.nextUrl.searchParams.get("runId");
	if (!runId) {
		return new Response("Missing runId parameter", { status: 400 });
	}

	// Create a new stream for this runId
	const stream = new ReadableStream({
		start(controller) {
			connectEventStream(runId, controller);
		},
		cancel() {
			// Cleanup handled in runtime-manager
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
}
