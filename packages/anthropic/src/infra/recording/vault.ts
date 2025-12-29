/**
 * Vault - Recording Storage for Agent Sessions
 *
 * Handles persisting and replaying LLM sessions for testing.
 * Pure Promise-based, no async generators.
 *
 * Node.js compatible - uses fs/promises instead of Bun APIs.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { inject, injectable } from "@needle-di/core";
import type { GenericMessage, IConfig } from "@openharness/sdk";
import { IConfigToken } from "@openharness/sdk";
import type { IVault, IVaultSession, RecordedSession } from "./types.js";

/**
 * Check if a file exists using Node.js fs.
 */
async function fileExists(path: string): Promise<boolean> {
	try {
		await readFile(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * VaultSession handles a single recording session.
 * Created by Vault.startSession().
 */
class VaultSession implements IVaultSession {
	private fileExists: boolean;
	private messages: GenericMessage[];
	private filePath: string;

	constructor(
		filePath: string,
		fileExists: boolean,
		messages: GenericMessage[],
		private config: IConfig,
	) {
		this.filePath = filePath;
		this.fileExists = fileExists;
		this.messages = messages;
	}

	exists(): boolean {
		return this.fileExists;
	}

	getMessages(): GenericMessage[] {
		return this.messages;
	}

	async save(messages: GenericMessage[]): Promise<void> {
		if (this.config.isReplayMode) return;

		const session: RecordedSession = {
			prompt: "", // Will be set by caller
			options: {},
			messages,
		};
		const line = `${JSON.stringify(session)}\n`;

		// Ensure directory exists
		const dir = dirname(this.filePath);
		await mkdir(dir, { recursive: true });

		// Append to file
		const existing = this.fileExists ? await readFile(this.filePath, "utf-8") : "";
		await writeFile(this.filePath, existing + line);
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

		const exists = await fileExists(filePath);
		let messages: GenericMessage[] = [];

		if (exists && this.config.isReplayMode) {
			const content = await readFile(filePath, "utf-8");
			const lines = content.trim().split("\n").filter(Boolean);
			if (lines.length > 0 && lines[0]) {
				// Get messages from the first session (or could match by prompt)
				const session: RecordedSession = JSON.parse(lines[0]);
				messages = session.messages;
			}
		}

		return new VaultSession(filePath, exists, messages, this.config);
	}
}
