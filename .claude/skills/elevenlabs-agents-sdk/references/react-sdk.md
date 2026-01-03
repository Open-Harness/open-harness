# @elevenlabs/react (React/Next.js)

Use this when building browser UI with React. It wraps the core client and manages audio and state.

## Install
- `npm install @elevenlabs/react`

## Hook
```ts
import { useConversation } from "@elevenlabs/react";
const conversation = useConversation();
```

Agents Platform requires microphone access for voice conversations. Request mic permissions before starting a session.

## Options
- `clientTools`: object of client tool functions
- `overrides`: conversation settings overrides (agent prompt, voice, etc.)
- `textOnly`: avoid mic/audio setup
- `serverLocation`: "us" | "eu-residency" | "in-residency" | "global"

## Key callbacks
`onConnect`, `onDisconnect`, `onMessage`, `onError`, `onAudio`, `onModeChange`, `onStatusChange`, `onCanSendFeedbackChange`, `onDebug`, `onUnhandledClientToolCall`, `onVadScore`

## Client tools
Define functions that match agent tool names and params:
```ts
const conversation = useConversation({
  clientTools: {
    displayMessage: ({ text }: { text: string }) => {
      alert(text);
      return "Message displayed";
    },
  },
});
```
If the tool returns a value, it is sent back to the agent. Configure tools as blocking in the dashboard if the agent must wait for the result.

## startSession
The options object requires one of `signedUrl`, `conversationToken`, or `agentId`.
```ts
const conversationId = await conversation.startSession({
  agentId: "<your-agent-id>",
  connectionType: "webrtc", // "webrtc" or "websocket"
  userId: "<your-end-user-id>", // optional
});
```
For private agents, use your server to generate signed URLs (WebSocket) or conversation tokens (WebRTC).

`startSession` resolves to a `conversationId` (globally unique).

## Common methods
- `endSession()`
- `sendUserMessage(text)`
- `sendContextualUpdate(text)`
- `sendFeedback(true|false)`
- `sendUserActivity()`
- `changeInputDevice(...)`
- `changeOutputDevice(...)`
- `getId()`
- `getInputVolume()` / `getOutputVolume()`

## State helpers
- `status`
- `isSpeaking`
- `canSendFeedback`
