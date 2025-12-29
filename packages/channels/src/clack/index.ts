/**
 * Clack Channel - Beautiful terminal UI with @clack/prompts
 *
 * Uses defineChannel for state management, pattern matching, and lifecycle hooks.
 * Provides spinners, progress indicators, and formatted output using @clack/prompts.
 *
 * @module @openharness/channels/clack
 */

import * as clack from "@clack/prompts";
import { defineChannel } from "@openharness/sdk";
import color from "picocolors";

// Type helpers - define minimal types based on actual event structure
type ChannelContext<TState> = {
	state: TState;
	event: {
		event: {
			type: string;
			[name: string]: unknown;
		};
		[id: string]: unknown;
	};
	emit: (type: string, data: Record<string, unknown>) => void;
	transport?: unknown;
};

type EnrichedEvent<T> = {
	event: T;
	[id: string]: unknown;
};

type PhaseStartEvent = { type: "phase:start"; name: string; phaseNumber?: number };
type PhaseCompleteEvent = { type: "phase:complete"; name: string; phaseNumber?: number };
type TaskStartEvent = { type: "task:start"; taskId: string };
type TaskCompleteEvent = { type: "task:complete"; taskId: string; result?: unknown };
type TaskFailedEvent = { type: "task:failed"; taskId: string; error: string };
type AgentStartEvent = { type: "agent:start"; agentName: string };
type AgentThinkingEvent = { type: "agent:thinking"; content: string };
type AgentToolStartEvent = { type: "agent:tool:start"; toolName: string };
type AgentToolCompleteEvent = { type: "agent:tool:complete"; toolName: string; isError?: boolean };
type NarrativeEvent = { type: "narrative"; text: string; importance?: string };

// ============================================================================
// TYPES
// ============================================================================

/**
 * Clack channel options.
 */
export interface ClackChannelOptions {
	/** Show task-level spinners (default: true) */
	showTasks?: boolean;
	/** Show phase-level spinners (default: true) */
	showPhases?: boolean;
	/** Show agent events (default: false) */
	showAgents?: boolean;
}

/**
 * Clack channel state - tracks active spinners.
 */
interface ClackState {
	options: Required<ClackChannelOptions>;
	phaseSpinner: ReturnType<typeof clack.spinner> | null;
	taskSpinner: ReturnType<typeof clack.spinner> | null;
	taskCount: number;
	taskCompleted: number;
	taskFailed: number;
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle phase start event.
 */
function handlePhaseStart({ state, event }: ChannelContext<ClackState>): void {
	if (!state.options.showPhases) return;

	const phaseEvent = event as EnrichedEvent<PhaseStartEvent>;
	const phaseName = phaseEvent.event.phaseNumber
		? `Phase ${phaseEvent.event.phaseNumber}: ${phaseEvent.event.name}`
		: phaseEvent.event.name;

	// Stop previous phase spinner if exists
	if (state.phaseSpinner) {
		state.phaseSpinner.stop(phaseName);
	}

	state.phaseSpinner = clack.spinner();
	state.phaseSpinner.start(phaseName);
}

/**
 * Handle phase complete event.
 */
function handlePhaseComplete({ state, event }: ChannelContext<ClackState>): void {
	if (!state.options.showPhases || !state.phaseSpinner) return;

	const phaseEvent = event as EnrichedEvent<PhaseCompleteEvent>;
	state.phaseSpinner.stop(`${color.green("✓")} ${phaseEvent.event.name} complete`);
	state.phaseSpinner = null;
}

/**
 * Handle task start event.
 */
function handleTaskStart({ state, event }: ChannelContext<ClackState>): void {
	if (!state.options.showTasks) return;

	const taskEvent = event as EnrichedEvent<TaskStartEvent>;
	state.taskCount++;

	// Stop previous task spinner if exists
	if (state.taskSpinner) {
		state.taskSpinner.stop();
	}

	state.taskSpinner = clack.spinner();
	state.taskSpinner.start(`Task: ${taskEvent.event.taskId}`);
}

/**
 * Handle task complete event.
 */
function handleTaskComplete({ state, event }: ChannelContext<ClackState>): void {
	if (!state.options.showTasks || !state.taskSpinner) return;

	const taskEvent = event as EnrichedEvent<TaskCompleteEvent>;
	state.taskCompleted++;
	state.taskSpinner.stop(`${color.green("✓")} ${taskEvent.event.taskId}`);
	state.taskSpinner = null;
}

/**
 * Handle task failed event.
 */
function handleTaskFailed({ state, event }: ChannelContext<ClackState>): void {
	if (!state.options.showTasks || !state.taskSpinner) return;

	const taskEvent = event as EnrichedEvent<TaskFailedEvent>;
	state.taskFailed++;
	state.taskSpinner.stop(`${color.red("✗")} ${taskEvent.event.taskId}: ${taskEvent.event.error || "error"}`);
	state.taskSpinner = null;
}

/**
 * Handle agent start event.
 */
function handleAgentStart({ state, event }: ChannelContext<ClackState>): void {
	if (!state.options.showAgents) return;

	const agentEvent = event as EnrichedEvent<AgentStartEvent>;
	clack.log.info(`Agent: ${agentEvent.event.agentName}`);
}

/**
 * Handle agent thinking event.
 */
function handleAgentThinking({ state, event }: ChannelContext<ClackState>): void {
	if (!state.options.showAgents) return;

	const agentEvent = event as EnrichedEvent<AgentThinkingEvent>;
	const truncated =
		agentEvent.event.content.length > 80 ? `${agentEvent.event.content.slice(0, 80)}...` : agentEvent.event.content;
	clack.log.step(truncated);
}

/**
 * Handle agent tool start event.
 */
function handleAgentToolStart({ event }: ChannelContext<ClackState>): void {
	const toolEvent = event as EnrichedEvent<AgentToolStartEvent>;
	clack.log.info(`Tool: ${toolEvent.event.toolName}`);
}

/**
 * Handle agent tool complete event.
 */
function handleAgentToolComplete({ event }: ChannelContext<ClackState>): void {
	const toolEvent = event as EnrichedEvent<AgentToolCompleteEvent>;
	if (toolEvent.event.isError) {
		clack.log.error(`Tool failed: ${toolEvent.event.toolName}`);
	} else {
		clack.log.success(`Tool complete: ${toolEvent.event.toolName}`);
	}
}

/**
 * Handle narrative event.
 */
function handleNarrative({ event }: ChannelContext<ClackState>): void {
	const narrativeEvent = event as EnrichedEvent<NarrativeEvent>;
	clack.log.message(narrativeEvent.event.text);
}

/**
 * Handle channel start.
 */
function handleStart(): void {
	clack.intro(color.inverse(" OpenHarness "));
}

/**
 * Handle channel complete.
 */
function handleComplete({ state }: ChannelContext<ClackState>): void {
	// Cleanup: stop any lingering spinners
	if (state.phaseSpinner) {
		state.phaseSpinner.stop();
	}
	if (state.taskSpinner) {
		state.taskSpinner.stop();
	}

	// Show completion summary
	const message =
		state.taskFailed > 0
			? `${color.red("✗")} Complete - ${state.taskCompleted} succeeded, ${state.taskFailed} failed`
			: `${color.green("✓")} Complete - ${state.taskCompleted} tasks succeeded`;

	clack.outro(message);
}

// ============================================================================
// CHANNEL FACTORY
// ============================================================================

/**
 * Create a clack channel that provides beautiful terminal UI.
 *
 * Features:
 * - Phase-level spinners for high-level progress
 * - Task-level spinners for granular feedback
 * - Formatted intro/outro messages
 * - Color-coded success/error states
 *
 * @param options - Channel options
 * @returns Attachment for use with harness.attach()
 *
 * @example
 * ```typescript
 * import { defineHarness } from "@openharness/sdk";
 * import { clackChannel } from "@openharness/channels";
 *
 * const harness = defineHarness({ ... })
 *   .attach(clackChannel({ showTasks: true, showPhases: true }));
 *
 * await harness.run();
 * ```
 */
export function clackChannel(options: ClackChannelOptions = {}) {
	return defineChannel({
		name: "Clack",
		state: (): ClackState => ({
			options: {
				showTasks: options.showTasks ?? true,
				showPhases: options.showPhases ?? true,
				showAgents: options.showAgents ?? false,
			},
			phaseSpinner: null,
			taskSpinner: null,
			taskCount: 0,
			taskCompleted: 0,
			taskFailed: 0,
		}),
		onStart: handleStart,
		on: {
			"phase:start": handlePhaseStart,
			"phase:complete": handlePhaseComplete,
			"task:start": handleTaskStart,
			"task:complete": handleTaskComplete,
			"task:failed": handleTaskFailed,
			"agent:start": handleAgentStart,
			"agent:thinking": handleAgentThinking,
			"agent:tool:start": handleAgentToolStart,
			"agent:tool:complete": handleAgentToolComplete,
			narrative: handleNarrative,
		},
		onComplete: handleComplete,
	});
}
