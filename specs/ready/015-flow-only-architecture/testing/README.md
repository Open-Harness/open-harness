# Testing Requirements (Flow-Only)

This folder contains test-spec artifacts for the Flow-only refactor. All new code must have a `.test-spec.md` file following the canonical template.

## Canonical format

Use the **exact structure** from the kernel docs:
- `/packages/kernel/docs/testing/test-spec-template.md`

A copy of the template is included here for convenience:
- `testing/test-spec-template.md`

## Implementation checklist

- `testing/implementation-plan.md` lists required code artifacts and test files.

## Required test specs (initial list)

- `flow-runtime.test-spec.md` (FlowRuntime lifecycle + inbox routing)
- `edge-routing.test-spec.md` (edge-level `when` readiness + merge semantics)
- `policy-enforcement.test-spec.md` (timeout, retry, continueOnError)
- `agent-nodes.test-spec.md` (agent node inbox + tool events)
- `flow-loader.test-spec.md` (nodePacks allowlist + promptFile resolution)

## Fixture conventions

- Fixtures live under `fixtures/golden/<component>/` and use JSONL.
- Recording is explicit: `bun scripts/record-fixture.ts <component> <fixture-name>`
- Golden fixtures are committed; scratch fixtures are not.

## Live tests

Each component must include an authoritative live test script under `scripts/live/` with a clear timeout and success criteria.
