# Recording & Fixtures (Kernel V3)

This doc describes how to generate fixtures from live SDK runs and how E2E tests
consume those fixtures.

## Why recordings

We avoid live SDK calls in tests by replaying recorded SDK message streams. This
keeps CI deterministic and fast while still exercising the Claude node behavior.

## Record fixtures

Use the recording script to execute a flow with the real SDK and write fixtures
per Claude node:

```bash
cd packages/kernel
bun run record:fixtures --flow path/to/flow.yaml --out tests/fixtures/recordings/my-flow
```

Output files are written as:

```
tests/fixtures/recordings/my-flow/<nodeId>.json
```

Each file contains a `calls` array, where each entry captures:
- The resolved `input` for the Claude node
- The SDK `events` stream emitted during the call
- The final `output` (text, usage, sessionId, etc.)

## E2E tests

The E2E tests use `createMockQuery()` with fixtures from
`tests/fixtures/recordings/`.

Run locally:

```bash
cd packages/kernel
bun run test:e2e
```

## Notes

- Fixtures are keyed by node id (default). If you need different keys, update
  the test's `selectFixtureKey` mapping.
- Recordings include SDK message streams, so tests can emit agent events
  (`agent:text`, `agent:thinking`, `agent:tool`, etc.) without live calls.
