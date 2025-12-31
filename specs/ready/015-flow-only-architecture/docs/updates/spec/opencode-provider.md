# OpenCode Provider (Text-Only) – Behavior Notes

This note documents how an OpenCode-backed provider maps to FlowRuntime
agent behavior and how it differs from the Claude Agent SDK.

## Summary

- OpenCode uses an HTTP server with SSE events for streaming.
- Messages are scoped to sessions; a session acts as the mailbox.
- Prompt injection can be done via `system` or `noReply` context messages.

## Request/Response Basics (OpenCode)

- Send message: `POST /session/{sessionID}/message`
  - Request fields: `model`, `agent`, `system`, `noReply`, `tools`, `variant`, `parts[]`.
  - Only `parts` is required.
  - Text input uses `TextPartInput` with `{ type: "text", text }`.
- Response: `{ info: AssistantMessage, parts: Part[] }`.

## Streaming / Telemetry

OpenCode streaming is delivered via SSE:

- `GET /event` emits `message.part.updated` events.
- Each event includes `part` (with `sessionID`, `messageID`) and optional `delta`.
- Completion can be inferred from `message.updated` or `session.idle` events.

## Prompt Injection and Mailbox Semantics

OpenCode supports two ways to inject context:

1) `system` field on the prompt request.
2) `noReply: true` with `parts[]` to append context without a response.

Mapping:

- **Mailbox**: one OpenCode session per FlowRuntime run.
- **Inbox injection**: send a `noReply` message to the session.
- **Prompt**: send a normal message; OpenCode uses accumulated session history.

## Differences vs Claude Agent SDK

Claude Agent SDK:

- `query()` returns an async iterable for the response stream.
- Streaming comes from the same call site; progress appears while the call runs.
- Inbox is a runtime object that can enqueue prompts asynchronously.

OpenCode:

- `session.prompt()` returns the final assistant message, not the stream.
- Streaming arrives on the event bus (`GET /event`) as `message.part.updated`.
- A session provides the mailbox; context injection uses `noReply`.

Implication: to mimic Claude SDK streaming, a provider must subscribe to
OpenCode SSE events and emit `agent:text` as deltas arrive, while awaiting the
final response for completion/error status.

## Minimal Validation Spike

A spike should verify:

- `noReply` messages append context without AI response.
- `system` is honored as a system prompt.
- `message.part.updated` emits text deltas tied to `sessionID`.
- `message.updated` includes error information if auth fails.
