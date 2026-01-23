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
	/**
	 * API endpoint URL for server-side workflow execution.
	 *
	 * When provided, the hook connects to this endpoint via Server-Sent Events (SSE)
	 * instead of running the workflow locally. The endpoint should be created with
	 * `createWorkflowHandler()`.
	 *
	 * @remarks
	 * **FR-060 Compliance**: This enables client-server separation where the
	 * workflow runs on the server and streams events to the client.
	 *
	 * @example
	 * ```tsx
	 * // Connect to server endpoint
	 * const { messages, handleSubmit } = useWorkflow(workflow, {
	 *   api: '/api/workflow',
	 * });
	 * ```
	 */
	readonly api?: string;
	/** Initial input value (default: "") */
	readonly initialInput?: string;
	/** Initial messages to display */
	readonly initialMessages?: readonly Message[];
	/** Callback when workflow completes */
	readonly onFinish?: (result: WorkflowResult<unknown>) => void;
	/** Callback on error */
	readonly onError?: (error: Error) => void;
	/** Whether to record the session (for server-side execution, default: false) */
	readonly record?: boolean;
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
// SSE Client Helper (FR-060)
// ============================================================================

/**
 * SSE event data format (matches server's SSEEventData).
 * @internal
 */
interface SSEEventData {
	type: "event" | "state" | "done" | "error";
	data: unknown;
}

/**
 * Parse SSE message from raw text.
 * SSE format: "data: {...}\n\n"
 * @internal
 */
function parseSSEMessage(message: string): SSEEventData | null {
	const dataPrefix = "data: ";
	if (!message.startsWith(dataPrefix)) {
		return null;
	}

	const jsonStr = message.slice(dataPrefix.length).trim();
	if (!jsonStr) {
		return null;
	}

	try {
		return JSON.parse(jsonStr) as SSEEventData;
	} catch {
		return null;
	}
}

/**
 * State setter type for workflow state.
 * @internal
 */
type WorkflowStateSetter<S> = (value: WorkflowState<S> | ((prev: WorkflowState<S>) => WorkflowState<S>)) => void;

/**
 * Execute workflow via server-side API endpoint using SSE.
 * @internal
 */
async function executeViaApi<S>(
	apiUrl: string,
	input: string,
	abortController: AbortController,
	record: boolean,
	setWorkflowState: WorkflowStateSetter<S>,
	setError: (value: Error | null | ((prev: Error | null) => Error | null)) => void,
	onError: ((error: Error) => void) | undefined,
	onFinish: ((result: WorkflowResult<unknown>) => void) | undefined,
): Promise<void> {
	// Send POST request to initiate workflow
	const response = await fetch(apiUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ input, record }),
		signal: abortController.signal,
	});

	// Check for HTTP errors
	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Server error: ${response.status} - ${errorText}`);
	}

	// Check for SSE content type
	const contentType = response.headers.get("Content-Type");
	if (!contentType?.includes("text/event-stream")) {
		throw new Error(`Expected text/event-stream, got ${contentType}`);
	}

	// Read SSE stream
	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error("Response body is not readable");
	}

	const decoder = new TextDecoder();
	let buffer = "";
	let collectedEvents: AnyEvent[] = [];
	let finalState: S | undefined;
	let sessionId: string | undefined;
	let terminated = false;

	try {
		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				break;
			}

			// Decode chunk and add to buffer
			buffer += decoder.decode(value, { stream: true });

			// Process complete messages (separated by double newlines)
			const messages = buffer.split("\n\n");
			buffer = messages.pop() ?? ""; // Keep incomplete message in buffer

			for (const message of messages) {
				const trimmedMessage = message.trim();
				if (!trimmedMessage) continue;

				const sseEvent = parseSSEMessage(trimmedMessage);
				if (!sseEvent) continue;

				switch (sseEvent.type) {
					case "event": {
						const event = sseEvent.data as AnyEvent;
						collectedEvents = [...collectedEvents, event];
						setWorkflowState((prev) => ({
							...prev,
							events: [...prev.events, event],
							position: prev.events.length,
						}));
						break;
					}
					case "state": {
						const newState = sseEvent.data as S;
						finalState = newState;
						setWorkflowState((prev) => ({
							...prev,
							state: newState,
						}));
						break;
					}
					case "done": {
						const doneData = sseEvent.data as {
							sessionId?: string;
							terminated?: boolean;
							finalState?: S;
						};
						sessionId = doneData.sessionId;
						terminated = doneData.terminated ?? false;
						if (doneData.finalState !== undefined) {
							finalState = doneData.finalState;
						}

						// Update final state
						setWorkflowState((prev) => ({
							...prev,
							events: collectedEvents,
							state: finalState ?? prev.state,
							position: collectedEvents.length > 0 ? collectedEvents.length - 1 : 0,
							status: "idle",
						}));

						// Call onFinish callback
						if (onFinish) {
							// Create a minimal result object for the callback
							// Note: sessionId comes from server as a plain string, cast to branded type
							// Note: Tape is not available in client-side API mode
							onFinish({
								state: finalState,
								events: collectedEvents,
								// biome-ignore lint/suspicious/noExplicitAny: SessionId from server is a plain string
								sessionId: (sessionId ?? "") as any,
								terminated,
								// biome-ignore lint/suspicious/noExplicitAny: Tape not available in API mode
								tape: undefined as any,
							});
						}
						break;
					}
					case "error": {
						const errorData = sseEvent.data as { message?: string; name?: string };
						const error = new Error(errorData.message ?? "Unknown server error");
						error.name = errorData.name ?? "ServerError";
						setError(error);
						onError?.(error);
						break;
					}
				}
			}
		}
	} finally {
		reader.releaseLock();
	}
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
 * @param options - Hook options including optional `api` for server-side execution
 * @returns AI SDK-compatible values plus Open Harness unique values
 *
 * @remarks
 * **Local vs Server Execution (FR-060)**:
 * - Without `api`: Workflow runs locally in the browser
 * - With `api`: Workflow runs on server, events streamed via SSE
 *
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
	const { api, initialInput = "", initialMessages = [], onFinish, onError, record = false } = options;

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
				// =====================================================================
				// Server-side execution via API (FR-060)
				// =====================================================================
				if (api) {
					await executeViaApi(
						api,
						trimmedInput,
						abortController,
						record,
						setWorkflowState,
						setError,
						onError,
						onFinish,
					);
				} else {
					// =================================================================
					// Local workflow execution
					// =================================================================
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
				}
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
		[input, isLoading, workflow, onFinish, onError, api, record],
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
// WorkflowChat Component (FR-058)
// ============================================================================

/**
 * Props for WorkflowChat component.
 *
 * @typeParam S - The workflow state type
 */
export interface WorkflowChatProps<S = unknown> {
	/** The workflow to use */
	readonly workflow: Workflow<S>;
	/** CSS class name for the root container */
	readonly className?: string;
	/** Placeholder text for input field */
	readonly placeholder?: string;
	/** Whether to show tape controls (default: false) */
	readonly showTapeControls?: boolean;
	/** Hook options passed to internal useWorkflow */
	readonly options?: UseWorkflowOptions;
}

/**
 * Internal component that renders the chat UI using context.
 * @internal
 */
function WorkflowChatInner<S = unknown>({
	className,
	placeholder = "Type a message...",
	showTapeControls = false,
}: Omit<WorkflowChatProps<S>, "workflow" | "options">): ReactNode {
	const { messages, input, setInput, handleSubmit, isLoading, error, tape } = useWorkflowContext<S>();

	// Build children array for the container
	const children: ReactNode[] = [];

	// Messages container
	const messageElements: ReactNode[] = [];
	for (let i = 0; i < messages.length; i++) {
		const message = messages[i];
		if (!message) continue;

		const messageStyle: Record<string, string> = {
			padding: "8px 12px",
			marginBottom: "8px",
			borderRadius: "8px",
			backgroundColor: message.role === "user" ? "#e3f2fd" : "#f5f5f5",
			alignSelf: message.role === "user" ? "flex-end" : "flex-start",
			maxWidth: "80%",
		};

		messageElements.push(
			createElement(
				"div",
				{
					key: message.id,
					style: messageStyle,
					"data-role": message.role,
					"data-testid": `message-${message.role}`,
				},
				// Message name (agent name) if present
				message.name
					? createElement(
							"div",
							{
								style: {
									fontSize: "12px",
									color: "#666",
									marginBottom: "4px",
								},
							},
							message.name,
						)
					: null,
				// Message content
				createElement("div", null, message.content),
				// Tool invocations if present
				message.toolInvocations && message.toolInvocations.length > 0
					? createElement(
							"div",
							{
								style: {
									fontSize: "12px",
									color: "#888",
									marginTop: "4px",
								},
							},
							`Tools: ${message.toolInvocations.map((t) => t.toolName).join(", ")}`,
						)
					: null,
			),
		);
	}

	const messagesContainerStyle: Record<string, string> = {
		display: "flex",
		flexDirection: "column",
		flex: "1",
		overflowY: "auto",
		padding: "16px",
		gap: "8px",
	};

	children.push(
		createElement(
			"div",
			{
				key: "messages",
				style: messagesContainerStyle,
				"data-testid": "messages-container",
			},
			...messageElements,
			// Loading indicator
			isLoading
				? createElement(
						"div",
						{
							key: "loading",
							style: {
								padding: "8px 12px",
								color: "#666",
								fontStyle: "italic",
							},
							"data-testid": "loading-indicator",
						},
						"Loading...",
					)
				: null,
		),
	);

	// Error display
	if (error) {
		children.push(
			createElement(
				"div",
				{
					key: "error",
					style: {
						padding: "8px 12px",
						backgroundColor: "#ffebee",
						color: "#c62828",
						borderRadius: "4px",
						margin: "0 16px",
					},
					"data-testid": "error-display",
				},
				error.message,
			),
		);
	}

	// Input form
	const formStyle: Record<string, string> = {
		display: "flex",
		gap: "8px",
		padding: "16px",
		borderTop: "1px solid #eee",
	};

	const inputStyle: Record<string, string> = {
		flex: "1",
		padding: "8px 12px",
		borderRadius: "4px",
		border: "1px solid #ddd",
		fontSize: "14px",
	};

	const buttonStyle: Record<string, string> = {
		padding: "8px 16px",
		borderRadius: "4px",
		border: "none",
		backgroundColor: isLoading ? "#ccc" : "#1976d2",
		color: "white",
		cursor: isLoading ? "not-allowed" : "pointer",
		fontSize: "14px",
	};

	children.push(
		createElement(
			"form",
			{
				key: "form",
				onSubmit: handleSubmit,
				style: formStyle,
				"data-testid": "chat-form",
			},
			createElement("input", {
				type: "text",
				value: input,
				onChange: (e: { target: { value: string } }) => setInput(e.target.value),
				placeholder,
				disabled: isLoading,
				style: inputStyle,
				"data-testid": "chat-input",
			}),
			createElement(
				"button",
				{
					type: "submit",
					disabled: isLoading || !input.trim(),
					style: buttonStyle,
					"data-testid": "submit-button",
				},
				"Send",
			),
		),
	);

	// Tape controls (optional)
	if (showTapeControls) {
		const tapeControlsStyle: Record<string, string> = {
			display: "flex",
			alignItems: "center",
			gap: "8px",
			padding: "8px 16px",
			borderTop: "1px solid #eee",
			backgroundColor: "#fafafa",
		};

		const tapeButtonStyle: Record<string, string> = {
			padding: "4px 8px",
			borderRadius: "4px",
			border: "1px solid #ddd",
			backgroundColor: "white",
			cursor: "pointer",
			fontSize: "12px",
		};

		children.push(
			createElement(
				"div",
				{
					key: "tape-controls",
					style: tapeControlsStyle,
					"data-testid": "tape-controls",
				},
				createElement(
					"button",
					{
						type: "button",
						onClick: tape.rewind,
						style: tapeButtonStyle,
						"data-testid": "rewind-button",
						title: "Rewind to start",
					},
					"⏮",
				),
				createElement(
					"button",
					{
						type: "button",
						onClick: tape.stepBack,
						style: tapeButtonStyle,
						"data-testid": "step-back-button",
						title: "Step back",
					},
					"◀",
				),
				createElement(
					"span",
					{
						style: {
							fontSize: "12px",
							color: "#666",
							minWidth: "60px",
							textAlign: "center",
						},
						"data-testid": "position-indicator",
					},
					`${tape.position + 1} / ${tape.length}`,
				),
				createElement(
					"button",
					{
						type: "button",
						onClick: tape.step,
						style: tapeButtonStyle,
						"data-testid": "step-button",
						title: "Step forward",
					},
					"▶",
				),
				createElement(
					"button",
					{
						type: "button",
						onClick: tape.play,
						style: tapeButtonStyle,
						"data-testid": "play-button",
						title: tape.status === "playing" ? "Playing..." : "Play",
					},
					tape.status === "playing" ? "⏸" : "▶▶",
				),
			),
		);
	}

	// Container styles
	const containerStyle: Record<string, string> = {
		display: "flex",
		flexDirection: "column",
		height: "100%",
		fontFamily: "system-ui, -apple-system, sans-serif",
	};

	return createElement(
		"div",
		{
			className,
			style: containerStyle,
			"data-testid": "workflow-chat",
		},
		...children,
	);
}

/**
 * Zero-config chat UI component for workflows.
 *
 * Provides a complete chat interface with messages list, input field,
 * submit button, and optional tape controls for time-travel debugging.
 *
 * @typeParam S - The workflow state type
 *
 * @remarks
 * **FR-058 Compliance**: This component provides a "zero-config chat UI"
 * that works out of the box with any workflow.
 *
 * The component uses `WorkflowProvider` internally, so the workflow state
 * is properly managed without requiring external state management.
 *
 * **Features:**
 * - Messages list with user/assistant styling
 * - Input field with placeholder
 * - Submit button with loading state
 * - Error display
 * - Optional tape controls for time-travel debugging
 *
 * @example
 * ```tsx
 * import { WorkflowChat } from "@open-harness/core-v2/react";
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
 *     <WorkflowChat
 *       workflow={workflow}
 *       placeholder="Ask me anything..."
 *       showTapeControls
 *     />
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With custom styling via className
 * <WorkflowChat
 *   workflow={workflow}
 *   className="my-chat-container"
 *   placeholder="Type here..."
 *   showTapeControls={false}
 * />
 * ```
 */
export function WorkflowChat<S = unknown>({
	workflow,
	className,
	placeholder,
	showTapeControls,
	options,
}: WorkflowChatProps<S>): ReactNode {
	// Use WorkflowProvider to manage state internally
	// Pass children as third argument per React convention
	return createElement(
		WorkflowProvider,
		{ workflow, options } as WorkflowProviderProps<S>,
		createElement(WorkflowChatInner, {
			className,
			placeholder,
			showTapeControls,
		}),
	);
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
