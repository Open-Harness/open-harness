# Implementation & Test Plan (Flow-Only)

This document enumerates **expected code artifacts** required by the test specs. It is not an implementation, but a checklist of files/scripts that must exist for the tests to pass.

## Runtime Implementation

- `packages/kernel/src/flow/runtime.ts`
  - FlowRuntime implementation (Hub + lifecycle + inbox routing)
- `packages/kernel/src/flow/executor.ts` (updated or merged into runtime)
  - Edge readiness + `when` evaluation
  - Policy enforcement (retry/timeout/continueOnError)

## Protocol Updates

- `packages/kernel/src/protocol/flow.ts`
  - `Edge.when?: WhenExpr`
  - `NodeCapabilities.isAgent?: boolean`
- `packages/kernel/src/protocol/agent.ts`
  - `AgentInbox.close(): void`

## Node Registry / Capabilities

- `packages/kernel/src/flow/registry.ts`
  - Respect `NodeCapabilities.isAgent` + `supportsInbox`

## Live Test Scripts (Authoritative)

- `packages/kernel/scripts/live/flow-runtime-live.ts`
- `packages/kernel/scripts/live/flow-edge-routing-live.ts`
- `packages/kernel/scripts/live/flow-policy-live.ts`
- `packages/kernel/scripts/live/flow-agent-nodes-live.ts`
- `packages/kernel/scripts/live/flow-loader-live.ts`

## Replay Tests

- `packages/kernel/tests/replay/flow.runtime.test.ts`
- `packages/kernel/tests/replay/flow.edge-routing.test.ts`
- `packages/kernel/tests/replay/flow.policy.test.ts`
- `packages/kernel/tests/replay/flow.agent-nodes.test.ts`
- `packages/kernel/tests/replay/flow.loader.test.ts`

## Unit Tests (Pure Logic)

- `packages/kernel/tests/unit/flow.runtime.unit.test.ts`
- `packages/kernel/tests/unit/flow.edge-routing.unit.test.ts`
- `packages/kernel/tests/unit/flow.policy.unit.test.ts`
- `packages/kernel/tests/unit/flow.agent-nodes.unit.test.ts`
- `packages/kernel/tests/unit/flow.loader.unit.test.ts`

## Fixtures (Golden)

- `packages/kernel/tests/fixtures/golden/flow/runtime-lifecycle.jsonl`
- `packages/kernel/tests/fixtures/golden/flow/runtime-task-events.jsonl`
- `packages/kernel/tests/fixtures/golden/flow/runtime-inbox-routing.jsonl`
- `packages/kernel/tests/fixtures/golden/flow/edge-when-basic.jsonl`
- `packages/kernel/tests/fixtures/golden/flow/edge-readiness.jsonl`
- `packages/kernel/tests/fixtures/golden/flow/edge-merge-any.jsonl`
- `packages/kernel/tests/fixtures/golden/flow/policy-timeout.jsonl`
- `packages/kernel/tests/fixtures/golden/flow/policy-retry.jsonl`
- `packages/kernel/tests/fixtures/golden/flow/policy-continue-on-error.jsonl`
- `packages/kernel/tests/fixtures/golden/flow/policy-failfast-false.jsonl`
- `packages/kernel/tests/fixtures/golden/flow/agent-inbox.jsonl`
- `packages/kernel/tests/fixtures/golden/flow/agent-tool-events.jsonl`
- `packages/kernel/tests/fixtures/golden/flow/agent-streaming.jsonl`
- `packages/kernel/tests/fixtures/golden/flow/loader-nodepacks.jsonl`
- `packages/kernel/tests/fixtures/golden/flow/loader-promptfile.jsonl`

## Notes

- All test specs are defined in `specs/ready/015-flow-only-architecture/testing/*.test-spec.md`.
- Fixture recording uses `bun scripts/record-fixture.ts flow <fixture-name>`.
