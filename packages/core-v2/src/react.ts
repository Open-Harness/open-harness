/**
 * @open-harness/core-v2 React Subpath Export
 *
 * Provides React hooks and components for workflow integration.
 * Compatible with AI SDK patterns (messages, input, handleSubmit).
 *
 * @module @open-harness/core-v2/react
 */

import {
	createContext,
	createElement,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { AnyEvent } from "./event/Event.js";
import type { Message } from "./message/Message.js";
import { projectEventsToMessages } from "./message/projection.js";
import type { TapeControls, TapeStatus } from "./tape/Tape.js";
import type { Workflow, WorkflowResult } from "./workflow/Workflow.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useWorkflow hook.
 */
export interface UseWorkflowOptions {
	/** API endpoint URL for server-side workflow (future) */
	readonly api?: string;
	/** Initial input value (default: "") */
	readonly initialInput?: string;
	/** Initial messages to display */
	readonly initialMessages?: readonly Message[];
	/** Callback when workflow completes */
	readonly onFinish?: (result: WorkflowResult<unknown>) => void;
	/** Callback on error */
	readonly onError?: (error: Error) => void;
}

/**
 * Return type of useWorkflow hook - AI SDK compatible values.
 *
 * @typeParam S - The workflow state type
 *
 * @remarks
 * Combines Vercel AI SDK-compatible values with Open Harness unique values:
 *
 * **AI SDK Compatible (FR-054):**
 * - `messages`: Projected message array
 * - `input`: Current input value
 * - `setInput`: Update input value
 * - `handleSubmit`: Submit the input
 * - `isLoading`: Whether a request is in progress
 * - `error`: Any error that occurred
 *
 * **Open Harness Unique (FR-055):**
 * - `events`: Raw event array
 * - `state`: Current workflow state
 *
 * **Tape Controls (FR-056):**
 * - `tape`: Tape controls for time-travel
 *
 * @example
 * ```tsx
 * function Chat() {
 *   const {
 *     messages,
 *     input,
 *     setInput,
 *     handleSubmit,
 *     isLoading,
 *     tape,
 *   } = useWorkflow(workflow);
 *
 *   return (
 *     <div>
 *       {messages.map((m) => (
 *         <div key={m.id}>{m.content}</div>
 *       ))}
 *       <form onSubmit={handleSubmit}>
 *         <input value={input} onChange={(e) => setInput(e.target.value)} />
 *         <button disabled={isLoading}>Send</button>
 *       </form>
 *       <button onClick={tape.stepBack}>Step Back</button>
 *     </div>
 *   );
 * }
 * ```
 */
export interface UseWorkflowReturn<S = unknown> {
	// =========================================================================
	// AI SDK Compatible (FR-054)
	// =========================================================================

	/** Projected messages for display */
	readonly messages: readonly Message[];
	/** Current input value */
	readonly input: string;
	/** Update input value */
	setInput: (value: string) => void;
	/** Submit the current input */
	handleSubmit: (e?: { preventDefault?: () => void }) => void;
	/** Whether a request is in progress */
	readonly isLoading: boolean;
	/** Error if one occurred */
	readonly error: Error | null;

	// =========================================================================
	// Open Harness Unique (FR-055)
	// =========================================================================

	/** Raw events (for power users) */
	readonly events: readonly AnyEvent[];
	/** Current state (for power users) */
	readonly state: S;

	// =========================================================================
	// Tape Controls (FR-056)
	// =========================================================================

	/** Tape controls for time-travel debugging */
	readonly tape: TapeControls<S>;
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Internal state for the workflow hook.
 */
interface WorkflowState<S> {
	events: readonly AnyEvent[];
	state: S;
	position: number;
	status: TapeStatus;
}

// ============================================================================
// useWorkflow Hook
// ============================================================================

/**
 * React hook for workflow integration with AI SDK-compatible API.
 *
 * Provides a familiar API for developers coming from Vercel AI SDK while
 * adding Open Harness unique features like raw events access and time-travel
 * debugging via tape controls.
 *
 * @typeParam S - The workflow state type
 * @param workflow - The workflow instance to use
 * @param options - Hook options
 * @returns AI SDK-compatible values plus Open Harness unique values
 *
 * @remarks
 * **Messages are projected from events** - they are not stored separately.
 * This ensures events remain the single source of truth.
 *
 * **Tape controls update React state** - when you call `tape.stepBack()`,
 * the hook internally updates position and recalculates state, triggering
 * a re-render with the new state at that position.
 *
 * @example
 * ```tsx
 * import { useWorkflow } from "@open-harness/core-v2/react";
 * import { createWorkflow } from "@open-harness/core-v2";
 *
 * const workflow = createWorkflow({
 *   name: "chat",
 *   initialState: { messages: [], terminated: false },
 *   handlers: [userInputHandler],
 *   agents: [chatAgent],
 *   until: (s) => s.terminated,
 * });
 *
 * function ChatApp() {
 *   const {
 *     messages,
 *     input,
 *     setInput,
 *     handleSubmit,
 *     isLoading,
 *     error,
 *     tape,
 *   } = useWorkflow(workflow);
 *
 *   return (
 *     <div>
 *       {messages.map((m) => <div key={m.id}>{m.content}</div>)}
 *
 *       <form onSubmit={handleSubmit}>
 *         <input
 *           value={input}
 *           onChange={(e) => setInput(e.target.value)}
 *           disabled={isLoading}
 *         />
 *         <button disabled={isLoading || !input.trim()}>Send</button>
 *       </form>
 *
 *       {error && <div className="error">{error.message}</div>}
 *
 *       <div className="tape-controls">
 *         <button onClick={tape.rewind}>⏮ Rewind</button>
 *         <button onClick={tape.stepBack}>◀ Back</button>
 *         <span>{tape.position} / {tape.length}</span>
 *         <button onClick={tape.step}>▶ Forward</button>
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useWorkflow<S = unknown>(
	workflow: Workflow<S>,
	options: UseWorkflowOptions = {},
): UseWorkflowReturn<S> {
	const { initialInput = "", initialMessages = [], onFinish, onError } = options;

	// =========================================================================
	// State
	// =========================================================================

	// Input state (controlled)
	const [input, setInput] = useState(initialInput);

	// Loading state
	const [isLoading, setIsLoading] = useState(false);

	// Error state
	const [error, setError] = useState<Error | null>(null);

	// Workflow state (events, state, position, status)
	const [workflowState, setWorkflowState] = useState<WorkflowState<S>>(() => ({
		events: [],
		// biome-ignore lint/suspicious/noExplicitAny: Workflow generic doesn't expose initialState
		state: (workflow as any)._definition?.initialState as S,
		position: 0,
		status: "idle" as TapeStatus,
	}));

	// Track active AbortController for cancellation
	const abortControllerRef = useRef<AbortController | null>(null);

	// Track if we have initial messages to show
	const hasInitialMessages = initialMessages.length > 0;

	// =========================================================================
	// Cleanup on unmount
	// =========================================================================

	useEffect(() => {
		return () => {
			// Abort any in-flight request
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
			// Dispose the workflow
			workflow.dispose().catch(() => {
				// Ignore disposal errors on unmount
			});
		};
	}, [workflow]);

	// =========================================================================
	// handleSubmit - Submit the current input
	// =========================================================================

	const handleSubmit = useCallback(
		async (e?: { preventDefault?: () => void }) => {
			// Prevent form submission
			e?.preventDefault?.();

			// Validate input
			const trimmedInput = input.trim();
			if (!trimmedInput || isLoading) {
				return;
			}

			// Create AbortController for this request
			const abortController = new AbortController();
			abortControllerRef.current = abortController;

			// Clear input and set loading
			setInput("");
			setIsLoading(true);
			setError(null);

			try {
				// Run the workflow
				const result = await workflow.run({
					input: trimmedInput,
					abortSignal: abortController.signal,
					callbacks: {
						onEvent: (event) => {
							// Update events and state on each event
							setWorkflowState((prev) => ({
								...prev,
								events: [...prev.events, event],
								position: prev.events.length, // Position at latest event
							}));
						},
						onStateChange: (newState) => {
							// Update state when it changes
							setWorkflowState((prev) => ({
								...prev,
								state: newState,
							}));
						},
						onError: (err) => {
							// Report non-fatal errors
							onError?.(err);
						},
					},
				});

				// Update final state from result
				setWorkflowState((prev) => ({
					...prev,
					events: result.events,
					state: result.state,
					position: result.events.length > 0 ? result.events.length - 1 : 0,
					status: "idle",
				}));

				// Call onFinish callback
				onFinish?.(result as WorkflowResult<unknown>);
			} catch (err) {
				// Handle abort specially
				if (err instanceof Error && err.name === "AbortError") {
					// Request was cancelled, not an error
					return;
				}

				// Set error state
				const error = err instanceof Error ? err : new Error(String(err));
				setError(error);
				onError?.(error);
			} finally {
				setIsLoading(false);
				abortControllerRef.current = null;
			}
		},
		[input, isLoading, workflow, onFinish, onError],
	);

	// =========================================================================
	// Tape Controls - Bridge between immutable Tape and React state
	// =========================================================================

	// Extract values outside of useMemo for clean dependency tracking
	const { position, status } = workflowState;
	const length = workflowState.events.length;

	const tape = useMemo<TapeControls<S>>(() => {
		// Helper to clamp position
		const clamp = (n: number) => Math.max(0, Math.min(n, length > 0 ? length - 1 : 0));

		return {
			// Position info
			position,
			length,
			status,

			// VCR Controls - update React state
			rewind: () => {
				setWorkflowState((prev) => ({
					...prev,
					position: 0,
					status: "idle",
				}));
			},

			step: () => {
				setWorkflowState((prev) => {
					const maxPos = prev.events.length > 0 ? prev.events.length - 1 : 0;
					return {
						...prev,
						position: Math.min(prev.position + 1, maxPos),
					};
				});
			},

			stepBack: () => {
				setWorkflowState((prev) => ({
					...prev,
					position: Math.max(0, prev.position - 1),
				}));
			},

			stepTo: (targetPosition: number) => {
				setWorkflowState((prev) => {
					const maxPos = prev.events.length > 0 ? prev.events.length - 1 : 0;
					return {
						...prev,
						position: Math.max(0, Math.min(targetPosition, maxPos)),
					};
				});
			},

			play: async () => {
				// Play from current position to end
				setWorkflowState((prev) => ({ ...prev, status: "playing" }));

				// Simple implementation: step through with delay
				const playStep = async (currentPos: number): Promise<void> => {
					if (currentPos >= length - 1) {
						setWorkflowState((prev) => ({ ...prev, status: "paused" }));
						return;
					}

					setWorkflowState((prev) => {
						if (prev.status !== "playing") return prev;
						return { ...prev, position: currentPos + 1 };
					});

					// Small delay between steps for visibility
					await new Promise((resolve) => setTimeout(resolve, 100));

					// Check if still playing
					return new Promise((resolve) => {
						setWorkflowState((prev) => {
							if (prev.status === "playing") {
								playStep(currentPos + 1).then(resolve);
							} else {
								resolve();
							}
							return prev;
						});
					});
				};

				await playStep(position);
			},

			playTo: async (targetPosition: number) => {
				const target = clamp(targetPosition);
				setWorkflowState((prev) => ({ ...prev, status: "playing" }));

				// Step towards target
				const playStep = async (currentPos: number): Promise<void> => {
					if (currentPos >= target) {
						setWorkflowState((prev) => ({ ...prev, status: "paused" }));
						return;
					}

					setWorkflowState((prev) => {
						if (prev.status !== "playing") return prev;
						return { ...prev, position: currentPos + 1 };
					});

					await new Promise((resolve) => setTimeout(resolve, 100));

					return new Promise((resolve) => {
						setWorkflowState((prev) => {
							if (prev.status === "playing") {
								playStep(currentPos + 1).then(resolve);
							} else {
								resolve();
							}
							return prev;
						});
					});
				};

				await playStep(position);
			},

			pause: () => {
				setWorkflowState((prev) => ({
					...prev,
					status: "paused",
				}));
			},
		};
	}, [position, length, status]);

	// =========================================================================
	// Derived values
	// =========================================================================

	// Project events to messages (memoized)
	const messages = useMemo<readonly Message[]>(() => {
		// If we have initial messages and no events yet, show those
		if (hasInitialMessages && workflowState.events.length === 0) {
			return initialMessages;
		}

		// Project events up to current position to messages
		const eventsUpToPosition = workflowState.events.slice(0, workflowState.position + 1);
		return projectEventsToMessages(eventsUpToPosition);
	}, [workflowState.events, workflowState.position, hasInitialMessages, initialMessages]);

	// =========================================================================
	// Return AI SDK compatible interface
	// =========================================================================

	return {
		// AI SDK Compatible (FR-054)
		messages,
		input,
		setInput,
		handleSubmit,
		isLoading,
		error,

		// Open Harness Unique (FR-055)
		events: workflowState.events,
		state: workflowState.state,

		// Tape Controls (FR-056)
		tape,
	};
}

// ============================================================================
// WorkflowProvider Context (FR-057)
// ============================================================================

/**
 * Context value for WorkflowProvider.
 * @internal
 */
interface WorkflowContextValue<S = unknown> {
	/** The shared workflow instance */
	readonly workflow: Workflow<S>;
	/** Shared hook return value (state is shared across consumers) */
	readonly hookValue: UseWorkflowReturn<S>;
}

/**
 * React Context for sharing workflow state across components.
 * @internal
 */
const WorkflowContext = createContext<WorkflowContextValue | null>(null);

/**
 * Props for WorkflowProvider component.
 */
export interface WorkflowProviderProps<S = unknown> {
	/** The workflow instance to share */
	readonly workflow: Workflow<S>;
	/** Hook options passed to useWorkflow */
	readonly options?: UseWorkflowOptions;
	/** Child components */
	readonly children: ReactNode;
}

/**
 * Provider component for sharing workflow state across components.
 *
 * Wraps children with a shared workflow context, allowing any nested
 * component to access the workflow via `useWorkflowContext()`.
 *
 * @typeParam S - The workflow state type
 *
 * @remarks
 * **FR-057 Compliance**: This component provides React context for shared workflow access.
 *
 * All components using `useWorkflowContext()` within this provider share:
 * - The same events array
 * - The same workflow state
 * - The same messages (projected from events)
 * - The same tape controls
 *
 * This enables building modular UIs where different components
 * can display different aspects of the workflow (messages, tape controls, etc.)
 * without prop drilling.
 *
 * @example
 * ```tsx
 * import { WorkflowProvider, useWorkflowContext } from "@open-harness/core-v2/react";
 * import { createWorkflow } from "@open-harness/core-v2";
 *
 * const workflow = createWorkflow({
 *   name: "chat",
 *   initialState: { messages: [], terminated: false },
 *   handlers: [userInputHandler],
 *   agents: [chatAgent],
 *   until: (s) => s.terminated,
 * });
 *
 * function App() {
 *   return (
 *     <WorkflowProvider workflow={workflow}>
 *       <ChatMessages />
 *       <ChatInput />
 *       <TapeControls />
 *     </WorkflowProvider>
 *   );
 * }
 *
 * function ChatMessages() {
 *   const { messages } = useWorkflowContext();
 *   return (
 *     <div>
 *       {messages.map((m) => (
 *         <div key={m.id}>{m.content}</div>
 *       ))}
 *     </div>
 *   );
 * }
 *
 * function ChatInput() {
 *   const { input, setInput, handleSubmit, isLoading } = useWorkflowContext();
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input value={input} onChange={(e) => setInput(e.target.value)} />
 *       <button disabled={isLoading}>Send</button>
 *     </form>
 *   );
 * }
 *
 * function TapeControls() {
 *   const { tape } = useWorkflowContext();
 *   return (
 *     <div>
 *       <button onClick={tape.stepBack}>Back</button>
 *       <span>{tape.position} / {tape.length}</span>
 *       <button onClick={tape.step}>Forward</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function WorkflowProvider<S = unknown>({
	workflow,
	options = {},
	children,
}: WorkflowProviderProps<S>): ReactNode {
	// Use the workflow hook to get shared state
	const hookValue = useWorkflow(workflow, options);

	// Create stable context value
	const contextValue = useMemo<WorkflowContextValue<S>>(
		() => ({
			workflow,
			hookValue,
		}),
		[workflow, hookValue],
	);

	// Use createElement instead of JSX since this is a .ts file
	return createElement(WorkflowContext.Provider, { value: contextValue as WorkflowContextValue }, children);
}

/**
 * Error thrown when useWorkflowContext is used outside WorkflowProvider.
 */
export class WorkflowContextError extends Error {
	constructor() {
		super("useWorkflowContext must be used within a WorkflowProvider");
		this.name = "WorkflowContextError";
	}
}

/**
 * Hook to access the shared workflow context from WorkflowProvider.
 *
 * Must be used within a `WorkflowProvider`. Throws `WorkflowContextError`
 * if used outside of a provider.
 *
 * @typeParam S - The workflow state type
 * @returns The shared UseWorkflowReturn value from the provider
 * @throws WorkflowContextError if used outside WorkflowProvider
 *
 * @remarks
 * This hook provides the same return type as `useWorkflow()`, but the
 * state is shared across all components using `useWorkflowContext()`
 * within the same `WorkflowProvider`.
 *
 * @example
 * ```tsx
 * function ChatMessages() {
 *   const { messages, isLoading, error } = useWorkflowContext();
 *
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       {messages.map((m) => (
 *         <div key={m.id} className={m.role}>
 *           {m.content}
 *         </div>
 *       ))}
 *       {isLoading && <div>Loading...</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useWorkflowContext<S = unknown>(): UseWorkflowReturn<S> {
	const context = useContext(WorkflowContext);

	if (context === null) {
		throw new WorkflowContextError();
	}

	return context.hookValue as UseWorkflowReturn<S>;
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type { Message, MessageRole, ToolInvocation, ToolInvocationState } from "./message/Message.js";
export type { TapeControls, TapeStatus } from "./tape/Tape.js";
export type {
	RunOptions,
	Workflow,
	WorkflowCallbacks,
	WorkflowDefinition,
	WorkflowResult,
} from "./workflow/Workflow.js";
