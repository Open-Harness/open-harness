# GitHub Channel — Spec

Purpose: Bidirectional channel that renders a live workflow dashboard to a single managed GitHub comment (PR or issue) and ingests user input (comments/reactions) as hub commands. Mirrors the channel contract in `packages/kernel/docs/spec/channel.md`.

## Attachment contract
- `createGithubChannel(config): Attachment`
- `Attachment = (hub: Hub) => Cleanup`
- Cleanup: void | () => void | () => Promise<void>
- Channel observes events and may emit commands (`hub.send`, `hub.reply`, `hub.abort`, `hub.sendToRun`), but never mutates FlowSpec or nodes.

## Configuration
- `repo: string` — `owner/repo`
- `issueNumber?: number` | `prNumber?: number` (exactly one)
- `tokenEnv: string` — env var containing a GitHub token
- `mentions?: string[]` — default @mentions for HITL prompts
- `debounceMs?: number` (default 3000)
- `maxRecent?: number` (default 50)
- `allowCommands?: string[]` — allowlist of slash commands
- Optional renderer override for custom dashboard template

## Events observed (hub → channel)
- `phase:*`, `task:*`, `agent:*`, `session:*`, `narrative`
- Optional: `voice:*` if mirroring voice activity
- Events reduce into curated state (run/phase/tasks/agents/prompts/recent/errors/summary).

## Commands accepted (GitHub → hub)
Slash commands (thread comments), parsed only if allowlisted:
- `/pause` → pause/abort hook (implementation-defined)
- `/resume` → resume hook
- `/abort <reason>` → `hub.abort(reason)`
- `/status` → ack only; dashboard already reflects status
- `/reply <promptId> <text>` → `hub.reply(promptId, { content: text })`
- `/choose <promptId> <choice>` → `hub.reply(promptId, { content: choice, choice })`
- `/help` → minimal usage reply (optional)

Reactions on the managed comment:
- ✅ confirm/ack prompt
- ⏸️ pause; ▶️ resume; 🛑 abort; 🔁 retry current task
- 👍 / 👎 feedback (optional telemetry)

## Output surface (channel → GitHub)
- One bot-owned managed comment with sentinel block:
```
<!-- DASHBOARD:START -->
... dashboard ...
<!-- DASHBOARD:END -->
```
- Sections: header (run/phase/time), tasks, agents, prompts, recent log, errors, control hints.
- Idempotency: render → hash; skip GitHub PATCH if unchanged. Debounce writes by `debounceMs`.
- Recovery: if sentinel missing, recreate the comment. Never edit issue/PR body.

## State shape (curated)
```ts
type GithubChannelState = {
  run: { id: string | null; status: "idle"|"running"|"paused"|"complete"|"aborted" };
  phase: { name: string | null; number?: number; status: "idle"|"running"|"complete"|"failed" };
  tasks: Array<{ id: string; label?: string; state: "pending"|"running"|"done"|"failed"; summary?: string }>;
  agents: Array<{ name: string; runId?: string; status?: string; last?: string }>;
  prompts: Array<{ promptId: string; prompt: string; choices?: string[]; allowText?: boolean; status: "open"|"answered"; from?: string }>;
  recent: Array<{ ts: string; type: string; text?: string }>;
  errors: Array<{ ts: string; message: string }>;
  summary?: string; // rolling abstract when recent overflows
  updatedAt: string;
};
```

## Event reduction rules (examples)
- `phase:start` → phase.name, status=running
- `phase:complete/failed` → status, error → errors
- `task:start/complete/failed` → tasks[id].state, summary (on complete/failed)
- `agent:*` → agents list + recent log (thinking/text/tool events)
- `session:prompt` → prompts push {open}; `session:reply` → mark answered
- `session:abort` → run.status=aborted
- `narrative` → recent; overflow → summary update

## Rendering rules
- Compact tables, truncate long text, include updatedAt.
- Control hints: list supported slash commands + reaction meanings.
- Avoid unbounded growth: cap recent by `maxRecent`, summarize overflow.

## Safety & security
- Strict command allowlist; ignore unknown commands.
- Optional membership/role check on commenters.
- Rate limit GitHub writes; backoff on 5xx; stop on 401.
- Only patch the managed comment; do not modify issue/PR body or other comments.

## Failure modes & recovery
- GitHub write fails → retry with backoff; emit `channel:error`; if persistent, pause updates.
- Sentinel missing → recreate managed comment once; if still missing, emit error and stop to avoid churn.
- Body too long → truncate sections; optionally link to external summary.

## Testing expectations
- Unit (agent): reducer (events → state), renderer (state → markdown), command parser (comments/reactions).
- Integration/offline (agent): simulate hub events over time; assert debounced writer calls with hashed bodies.
- Live (required, human-operated):
  - Human provides GH token (issue/comment perms) via `tokenEnv` and a throwaway issue/PR in `repo`.
  - Agent runs channel against that issue/PR with live writes enabled.
  - Human (or agent with human approval) posts test commands: `/status`, `/pause`, `/resume`, `/abort <reason>`, `/reply <promptId> <text>`, `/choose <promptId> <choice>`, `/help`.
  - Human (or agent under supervision) adds reactions on the managed comment: ✅, ⏸️, ▶️, 🛑, 🔁, 👍, 👎.
  - Verify dashboard updates and command routing; capture a short log; cleanup managed comment (and issue if desired).
