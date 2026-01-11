# Testing Plan (v1)

This is a design-time testing plan for the daemon implementation.

## Unit Tests

- Renderer filters (verbosity + streaming) for text renderer.
- Grouping logic (bucket state by runId/nodeId).
- JSON renderer output format.
- CLI arg parsing (defaults, conflicts).
- WS protocol decode/encode for envelope.

## Integration Tests (No External SDK)

Use constant/echo nodes to avoid external dependencies:

- Start daemon with a simple flow and assert:
  - WS connects
  - events are broadcast
  - commands (`abort`, `resume`) are accepted
- Validate grouped renderer output with snapshot tests (no color).

## Live Tests (When External SDK is Involved)

If the daemon runs flows that hit the Claude agent:

- Run live integration tests against the real SDK.
- Record fixtures from real SDK responses (no fabricated fixtures).
- Ensure pause/resume works with streaming events.

## Manual Validation

- Start daemon, attach WS client, observe event stream.
- Pause/resume flow and confirm state transitions.
- Verify that daemon exits on flow completion.

