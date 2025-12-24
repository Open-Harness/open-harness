/**
 * AgentMonologue - Internal observer that generates reflective monologues
 */

import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { inject, injectable } from "@needle-di/core";
import { Record } from "../core/decorators.js";
import { type IAgentRunner, IAgentRunnerToken, type RunnerCallbacks } from "../core/tokens.js";
import { type AgentEvent, EventTypeConst } from "../runner/models.js";

@injectable()
export class AgentMonologue {
	private history: string[] = [];
	private buffer: AgentEvent[] = [];

	constructor(private runner: IAgentRunner = inject(IAgentRunnerToken)) {}

	ingest(event: AgentEvent): void {
		this.buffer.push(event);
	}

	/**
	 * Generate a monologue based on buffered events.
	 *
	 * @param sessionId - Session identifier for recording
	 * @param callbacks - Optional callbacks for observing the generation
	 * @returns The generated monologue event, or undefined if nothing to process
	 */
	@Record("monologue", (args) => args[0])
	async generate(_sessionId: string, callbacks?: RunnerCallbacks): Promise<AgentEvent | undefined> {
		if (this.buffer.length === 0) return undefined;

		const eventsToProcess = [...this.buffer];
		this.buffer = [];

		const prompt = `You are an internal observer.
Recent events: ${JSON.stringify(eventsToProcess)}
History: ${this.history.join("\n")}
Provide a 1st person monologue.`;

		let resultEvent: AgentEvent | undefined;

		await this.runner.run({
			prompt,
			options: {
				model: "haiku",
				outputFormat: {
					type: "json_schema",
					schema: {
						type: "object",
						properties: {
							action: { type: "string", enum: ["observing", "monologue"] },
							content: { type: "string" },
						},
						required: ["action"],
					},
				},
			},
			callbacks: {
				onMessage: (msg: SDKMessage) => {
					if (msg.type === "result" && msg.subtype === "success") {
						const out = msg.structured_output as {
							action: string;
							content?: string;
						};
						if (out.action === "monologue" && out.content) {
							this.history.push(out.content);
							resultEvent = {
								timestamp: new Date(),
								event_type: EventTypeConst.MONOLOGUE,
								agent_name: "Observer",
								content: out.content,
							};
						}
					}
					// Forward to caller's callback
					if (callbacks?.onMessage) {
						callbacks.onMessage(msg);
					}
				},
			},
		});

		return resultEvent;
	}
}
