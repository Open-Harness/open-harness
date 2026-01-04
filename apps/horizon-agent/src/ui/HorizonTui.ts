/**
 * HorizonTui - Main Terminal UI Class
 *
 * Orchestrates all UI components and handles runtime events.
 * Based on the pattern from packages/rtv-channel/src/ui/Tui.ts
 */

import type { TypedRuntime } from "@open-harness/kernel-v3";
import blessed from "blessed";
import contrib from "blessed-contrib";
import { flushLogs } from "../logger.js";
import type { HorizonState } from "../runtime/state-schema.js";
import { AgentStream, ControlPanel, FlowGraph, StatusBar, TaskList } from "./components/index.js";

/** Runtime event type (simplified from kernel-v3) */
interface RuntimeEvent {
	type: string;
	timestamp: number;
	[key: string]: unknown;
}

export interface HorizonTuiOptions {
	/** The Horizon runtime to visualize */
	runtime: TypedRuntime<HorizonState>;
}

/**
 * Terminal UI for the Horizon Agent workflow.
 *
 * Layout:
 * ```
 * +------------------+----------+
 * |   Flow Graph     |  Status  |
 * |                  |   Bar    |
 * +------------------+----------+
 * |  Agent Stream    |  Task    |
 * |                  |  List    |
 * +------------------+----------+
 * |      Control Panel          |
 * +-----------------------------+
 * ```
 */
export class HorizonTui {
	private screen!: blessed.Widgets.Screen;
	private grid!: contrib.grid;

	// Components
	private flowGraph!: FlowGraph;
	private statusBar!: StatusBar;
	private agentStream!: AgentStream;
	private taskList!: TaskList;
	private controlPanel!: ControlPanel;

	// State
	private runtime: TypedRuntime<HorizonState>;
	private startTime: number;
	private unsubscribe?: () => void;
	private updateInterval?: ReturnType<typeof setInterval>;
	private autoExitTimeout?: ReturnType<typeof setTimeout>;

	constructor(options: HorizonTuiOptions) {
		this.runtime = options.runtime;
		this.startTime = Date.now();

		this.initializeScreen();
		this.initializeComponents();
		this.bindKeys();
		this.subscribeToEvents();
		this.startPeriodicUpdates();
		this.render();
	}

	private initializeScreen(): void {
		this.screen = blessed.screen({
			smartCSR: true,
			title: "Horizon Agent - Multi-Agent Implementation System",
		});

		this.grid = new contrib.grid({
			rows: 12,
			cols: 12,
			screen: this.screen,
		});
	}

	private initializeComponents(): void {
		// Layout:
		// FlowGraph: rows 0-5, cols 0-7 (6 rows, 8 cols)
		// StatusBar: rows 0-2, cols 8-11 (3 rows, 4 cols)
		// AgentStream: rows 6-10, cols 0-7 (5 rows, 8 cols)
		// TaskList: rows 3-10, cols 8-11 (8 rows, 4 cols)
		// ControlPanel: row 11, cols 0-11 (1 row, 12 cols)

		this.flowGraph = new FlowGraph(this.grid, 0, 0, 6, 8);
		this.statusBar = new StatusBar(this.grid, 0, 8, 3, 4);
		this.agentStream = new AgentStream(this.grid, 6, 0, 5, 8);
		this.taskList = new TaskList(this.grid, 3, 8, 8, 4);
		this.controlPanel = new ControlPanel(this.grid, 11, 0, 1, 12);
	}

	private bindKeys(): void {
		// Quit
		this.screen.key(["q", "C-c"], () => this.shutdown());

		// Pause flow execution.
		// NOTE: Pause takes effect between nodes, not mid-turn.
		// The SDK cannot interrupt a streaming agent response in progress.
		// The current node will complete before the pause takes effect.
		this.screen.key(["p"], () => {
			this.runtime.pause();
			this.agentStream.warn("Flow paused (takes effect after current node completes)");
		});

		// Resume
		this.screen.key(["r"], () => {
			this.runtime.resume();
			this.agentStream.success("Flow resumed");
		});

		// Inject message
		this.screen.key(["i"], () => this.showInjectDialog());

		// Toggle help
		this.screen.key(["?"], () => {
			this.controlPanel.toggleExpanded();
			this.render();
		});
	}

	private subscribeToEvents(): void {
		this.unsubscribe = this.runtime.onEvent((event) => {
			this.handleEvent(event as RuntimeEvent);
			this.render();
		});
	}

	private startPeriodicUpdates(): void {
		// Update elapsed time every second
		this.updateInterval = setInterval(() => {
			this.statusBar.setElapsedTime(Date.now() - this.startTime);
			this.render();
		}, 1000);
	}

	private handleEvent(event: RuntimeEvent): void {
		switch (event.type) {
			case "flow:start":
				this.statusBar.setStatus("executing");
				this.agentStream.info(`Flow started: ${(event.flowName as string) ?? "horizon-agent"}`);
				break;

			case "node:start": {
				const nodeId = event.nodeId as string;
				this.flowGraph.highlightNode(nodeId);
				this.statusBar.setCurrentNode(nodeId);
				this.agentStream.log(`{cyan-fg}[${nodeId}]{/cyan-fg} Starting...`);
				break;
			}

			case "node:complete": {
				const nodeId = event.nodeId as string;
				this.flowGraph.completeNode(nodeId);
				// Flush any buffered streaming text before logging completion
				this.agentStream.flushBuffer();
				this.agentStream.success(`[${nodeId}] Complete`);
				this.updateFromState();
				break;
			}

			case "node:error": {
				const nodeId = event.nodeId as string;
				const error = event.error as string;
				this.flowGraph.errorNode(nodeId);
				this.agentStream.error(`[${nodeId}] ${error}`);
				break;
			}

			case "agent:text": {
				const content = event.content as string;
				this.agentStream.appendText(content);
				break;
			}

			case "agent:thinking": {
				const content = event.content as string;
				this.agentStream.appendThinking(content);
				break;
			}

			case "agent:tool": {
				const toolName = event.toolName as string;
				const durationMs = event.durationMs as number | undefined;
				this.agentStream.logTool(toolName, durationMs);
				break;
			}

			case "loop:iterate": {
				const iteration = event.iteration as number;
				this.statusBar.setIteration(iteration);
				this.agentStream.warn(`Review iteration ${iteration}`);
				break;
			}

			case "flow:paused":
				this.statusBar.setStatus("paused");
				this.agentStream.warn("Flow paused");
				break;

			case "flow:resumed":
				this.statusBar.setStatus("executing");
				this.agentStream.info("Flow resumed");
				break;

			case "flow:complete": {
				const status = event.status as string | undefined;
				if (status === "failed") {
					this.statusBar.setStatus("failed");
					this.agentStream.error("Flow failed");
				} else {
					this.statusBar.setStatus("completed");
					this.agentStream.success("Flow completed successfully!");
				}
				// Auto-exit after a brief delay to let user see the final state
				this.scheduleAutoExit();
				break;
			}

			case "flow:aborted":
				this.statusBar.setStatus("failed");
				this.agentStream.error("Flow aborted");
				// Auto-exit after a brief delay
				this.scheduleAutoExit();
				break;
		}
	}

	private updateFromState(): void {
		const state = this.runtime.getState();
		this.taskList.update(state.tasks, state.currentTaskIndex, state.completedTasks);
		this.statusBar.setTaskProgress(state.currentTaskIndex, state.tasks.length);
	}

	/**
	 * Schedule automatic exit after flow completion.
	 * Gives user 2 seconds to see the final state before exiting.
	 * User can still press 'q' to exit immediately.
	 */
	private scheduleAutoExit(): void {
		// Clear any existing timeout
		if (this.autoExitTimeout) {
			clearTimeout(this.autoExitTimeout);
		}

		this.agentStream.info("Exiting in 2 seconds... (press 'q' to exit now)");
		this.render();

		this.autoExitTimeout = setTimeout(() => {
			this.shutdown();
		}, 2000);
	}

	private showInjectDialog(): void {
		const input = blessed.textbox({
			parent: this.screen,
			top: "center",
			left: "center",
			width: "50%",
			height: 3,
			border: "line",
			label: " Inject Message ",
			inputOnFocus: true,
			style: {
				border: { fg: "cyan" },
				focus: { border: { fg: "yellow" } },
			},
		});

		input.focus();
		input.readInput((_err, value) => {
			input.destroy();
			if (value && value.trim()) {
				const snapshot = this.runtime.getSnapshot();
				const runId = snapshot.runId ?? "";
				this.runtime.dispatch({
					type: "send",
					runId,
					message: value.trim(),
				});
				this.agentStream.info(`Injected: ${value.trim()}`);
			}
			this.render();
		});
		this.render();
	}

	private render(): void {
		this.screen.render();
	}

	private shutdown(): void {
		// Cleanup
		this.unsubscribe?.();
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
		}
		if (this.autoExitTimeout) {
			clearTimeout(this.autoExitTimeout);
		}

		// Abort the runtime
		this.runtime.abort();

		// Destroy screen
		try {
			this.screen.destroy();
		} catch {
			// Ignore errors during shutdown
		}

		// Flush logs before exiting to ensure all log data is written
		flushLogs()
			.catch(() => {
				// Ignore flush errors during shutdown
			})
			.finally(() => {
				process.exit(0);
			});
	}
}
