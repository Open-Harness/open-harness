# Voice Events (Channel Extensions)

These events are emitted by a voice transport channel (e.g., OpenAI Realtime). They are **extension events** and do not modify the kernel protocol.

## Events out (channel → hub)

- `voice:connected` - `{ }`
- `voice:disconnected` - `{ }`
- `voice:status` - `{ connected: boolean; talking: boolean; responseInProgress: boolean; mode: "push-to-talk" | "conversation"; statusLine: string }`
- `voice:transcript` - `{ text: string }` (user transcription)
- `voice:assistant_text` - `{ text: string }` (assistant transcript)
- `voice:assistant_audio` - `{ audio: string }` (base64 pcm16le)
- `voice:mic_level` - `{ level: number }` (0–100)
- `voice:spk_level` - `{ level: number }` (0–100)
- `voice:notice` - `{ level: "info" | "warn"; message: string }`
- `voice:error` - `{ message: string }`
- `voice:event` - `{ name: string }` (raw transport event type)

## Commands in (hub → channel)

- `voice:input:start` - `{ }` (clear buffer + begin turn)
- `voice:input:audio` - `{ audio: string }` (base64 pcm16le)
- `voice:input:commit` - `{ }` (commit buffer + create response)
- `voice:response:cancel` - `{ }`
- `voice:shutdown` - `{ }`

**Note**: This channel is push-to-talk only in MVP and does not expose VAD mode switching.
