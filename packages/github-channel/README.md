# GitHub Channel

Bidirectional channel that renders a live dashboard to a single managed GitHub comment (PR or issue) and ingests user input from comments/reactions, emitting hub commands. This package mirrors the channel patterns in `packages/kernel/docs/spec/channel.md` and the voice channel docs, but targets GitHub as the UI surface.

## What is a channel?
- A channel is an attachment: `(hub: Hub) => cleanup`.
- Channels subscribe to hub events and may emit commands (`hub.send`, `hub.reply`, `hub.abort`, etc.).
- Channels are not nodes and do not appear in FlowSpec.
See `packages/kernel/docs/spec/channel.md` for the canonical contract.

## Docs
- `spec/github-channel.md` — canonical spec (contract, config, event/command surface, rendering).
- `spec/github-channel-architecture.md` — state model, reduction rules, rendering template, control surface.
- `spec/github-channel-implementation-manifest.md` — phased implementation + test/handoff checklist.

## High-level behavior
- Output: Maintains one bot-owned comment with a sentinel block; renders phases, tasks, prompts, agents, recent log, errors, and control hints. Debounced + hashed to avoid no-op writes.
- Input: Parses slash commands in thread comments and emoji reactions on the managed comment; maps to hub commands (pause/resume/abort/reply/choose/status).
- Safety: Allowlisted commands, optional membership checks, retry/backoff on GitHub writes, never edits the issue/PR body—only its own comment.

## Next steps
See the implementation manifest for the phased plan and test expectations. Once code is added, wire it as `createGithubChannel(config): Attachment` and keep docs and code in sync.
