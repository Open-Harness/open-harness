"use client";

import { useChat } from "@ai-sdk/react";
import { createOpenHarnessChatTransport } from "@open-harness/ai-sdk";
import type { Runtime, RuntimeCommand, RuntimeEvent } from "@open-harness/sdk";
import { useMemo, useState } from "react";

// Client-side proxy Runtime that communicates with server-side runtime via API
class ServerRuntimeProxy implements Runtime {
	private eventListeners = new Set<(event: RuntimeEvent) => void>();
	private eventSources = new Map<string, EventSource>();

	dispatch(command: RuntimeCommand): void {
		if (command.type === "send" && command.runId) {
			// Start event stream for this runId BEFORE dispatching
			// This ensures we don't miss any events
			this.startEventStream(command.runId);

			// Small delay to ensure event stream is connected
			setTimeout(() => {
				// Send command to server via API
				fetch("/api/runtime/command", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(command),
				}).catch((error) => {
					console.error("[ServerRuntimeProxy] Error dispatching command:", error);
				});
			}, 100);
		}
	}

	private startEventStream(runId: string) {
		if (this.eventSources.has(runId)) {
			return; // Already connected
		}

		const eventSource = new EventSource(`/api/runtime/events?runId=${runId}`);
		this.eventSources.set(runId, eventSource);

		eventSource.onmessage = (event) => {
			try {
				const runtimeEvent = JSON.parse(event.data) as RuntimeEvent;
				for (const listener of this.eventListeners) {
					listener(runtimeEvent);
				}

				// Close stream on terminal events
				if (
					runtimeEvent.type === "agent:complete" ||
					runtimeEvent.type === "agent:paused" ||
					runtimeEvent.type === "agent:aborted"
				) {
					eventSource.close();
					this.eventSources.delete(runId);
				}
			} catch (error) {
				console.error("[ServerRuntimeProxy] Error parsing event:", error);
			}
		};

		eventSource.onerror = () => {
			eventSource.close();
			this.eventSources.delete(runId);
		};
	}

	onEvent(listener: (event: RuntimeEvent) => void): () => void {
		this.eventListeners.add(listener);
		return () => {
			this.eventListeners.delete(listener);
		};
	}

	getSnapshot() {
		return {
			status: "idle" as const,
			outputs: {},
			state: {},
			nodeStatus: {},
			edgeStatus: {},
			loopCounters: {},
			inbox: [],
			agentSessions: {},
		};
	}

	async run() {
		return this.getSnapshot();
	}
}

export default function DemoPage() {
	const [input, setInput] = useState("");

	// Create server-side runtime proxy
	const runtime = useMemo<Runtime>(() => {
		return new ServerRuntimeProxy();
	}, []);

	// Create transport
	const transport = useMemo(() => createOpenHarnessChatTransport(runtime), [runtime]);

	// Use AI SDK's useChat hook
	const chat = useChat({
		transport,
		onError: (error) => {
			console.error("[useChat] Error:", error);
			alert(`Chat error: ${error instanceof Error ? error.message : String(error)}`);
		},
	});

	const { messages, sendMessage, status, error } = chat;

	// Log the entire chat object for debugging
	if (typeof window !== "undefined") {
		console.log("[useChat] Full chat object:", chat);
		console.log("[useChat] Messages:", messages);
		console.log("[useChat] Status:", status);
		console.log("[useChat] Error:", error);
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const messageText = input.trim();
		if (messageText) {
			try {
				console.log("[Demo] === SENDING MESSAGE ===");
				console.log("[Demo] Message text:", messageText);
				console.log("[Demo] sendMessage function:", sendMessage);
				console.log("[Demo] Transport:", transport);
				console.log("[Demo] Runtime:", runtime);

				// Try calling sendMessage - check what it actually expects
				const result = sendMessage({
					role: "user",
					parts: [{ type: "text", text: messageText }],
				});

				console.log("[Demo] sendMessage result:", result);
				console.log("[Demo] Message sent, clearing input");
				setInput("");
			} catch (error) {
				console.error("[Demo] === ERROR SENDING MESSAGE ===");
				console.error("[Demo] Error:", error);
				console.error("[Demo] Error stack:", error instanceof Error ? error.stack : "No stack");
				alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	};

	const isLoading = status === "streaming";

	return (
		<div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
			<main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-black dark:text-zinc-50">Open Harness AI SDK Demo</h1>
					<p className="mt-2 text-zinc-600 dark:text-zinc-400">
						Streaming chat interface powered by Open Harness runtime events
					</p>
				</div>

				<div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
					{/* Messages */}
					<div className="flex max-h-[600px] flex-col gap-4 overflow-y-auto p-6">
						{messages.length === 0 && (
							<div className="text-center text-zinc-500 dark:text-zinc-400">
								Start a conversation by typing a message below
							</div>
						)}

						{messages.map((message) => (
							<div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
								<div
									className={`max-w-[80%] rounded-lg px-4 py-2 ${
										message.role === "user"
											? "bg-blue-500 text-white"
											: "bg-zinc-100 text-black dark:bg-zinc-800 dark:text-zinc-50"
									}`}
								>
									{message.parts
										?.filter((p) => p.type === "text")
										.map((p) => {
											const text = "text" in p ? p.text : "";
											return (
												<div key={text} className="whitespace-pre-wrap">
													{text}
												</div>
											);
										})}
								</div>
							</div>
						))}

						{isLoading && (
							<div className="flex justify-start">
								<div className="rounded-lg bg-zinc-100 px-4 py-2 dark:bg-zinc-800">
									<div className="flex items-center gap-2">
										<div className="h-2 w-2 animate-pulse rounded-full bg-zinc-400"></div>
										<span className="text-sm text-zinc-600 dark:text-zinc-400">Thinking...</span>
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Input */}
					<form onSubmit={handleSubmit} className="border-t border-zinc-200 p-4 dark:border-zinc-800">
						<div className="flex gap-2">
							<input
								type="text"
								value={input}
								onChange={(e) => setInput(e.target.value)}
								placeholder="Type your message..."
								className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-black focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
								disabled={isLoading}
							/>
							<button
								type="submit"
								disabled={isLoading || !input.trim()}
								className="rounded-lg bg-blue-500 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
							>
								Send
							</button>
						</div>
					</form>
				</div>
			</main>
		</div>
	);
}
