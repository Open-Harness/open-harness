// Engine: Agent Inbox
// Implements docs/spec/agent.md inbox semantics

import type { AgentInbox, InjectedMessage } from "../protocol/agent.js";

export class AgentInboxImpl implements AgentInbox {
	private readonly messages: InjectedMessage[] = [];
	private readonly waiters: Array<(message: InjectedMessage) => void> = [];

	push(content: string, timestamp: Date = new Date()): void {
		const message: InjectedMessage = { content, timestamp };
		const waiter = this.waiters.shift();
		if (waiter) {
			waiter(message);
			return;
		}
		this.messages.push(message);
	}

	async pop(): Promise<InjectedMessage> {
		const message = this.messages.shift();
		if (message) {
			return message;
		}
		return await new Promise<InjectedMessage>((resolve) => {
			this.waiters.push(resolve);
		});
	}

	drain(): InjectedMessage[] {
		const drained = [...this.messages];
		this.messages.length = 0;
		return drained;
	}

	async *[Symbol.asyncIterator](): AsyncIterableIterator<InjectedMessage> {
		while (true) {
			yield await this.pop();
		}
	}
}
