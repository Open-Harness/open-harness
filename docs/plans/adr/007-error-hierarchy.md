# ADR-007: Error Hierarchy

**Status:** Accepted
**Date:** 2026-01-29
**Decision Area:** Error Hierarchy
**Related Issues:** ERR-001, ERR-002, NAME-006

---

## Context

The codebase has **duplicate error hierarchies** and **poor consumer error DX**:

### Current Error Locations

| Location | Errors | Style | Usage |
|----------|--------|-------|-------|
| `Domain/Errors.ts` | `ValidationError`, `StoreError`, `AgentError`, etc. | Effect `TaggedError` | **53 uses** in production |
| `Engine/types.ts` | `WorkflowAgentError`, `WorkflowValidationError`, etc. | Effect `TaggedError` | **0 uses** in production (only tests) |
| `server/Server.ts` | `ServerError` | Effect `TaggedError` | HTTP server operations |
| `server/OpenScaffold.ts` | `OpenScaffoldError` | Plain `Error` | Public API wrapper |

### The Duplication Problem

| Domain Error | Engine Duplicate | Prod Usage |
|--------------|------------------|------------|
| `AgentError` | `WorkflowAgentError` | Domain: 2, Workflow: 0 |
| `ValidationError` | `WorkflowValidationError` | Domain: 5, Workflow: 0 |
| `StoreError` | `WorkflowStoreError` | Domain: 24, Workflow: 0 |
| `ProviderError` | `WorkflowProviderError` | Domain: 9, Workflow: 0 |

The `Workflow*` duplicates are essentially dead code.

**However**, these are legitimately used:
- `WorkflowPhaseError` — No Domain equivalent, used in runtime
- `WorkflowAbortedError` — No Domain equivalent, used in execute
- `WorkflowTimeoutError` — No Domain equivalent

### Poor Consumer DX

Current client throws generic errors:
```typescript
throw new ClientError({
  operation: "receive",
  cause: new Error(`Request failed: ${response.status}`)
})
```

Consumer experience:
```typescript
try {
  await client.createSession("hello")
} catch (e) {
  // e.cause.message = "Request failed: 400"
  // No idea what kind of error. Can't pattern match.
}
```

---

## Decision

### 1. Remove Unused Workflow* Duplicates

Delete from `Engine/types.ts`:
- `WorkflowAgentError` (duplicate of `AgentError`)
- `WorkflowValidationError` (duplicate of `ValidationError`)
- `WorkflowStoreError` (duplicate of `StoreError`)
- `WorkflowProviderError` (duplicate of `ProviderError`)

### 2. Move Legitimate Workflow Errors to Domain/Errors.ts

Rename per ADR-008 (drop `Workflow` prefix):
- `WorkflowPhaseError` → `PhaseError`
- `WorkflowAbortedError` → `AbortedError`
- `WorkflowTimeoutError` → `TimeoutError`

### 3. Establish Error Code Taxonomy

All errors have a string `code` for pattern matching:

```typescript
type ErrorCode =
  // Validation / Not Found
  | "VALIDATION_ERROR"      // Bad input, schema mismatch
  | "SESSION_NOT_FOUND"     // Session doesn't exist
  | "WORKFLOW_NOT_FOUND"    // Workflow not registered
  | "RECORDING_NOT_FOUND"   // Playback mode: no recording

  // Infrastructure
  | "STORE_ERROR"           // Database operation failed
  | "PROVIDER_ERROR"        // Agentic SDK provider failed

  // Workflow Execution
  | "PHASE_ERROR"           // Phase transition failed
  | "ABORTED"               // User/system aborted
  | "TIMEOUT"               // Execution timed out

  // Catch-all
  | "UNKNOWN"               // Unexpected error
```

### 4. Server Returns Structured Error Responses

```typescript
// Success response
{ "sessionId": "abc-123" }

// Error response (4xx/5xx)
{
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Session not found",
    "sessionId": "abc-123"
  }
}

// Error with extra fields
{
  "error": {
    "code": "PROVIDER_ERROR",
    "message": "Rate limited",
    "retryable": true,
    "retryAfter": 5000
  }
}
```

HTTP status is transport-level:
- 400 = validation errors
- 404 = not found errors
- 429 = rate limited
- 500 = server/store errors
- 502 = provider errors

### 5. Client Returns Discriminated Union (No Exceptions)

```typescript
// New client API
type ClientResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError }

type ApiError =
  | { code: "VALIDATION_ERROR"; message: string; path?: string }
  | { code: "SESSION_NOT_FOUND"; message: string; sessionId: string }
  | { code: "WORKFLOW_NOT_FOUND"; message: string; workflowId: string }
  | { code: "PROVIDER_ERROR"; message: string; retryable: boolean; retryAfter?: number }
  | { code: "STORE_ERROR"; message: string; operation: string }
  | { code: "PHASE_ERROR"; message: string; fromPhase: string; toPhase: string }
  | { code: "ABORTED"; message: string; reason: string }
  | { code: "TIMEOUT"; message: string; timeoutMs: number }
  | { code: "UNKNOWN"; message: string }

// Consumer usage - NO try/catch
const result = await client.createSession("hello")

if (!result.ok) {
  switch (result.error.code) {
    case "VALIDATION_ERROR":
      console.log("Invalid input:", result.error.message)
      break
    case "PROVIDER_ERROR":
      if (result.error.retryable) {
        await sleep(result.error.retryAfter ?? 1000)
        // retry
      }
      break
  }
  return
}

// TypeScript knows result.data is valid here
console.log("Created session:", result.data.sessionId)
```

---

## Consolidated Error Hierarchy

After this ADR, `Domain/Errors.ts` contains all errors:

```typescript
// Domain/Errors.ts (consolidated)

// Not Found
export class SessionNotFound extends Data.TaggedError("SessionNotFound")<{
  readonly sessionId: string
}> {}

export class WorkflowNotFound extends Data.TaggedError("WorkflowNotFound")<{
  readonly workflowId: string
}> {}

export class RecordingNotFound extends Data.TaggedError("RecordingNotFound")<{
  readonly hash: string
  readonly prompt: string
}> {}

// Validation
export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string
  readonly path?: string
}> {}

// Infrastructure
export class StoreError extends Data.TaggedError("StoreError")<{
  readonly operation: "read" | "write" | "delete"
  readonly cause: unknown
}> {}

export class ProviderError extends Data.TaggedError("ProviderError")<{
  readonly code: "RATE_LIMITED" | "CONTEXT_EXCEEDED" | "AUTH_FAILED" | "NETWORK" | "UNKNOWN"
  readonly message: string
  readonly retryable: boolean
  readonly retryAfter?: number
}> {}

// Agent/Handler
export class AgentError extends Data.TaggedError("AgentError")<{
  readonly agent: string  // renamed from agentName per ADR-008
  readonly phase: "prompt" | "execution" | "output"
  readonly cause: unknown
}> {}

export class HandlerError extends Data.TaggedError("HandlerError")<{
  readonly handlerName: string
  readonly eventName: string
  readonly cause: unknown
}> {}

// Workflow Execution (moved from Engine/types.ts)
export class PhaseError extends Data.TaggedError("PhaseError")<{
  readonly fromPhase: string
  readonly toPhase: string
  readonly message: string
}> {}

export class AbortedError extends Data.TaggedError("AbortedError")<{
  readonly phase?: string
  readonly reason: string
}> {}

export class TimeoutError extends Data.TaggedError("TimeoutError")<{
  readonly phase?: string
  readonly agent?: string  // renamed from agentName per ADR-008
  readonly timeoutMs: number
}> {}
```

---

## Alternatives Considered

### A. Keep both Domain and Engine error hierarchies
- **Rejected:** The Engine errors are unused in production. Consolidating eliminates confusion.

### B. Add statusCode property to error classes
- **Rejected:** Couples core errors to HTTP. The `code` field is for domain-level pattern matching; HTTP status is a server concern.

### C. Use neverthrow for client Result type
- **Rejected:** Adds external dependency. Discriminated union achieves same DX without dependencies.

### D. Keep try/catch in client
- **Rejected:** Exceptions are easy to ignore and don't enforce error handling. Discriminated union forces explicit handling.

---

## Consequences

### Positive
- Single source of truth for all errors (`Domain/Errors.ts`)
- Clean error taxonomy with string codes
- Client DX similar to Effect/Rust (errors as values)
- Pattern matching on error codes
- No try/catch needed for consumers
- Type-safe error handling

### Negative
- **Breaking change** to client API (every method returns `ClientResult<T>`)
- Breaking change to error names (`WorkflowPhaseError` → `PhaseError`)
- Server response format change (add `code` field)

### Migration Path
1. Update server to return `{ error: { code, message, ...details } }`
2. Update client to return `ClientResult<T>` instead of throwing
3. Update `Domain/Errors.ts` with consolidated errors
4. Remove duplicate errors from `Engine/types.ts`
5. Update runtime.ts/execute.ts to use renamed errors

---

## Implementation Notes

### Files to Update

**Remove from `Engine/types.ts`:**
- `WorkflowAgentError`
- `WorkflowValidationError`
- `WorkflowStoreError`
- `WorkflowProviderError`
- `WorkflowError` union type (update to reference Domain errors)

**Move to `Domain/Errors.ts` (with renames):**
- `WorkflowPhaseError` → `PhaseError`
- `WorkflowAbortedError` → `AbortedError`
- `WorkflowTimeoutError` → `TimeoutError`

**Update `packages/server/src/http/Server.ts`:**
- Expand `mapErrorToResponse` to return `{ code, message, ...details }`
- Map all error types to appropriate HTTP status codes

**Update `packages/client/src/HttpClient.ts`:**
- Change all methods to return `ClientResult<T>`
- Parse error response body to construct typed `ApiError`

**Update `packages/client/src/Contract.ts`:**
- Add `ClientResult<T>` type
- Add `ApiError` discriminated union type
- Update `WorkflowClient` interface

### HTTP Status Mapping (in Server.ts)

```typescript
const mapErrorToResponse = (error: unknown) => {
  if (error instanceof ValidationError) {
    return { status: 400, body: { error: { code: "VALIDATION_ERROR", message: error.message, path: error.path } } }
  }
  if (error instanceof SessionNotFound) {
    return { status: 404, body: { error: { code: "SESSION_NOT_FOUND", message: "Session not found", sessionId: error.sessionId } } }
  }
  if (error instanceof WorkflowNotFound) {
    return { status: 404, body: { error: { code: "WORKFLOW_NOT_FOUND", message: "Workflow not found", workflowId: error.workflowId } } }
  }
  if (error instanceof RecordingNotFound) {
    return { status: 404, body: { error: { code: "RECORDING_NOT_FOUND", message: "Recording not found", hash: error.hash } } }
  }
  if (error instanceof ProviderError) {
    const status = error.code === "RATE_LIMITED" ? 429 : 502
    return { status, body: { error: { code: "PROVIDER_ERROR", message: error.message, retryable: error.retryable, retryAfter: error.retryAfter } } }
  }
  if (error instanceof StoreError) {
    return { status: 503, body: { error: { code: "STORE_ERROR", message: "Storage error", operation: error.operation } } }
  }
  if (error instanceof PhaseError) {
    return { status: 409, body: { error: { code: "PHASE_ERROR", message: error.message, fromPhase: error.fromPhase, toPhase: error.toPhase } } }
  }
  if (error instanceof AbortedError) {
    return { status: 409, body: { error: { code: "ABORTED", message: "Workflow aborted", reason: error.reason } } }
  }
  if (error instanceof TimeoutError) {
    return { status: 504, body: { error: { code: "TIMEOUT", message: "Execution timed out", timeoutMs: error.timeoutMs } } }
  }
  return { status: 500, body: { error: { code: "UNKNOWN", message: "Internal server error" } } }
}
```

---

## Related Files

- `packages/core/src/Domain/Errors.ts` — Consolidated error classes
- `packages/core/src/Engine/types.ts` — Remove duplicate errors
- `packages/core/src/Engine/runtime.ts` — Update error imports
- `packages/core/src/Engine/execute.ts` — Update error imports
- `packages/server/src/http/Server.ts` — Error response mapping
- `packages/client/src/Contract.ts` — Add ClientResult, ApiError types
- `packages/client/src/HttpClient.ts` — Return ClientResult instead of throwing
