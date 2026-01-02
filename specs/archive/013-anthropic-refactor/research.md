# Research: Anthropic Package Architecture Refactor

**Branch**: `013-anthropic-refactor` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)

---

## Research Question 1: Factory DI Pattern

**Unknown**: How should `defineAnthropicAgent()` internally create the DI container and wire dependencies without exposing Needle DI to users?

### Decision

Use a singleton global container pattern with lazy initialization inside `defineAnthropicAgent()`, registering internal agent via `useFactory` with `inject()` calls.

### Rationale

This approach aligns with existing codebase patterns while hiding DI complexity:

1. **Singleton Global Container**: Follow the pattern already established in `packages/sdk/src/factory/agent-factory.ts` which uses a private `_globalContainer` singleton with lazy initialization via `getGlobalContainer()`. This ensures all factory-created agents share the same DI context.

2. **useFactory with inject()**: Leverage Needle DI's capability to call `inject()` inside factory functions:
   ```typescript
   container.bind({
     provide: InternalAnthropicAgentToken,
     useFactory: () => new InternalAnthropicAgent(
       inject(IAgentRunnerToken),
       inject(IUnifiedEventBusToken, { optional: true })
     )
   })
   ```

3. **Internal Registration Only**: `InternalAnthropicAgent` class remains internal (not exported). Users never see `@injectable()` decorators or injection tokens. The factory function returns a simple object with `.execute()` and `.stream()` methods that delegate to the internal agent.

4. **Decorator Compatibility**: Call `setDecoratorContainer(container)` and `setMonologueContainer(container)` immediately after container creation, ensuring `@Record` and `@Monologue` decorators work correctly (pattern already used in `createReplayContainer`).

5. **Per-Agent Configuration**: Each call to `defineAnthropicAgent()` can create agent-specific bindings (like custom prompt templates) in the global container using unique tokens, while sharing infrastructure services (runner, event bus).

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Create new container per agent instance | Would break decorator compatibility (they expect a single global container) and waste memory by duplicating infrastructure services |
| Manual constructor injection without DI | Would require duplicating complex dependency wiring and lose compatibility with existing infrastructure |
| Service Locator pattern (expose getService() to users) | Violates Constitution III by forcing users to understand service tokens |

---

## Research Question 2: PromptTemplate Type Safety

**Unknown**: What's the best pattern for `PromptTemplate<TData>` to enforce type safety between input schema and template variables?

### Decision

Hybrid approach: Extract template variable names using TypeScript template literal types + infer, constrain TData to include those keys, and validate at runtime with Zod.

### Rationale

Based on research into TypeScript advanced types, prompt templating libraries, and the specific requirements of FR-007/FR-008:

1. **Compile-time extraction**: Use TypeScript's template literal types with recursive `infer` to extract variable names from template strings like `{{task}}` at the type level. This creates a union type of all placeholder names.

2. **Type constraint on TData**: Constrain the generic `TData` parameter to extend `Record<ExtractedVars, unknown>`, ensuring TData must include all variables used in the template.

3. **Runtime validation with Zod**: Link TData to `inputSchema: ZodType<TInput>` where TInput = TData.

### Implementation Pattern

```typescript
// Extract variable names from template string
type ExtractVars<S extends string> =
  S extends `${string}{{${infer Var}}}${infer Rest}`
    ? Var | ExtractVars<Rest>
    : never;

// Constrain TData to include all extracted variables
type PromptTemplate<TTemplate extends string, TData extends Record<ExtractVars<TTemplate>, unknown>> = {
  template: TTemplate;
  render(data: TData): string;
  validate?(data: unknown): data is TData;
};

// Factory helper
function createPromptTemplate<TTemplate extends string, TData extends Record<ExtractVars<TTemplate>, unknown>>(
  template: TTemplate,
  schema?: ZodType<TData>
): PromptTemplate<TTemplate, TData>;
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Runtime-only validation with string parsing | Fails SC-003 requirement for compile-time type safety |
| Branded types to tag template strings | Doesn't extract variable names from template strings |
| Manual declaration of template variables | Requires users to declare variables separately, violates DRY |
| Template literal types only (no Zod) | No runtime guarantees when data comes from external sources |

---

## Research Question 3: Decorator Compatibility

**Unknown**: How do `@Monologue` and `@Record` decorators attach to factory-produced agents (FR-004)?

### Decision

Use higher-order function wrapper pattern in factory - return decorated methods, not plain object.

### Rationale

Current decorators are TypeScript method decorators that only work on class methods. Since the refactor moves from classes to factory functions, we apply decorator logic as higher-order function wrappers INSIDE the factory function.

The factory (defineAnthropicAgent) will:
1. Create the core execute/stream functions
2. Check if recording/monologue is enabled in options
3. Wrap the functions with decorator logic (same interception code from current decorators)
4. Return the wrapped functions as object methods

### Implementation Approach

- Extract `@Record` logic to `wrapWithRecording(fn, options)` helper
- Extract `@Monologue` logic to `wrapWithMonologue(fn, scope, options)` helper
- Factory calls these wrappers before returning object
- No API changes - decorators become internal factory concern

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Keep decorators, require internal class | Violates FR-004 requirement to hide DI from users |
| Proxy pattern with method interception | Over-engineered, adds runtime overhead, harder to debug and type-check |
| Separate decorator attachment API | Forces users to manually attach decorators, breaks zero-config promise |

---

## Research Question 4: Event Bus Migration

**Unknown**: What migration path removes legacy `IEventBus` while keeping `IUnifiedEventBus` (FR-004d)?

### Decision

Three-phase graceful deprecation:
1. Mark IEventBus as `@deprecated` with JSDoc in current minor version
2. Keep dual-bus support for 1 major version cycle
3. Remove IEventBus in next major version (v2.0.0)

### Rationale

This approach balances the project's zero-console policy with semantic versioning best practices:

1. **Maintains Zero-Console Policy**: The existing deprecation-schedule.md explicitly states "Deprecated APIs emit no runtime warnings". JSDoc `@deprecated` tags provide IDE-level warnings without runtime console pollution.

2. **Follows Established Pattern**: The codebase already uses this pattern for BaseAgent → BaseAnthropicAgent migration.

3. **Respects SemVer**: Breaking changes (removing IEventBus) happen in major versions only.

4. **Low Migration Burden**: Only 6 files use IEventBusToken (all concrete agents in this package). The factory pattern hides this entirely from end users.

### Implementation Phases

**Phase 1 (This spec - 013-anthropic-refactor)**:
- Add `@deprecated` JSDoc tag to IEventBus interface
- Add `@deprecated` tag to IEventBusToken constant
- Include migration guide in JSDoc pointing to IUnifiedEventBus
- `defineAnthropicAgent()` factory wires ONLY IUnifiedEventBus

**Phase 2 (v1.0.0)**:
- Keep dual-bus support in InternalAnthropicAgent
- Document in CHANGELOG that IEventBus will be removed in v2.0.0

**Phase 3 (v2.0.0)**:
- Remove IEventBus, IEventBusToken, EventBus class
- Remove publishToEventBus() method
- Remove mapSdkMessageToEvents() (keep only mapSdkMessageToUnifiedEvents)

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Immediate hard cutover (remove now) | Violates SemVer, would force emergency migrations |
| Add console.warn() deprecation | Violates project's zero-console policy |
| Create IEventBusAdapter | Adds unnecessary abstraction, doesn't simplify anything |

---

**Last Updated**: 2025-12-28
