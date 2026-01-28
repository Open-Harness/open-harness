# SDK DX Redesign — Fresh Session Prompt

Copy everything below the line into a fresh Claude Code session.

---

## Task

Design the DX for OpenScaffold's workflow SDK. Focus on how developers define agents, compose workflows, run them, and benchmark/evaluate them.

## Background

OpenScaffold is an Effect-TS based framework for building long-horizon agentic workflows. The core infrastructure (recording/playback, event sourcing, state snapshots) is solid. The DX layer needs redesign.

## Current Problem

Agents reference models by string name (`model: "claude-sonnet-4-5"`), and providers are mapped separately in RuntimeConfig (`providers: { "claude-sonnet-4-5": AnthropicProvider(...) }`). This indirection is unintuitive. The agent should own its provider directly.

## Design Decision

**Agent owns provider.** No string-based model resolution. For evals, use `workflow.with({ agents: {...} })` to create variants.

## Read These Files

1. `docs/sdk-guide-for-workflow-designers.md` — current SDK concepts (mental model is good, syntax needs update)
2. `docs/plans/eval-system-design.md` — eval system requirements
3. `docs/plans/fastrender-lessons.md` — target use case (hierarchical planner-worker-judge workflows)
4. `packages/core/src/Next/runtime.ts` — current ExecuteOptions, how phases/agents execute
5. `packages/core/src/Next/workflow.ts` — current WorkflowDef structure
6. `packages/core/src/Next/agent.ts` — current AgentDef structure

## Requirements

### Agent Definition
- Agent has `provider` (not `model` string)
- Agent has `prompt`, `output` (Zod schema), `update` function
- Provider wraps an SDK (Anthropic, OpenAI) with a specific model

### Workflow Definition
- Composes agents into phases
- Phase execution modes: single agent, parallel agents via `forEach`
- Phase transitions: `next` (static or conditional based on state)
- Looping: `until` condition for repeated execution
- Concurrency control: `parallel: N` for forEach
- HITL: human-in-the-loop as a phase type (not an agent property)

### Running
- `run(workflow, { input })` — minimal config when agents have providers
- Global config only: database path, recording mode

### Evaluating
- `workflow.with({ agents: {...} })` — create variant with different agents
- Eval matrix: vary model, prompt, parameters across runs
- Scorers: programmatic checks on final state

## Deliverables

1. **Type definitions** — AgentDef, PhaseDef, WorkflowDef with new structure
2. **Example workflow** — show the full DX for a planner-worker-judge pattern:
   - Decompose goal into areas
   - Plan tasks per area (parallel planners)
   - Execute tasks (parallel workers, isolated)
   - Judge and decide to continue or stop
3. **Eval example** — show how to benchmark same workflow with different models/prompts
4. **Migration notes** — what changes from current API

## Constraints

- Keep prompts SHORT in examples (just show structure, not full text)
- Don't invent features — check actual codebase before adding
- Focus on DX clarity over implementation details
- The infrastructure (ProviderRecorder, EventStore, state snapshots) already works — don't redesign it

## Success Criteria

A developer reading the examples should immediately understand:
- How to define an agent with a provider
- How to compose agents into a phased workflow
- How forEach/parallel/until/next work together
- How to create workflow variants for evals
- How HITL pauses/resumes work

Start by reading the files listed above, then propose the new type definitions and show examples.
