# Core-v3 Continuation Prompt

Copy everything below the line to continue in a new session.

---

## Task

Continue building `packages/core-v3` - an Effect-based workflow runtime with TDD.

## Skill Activation

Activate these skills first:
```
/effect-ts-architect
/wide-events-pino
```

## Context Loading

Read these files in order:
1. `specs/core-v3/01-domain-map.md` - Effect primitives + service boundaries
2. `specs/core-v3/02-service-contracts.md` - Public API + internal Effect services
3. `specs/core-v3/HANDOFF.md` - Full context and remaining phases

## Current State

**Completed**:
- Phase 0: Effect ecosystem check (primitives identified)
- Phase 1: Domain discovery (services mapped)
- Phase 2: Service contracts (public types + internal Effect services defined)

**Remaining**:
- Phase 3: Effect programs (TDD - write tests first, then implement)
- Phase 4: Layer architecture (stubs to prove compilation)
- Phase 5: Implementation task list

## Key Constraints

1. **Effect is internal** - Public API uses Zod + Promises, no Effect types exposed
2. **TDD** - Write tests before implementation for each service
3. **Wide events** - Observability built-in from start using Effect.log + withSpan
4. **Zod for users** - Agent outputSchema uses Zod (familiar to consumers)

## Architecture

```
PUBLIC API                    INTERNAL
───────────────────────────   ───────────────────────────
Zod schemas                   Effect Schema
Promise<T>                    Effect<T, E, R>
Plain TS interfaces           Context.Tag services
```

## Services to Implement

| Service | Effect Primitive | Purpose |
|---------|-----------------|---------|
| EventStore | - | Persist events (tape) |
| StateStore | SubscriptionRef | Computed state + subscriptions |
| EventBus | PubSub | Broadcast to SSE clients |
| AgentProvider | Stream | Wrap Claude Agent SDK |
| AgentService | - | Execute agents in context |
| WorkflowRuntime | Queue | Orchestrate handlers + agents |

## Next Step

Start Phase 3: Effect Programs with TDD.

For the first service (suggest: EventStore as it has no dependencies):
1. Write test file with expected behavior
2. Create stub layer (proves types compile)
3. Implement memory layer
4. Run tests, ensure pass

Then repeat for each service in dependency order.

## Branch

Work on branch: `core-v3` (create from `dev`)

```bash
git checkout dev
git pull origin dev
git checkout -b core-v3
```
