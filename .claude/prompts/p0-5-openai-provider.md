# P0-5: OpenAI Codex Provider Implementation

## What Went Wrong (Previous Attempt)

A previous agent attempted this task and made these mistakes:

1. **Skipped fixture recording** - Wrote mock infrastructure without ever capturing real SDK behavior
2. **Invented unnecessary code** - Created `isCodexAvailable()` that shelled out to `codex --version` binary, bypassing the SDK entirely
3. **Wrong test order** - Started writing unit tests with mocks before having any real fixtures
4. **Ignored existing patterns** - Didn't follow the Claude provider's proven approach (live tests → record fixtures → replay tests)

**DO NOT repeat these mistakes.**

---

## Task

Implement `@signals/provider-openai` - an OpenAI Codex SDK provider for Open Harness.

## Context

You are continuing v0.3.0 signal-based architecture. P0-1 through P0-4 are complete:
- `packages/core/` - Signal types, Provider interface
- `packages/signals/` - SignalBus, Store, Player
- `packages/providers/claude/` - Reference implementation

## Reference Implementation

**Study these files first (MANDATORY before writing any code):**
```
packages/providers/claude/src/claude-provider.ts              # Provider pattern
packages/providers/claude/tests/claude-provider.live.test.ts  # Live test → fixture recording
packages/providers/claude/tests/claude-provider.test.ts       # Fixture-based unit tests
packages/internal/server/src/providers/testing/mock-query.ts  # Fixture infrastructure
```

## OpenAI Codex SDK

**Package:** `@openai/codex-sdk`
**API Pattern:** Thread-based, async generator events

```typescript
import { Codex } from "@openai/codex-sdk";

const codex = new Codex();
const thread = codex.startThread();

// Streaming events
const { events } = await thread.runStreamed("prompt");
for await (const event of events) {
  // event.type: "thread.started" | "turn.completed" | "item.started" | etc.
}
```

**Event Types:**
- `thread.started` - Contains `thread_id` for resume
- `turn.started` / `turn.completed` / `turn.failed` - Turn lifecycle
- `item.started` / `item.updated` / `item.completed` - Content items
- `thread.error` - Fatal error

**Item Types:**
- `agent_message` - Text or structured output → `text:delta`, `text:complete`
- `reasoning` - Agent reasoning → `thinking:delta`, `thinking:complete`
- `mcp_tool_call` - Tool calls → `tool:call`, `tool:result`
- `command_execution` - Shell commands → `tool:call` (name="shell"), `tool:result`
- `file_change`, `web_search`, `todo_list` - Codex-specific → custom signals

## Deliverables

1. **packages/providers/openai/package.json** - Dependencies including `@openai/codex-sdk`
2. **packages/providers/openai/src/codex-provider.ts** - Provider implementation
3. **packages/providers/openai/tests/codex-provider.live.test.ts** - Live tests that record fixtures
4. **packages/providers/openai/tests/fixtures/*.json** - Recorded fixtures from real SDK
5. **packages/providers/openai/tests/codex-provider.test.ts** - Fixture-based unit tests

## Implementation Order (CRITICAL - DO NOT SKIP STEPS)

1. **Install SDK:** `cd packages/providers/openai && bun add @openai/codex-sdk`
2. **Write provider:** Following claude-provider.ts pattern exactly
3. **Write LIVE tests FIRST:** Run against real Codex SDK, record fixtures to JSON
4. **Generate fixtures:** Run `LIVE_SDK=1 bun run test` - this creates real fixture data
5. **ONLY THEN write unit tests:** Use the recorded fixtures, never fabricate mock data

## Signal Mapping

| Codex Event | Open Harness Signal |
|-------------|---------------------|
| turn.started | provider:start |
| turn.completed | provider:end |
| turn.failed | provider:error + provider:end |
| item.updated (agent_message) | text:delta |
| item.completed (agent_message) | text:complete |
| item.updated (reasoning) | thinking:delta |
| item.completed (reasoning) | thinking:complete |
| item.started (mcp_tool_call) | tool:call |
| item.completed (mcp_tool_call) | tool:result |
| item.started (command_execution) | tool:call (name="shell") |
| item.completed (command_execution) | tool:result |

## Constraints

- **Follow existing patterns exactly** - don't invent new approaches
- **NEVER mock without real fixtures first** - this is a hard rule
- **Tests must match Claude provider test structure**
- **Both providers must emit identical signal types**
- **All signals must have `source.provider` set**
- **The SDK handles the binary** - never shell out to check for `codex` CLI

## Commands

```bash
cd packages/providers/openai
bun install                           # Install dependencies
bun run typecheck                     # Type check
LIVE_SDK=1 bun run test              # Record fixtures (MUST DO FIRST)
bun run test                          # Run with fixtures (after recording)
```

## Success Criteria (from ROADMAP.md P0-5)

- [ ] OpenAI provider implementing Provider interface
- [ ] Same signal types as Claude (text:delta, tool:call, etc.)
- [ ] Session/resume support via thread_id
- [ ] Tests: swap providers, same harness works
- [ ] Cross-provider validation (same test suite passes both)
- [ ] Fixtures recorded from REAL SDK interactions
