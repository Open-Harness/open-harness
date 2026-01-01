import type pino from "pino";
import { dispatchCommand } from "./dispatcher.js";
import { parseReaction, parseSlashCommand } from "./parser.js";
import type { Hub } from "./types.js";

export type InputHandlerConfig = {
	repo: string;
	issueNumber?: number;
	prNumber?: number;
	token: string;
	allowCommands: string[];
	pollIntervalMs: number;
};

export class GithubInputHandler {
	private lastCommentId = 0;
	private lastCommentIdInitialized = false;
	private seenReactions = new Set<string>(); // Format: "commentId:user:emoji"
	private pollTimer: ReturnType<typeof setInterval> | null = null;
	private isPolling = false;

	constructor(
		private config: InputHandlerConfig,
		private managedCommentId: number,
		private hub: Hub,
		private getOpenPromptId: () => string | undefined,
		private logger: pino.Logger,
	) {}

	async poll(): Promise<void> {
		if (this.isPolling) {
			return; // Prevent concurrent polls
		}

		this.isPolling = true;
		try {
			await Promise.all([this.pollComments(), this.pollReactions()]);
		} catch (err) {
			this.logger.error({ err }, "Error during poll");
		} finally {
			this.isPolling = false;
		}
	}

	private async pollComments(): Promise<void> {
		const [owner, repo] = this.config.repo.split("/");
		if (!owner || !repo) {
			throw new Error(`Invalid repo format: ${this.config.repo}`);
		}

		const endpoint =
			this.config.issueNumber !== undefined
				? `/repos/${owner}/${repo}/issues/${this.config.issueNumber}/comments`
				: `/repos/${owner}/${repo}/pulls/${this.config.prNumber}/comments`;

		const response = await this.githubRequest("GET", endpoint, {
			per_page: 100,
			sort: "created",
			direction: "desc",
		});

		if (!response.ok) {
			if (response.status === 403 || response.status === 401) {
				this.logger.warn(
					{ status: response.status },
					"GitHub auth error, stopping polling",
				);
				this.stopPolling();
				return;
			}
			this.logger.warn({ status: response.status }, "Failed to fetch comments");
			return;
		}

		const comments = (await response.json()) as Array<{
			id: number;
			body: string;
			user: { login: string };
			created_at: string;
		}>;

		this.logger.debug(
			{ commentCount: comments.length, lastCommentId: this.lastCommentId },
			"Fetched comments",
		);

		// On first poll, process all comments, then initialize lastCommentId
		// On subsequent polls, only process comments newer than lastCommentId
		let newComments: Array<{
			id: number;
			body: string;
			user: { login: string };
			created_at: string;
		}>;

		if (!this.lastCommentIdInitialized) {
			// First poll: process all comments, then set lastCommentId to max
			newComments = [...comments].reverse(); // Process oldest first
			if (comments.length > 0) {
				const maxId = Math.max(...comments.map((c) => c.id));
				this.lastCommentId = maxId;
				this.logger.info(
					{ lastCommentId: this.lastCommentId, commentCount: comments.length },
					"Initialized lastCommentId from existing comments",
				);
			}
			this.lastCommentIdInitialized = true;
		} else {
			// Subsequent polls: only process comments newer than lastCommentId
			newComments = comments.filter((c) => c.id > this.lastCommentId).reverse();
		}

		this.logger.debug(
			{
				newCommentCount: newComments.length,
				newCommentIds: newComments.map((c) => c.id),
			},
			"Processing new comments",
		);

		for (const comment of newComments) {
			// Skip the managed comment itself
			if (comment.id === this.managedCommentId) {
				this.logger.debug(
					{ commentId: comment.id },
					"Skipping managed comment",
				);
				continue;
			}

			const parsed = parseSlashCommand(comment.body, this.config.allowCommands);

			if (parsed) {
				if (parsed.type === "unknown") {
					this.logger.debug(
						{
							commentId: comment.id,
							body: comment.body,
							allowCommands: this.config.allowCommands,
						},
						"Command filtered by allowlist or invalid",
					);
				} else {
					this.logger.debug(
						{
							commentId: comment.id,
							commandType: parsed.type,
							commenter: comment.user.login,
						},
						"Parsed command from comment",
					);
				}

				const result = dispatchCommand(this.hub, parsed, {
					commenter: comment.user.login,
				});

				if (result.handled) {
					// Emit a narrative event so the dashboard visibly updates for GitHub-sourced input
					this.hub.emit({
						type: "narrative",
						text: `GitHub: /${parsed.type}${"reason" in parsed && parsed.reason ? ` (${parsed.reason})` : ""} from @${comment.user.login}`,
					});
					this.logger.info(
						{
							command: parsed.type,
							commenter: comment.user.login,
							commentId: comment.id,
							ack: result.ack,
						},
						"Dispatched command from comment",
					);
				} else {
					this.logger.debug(
						{
							command: parsed.type,
							commentId: comment.id,
						},
						"Command not handled by dispatcher",
					);
				}

				// Optionally post ack reply (commented out for now)
				// if (result.ack) {
				//   await this.postAckReply(comment.id, result.ack);
				// }
			} else {
				this.logger.debug(
					{ commentId: comment.id, body: comment.body },
					"Comment does not contain a command",
				);
			}

			// Update lastCommentId
			if (comment.id > this.lastCommentId) {
				this.lastCommentId = comment.id;
			}
		}
	}

	private async pollReactions(): Promise<void> {
		const [owner, repo] = this.config.repo.split("/");
		if (!owner || !repo) {
			throw new Error(`Invalid repo format: ${this.config.repo}`);
		}

		const response = await this.githubRequest(
			"GET",
			`/repos/${owner}/${repo}/issues/comments/${this.managedCommentId}/reactions`,
		);

		if (!response.ok) {
			if (response.status === 403 || response.status === 401) {
				this.logger.warn(
					{ status: response.status },
					"GitHub auth error, stopping polling",
				);
				this.stopPolling();
				return;
			}
			// 404 might mean reactions API not available, skip silently
			if (response.status === 404) {
				return;
			}
			this.logger.warn(
				{ status: response.status },
				"Failed to fetch reactions",
			);
			return;
		}

		const reactions = (await response.json()) as Array<{
			user: { login: string };
			content: string;
		}>;

		this.logger.debug({ reactionCount: reactions.length }, "Fetched reactions");

		for (const reaction of reactions) {
			const key = `${this.managedCommentId}:${reaction.user.login}:${reaction.content}`;

			if (!this.seenReactions.has(key)) {
				this.seenReactions.add(key);

				const parsed = parseReaction(reaction.content);

				if (parsed.type !== "unknown") {
					this.logger.debug(
						{
							reactionContent: reaction.content,
							parsedType: parsed.type,
							user: reaction.user.login,
						},
						"Parsed reaction",
					);

					const openPromptId = this.getOpenPromptId();
					const result = dispatchCommand(this.hub, parsed, {
						openPromptId,
						commenter: reaction.user.login,
					});

					if (result.handled) {
						// Emit a narrative event so the dashboard visibly updates for GitHub-sourced input
						this.hub.emit({
							type: "narrative",
							text: `GitHub: reaction "${reaction.content}" -> ${parsed.type} from @${reaction.user.login}`,
						});
						this.logger.info(
							{
								reaction: parsed.type,
								user: reaction.user.login,
								emoji: reaction.content,
								ack: result.ack,
							},
							"Dispatched command from reaction",
						);
					} else {
						this.logger.debug(
							{
								reaction: parsed.type,
								user: reaction.user.login,
							},
							"Reaction not handled by dispatcher",
						);
					}
				} else {
					this.logger.debug(
						{
							reactionContent: reaction.content,
							user: reaction.user.login,
						},
						"Unknown reaction type",
					);
				}
			} else {
				this.logger.debug(
					{ key, user: reaction.user.login },
					"Skipping already seen reaction",
				);
			}
		}
	}

	startPolling(): () => void {
		if (this.pollTimer) {
			return () => this.stopPolling();
		}

		// Do initial poll immediately
		void this.poll();

		// Then poll at interval
		this.pollTimer = setInterval(() => {
			void this.poll();
		}, this.config.pollIntervalMs);

		this.logger.info(
			{ interval: this.config.pollIntervalMs },
			"Started polling for GitHub input",
		);

		return () => this.stopPolling();
	}

	stopPolling(): void {
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
			this.logger.info("Stopped polling for GitHub input");
		}
	}

	private async githubRequest(
		method: string,
		path: string,
		params?: Record<string, unknown>,
	): Promise<Response> {
		let url = `https://api.github.com${path}`;

		if (params && method === "GET") {
			const searchParams = new URLSearchParams();
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined) {
					searchParams.append(key, String(value));
				}
			}
			const query = searchParams.toString();
			if (query) {
				url += `?${query}`;
			}
		}

		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.config.token}`,
			Accept: "application/vnd.github.v3+json",
			"User-Agent": "github-channel",
		};

		return fetch(url, {
			method,
			headers,
		});
	}
}
