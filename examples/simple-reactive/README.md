# Simple Reactive Agent Example

A minimal example demonstrating the v0.3.0 signal-based reactive architecture.

## What This Shows

1. **`createWorkflow<TState>()`** - Create a typed factory for agents
2. **`activateOn`** - Declare what signals trigger an agent
3. **`when`** - Guard conditions for conditional activation
4. **`emits`** - Declare what signals an agent produces
5. **`endWhen`** - Termination condition for early exit

## The Flow

```
workflow:start
    │
    ▼
┌─────────┐
│ greeter │ ──► greeting:created
└─────────┘           │
                      ▼
              ┌─────────────┐
              │ transformer │ ──► greeting:transformed
              └─────────────┘
```

## Running

```bash
# From repository root
bun run examples/simple-reactive/index.ts
```

## Code Walkthrough

### 1. Define State Type

```typescript
type GreetingState = {
  name: string;
  greeting: string | null;
  uppercase: boolean;
};
```

### 2. Create Typed Factory

```typescript
const { agent, runReactive } = createWorkflow<GreetingState>();
```

### 3. Define Agents

```typescript
const greeter = agent({
  prompt: `Create a greeting for {{ state.name }}`,
  activateOn: ["workflow:start"],
  emits: ["greeting:created"],
  when: (ctx) => ctx.state.name.length > 0,  // Full type safety!
});
```

### 4. Run Workflow

```typescript
const result = await runReactive({
  agents: { greeter, transformer },
  state: { name: "World", greeting: null, uppercase: true },
  harness,
  endWhen: (state) => state.greeting !== null,
});
```

### 5. Inspect Results

```typescript
console.log(result.signals);      // All signals emitted
console.log(result.state);        // Final state
console.log(result.metrics);      // Duration, activations
```

## Key Concepts

### Signal Patterns

Agents declare patterns they react to:

```typescript
activateOn: ["workflow:start"]           // Exact match
activateOn: ["greeting:*"]               // Wildcard
activateOn: ["state:**:changed"]         // Deep wildcard
```

### Template Expansion

Prompts support Mustache-style templates:

```typescript
prompt: `Analyze {{ state.data }} with confidence {{ state.threshold }}`
```

Available context:
- `state` - Current workflow state
- `signal` - The triggering signal
- `input` - Original input to runReactive

### Guard Conditions

The `when` function has full typed access to state:

```typescript
when: (ctx) => {
  // ctx.state is typed as GreetingState
  return ctx.state.name.length > 0 && ctx.signal.name !== "skip";
}
```

## Next Steps

See `examples/trading-agent/` for a more complex multi-agent workflow.
