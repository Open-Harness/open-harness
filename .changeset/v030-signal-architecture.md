---
"@open-harness/core": major
"@open-harness/client": major
"@open-harness/server": major
"@open-harness/react": major
"@open-harness/stores": major
"@open-harness/testing": major
"@open-harness/vitest": major
"@open-harness/claude": major
"@open-harness/openai": major
---

Signal-based reactive architecture (v0.3.0)

BREAKING CHANGES:
- Remove `workflow()` factory - use `createWorkflow()` instead
- Remove `runFlow()` - use `runReactive()` instead
- Remove `FlowDefinition`, `NodeDefinition`, `EdgeDefinition` types
- Remove JSONata expression support - use template syntax `{{ state.x }}`
- Remove `edges` array - use signal chaining with `activateOn`/`emits`

New features:
- `createWorkflow<State>()` returns typed `agent()` and `runReactive()`
- Signal-based agent coordination via `activateOn` and `emits`
- Template expressions `{{ state.field }}` for state interpolation
- `endWhen` predicate for workflow termination
- Improved type safety with generic state types

Migration:
```typescript
// Before (v0.2.0)
const flow = workflow({ nodes, edges })
await runFlow(flow, input)

// After (v0.3.0)
const { agent, runReactive } = createWorkflow<State>()
const myAgent = agent({ activateOn: ["workflow:start"], emits: ["done"] })
await runReactive({ agents: { myAgent }, state, harness, endWhen })
```
