import type pino from "pino";
import { hashContent } from "./renderer.js";

export type WriterConfig = {
	repo: string;
	issueNumber?: number;
	prNumber?: number;
	token: string;
	debounceMs: number;
};

export class GithubWriter {
	private commentId: number | null = null;
	private lastHash: string | null = null;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private pendingRendered: string | null = null;

	constructor(
		private config: WriterConfig,
		private logger: pino.Logger,
	) {}

	async ensureComment(): Promise<number> {
		if (this.commentId) {
			return this.commentId;
		}

		const [owner, repo] = this.config.repo.split("/");
		if (!owner || !repo) {
			throw new Error(`Invalid repo format: ${this.config.repo}`);
		}

		const endpoint =
			this.config.issueNumber !== undefined
				? `/repos/${owner}/${repo}/issues/${this.config.issueNumber}/comments`
				: `/repos/${owner}/${repo}/pulls/${this.config.prNumber}/comments`;

		// Search for existing comment with sentinel
		const existing = await this.searchForComment(owner, repo);
		if (existing) {
			this.commentId = existing;
			return existing;
		}

		// Create new comment
		const body =
			"<!-- DASHBOARD:START -->\nInitializing dashboard...\n<!-- DASHBOARD:END -->";
		const response = await this.githubRequest("POST", endpoint, { body });

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Failed to create comment: ${response.status} ${errorText}`,
			);
		}

		const data = (await response.json()) as { id: number };
		this.commentId = data.id;
		this.logger.info({ commentId: this.commentId }, "Created managed comment");
		return this.commentId;
	}

	queueUpdate(rendered: string): void {
		this.pendingRendered = rendered;

		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = setTimeout(() => {
			if (this.pendingRendered) {
				void this.writeComment(this.pendingRendered).catch((err) => {
					this.logger.error({ err }, "Error writing comment");
				});
				this.pendingRendered = null;
			}
			this.debounceTimer = null;
		}, this.config.debounceMs);
	}

	private async writeComment(rendered: string): Promise<void> {
		if (!this.commentId) {
			await this.ensureComment();
		}

		// Hash check
		const hash = hashContent(rendered);
		if (hash === this.lastHash) {
			this.logger.debug("Skipping write (hash unchanged)");
			return;
		}

		const [owner, repo] = this.config.repo.split("/");
		if (!owner || !repo) {
			throw new Error(`Invalid repo format: ${this.config.repo}`);
		}

		// Extract sentinel block and replace
		const sentinelStart = "<!-- DASHBOARD:START -->";
		const sentinelEnd = "<!-- DASHBOARD:END -->";
		const currentBody = await this.getCurrentCommentBody();
		let newBody: string;

		if (
			currentBody.includes(sentinelStart) &&
			currentBody.includes(sentinelEnd)
		) {
			// Replace the entire sentinel region (robust to duplicated markers)
			const startIdx = currentBody.indexOf(sentinelStart);
			const endIdx = currentBody.lastIndexOf(sentinelEnd);
			const before = startIdx >= 0 ? currentBody.slice(0, startIdx) : "";
			const after =
				endIdx >= 0 ? currentBody.slice(endIdx + sentinelEnd.length) : "";
			newBody = `${before}${sentinelStart}\n${rendered}\n${sentinelEnd}${after}`;
		} else {
			// No sentinel found, replace entire body
			newBody = `${sentinelStart}\n${rendered}\n${sentinelEnd}`;
		}

		// Retry with exponential backoff
		let retries = 3;
		let delay = 1000;

		while (retries > 0) {
			const response = await this.githubRequest(
				"PATCH",
				`/repos/${owner}/${repo}/issues/comments/${this.commentId}`,
				{ body: newBody },
			);

			if (response.ok) {
				this.lastHash = hash;
				this.logger.debug({ commentId: this.commentId }, "Updated comment");
				return;
			}

			if (response.status === 401 || response.status === 403) {
				const errorText = await response.text();
				throw new Error(`GitHub auth error: ${response.status} ${errorText}`);
			}

			if (response.status >= 500 && retries > 1) {
				retries--;
				this.logger.warn(
					{ status: response.status, retries },
					"Retrying after backoff",
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
				delay *= 2;
				continue;
			}

			const errorText = await response.text();
			throw new Error(
				`Failed to update comment: ${response.status} ${errorText}`,
			);
		}
	}

	async deleteComment(): Promise<void> {
		if (!this.commentId) {
			return;
		}

		const [owner, repo] = this.config.repo.split("/");
		if (!owner || !repo) {
			throw new Error(`Invalid repo format: ${this.config.repo}`);
		}

		const response = await this.githubRequest(
			"DELETE",
			`/repos/${owner}/${repo}/issues/comments/${this.commentId}`,
		);

		if (!response.ok && response.status !== 404) {
			const errorText = await response.text();
			this.logger.warn(
				{ status: response.status, errorText },
				"Failed to delete comment",
			);
		} else {
			this.logger.info({ commentId: this.commentId }, "Deleted comment");
			this.commentId = null;
		}
	}

	private async searchForComment(
		owner: string,
		repo: string,
	): Promise<number | null> {
		const endpoint =
			this.config.issueNumber !== undefined
				? `/repos/${owner}/${repo}/issues/${this.config.issueNumber}/comments`
				: `/repos/${owner}/${repo}/pulls/${this.config.prNumber}/comments`;

		const response = await this.githubRequest("GET", endpoint);

		if (!response.ok) {
			return null;
		}

		const comments = (await response.json()) as Array<{
			id: number;
			body: string;
			user: { login: string };
		}>;

		// Find comment with sentinel (prefer bot-owned, but accept any)
		for (const comment of comments) {
			if (
				comment.body.includes("<!-- DASHBOARD:START -->") &&
				comment.body.includes("<!-- DASHBOARD:END -->")
			) {
				return comment.id;
			}
		}

		return null;
	}

	private async getCurrentCommentBody(): Promise<string> {
		if (!this.commentId) {
			return "";
		}

		const [owner, repo] = this.config.repo.split("/");
		const response = await this.githubRequest(
			"GET",
			`/repos/${owner}/${repo}/issues/comments/${this.commentId}`,
		);

		if (!response.ok) {
			return "";
		}

		const data = (await response.json()) as { body: string };
		return data.body;
	}

	private async githubRequest(
		method: string,
		path: string,
		body?: { body?: string },
	): Promise<Response> {
		const url = `https://api.github.com${path}`;
		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.config.token}`,
			Accept: "application/vnd.github.v3+json",
			"User-Agent": "github-channel",
		};

		if (body) {
			headers["Content-Type"] = "application/json";
		}

		return fetch(url, {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
		});
	}
}
