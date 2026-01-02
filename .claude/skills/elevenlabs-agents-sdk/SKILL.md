---
name: elevenlabs-agents-sdk
description: Build, integrate, or debug ElevenLabs Agents SDK (Agentic SDK) in TypeScript/JavaScript, including real-time voice agents, WebRTC/WebSocket sessions, React hooks, client tools, authentication (public vs private agents), and custom transports/connectors.
---

# ElevenLabs Agents SDK

## Quick start
- Confirm target runtime (web, Node, React, React Native) and decide whether to use the official SDKs or the raw WebSocket API.
- Identify agent type: public vs private, and pick the required auth flow.
- Choose connection type: WebRTC (recommended for browser UI) or WebSocket (custom transport, signed URL).
- Map events and tool calls into your host app or workflow transport.

## Load references when needed
- `references/js-client.md`: @elevenlabs/client usage (startSession, callbacks, lifecycle).
- `references/react-sdk.md`: @elevenlabs/react hook usage, client tools, overrides.
- `references/websocket-api.md`: raw WebSocket API for custom transports and event payloads.
- `references/tools.md`: tool types (client/server/MCP/system) and configuration guidance.

## Core workflow
1. Gather inputs: agentId, public/private, audio vs text-only, server location requirements.
2. Auth: public agents use agentId directly; private agents require a server endpoint for signed URL (WebSocket) or conversation token (WebRTC). Never expose API keys in the client.
3. Session: request mic permissions (if audio), then start session with SDK or WebSocket.
4. Events: wire callbacks (connect, disconnect, message, error, status, mode, tool calls). Ensure the agent has the required events enabled in the dashboard.
5. Tools: define client tools, match names and parameters to agent config, and decide whether tools should block the conversation.
6. Connector: translate agent/user events to workflow events; send contextual updates and user activity; manage reconnects and endSession.
7. Cleanup: end session, release audio devices, and flush any pending tool results.

## Transport/connector hints
- Use a small adapter that maps:
  - user input -> sendUserMessage or audio stream
  - workflow status -> sendContextualUpdate
  - agent replies -> UI/workflow output events
  - tool calls -> local actions + tool results
- Prefer WebRTC for browser UI latency; use WebSocket API for custom transports or server-side bridging.

## Guardrails
- Never expose ElevenLabs API keys on the client.
- Use signed URLs or conversation tokens for private agents.
- Keep tool schemas in sync between agent config and client/server implementations.
