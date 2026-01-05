# GitHub Channel — Architecture & Strategy

This doc explains how the GitHub Channel maintains curated state, renders a live dashboard to a managed comment, and maps GitHub inputs (comments/reactions) into hub commands.

## State model (curated)
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

## Event intake and reduction
- Subscribe: `phase:*`, `task:*`, `agent:*`, `session:*`, `narrative` (optional `voice:*`).
- Reduction rules:
  - `phase:start/complete/failed` → phase status, errors on failed
  - `task:start/complete/failed` → tasks[id] state + summary on completion/failure
  - `agent:thinking/text/tool:* /complete` → agents list + recent log
  - `session:prompt` → add prompt (open); `session:reply` → mark answered
  - `session:abort` → run.status = aborted
  - `narrative` → recent; overflow → update summary
- Windowing: cap `recent` at `maxRecent`; when overflow, move older entries into `summary` (rolling abstract).

## Rendering strategy
- Managed comment with sentinel block:
```
<!-- DASHBOARD:START -->
... dashboard markdown ...
<!-- DASHBOARD:END -->
```
- Sections:
  - Header: run status, phase, updatedAt
  - Tasks table (id, state, summary truncated)
  - Agents (name, runId?, status, last message)
  - Prompts (open prompts with promptId and choices)
  - Recent log (last N)
  - Errors (recent)
  - Control hints (slash commands + reaction meanings)
- Idempotency: render → hash; if hash unchanged, skip write.
- Debounce writes by `debounceMs` to avoid spam.
- Truncation: limit column widths; ellipsize long text; keep dashboard compact.

## GitHub write path
- Create/find one bot-owned comment on the target PR/issue.
- Patch only the sentinel block; leave any other user content untouched (if present).
- Use retries/backoff on 5xx; stop on 401; log/emit `channel:error` on persistent failure.
- If sentinel missing or comment deleted, recreate once; if still missing, halt to avoid churn.

## Control surface (inputs)
- Slash commands (comments), allowlisted:
  - `/pause`, `/resume`, `/abort <reason>`, `/status`, `/reply <promptId> <text>`, `/choose <promptId> <choice>`, `/help`
- Reactions on the managed comment:
  - ✅ ack prompt
  - ⏸️ pause; ▶️ resume; 🛑 abort; 🔁 retry; 👍/👎 feedback
- Optional: short ack reply to the triggering comment to confirm receipt.
- Security: enforce allowlist; optionally require org membership/role for control commands.

## Failure modes & recovery
- Write failures: backoff, emit error, pause updates on repeated failure.
- Sentinel loss: recreate once; if repeated, emit error and stop.
- Oversized body: truncate sections; optionally link to external summary if ever needed.
- Live-test responsibility: live GitHub exercise must be run by a human operator (token + throwaway issue/PR); agent may execute under explicit human approval, must log steps, and must clean up the managed comment afterward.

## Testing approach
- Unit: reducer (events → state), renderer (state → markdown), command parser (comment text/reactions → control commands).
- Integration (offline): simulate hub events over time; assert debounced writes and idempotent hashes.
- Optional live: against a throwaway issue with a GH token—create managed comment, send fake webhook payloads for comments/reactions, verify updates, then clean up.
