# PRD: Declarative Agent Pattern with Structured Outputs

## Problem Statement

The workflow system has a **contract mismatch** between agents and handlers:

1. **Agents emit**: `{ agent: "planner", output: "<raw text>" }`
2. **Handlers expect**: `{ tasks: Task[], milestones: Milestone[], taskOrder: string[] }`

This causes runtime crashes when handlers try to access typed fields that don't exist.

**Root Cause**: The SDK supports structured outputs via `outputSchema`, but:
- Agent config doesn't accept Zod schemas
- Workflow doesn't pass schema to harness
- Signal emission doesn't use `structuredOutput`

## Solution

Implement **Declarative Agent Files** with Zod schemas:

1. **`defineAgent()` utility** - Accepts Zod schema, converts to JSON schema
2. **Co-located agent files** - Prompt, schema, signals all together
3. **Shared schemas** - Handlers and agents import same types
4. **Auto-wiring** - Workflow passes schema to harness, uses `structuredOutput` as payload

## Success Criteria

1. `defineAgent()` accepts Zod schemas and converts to JSON schema
2. Planner agent uses structured output, handler receives typed payload
3. No more `as FooPayload` casts needed in handlers
4. `bun run prd:live` completes without handler crashes

## Architecture

```
packages/prd-workflow/
├── src/
│   ├── agents/
│   │   ├── index.ts           # Re-exports all agents
│   │   └── planner.agent.ts   # Planner with Zod schema
│   ├── schemas/
│   │   ├── index.ts           # Re-exports all schemas
│   │   └── plan.schema.ts     # PlanCreated schema
│   ├── handlers/              # (existing, uses shared types)
│   └── workflow.ts            # Updated to wire schemas
```

## Technical Requirements

### TR-01: Add zod-to-json-schema dependency
- Install `zod-to-json-schema` package
- Version compatible with zod 4.x

### TR-02: Create `defineAgent()` utility
Location: `packages/internal/core/src/api/define-agent.ts`

```typescript
export function defineAgent<TOutput, TState>(
  definition: AgentDefinition<TOutput, TState>
): CompiledAgent<TOutput, TState>
```

Must:
- Accept `outputSchema` as Zod type
- Convert to JSON schema using `zod-to-json-schema`
- Preserve original Zod schema for runtime validation
- Support prompt as string OR function of context

### TR-03: Create shared schemas
Location: `packages/prd-workflow/src/schemas/`

Files:
- `plan.schema.ts` - TaskSchema, MilestoneSchema, PlanCreatedPayloadSchema
- `task.schema.ts` - TaskReadyPayloadSchema, TaskCompletePayloadSchema
- `index.ts` - Re-exports

Must:
- Export both Zod schemas AND inferred types
- Use `.describe()` for JSON schema documentation
- Match existing type definitions in `types.ts`

### TR-04: Create planner agent file
Location: `packages/prd-workflow/src/agents/planner.agent.ts`

Must:
- Import `defineAgent` from `@internal/core`
- Import `PlanCreatedPayloadSchema` from schemas
- Define prompt that instructs Claude to return structured plan
- Declare `emits: ["plan:created"]` with schema

### TR-05: Update workflow to wire schemas
Location: `packages/internal/core/src/api/create-workflow.ts`

Changes:
1. Pass `agent.jsonSchema` to harness input as `outputSchema`
2. When emitting signals, use `result.structuredOutput` if available
3. Fall back to `{ agent, output }` wrapper only for text-only agents

### TR-06: Update handler to use shared types
Location: `packages/prd-workflow/src/handlers/planning.ts`

Changes:
- Import `PlanCreatedPayload` from `../schemas/plan.schema.js`
- Remove local type definition (use shared)
- Handler now receives correctly typed payload

### TR-07: Update CLI to use new agent
Location: `packages/prd-workflow/src/cli.ts`

Changes:
- Import `plannerAgent` from `./agents/planner.agent.js`
- Remove inline agent definition
- Pass to workflow

## Verification

### V-01: Type check passes
```bash
bun run typecheck
```
Zero errors.

### V-02: Unit tests pass
```bash
bun run test
```
All tests pass.

### V-03: Live workflow completes
```bash
cd packages/prd-workflow
bun run prd:live ../../examples/hello-world.prd.md
```
Must:
- Call real Claude API
- Receive structured output
- Handler processes payload without crash
- Workflow completes

## Out of Scope

- Other agents (coder, reviewer) - planner only for this iteration
- Replay mode changes
- New signals or handlers
- UI changes

## Dependencies

- Existing `ClaudeHarness` structured output support (already implemented)
- Existing `createHandler` utility (already implemented)
- zod 4.x (already in project)
