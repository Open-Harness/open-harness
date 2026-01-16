/**
 * PRD Workflow Types
 *
 * Data types for the PRD Agent System.
 * Based on PRD-AGENT-SYSTEM-DESIGN.md v0.5
 */

// ============================================================================
// Task Types
// ============================================================================

/**
 * A specific change to be made to a file.
 */
export interface TaskChange {
	file: string;
	changeType: "modify" | "create" | "delete" | "rename";
	description: string;
	location: string | null; // Line range, function name, etc. if known
}

/**
 * Record of a single task attempt.
 */
export interface TaskAttempt {
	attempt: number;
	timestamp: string;
	outcome: "success" | "failed" | "blocked";
	summary: string;
	filesChanged: string[];
	checkpointHash: string; // Git commit hash
	reviewFeedback: string | null; // What the reviewer said
}

/**
 * Task status values.
 */
export type TaskStatus = "pending" | "ready" | "in_progress" | "complete" | "blocked" | "skipped";

/**
 * The atomic unit of work in the PRD workflow.
 */
export interface Task {
	// === Identity ===
	id: string; // e.g., "T001", "T002-discovered"
	milestoneId: string; // Which milestone this belongs to

	// === What ===
	title: string; // Short descriptive title
	description: string; // Detailed explanation of what needs to happen
	definitionOfDone: string[]; // Specific criteria that mark this task complete

	// === How (may be partial initially, discovered during work) ===
	technicalApproach: string | null; // How to implement
	filesToModify: string[]; // Known files that need changes
	filesToCreate: string[]; // New files to create
	changes: TaskChange[]; // Specific changes if known

	// === Context ===
	context: string | null; // Why this task exists, relevant background
	dependencies: string[]; // Task IDs this depends on
	blockedBy: string | null; // What's blocking this (if blocked)

	// === Lifecycle ===
	status: TaskStatus;
	createdBy: "planner" | "coder"; // Who created this task
	attempt: number; // Current attempt number
	maxAttempts: number; // Limit before escalation (default: 5)

	// === History ===
	attemptHistory: TaskAttempt[]; // Record of all attempts
}

// ============================================================================
// Milestone Types
// ============================================================================

/**
 * Acceptance test configuration for a milestone.
 */
export interface AcceptanceTest {
	type: "manual" | "automated" | "behavioral";
	description: string; // What proves this milestone works
	command: string | null; // Test command if automated
	expectedOutcome: string; // What success looks like
}

/**
 * Milestone status values.
 */
export type MilestoneStatus = "pending" | "in_progress" | "testing" | "complete" | "failed";

/**
 * A milestone groups related tasks with an integration test.
 */
export interface Milestone {
	id: string; // e.g., "M001"
	index: number; // Order in plan
	title: string;
	description: string;

	// === The Real Test ===
	acceptanceTest: AcceptanceTest;

	// === Relationships ===
	taskIds: string[]; // Tasks in this milestone
	dependencies: string[]; // Milestone IDs this depends on

	// === Status ===
	status: MilestoneStatus;
}

// ============================================================================
// Discovery Types
// ============================================================================

/**
 * A task discovered by the coding agent during implementation.
 */
export interface DiscoveredTask {
	title: string;
	description: string;
	definitionOfDone: string[];
	suggestedMilestoneId: string | null;
	reason: string; // Why this task is needed
	filesToModify: string[];
	filesToCreate: string[];
	changes: TaskChange[];
	discoveredBy: string; // Task ID that discovered this
	timestamp: string;
}

// ============================================================================
// History Types
// ============================================================================

/**
 * Types of events recorded in workflow history.
 */
export type HistoryEntryType =
	| "task_started"
	| "task_completed"
	| "task_failed"
	| "task_skipped"
	| "milestone_started"
	| "milestone_completed"
	| "milestone_failed"
	| "discovery_submitted"
	| "discovery_approved"
	| "discovery_rejected"
	| "replan_triggered"
	| "workflow_complete"
	| "workflow_failed";

/**
 * An entry in the append-only audit log.
 */
export interface HistoryEntry {
	timestamp: string;
	type: HistoryEntryType;
	details: Record<string, unknown>;
}

// ============================================================================
// Review Types
// ============================================================================

/**
 * A specific issue found during code review.
 */
export interface ReviewIssue {
	file: string;
	issue: string;
	suggestion: string;
}

/**
 * Possible review decisions.
 */
export type ReviewDecisionType = "approved" | "needs_fix" | "blocked" | "escalate";

/**
 * Recommended action when escalating.
 */
export type EscalationAction = "replan" | "skip" | "abort";

/**
 * A review decision from the review agent.
 */
export interface ReviewDecision {
	decision: ReviewDecisionType;
	reasoning: string;

	// For needs_fix
	fixInstructions: string | null;
	specificIssues: ReviewIssue[];

	// For escalate
	escalationReason: string | null;
	recommendedAction: EscalationAction | null;

	// Progress assessment (critical for termination decisions)
	progressMade: boolean;
	lessonsLearned: string | null;
}

// ============================================================================
// State Types
// ============================================================================

/**
 * Planning layer phase.
 */
export type PlanningPhase = "analyzing" | "planning" | "monitoring" | "replanning";

/**
 * Execution layer phase.
 */
export type ExecutionPhase = "idle" | "executing" | "awaiting_review";

/**
 * Review layer phase.
 */
export type ReviewPhase = "idle" | "reviewing_task" | "reviewing_milestone";

/**
 * Workflow-level phase.
 */
export type WorkflowPhase = "planning" | "executing" | "complete" | "failed";

/**
 * The complete state of a PRD workflow.
 */
export interface PRDWorkflowState {
	// === Input ===
	prd: string;

	// ============================================================
	// PLANNING LAYER - Strategic decisions, work management
	// ============================================================
	planning: {
		phase: PlanningPhase;

		// The plan
		milestones: Milestone[];
		approach: string; // Overall technical approach
		reasoning: string; // Why this plan

		// Task management (source of truth for all tasks)
		allTasks: Record<string, Task>; // All tasks by ID
		taskQueue: string[]; // Task IDs ready to be picked up

		// Discovery handling
		pendingDiscoveries: DiscoveredTask[]; // Tasks proposed by coder
		rejectedDiscoveries: DiscoveredTask[]; // Tasks planner decided not to do

		// Iteration tracking
		replanCount: number;
		maxReplans: number; // Default: 2
	};

	// ============================================================
	// EXECUTION LAYER - Active work
	// ============================================================
	execution: {
		phase: ExecutionPhase;

		// Current work
		activeTasks: string[]; // Task IDs currently being worked (parallel)
		currentTaskId: string | null; // Primary task ID (for single-task mode)
		currentTask: Task | null; // Pre-computed: allTasks[currentTaskId] for template access

		// Progress tracking
		completedTaskIds: string[];
		blockedTaskIds: string[];
		skippedTaskIds: string[];

		// Current milestone context
		currentMilestoneId: string | null;
	};

	// ============================================================
	// REVIEW LAYER - Evaluation and steering
	// ============================================================
	review: {
		phase: ReviewPhase;

		// What's being reviewed
		taskUnderReview: string | null;
		milestoneUnderReview: string | null;

		// Pre-computed for template access
		currentTaskForReview: Task | null;

		// Last decision (for context)
		lastDecision: ReviewDecision | null;
	};

	// ============================================================
	// GLOBAL STATE
	// ============================================================
	history: HistoryEntry[]; // Append-only audit log
	terminalFailure: string | null; // If workflow failed terminally
	workflowPhase: WorkflowPhase;
}
