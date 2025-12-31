# Flow-Only Fixture Map

This file lists all fixtures referenced by the Flow-only test specifications.

## Flow Runtime

- `fixtures/golden/flow/runtime-lifecycle.jsonl`
  - Scenario: run lifecycle events (`harness:*`, `phase:*`)
- `fixtures/golden/flow/runtime-task-events.jsonl`
  - Scenario: task events per node
- `fixtures/golden/flow/runtime-inbox-routing.jsonl`
  - Scenario: inbox routing via `sendToRun`

## Edge Routing

- `fixtures/golden/flow/edge-when-basic.jsonl`
  - Scenario: edge `when` gating
- `fixtures/golden/flow/edge-readiness.jsonl`
  - Scenario: readiness (all resolved + any fired)
- `fixtures/golden/flow/edge-merge-any.jsonl`
  - Scenario: merge `any` semantics

## Policy Enforcement

- `fixtures/golden/flow/policy-timeout.jsonl`
  - Scenario: node timeout
- `fixtures/golden/flow/policy-retry.jsonl`
  - Scenario: retry with backoff
- `fixtures/golden/flow/policy-continue-on-error.jsonl`
  - Scenario: continueOnError
- `fixtures/golden/flow/policy-failfast-false.jsonl`
  - Scenario: failFast false

## Agent Nodes

- `fixtures/golden/flow/agent-inbox.jsonl`
  - Scenario: inbox always present
- `fixtures/golden/flow/agent-tool-events.jsonl`
  - Scenario: tool events emitted
- `fixtures/golden/flow/agent-streaming.jsonl`
  - Scenario: streaming text events
