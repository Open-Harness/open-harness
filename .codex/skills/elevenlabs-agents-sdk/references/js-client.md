# @elevenlabs/client (TypeScript/JavaScript)

Use this when integrating the core JS/TS client directly (non-React). Prefer the framework SDK if available.

## Install
- `npm install @elevenlabs/client`

## Start a session (public agent)
```ts
const conversation = await Conversation.startSession({
  agentId: "<your-agent-id>",
  connectionType: "webrtc", // "websocket" is also accepted
});
```

`startSession` kicks off the WebSocket or WebRTC connection and starts using the microphone. Request mic permissions before starting a voice session.

## Private agents
For authenticated agents, your server must request either:
- a signed URL for WebSocket sessions, or
- a conversation token for WebRTC sessions.

WebSocket (signed URL from your server):
```ts
const signedUrl = await fetch("/signed-url").then(r => r.text());
const conversation = await Conversation.startSession({
  signedUrl,
  connectionType: "websocket",
});
```

WebRTC (conversation token from your server):
```ts
const conversationToken = await fetch("/conversation-token").then(r => r.text());
const conversation = await Conversation.startSession({
  conversationToken,
  connectionType: "webrtc",
});
```

Never expose your ElevenLabs API key in the client.

## Optional callbacks
Register these in the `startSession` options:
- `onConnect`
- `onDisconnect`
- `onMessage`
- `onError`
- `onStatusChange`
- `onModeChange`
- `onCanSendFeedbackChange`

If callbacks are not firing, enable the corresponding events in the agent’s Advanced settings in the ElevenLabs dashboard.

## Return value and errors
`startSession` returns a `Conversation` instance. It throws if the session cannot be established (for example if the user denies microphone access).

## Conversation methods
- `endSession()`
- `getId()`
- `setVolume({ volume: 0..1 })`
- `getInputVolume()` / `getOutputVolume()` (0..1, where 0 is -100 dB and 1 is -30 dB)
- `sendFeedback(true|false)` (only once per agent response)
- `sendContextualUpdate(text)`
- `sendUserMessage(text)`
- `sendUserActivity()`
- `setMicMuted(true|false)`
- `changeInputDevice(...)` (voice only)
- `changeOutputDevice(...)` (voice only)

## Audio format note
In WebRTC mode the input format and sample rate are hardcoded to `pcm` and `48000` respectively; changing those values when switching input devices is a no-op.
