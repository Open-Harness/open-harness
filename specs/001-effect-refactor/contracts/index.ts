/**
 * @core-v2 Public API Contracts
 *
 * This module exports all public types for the core-v2 package.
 * These types form the consumer-facing API surface.
 *
 * IMPORTANT: No Effect types are exposed here. All async operations
 * return standard Promises, and all data types are plain objects.
 *
 * @module @core-v2
 */

// ============================================================================
// Event Types
// ============================================================================

export type {
  // Core types
  EventId,
  Event,
  EventPayload,
  AnyEvent,
  // Built-in events
  UserInputEvent,
  TextDeltaEvent,
  TextCompleteEvent,
  AgentStartedEvent,
  AgentCompletedEvent,
  ToolCalledEvent,
  ToolResultEvent,
  ErrorOccurredEvent,
  // Factory types
  EventDefinition,
  EventFromDef,
} from "./event";

// ============================================================================
// Handler Types
// ============================================================================

export type {
  HandlerResult,
  Handler,
  HandlerDefinition,
  HandlerRegistry,
  DefineHandlerOptions,
} from "./handler";

// ============================================================================
// Agent Types
// ============================================================================

export type {
  PromptTemplate,
  PromptPart,
  Agent,
  AgentRegistry,
  AgentOptions,
} from "./agent";

// ============================================================================
// Renderer Types
// ============================================================================

export type {
  EventPattern,
  RenderFunction,
  Renderer,
  MultiRenderer,
  RendererRegistry,
  CreateRendererOptions,
} from "./renderer";

// ============================================================================
// Store Types
// ============================================================================

export type {
  SessionId,
  SessionMetadata,
  StateSnapshot,
  StoreError,
  Store,
  MemoryStoreOptions,
  SqliteStoreOptions,
} from "./store";

// ============================================================================
// Tape Types
// ============================================================================

export type {
  TapeStatus,
  TapeMetadata,
  Tape,
  TapeControls,
} from "./tape";

// ============================================================================
// Workflow Types
// ============================================================================

export type {
  WorkflowCallbacks,
  RunOptions,
  WorkflowResult,
  WorkflowDefinition,
  Workflow,
  WorkflowHandler,
  CreateWorkflowHandlerOptions,
} from "./workflow";

// ============================================================================
// Message Types (React Integration)
// ============================================================================

export type {
  MessageRole,
  ToolInvocationState,
  ToolInvocation,
  Message,
  ProjectionOptions,
  UseWorkflowReturn,
  WorkflowProviderProps,
  WorkflowChatProps,
  UseWorkflowOptions,
} from "./message";

// ============================================================================
// Provider Types
// ============================================================================

export type {
  ProviderError,
  ProviderMessage,
  QueryOptions,
  StreamChunk,
  ClaudeProviderConfig,
  ProviderType,
  ProviderInfo,
} from "./provider";
