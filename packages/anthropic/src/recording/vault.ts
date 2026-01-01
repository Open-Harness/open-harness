/**
 * Vault - Recording Storage for Agent Sessions
 *
 * Handles persisting and replaying LLM sessions for testing.
 * Pure Promise-based, no async generators.
 */

import { join } from "node:path";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { inject, injectable } from "@needle-di/core";
import type { IConfig } from "@openharness/sdk";
import { IConfigToken } from "@openharness/sdk";
import type { IVault, IVaultSession, RecordedSession } from "./types.js";

/**
 * VaultSession handles a single recording session.
 * Created by Vault.startSession().
 */
class VaultSession implements IVaultSession {
	private fileExists: boolean;
	private messages: SDKMessage[];
	private filePath: string;

	constructor(
		filePath: string,
		fileExists: boolean,
		messages: SDKMessage[],
		private config: IConfig,
	) {
		this.filePath = filePath;
		this.fileExists = fileExists;
		this.messages = messages;
	}

	exists(): boolean {
		return this.fileExists;
	}

	getMessages(): SDKMessage[] {
		return this.messages;
	}

	async save(messages: SDKMessage[]): Promise<void> {
		if (this.config.isReplayMode) return;

		const session: RecordedSession = {
			prompt: "", // Will be set by caller
			options: {},
			messages,
		};
		const line = `${JSON.stringify(session)}\n`;

		// Ensure directory exists
		const dir = join(this.filePath, "..");
		await Bun.write(join(dir, ".keep"), "");

		// Append to file
		const file = Bun.file(this.filePath);
		const existing = this.fileExists ? await file.text() : "";
		await Bun.write(this.filePath, existing + line);
	}
}

/**
 * Vault manages recording sessions.
 * Injectable service that implements IVault.
 */
@injectable()
export class Vault implements IVault {
	constructor(private config = inject(IConfigToken)) {}

	async startSession(category: string, id: string): Promise<IVaultSession> {
		const filePath = join(this.config.recordingsDir, category, `${id}.jsonl`);
		const file = Bun.file(filePath);

		const fileExists = await file.exists();
		let messages: SDKMessage[] = [];

		if (fileExists && this.config.isReplayMode) {
			const content = await file.text();
			const lines = content.trim().split("\n").filter(Boolean);
			if (lines.length > 0 && lines[0]) {
				// Get messages from the first session (or could match by prompt)
				const session: RecordedSession = JSON.parse(lines[0]);
				messages = session.messages;
			}
		}

		return new VaultSession(filePath, fileExists, messages, this.config);
	}
}
