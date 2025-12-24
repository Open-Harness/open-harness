/**
 * JSON File Data Source - Read/write tasks from JSON files
 *
 * IMPORTANT: This implementation is designed for single-process use only.
 * Running multiple CLI instances against the same project directory concurrently
 * may cause race conditions (TOCTOU) in task status updates.
 *
 * For concurrent access, consider:
 * - Using a database-backed data source
 * - Implementing file locking (e.g., proper-lockfile package)
 * - Using atomic file operations
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { calculateProgress, type ProgressStats, type TaskStatus } from "../schemas/task.js";
import type { DataSource } from "./types.js";

export interface JsonTask {
	id: string;
	status: TaskStatus;
	[key: string]: unknown;
}

/**
 * JSON file-based data source implementation
 *
 * @remarks
 * Single-process only. See module documentation for concurrency limitations.
 */
export class JsonFileDataSource<T extends JsonTask> implements DataSource<T> {
	constructor(private readonly filePath: string) {}

	exists(): boolean {
		return existsSync(this.filePath);
	}

	async load(): Promise<T[]> {
		if (!this.exists()) {
			return [];
		}

		const content = readFileSync(this.filePath, "utf-8");

		try {
			return JSON.parse(content) as T[];
		} catch (error) {
			// Don't swallow JSON parse errors - this could cause data loss
			// if we return [] and then save() is called
			throw new Error(
				`Failed to parse ${this.filePath}: ${error instanceof Error ? error.message : error}. ` +
					"The file may be corrupted. Please check the file contents.",
			);
		}
	}

	async save(items: T[]): Promise<void> {
		writeFileSync(this.filePath, JSON.stringify(items, null, 2));
	}

	async getNext(filter?: Partial<T>): Promise<T | null> {
		const items = await this.load();

		// Default: find first pending item
		const statusFilter = filter?.status || "pending";

		const found = items.find((item) => {
			if (item.status !== statusFilter) return false;

			// Check additional filter criteria
			if (filter) {
				for (const [key, value] of Object.entries(filter)) {
					if (key === "status") continue;
					if (item[key] !== value) return false;
				}
			}

			return true;
		});

		return found || null;
	}

	async markInProgress(id: string): Promise<void> {
		const items = await this.load();
		const item = items.find((i) => i.id === id);

		if (item) {
			item.status = "in_progress";
			await this.save(items);
		}
	}

	async markComplete(id: string, result?: Record<string, unknown>): Promise<void> {
		const items = await this.load();
		const item = items.find((i) => i.id === id);

		if (item) {
			item.status = "completed";
			if (result) {
				const existingResult = (item as Record<string, unknown>).result as Record<string, unknown> | undefined;
				(item as Record<string, unknown>).result = {
					...existingResult,
					...result,
					completedAt: new Date().toISOString(),
				};
			}
			await this.save(items);
		}
	}

	async markFailed(id: string, error: string): Promise<void> {
		const items = await this.load();
		const item = items.find((i) => i.id === id);

		if (item) {
			item.status = "failed";
			const existingResult = (item as Record<string, unknown>).result as Record<string, unknown> | undefined;
			(item as Record<string, unknown>).result = {
				...existingResult,
				error,
				failedAt: new Date().toISOString(),
			};
			await this.save(items);
		}
	}

	async getProgress(): Promise<ProgressStats> {
		const items = await this.load();
		return calculateProgress(items);
	}
}
