/**
 * Human-in-the-Loop (HITL) interaction helpers.
 *
 * Provides a high-level API for creating interactions that request
 * human input and handle responses in a type-safe way.
 *
 * Note: This module inlines the Event/Handler types it needs since
 * the old Domain/Event.ts and Domain/Handler.ts have been removed.
 *
 * @module
 */

import type { InteractionEventId as EventId } from "./Ids.js"

// ─────────────────────────────────────────────────────────────────
// Inlined Event Types (formerly from Domain/Event.ts)
// ─────────────────────────────────────────────────────────────────

/**
 * Base event interface.
 */
export interface Event<Name extends string = string, Payload = unknown> {
  readonly id: EventId
  readonly name: Name
  readonly payload: Payload
  readonly timestamp: Date
  readonly causedBy?: EventId
}

/**
 * Generic event type for collections and runtime handling.
 */
export type AnyEvent = Event<string, unknown>

/**
 * Event definition - provides type-safe create() and is() methods.
 */
interface EventDefinition<Name extends string, Payload> {
  readonly name: Name
  create: (payload: Payload, causedBy?: EventId) => Event<Name, Payload>
  is: (event: AnyEvent) => event is Event<Name, Payload>
}

/**
 * Factory to define custom event types.
 */
function defineEvent<Name extends string, Payload>(
  name: Name
): EventDefinition<Name, Payload> {
  return {
    name,
    create: (payload: Payload, causedBy?: EventId): Event<Name, Payload> => {
      const event: Event<Name, Payload> = {
        id: crypto.randomUUID() as EventId,
        name,
        payload,
        timestamp: new Date()
      }
      if (causedBy !== undefined) {
        return { ...event, causedBy }
      }
      return event
    },
    is: (event: AnyEvent): event is Event<Name, Payload> => event.name === name
  }
}

// Built-in events needed by Interaction
const InputRequested = defineEvent<
  "input:requested",
  {
    interactionId: string
    agentName: string
    prompt: string
    inputType: "freeform" | "approval" | "choice"
    options?: ReadonlyArray<string>
    metadata?: Record<string, unknown>
  }
>("input:requested")

const InputResponse = defineEvent<
  "input:response",
  {
    interactionId: string
    value: string
    approved?: boolean
    selectedIndex?: number
  }
>("input:response")

// ─────────────────────────────────────────────────────────────────
// Inlined Handler Types (formerly from Domain/Handler.ts)
// ─────────────────────────────────────────────────────────────────

/**
 * Result returned by a handler.
 */
export interface HandlerResult<S> {
  readonly state: S
  readonly events: ReadonlyArray<AnyEvent>
}

/**
 * Handler definition with metadata.
 */
export interface HandlerDefinition<E extends Event = AnyEvent, S = unknown> {
  readonly name: string
  readonly handles: E["name"]
  readonly handler: (event: E, state: S) => HandlerResult<S>
}

// ─────────────────────────────────────────────────────────────────
// Interaction Types
// ─────────────────────────────────────────────────────────────────

/**
 * Type of input expected from the human.
 */
export type InteractionType = "freeform" | "approval" | "choice"

/**
 * Payload for an interaction request event.
 */
export interface InteractionRequestPayload {
  readonly interactionId: string
  readonly agentName: string
  readonly prompt: string
  readonly inputType: InteractionType
  readonly options?: ReadonlyArray<string>
  readonly metadata?: Record<string, unknown>
}

/**
 * Payload for an interaction response event.
 */
export interface InteractionResponsePayload {
  readonly interactionId: string
  readonly value: string
  readonly approved?: boolean
  readonly selectedIndex?: number
}

/**
 * Configuration for creating an interaction.
 */
export interface InteractionConfig<S> {
  /** Unique name for this interaction (used as interactionId prefix) */
  readonly name: string

  /** Type of input expected */
  readonly type: InteractionType

  /** Function that generates the prompt from current state */
  readonly prompt: (state: S) => string

  /** For choice type: available options */
  readonly options?: ReadonlyArray<string>

  /** Optional timeout in milliseconds */
  readonly timeout?: number

  /** Optional metadata generator for UI rendering */
  readonly metadata?: (state: S) => Record<string, unknown>

  /**
   * Handler for the response.
   *
   * @param response - The response value (string for freeform/choice, boolean for approval)
   * @param state - Current workflow state
   * @param trigger - The original response event
   * @returns Handler result with new state and any events to emit
   */
  readonly onResponse: (
    response: string | boolean,
    state: S,
    trigger: Event<"input:response", InteractionResponsePayload>
  ) => HandlerResult<S>
}

/**
 * Result of createInteraction - provides all the pieces needed for HITL.
 */
export interface Interaction<S> {
  /** The interaction name */
  readonly name: string

  /** The interaction type */
  readonly type: InteractionType

  /** Handler that processes the response */
  readonly responseHandler: HandlerDefinition<
    Event<"input:response", InteractionResponsePayload>,
    S
  >

  /**
   * Helper to create a request event.
   *
   * @param state - Current workflow state (used to generate prompt)
   * @param agentName - Name of the agent requesting input
   * @param causedBy - Optional event that caused this request
   * @returns The request event ready to be emitted
   */
  readonly request: (
    state: S,
    agentName: string,
    causedBy?: EventId
  ) => Event<"input:requested", InteractionRequestPayload>
}

// ─────────────────────────────────────────────────────────────────
// Interaction Factory
// ─────────────────────────────────────────────────────────────────

/**
 * Create a human-in-the-loop interaction.
 *
 * This helper generates all the pieces needed for a complete HITL workflow:
 * - A response handler
 * - A convenience method to create request events
 *
 * @example
 * ```typescript
 * const planApproval = createInteraction({
 *   name: "plan-approval",
 *   type: "approval",
 *   prompt: (state) => `Approve ${state.tasks.length} tasks?`,
 *
 *   onResponse: (response, state, trigger) => {
 *     const approved = response === true
 *     if (approved) {
 *       return {
 *         state: { ...state, phase: "executing" },
 *         events: [ExecutionStarted.create({}, trigger.id)]
 *       }
 *     }
 *     return {
 *       state: { ...state, phase: "planning" },
 *       events: [PlanRejected.create({}, trigger.id)]
 *     }
 *   }
 * })
 * ```
 */
export function createInteraction<S>(config: InteractionConfig<S>): Interaction<S> {
  const { metadata, name, onResponse, options, prompt, type } = config

  // Create a counter for unique interaction IDs within this interaction type
  let counter = 0

  // Create the request helper
  const request = (
    state: S,
    agentName: string,
    causedBy?: EventId
  ): Event<"input:requested", InteractionRequestPayload> => {
    counter++
    const interactionId = `${name}-${counter}-${Date.now()}`
    const payload: InteractionRequestPayload = {
      interactionId,
      agentName,
      prompt: prompt(state),
      inputType: type,
      ...(options ? { options } : {}),
      ...(metadata ? { metadata: metadata(state) } : {})
    }

    return InputRequested.create(payload, causedBy)
  }

  // Create the response handler
  const responseHandler: HandlerDefinition<
    Event<"input:response", InteractionResponsePayload>,
    S
  > = {
    name: `handle-${name}-response`,
    handles: "input:response",
    handler: (event, state) => {
      // Only handle responses for this interaction type
      if (!event.payload.interactionId.startsWith(`${name}-`)) {
        // Not for us, pass through unchanged
        return { state, events: [] }
      }

      // Extract the response value based on type
      let response: boolean | string
      if (type === "approval") {
        response = event.payload.approved ?? event.payload.value === "approve"
      } else {
        response = event.payload.value
      }

      // Call the user's onResponse handler
      return onResponse(response, state, event)
    }
  }

  return {
    name,
    type,
    responseHandler,
    request
  }
}

// ─────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────

/**
 * Check if an event is an interaction request.
 */
export function isInteractionRequest(
  event: AnyEvent
): event is Event<"input:requested", InteractionRequestPayload> {
  return InputRequested.is(event)
}

/**
 * Check if an event is an interaction response.
 */
export function isInteractionResponse(
  event: AnyEvent
): event is Event<"input:response", InteractionResponsePayload> {
  return InputResponse.is(event)
}

/**
 * Find pending interactions from an event stream.
 *
 * Returns requests that haven't been responded to yet.
 */
export function findPendingInteractions(
  events: ReadonlyArray<AnyEvent>
): ReadonlyArray<Event<"input:requested", InteractionRequestPayload>> {
  // Get all request interactionIds
  const requests = new Map<
    string,
    Event<"input:requested", InteractionRequestPayload>
  >()

  // Get all response interactionIds
  const respondedIds = new Set<string>()

  for (const event of events) {
    if (isInteractionRequest(event)) {
      requests.set(event.payload.interactionId, event)
    } else if (isInteractionResponse(event)) {
      respondedIds.add(event.payload.interactionId)
    }
  }

  // Return requests without responses
  return Array.from(requests.entries())
    .filter(([id]) => !respondedIds.has(id))
    .map(([, event]) => event)
}
