/**
 * ParserAgent - Parses tasks.md files into structured task data
 *
 * This agent uses Claude to intelligently parse markdown task files,
 * extracting structured information including:
 * - Task IDs, descriptions, and status
 * - Phase information and grouping
 * - Dependencies between tasks
 * - Validation criteria (explicit or inferred)
 * - Flags (parallel, user story, constitution)
 *
 * @module agents/parser-agent
 * @see {@link ../../prompts/parser.md} for the prompt template
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { inject, injectable } from "@needle-di/core";
import type { IAgentCallbacks } from "../../../callbacks/types.js";
import { IAgentRunnerToken, type IEventBus, IEventBusToken } from "../../../core/tokens.js";
import {
	type ParsedTask,
	type ParserAgentInput,
	type ParserAgentOutput,
	ParserAgentOutputSchema,
	type ParserMetadata,
} from "../../../harness/task-harness-types.js";
import { zodToSdkSchema } from "../runner/models.js";
import { BaseAnthropicAgent } from "./base-anthropic-agent.js";

// Convert Zod schema to SDK format for structured output
const ParserAgentOutputSdkSchema = zodToSdkSchema(ParserAgentOutputSchema);

/**
 * ParserAgent - Converts tasks.md markdown files into structured ParsedTask arrays.
 *
 * Uses Claude to intelligently parse task files, extracting:
 * - Task metadata (ID, status, description)
 * - Phase information
 * - Dependencies and validation criteria
 * - Task flags (parallel, user story references)
 *
 * @example
 * ```typescript
 * const parser = container.get(ParserAgent);
 *
 * const result = await parser.parse({
 *   tasksFilePath: "specs/001-sdk-core/tasks.md",
 *   tasksContent: await fs.readFile("specs/001-sdk-core/tasks.md", "utf-8"),
 * });
 *
 * console.log(`Parsed ${result.metadata.totalTasks} tasks`);
 * for (const task of result.tasks) {
 *   console.log(`${task.id}: ${task.description}`);
 * }
 * ```
 */
@injectable()
export class ParserAgent extends BaseAnthropicAgent {
	private promptTemplate: string | null = null;

	constructor(
		runner = inject(IAgentRunnerToken),
		eventBus: IEventBus | null = inject(IEventBusToken, { optional: true }) ?? null,
	) {
		super("Parser", runner, eventBus);
	}

	/**
	 * Parse a tasks.md file into structured task data.
	 *
	 * @param input - Parser input containing file path and content
	 * @param callbacks - Optional callbacks for progress updates
	 * @returns Structured parser output with tasks, phases, warnings, and metadata
	 *
	 * @throws {Error} If parsing fails or output doesn't match schema
	 */
	async parse(input: ParserAgentInput, callbacks?: IAgentCallbacks<ParserAgentOutput>): Promise<ParserAgentOutput> {
		const prompt = await this.buildPrompt(input);

		const sessionId = `parser-${Date.now()}`;

		const result = await this.run<ParserAgentOutput>(prompt, sessionId, {
			callbacks,
			outputFormat: this.buildOutputFormat(),
		});

		// Sanitize before Zod validation: filter empty validationCriteria
		const sanitized = this.sanitizeResult(result);

		// Validate with Zod schema
		const validated = ParserAgentOutputSchema.parse(sanitized);

		// Post-process: detect cycles and add warnings
		const processed = this.postProcess(validated, input.tasksFilePath);

		return processed;
	}

	/**
	 * Parse a tasks.md file from disk.
	 *
	 * Convenience method that reads the file and calls parse().
	 *
	 * @param tasksFilePath - Path to the tasks.md file
	 * @param callbacks - Optional callbacks for progress updates
	 * @returns Structured parser output
	 *
	 * @throws {Error} If file cannot be read or parsing fails
	 */
	async parseFile(tasksFilePath: string, callbacks?: IAgentCallbacks<ParserAgentOutput>): Promise<ParserAgentOutput> {
		const tasksContent = await fs.readFile(tasksFilePath, "utf-8");

		return this.parse(
			{
				tasksFilePath,
				tasksContent,
			},
			callbacks,
		);
	}

	/**
	 * Build the prompt for the LLM.
	 */
	private async buildPrompt(input: ParserAgentInput): Promise<string> {
		const template = await this.loadPromptTemplate();

		return `${template}

---

## Tasks File to Parse

**Path**: ${input.tasksFilePath}

**Content**:

\`\`\`markdown
${input.tasksContent}
\`\`\`

Parse this file and return the structured output as specified.`;
	}

	/**
	 * Load the prompt template from disk.
	 */
	private async loadPromptTemplate(): Promise<string> {
		if (this.promptTemplate) {
			return this.promptTemplate;
		}

		// Look for prompt template relative to this file
		const promptPath = path.resolve(__dirname, "../../prompts/parser.md");

		try {
			this.promptTemplate = await fs.readFile(promptPath, "utf-8");
			return this.promptTemplate;
		} catch {
			// Fallback to inline prompt if file not found
			return this.getInlinePrompt();
		}
	}

	/**
	 * Fallback inline prompt if template file not found.
	 */
	private getInlinePrompt(): string {
		return `# Task Parser Agent

You are a task parsing agent that converts markdown task files into structured JSON output.

Parse the provided tasks.md content and extract:
1. All tasks with their ID, description, status, dependencies, and validation criteria
2. All phases with their number, name, purpose, and goals
3. Any warnings about malformed content or dependency issues

Return a JSON object with: tasks[], phases[], warnings[], and metadata.`;
	}

	/**
	 * Build the output format for structured output.
	 */
	private buildOutputFormat(): Options["outputFormat"] {
		return ParserAgentOutputSdkSchema;
	}

	/**
	 * Sanitize LLM result before Zod validation.
	 *
	 * Handles edge cases where LLM returns empty strings that would fail schema validation.
	 * - Filters empty validationCriteria strings (replaces with default)
	 */
	private sanitizeResult(result: ParserAgentOutput): ParserAgentOutput {
		return {
			...result,
			tasks: result.tasks.map((task) => ({
				...task,
				// Replace empty validationCriteria with a default (schema requires min(1))
				validationCriteria:
					task.validationCriteria?.trim() || `Complete task: ${task.description.slice(0, 50)}`,
			})),
		};
	}

	/**
	 * Post-process the parser output.
	 *
	 * - Detects dependency cycles
	 * - Validates task references
	 * - Adds metadata
	 */
	private postProcess(output: ParserAgentOutput, sourcePath: string): ParserAgentOutput {
		const taskIds = new Set(output.tasks.map((t) => t.id));
		const warnings = [...output.warnings];

		// Check for unknown dependency references
		for (const task of output.tasks) {
			for (const dep of task.dependencies) {
				if (!taskIds.has(dep)) {
					warnings.push(`Task ${task.id} references unknown dependency: ${dep}`);
				}
			}
		}

		// Detect cycles
		const cycles = this.detectCycles(output.tasks);
		for (const cycle of cycles) {
			warnings.push(`Dependency cycle detected: ${cycle.join(" -> ")}`);
		}

		// Update metadata
		const metadata: ParserMetadata = {
			...output.metadata,
			cycles,
			sourcePath,
			totalTasks: output.tasks.length,
			completeTasks: output.tasks.filter((t) => t.status === "complete").length,
			pendingTasks: output.tasks.filter((t) => t.status === "pending").length,
		};

		return {
			...output,
			warnings,
			metadata,
		};
	}

	/**
	 * Detect dependency cycles using Kahn's algorithm.
	 *
	 * @param tasks - Array of parsed tasks
	 * @returns Array of cycles (each cycle is an array of task IDs)
	 */
	private detectCycles(tasks: ParsedTask[]): string[][] {
		const taskMap = new Map(tasks.map((t) => [t.id, t]));
		const inDegree = new Map<string, number>();
		const adjList = new Map<string, string[]>();

		// Initialize
		for (const task of tasks) {
			inDegree.set(task.id, 0);
			adjList.set(task.id, []);
		}

		// Build graph
		for (const task of tasks) {
			for (const dep of task.dependencies) {
				if (taskMap.has(dep)) {
					adjList.get(dep)?.push(task.id);
					inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
				}
			}
		}

		// Kahn's algorithm
		const queue: string[] = [];
		for (const [id, degree] of inDegree) {
			if (degree === 0) {
				queue.push(id);
			}
		}

		const sorted: string[] = [];
		while (queue.length > 0) {
			const current = queue.shift();
			if (!current) break;
			sorted.push(current);

			for (const neighbor of adjList.get(current) ?? []) {
				const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
				inDegree.set(neighbor, newDegree);
				if (newDegree === 0) {
					queue.push(neighbor);
				}
			}
		}

		// If not all tasks processed, there are cycles
		if (sorted.length !== tasks.length) {
			// Find cycle(s) by DFS
			const remaining = tasks.filter((t) => !sorted.includes(t.id));
			return this.findCyclesDFS(remaining, taskMap);
		}

		return [];
	}

	/**
	 * Find cycles using DFS.
	 */
	private findCyclesDFS(tasks: ParsedTask[], taskMap: Map<string, ParsedTask>): string[][] {
		const cycles: string[][] = [];
		const visited = new Set<string>();
		const recStack = new Set<string>();

		const dfs = (taskId: string, path: string[]): void => {
			if (recStack.has(taskId)) {
				// Found cycle
				const cycleStart = path.indexOf(taskId);
				if (cycleStart !== -1) {
					cycles.push([...path.slice(cycleStart), taskId]);
				}
				return;
			}

			if (visited.has(taskId)) {
				return;
			}

			visited.add(taskId);
			recStack.add(taskId);

			const task = taskMap.get(taskId);
			if (task) {
				for (const dep of task.dependencies) {
					if (taskMap.has(dep)) {
						dfs(dep, [...path, taskId]);
					}
				}
			}

			recStack.delete(taskId);
		};

		for (const task of tasks) {
			if (!visited.has(task.id)) {
				dfs(task.id, []);
			}
		}

		return cycles;
	}
}
