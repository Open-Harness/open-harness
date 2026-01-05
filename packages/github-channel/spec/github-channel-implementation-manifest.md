# GitHub Channel — Implementation Manifest

Phased plan to deliver a production-ready GitHub Channel with tests and handoff checks. Mirrors the structure used in the voice channel manifest.

## Goals
- Bidirectional GitHub interface: live dashboard in one managed comment; command intake from comments/reactions → hub commands.
- Safe, rate-limited, idempotent updates; no edits to issue/PR bodies.
- Tested with unit + offline integration; optional live test with throwaway issue.

## Non-goals (for MVP)
- No GitHub Checks UI; focus on managed comment surface.
- No multi-comment dashboards; exactly one managed comment per run.
- No body rewrites; leave issue/PR description untouched.

## Phases (with agent vs human responsibilities)
### Phase 0 — Spec & Scaffolding
- Add docs (spec, architecture, manifest) and package skeleton.
- Define config shape and state shape; align terms with kernel channel spec.
- Exit: docs present; package folder created; no code required yet.

### Phase 1 — Reducer & Renderer (pure)
- Implement state reducer (events → GithubChannelState).
- Implement renderer (state → markdown with sentinel block).
- Unit tests for reducer and renderer (hash stability, truncation).
- Exit: `bun test` for unit passes; snapshots for renderer accepted.

### Phase 2 — GitHub Writer
- Managed comment lifecycle: create/find, sentinel insert, patch sentinel block only.
- Debounce + hash guard; retry/backoff; ETag if available.
- Error surfacing via `channel:error` events.
- Exit: integration test (mock GitHub client) proves debounce, idempotency, sentinel replace.

### Phase 3 — Command Parser & Hub Bridge
- Parse allowlisted slash commands from comments; map to hub commands/replies.
- Parse reactions on managed comment; map to control commands.
- Security: allowlist enforced; optional commenter membership check stub.
- Exit: unit tests for parsing; integration test that simulated webhooks emit expected hub commands.

### Phase 4 — Offline Integration (Simulated Hub)
- Scripted 60s run emitting phase/task/agent/prompt events; ensure dashboard evolves and writer gets expected payloads.
- Assert prompt lifecycle, recent window capping, summary roll-up.
- Exit: integration test green; writer call count within throttle expectations.

### Phase 5 — Required Live GitHub Test (human-operated)
- Preconditions (human):
  - Provide a GH token with issue/comment permissions in the configured `tokenEnv`.
  - Create or select a throwaway issue (or PR) in the target repo.
  - Share the issue/PR number and `repo` with the agent.
- Agent steps (no unattended token handling):
  - Run the channel against the throwaway issue with live GitHub writes enabled.
  - Post test comments covering slash commands: `/status`, `/pause`, `/resume`, `/abort <reason>`, `/reply <promptId> <text>`, `/choose <promptId> <choice>`, `/help`.
  - Add reactions on the managed comment: ✅, ⏸️, ▶️, 🛑, 🔁, 👍, 👎 and confirm they map to hub commands.
  - Verify the dashboard updates correctly (tasks/phases/prompts/recent/errors).
  - Capture a short test log (timestamps, commands sent, observed updates).
  - Cleanup: remove the managed comment and optionally the throwaway issue.
- Exit: live test log present; cleanup confirmed.

## Handoff checklist
- Lint and typecheck clean (`bun run lint`, `bun run typecheck` once code exists).
- Unit tests: reducer, renderer, parser.
- Integration: writer behavior, simulated hub run.
- Live (required): recorded log of throwaway issue run, with cleanup done.
- Docs updated if interfaces change.

## Testing notes
- Keep tests deterministic; no network in default test suite.
- Live test must be human-operated, required, and isolated to a temporary issue/branch.
- Hash comparisons should exclude timestamps unless normalized for tests.
