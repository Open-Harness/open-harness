---

## 1.0.0-alpha.3
### Patch Changes

- fix: resolve npm publishing issues
  
  - Fixed workspace:* protocol leaking to published packages
  - Fixed entry points pointing to TypeScript source instead of dist/
  - Moved bundled internal dependencies to devDependencies
  - Updated @open-harness/vitest to import from @open-harness/core
- Updated dependencies
  - @open-harness/core@1.0.0-alpha.3
lastUpdated: "2026-01-11T22:24:30.758Z"
lastCommit: "d9135fcfeffa2f6fcee18474af588d736159f828"
lastCommitDate: "2026-01-11T22:24:09Z"
---

# @open-harness/stores

## 1.0.0-alpha.2

### Major Changes

- a30a438: Signal-based reactive architecture (v0.3.0)

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
  const flow = workflow({ nodes, edges });
  await runFlow(flow, input);

  // After (v0.3.0)
  const { agent, runReactive } = createWorkflow<State>();
  const myAgent = agent({ activateOn: ["workflow:start"], emits: ["done"] });
  await runReactive({ agents: { myAgent }, state, harness, endWhen });
  ```

### Patch Changes

- Updated dependencies [30c0662]
- Updated dependencies [573af92]
- Updated dependencies [30c0662]
- Updated dependencies [a30a438]
  - @open-harness/core@1.0.0-alpha.2
