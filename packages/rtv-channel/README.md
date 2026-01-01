# rtv-spike

To install dependencies:

```bash
bun install
```

Exports:

- `createRealtimeVoiceChannel` — Hub attachment that bridges OpenAI Realtime to `voice:*` events.
- `createConsoleVoiceChannel` — Hub attachment that renders a TUI for `voice:*` events.
- `createRealtimeConsoleConnector` — Direct connector (RealtimeService + Tui).

Tutorial:
- `spec/channel-tutorial.md`

To run the console connector:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.3. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
