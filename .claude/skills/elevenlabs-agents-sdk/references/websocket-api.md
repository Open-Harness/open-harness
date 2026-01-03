# WebSocket API (custom transports)

Use this when you need a custom transport/connector or server-side bridge rather than the SDKs.

## Endpoint
- `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=<agent_id>`

## Auth
- Public agents: connect directly with `agent_id`.
- Private agents: your server must request a signed URL from ElevenLabs and return it to the client.
- Signed URLs expire after 15 minutes.
- Never expose API keys in the client.

## Signed URL request (server-side)
- `GET https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=<agent_id>`
- Header: `xi-api-key: <your-api-key>`
- Response: `{ "signed_url": "..." }`

## Contextual update event
```json
{
  "type": "contextual_update",
  "text": "User clicked on pricing page"
}
```

## Notes
- Use the API reference for full event schema (conversation initiation, transcripts, agent responses, audio chunks, tool calls).
- Prefer WebRTC via SDK for browser UI unless you need custom routing or server-side audio handling.
