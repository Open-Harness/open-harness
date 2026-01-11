# Proxy-Based Reactive State: Implementation Guide

## Executive Summary

**Recommended**: Valtio + valtio-zod for Open Harness agent state management.

**Why**: Natural mutation syntax + automatic Zod validation + built-in snapshots + minimal API surface.

---

## Quick Start: Valtio + Zod

```typescript
import { proxy, subscribe, snapshot } from 'valtio'
import { schema } from 'valtio-zod'
import { z } from 'zod'

// 1. Define your schema
const AgentStateSchema = z.object({
  status: z.enum(['idle', 'running', 'paused', 'error']),
  currentTask: z.string().nullable(),
  metrics: z.object({
    tokensUsed: z.number().nonnegative(),
    tasksCompleted: z.number().int().nonnegative()
  }),
  history: z.array(z.object({
    timestamp: z.number(),
    action: z.string(),
    result: z.unknown()
  }))
})

type AgentState = z.infer<typeof AgentStateSchema>

// 2. Create validated proxy
const agentState = schema(AgentStateSchema).proxy<AgentState>({
  status: 'idle',
  currentTask: null,
  metrics: { tokensUsed: 0, tasksCompleted: 0 },
  history: []
}, {
  parseSafe: true,
  errorHandler: (err) => {
    console.error('State validation failed:', err.issues)
  }
})

// 3. Mutate naturally
agentState.status = 'running'
agentState.currentTask = 'analyze-logs'
agentState.metrics.tokensUsed += 150

// Invalid mutations are silently rejected
agentState.status = 'invalid' // Keeps old value
agentState.metrics.tokensUsed = -50 // Validation fails

// 4. Subscribe to changes
const unsubscribe = subscribe(agentState, () => {
  console.log('State changed:', snapshot(agentState))
})

// 5. Get immutable snapshots
const snap = snapshot(agentState)
console.log(snap.status) // Read-only
const json = JSON.stringify(snap)

// 6. Cleanup
unsubscribe()
```

---

## Deep Dive: Core Patterns

### Pattern 1: Schema-Driven State

```typescript
// Define schema first, derive types
const HarnessStateSchema = z.object({
  phase: z.enum(['init', 'planning', 'executing', 'completed']),
  tasks: z.array(z.object({
    id: z.string(),
    status: z.enum(['pending', 'running', 'done', 'failed']),
    result: z.unknown().optional()
  })),
  config: z.object({
    model: z.string(),
    temperature: z.number().min(0).max(2)
  })
})

type HarnessState = z.infer<typeof HarnessStateSchema>

// Validated proxy ensures state always matches schema
const state = schema(HarnessStateSchema).proxy<HarnessState>({
  phase: 'init',
  tasks: [],
  config: { model: 'claude-3-5-sonnet', temperature: 0.7 }
})
```

**Benefits**:
- Single source of truth (schema)
- Type safety + runtime validation
- Self-documenting state structure
- Prevents invalid state transitions

### Pattern 2: Subscription Management

```typescript
class Agent {
  private disposers: Array<() => void> = []

  constructor(private state: AgentState) {
    this.setupSubscriptions()
  }

  private setupSubscriptions() {
    // Subscribe to specific state changes
    this.disposers.push(
      subscribe(this.state.metrics, () => {
        this.onMetricsChanged()
      })
    )

    // Subscribe to entire state
    this.disposers.push(
      subscribe(this.state, () => {
        this.persist()
      })
    )
  }

  private onMetricsChanged() {
    const snap = snapshot(this.state.metrics)
    console.log('Metrics updated:', snap)
  }

  private persist() {
    const json = JSON.stringify(snapshot(this.state))
    // Save to disk/DB
  }

  dispose() {
    this.disposers.forEach(d => d())
    this.disposers = []
  }
}
```

**Benefits**:
- Centralized cleanup
- No memory leaks
- Clear lifecycle management

### Pattern 3: State Serialization & Hydration

```typescript
import { proxy, snapshot } from 'valtio'
import { schema } from 'valtio-zod'
import { z } from 'zod'
import * as fs from 'node:fs/promises'

class StateManager<T extends z.ZodTypeAny> {
  private state: any
  private filePath: string

  constructor(
    private zodSchema: T,
    initialState: z.infer<T>,
    filePath: string
  ) {
    this.filePath = filePath
    this.state = schema(zodSchema).proxy(initialState, {
      parseSafe: true,
      errorHandler: (err) => console.error('Validation failed:', err)
    })
  }

  getState() {
    return this.state
  }

  async save() {
    const snap = snapshot(this.state)
    const json = JSON.stringify(snap, null, 2)
    await fs.writeFile(this.filePath, json, 'utf-8')
  }

  async load() {
    try {
      const json = await fs.readFile(this.filePath, 'utf-8')
      const data = JSON.parse(json)

      // Validate before hydrating
      const result = this.zodSchema.safeParse(data)
      if (result.success) {
        Object.assign(this.state, result.data)
        return true
      } else {
        console.error('Invalid state file:', result.error)
        return false
      }
    } catch (err) {
      console.error('Failed to load state:', err)
      return false
    }
  }

  snapshot() {
    return snapshot(this.state)
  }
}

// Usage
const stateManager = new StateManager(
  AgentStateSchema,
  { status: 'idle', currentTask: null, metrics: { tokensUsed: 0 } },
  '.harness/agent-state.json'
)

await stateManager.load() // Hydrate from disk
const state = stateManager.getState()

state.status = 'running' // Natural mutations
await stateManager.save() // Persist
```

**Benefits**:
- Type-safe persistence
- Validation on load
- Reusable pattern
- Clear separation of concerns

### Pattern 4: Nested State Updates

```typescript
// Valtio handles nested updates naturally
const state = proxy({
  agents: {
    controller: { status: 'idle', tokens: 0 },
    subagents: [
      { id: 'a1', status: 'idle', tokens: 0 },
      { id: 'a2', status: 'idle', tokens: 0 }
    ]
  }
})

// Direct nested mutations work
state.agents.controller.status = 'running'
state.agents.controller.tokens += 100

// Array mutations work
state.agents.subagents.push({ id: 'a3', status: 'idle', tokens: 0 })
state.agents.subagents[0].status = 'completed'

// Subscribe to nested paths
subscribe(state.agents.controller, () => {
  console.log('Controller changed')
})
```

**Benefits**:
- No special array helpers needed
- Natural JavaScript mutations
- Granular subscriptions
- Deep reactivity automatic

### Pattern 5: Computed Values (DIY)

Valtio doesn't have built-in computed values, but you can implement them:

```typescript
import { proxy, subscribe, snapshot } from 'valtio'

const state = proxy({
  tasks: [
    { id: '1', status: 'done' },
    { id: '2', status: 'running' },
    { id: '3', status: 'pending' }
  ],
  _computed: {
    completedCount: 0,
    progress: 0
  }
})

// Update computed values on change
subscribe(state.tasks, () => {
  const snap = snapshot(state)
  const completed = snap.tasks.filter(t => t.status === 'done').length
  const total = snap.tasks.length

  state._computed.completedCount = completed
  state._computed.progress = total > 0 ? completed / total : 0
})

// Access computed values
console.log(state._computed.progress) // 0.33
```

**Alternative**: Use @vue/reactivity if you need many computed values:

```typescript
import { reactive, computed } from '@vue/reactivity'

const state = reactive({
  tasks: [
    { id: '1', status: 'done' },
    { id: '2', status: 'running' }
  ]
})

const completedCount = computed(() =>
  state.tasks.filter(t => t.status === 'done').length
)

const progress = computed(() =>
  state.tasks.length > 0 ? completedCount.value / state.tasks.length : 0
)

console.log(progress.value) // Auto-updates
```

---

## Gotchas & Pitfalls

### Gotcha 1: Invalid Mutations Are Silent

```typescript
const state = schema(z.object({ count: z.number() }))
  .proxy({ count: 0 })

state.count = 'invalid' // Silently rejected
console.log(state.count) // Still 0

// Solution: Enable error handler
const state = schema(z.object({ count: z.number() }))
  .proxy({ count: 0 }, {
    parseSafe: true,
    errorHandler: (err) => {
      console.error('Validation failed:', err)
      // Optionally throw or handle
    }
  })
```

### Gotcha 2: Subscriptions Don't Provide Old/New Values

```typescript
subscribe(state, () => {
  // No access to previous state!
  console.log('State changed')
})

// Solution: Track manually
let prevSnap = snapshot(state)
subscribe(state, () => {
  const newSnap = snapshot(state)
  console.log('Old:', prevSnap)
  console.log('New:', newSnap)
  prevSnap = newSnap
})

// Or use @vue/reactivity watch()
import { watch } from '@vue/reactivity'
watch(
  () => state.count,
  (newVal, oldVal) => {
    console.log(`${oldVal} -> ${newVal}`)
  }
)
```

### Gotcha 3: Snapshots Are Shallow Clones

```typescript
const state = proxy({ nested: { value: 42 } })
const snap = snapshot(state)

// Snap is immutable, but reference types need care
const obj = snap.nested // Still a reference

// For deep immutability, use Object.freeze or deep clone
const deepSnap = JSON.parse(JSON.stringify(snapshot(state)))
```

### Gotcha 4: Memory Leaks from Forgotten Unsubscribes

```typescript
function createAgent() {
  const state = proxy({ status: 'idle' })

  // BUG: Subscribe without unsubscribe
  subscribe(state, () => {
    console.log('Changed')
  })

  return state
}

// Each call leaks a subscription
for (let i = 0; i < 1000; i++) {
  createAgent() // Memory leak!
}

// FIX: Always dispose
function createAgent() {
  const state = proxy({ status: 'idle' })

  const dispose = subscribe(state, () => {
    console.log('Changed')
  })

  return { state, dispose }
}

const { state, dispose } = createAgent()
// Later: dispose()
```

### Gotcha 5: Non-Serializable Values in State

```typescript
const state = proxy({
  handler: () => console.log('hi'), // Function
  date: new Date(), // Date object
  map: new Map(), // Map
  count: 42
})

// Snapshot loses functions/classes
const snap = snapshot(state)
console.log(snap.handler) // undefined
console.log(snap.date) // '2025-01-09T...' (string)
console.log(snap.map) // {} (empty object)

// Solution: Keep non-serializable values separate
const state = proxy({ count: 42 })
const handlers = { onChange: () => {} } // Outside state
```

### Gotcha 6: Zod Schema Mismatches

```typescript
const schema = z.object({
  count: z.number(),
  name: z.string()
})

const state = schema(schema).proxy({
  count: 0
  // BUG: Missing 'name' field
})

// Zod will throw during proxy creation
// FIX: Match initial state to schema
const state = schema(schema).proxy({
  count: 0,
  name: 'agent' // Required by schema
})
```

---

## Performance Considerations

### Micro-Benchmarks (Relative)

| Operation | Valtio | @vue/reactivity | MobX | Immer |
|-----------|--------|-----------------|------|-------|
| Create proxy | 1x | 1x | 1.2x | 0x (no proxy) |
| Mutate property | 1x | 1x | 1.1x | 0.8x |
| Deep mutation | 1x | 1x | 1.1x | 1.5x |
| Subscribe trigger | 1x | 0.9x | 0.9x | N/A |
| Snapshot/clone | 1x | 2x (manual) | 2x (manual) | 0.5x |

**Takeaway**: All are fast enough. Don't optimize prematurely.

### Memory Usage

| Library | Overhead per Object | Notes |
|---------|---------------------|-------|
| Valtio | ~100 bytes | Proxy wrapper |
| Vue | ~100 bytes | Reactive proxy |
| MobX | ~200 bytes | Observable + metadata |
| Immer | ~0 bytes | Structural sharing, no persistent overhead |

**For typical agent state (<100 objects)**: Negligible difference.

### Optimization Tips

1. **Batch mutations** (Valtio doesn't batch automatically):
   ```typescript
   // Bad: Triggers 3 subscriptions
   state.a = 1
   state.b = 2
   state.c = 3

   // Better: Use single update
   Object.assign(state, { a: 1, b: 2, c: 3 })
   ```

2. **Subscribe to specific paths**:
   ```typescript
   // Bad: Re-runs on any state change
   subscribe(state, () => { /* heavy work */ })

   // Better: Only when metrics change
   subscribe(state.metrics, () => { /* heavy work */ })
   ```

3. **Avoid deep cloning in subscriptions**:
   ```typescript
   // Bad: Deep clone on every change
   subscribe(state, () => {
     const copy = JSON.parse(JSON.stringify(snapshot(state)))
   })

   // Better: Shallow snapshot is usually enough
   subscribe(state, () => {
     const snap = snapshot(state)
   })
   ```

---

## Migration Guide

### From Plain Objects

```typescript
// Before
let state = { count: 0 }
const listeners = new Set()

function setState(updates) {
  state = { ...state, ...updates }
  listeners.forEach(fn => fn(state))
}

// After (Valtio)
const state = proxy({ count: 0 })
subscribe(state, () => { /* ... */ })

// Mutations are just assignments
state.count++
```

### From MobX

```typescript
// Before (MobX)
import { makeAutoObservable, autorun } from 'mobx'

class Store {
  count = 0
  constructor() { makeAutoObservable(this) }
  increment() { this.count++ }
}

const store = new Store()
autorun(() => console.log(store.count))

// After (Valtio)
import { proxy, subscribe } from 'valtio'

const store = proxy({ count: 0 })
subscribe(store, () => console.log(store.count))

// Direct mutations (no actions)
store.count++
```

### From Redux/Immer

```typescript
// Before (Redux + Immer)
const reducer = produce((draft, action) => {
  switch (action.type) {
    case 'INCREMENT':
      draft.count++
  }
}, { count: 0 })

// After (Valtio)
const state = proxy({ count: 0 })
state.count++ // Direct mutation
```

---

## Testing Patterns

### Unit Testing State

```typescript
import { proxy, subscribe, snapshot } from 'valtio'
import { describe, it, expect, vi } from 'vitest'

describe('AgentState', () => {
  it('should mutate state naturally', () => {
    const state = proxy({ count: 0 })
    state.count++
    expect(state.count).toBe(1)
  })

  it('should trigger subscriptions', () => {
    const state = proxy({ count: 0 })
    const listener = vi.fn()

    subscribe(state, listener)
    state.count++

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('should create immutable snapshots', () => {
    const state = proxy({ count: 0 })
    const snap = snapshot(state)

    state.count++ // Mutate proxy
    expect(snap.count).toBe(0) // Snapshot unchanged
  })

  it('should validate with Zod', () => {
    const schema = z.object({ count: z.number() })
    const errors: any[] = []

    const state = schema(schema).proxy({ count: 0 }, {
      parseSafe: true,
      errorHandler: (err) => errors.push(err)
    })

    state.count = 'invalid' as any
    expect(state.count).toBe(0) // Rejected
    expect(errors.length).toBe(1)
  })
})
```

### Integration Testing

```typescript
describe('Agent with state', () => {
  it('should persist and hydrate state', async () => {
    const stateManager = new StateManager(
      AgentStateSchema,
      { status: 'idle', metrics: { tokensUsed: 0 } },
      '/tmp/test-state.json'
    )

    const state = stateManager.getState()
    state.status = 'running'
    state.metrics.tokensUsed = 150

    await stateManager.save()

    // Create new manager, load state
    const newManager = new StateManager(
      AgentStateSchema,
      { status: 'idle', metrics: { tokensUsed: 0 } },
      '/tmp/test-state.json'
    )

    await newManager.load()
    const loaded = newManager.snapshot()

    expect(loaded.status).toBe('running')
    expect(loaded.metrics.tokensUsed).toBe(150)
  })
})
```

---

## Comparison: When to Use Each

### Use Valtio When:
- ✅ You want natural mutation syntax
- ✅ You need Zod schema validation
- ✅ You need built-in snapshots
- ✅ You want minimal API surface
- ✅ Bundle size matters
- ✅ Simple reactive patterns suffice

### Use @vue/reactivity When:
- ✅ You need computed values (many)
- ✅ You want fine-grained watch control
- ✅ You need old/new values in watchers
- ✅ Maximum performance is critical
- ✅ You want battle-tested scale

### Use MobX When:
- ✅ You have existing MobX code
- ✅ You prefer class-based patterns
- ✅ You need complex computed graphs
- ✅ You want mature debugging tools

### Use Immer When:
- ✅ You only need immutable updates
- ✅ You're using Redux/Zustand
- ✅ You don't need reactivity
- ✅ You want structural sharing

---

## Real-World Example: Harness Controller State

```typescript
import { proxy, subscribe, snapshot } from 'valtio'
import { schema } from 'valtio-zod'
import { z } from 'zod'

// Schema for harness controller
const HarnessStateSchema = z.object({
  phase: z.enum(['init', 'planning', 'executing', 'verifying', 'completed', 'error']),

  spec: z.object({
    path: z.string(),
    hash: z.string().optional()
  }).nullable(),

  plan: z.object({
    path: z.string(),
    validated: z.boolean()
  }).nullable(),

  tasks: z.array(z.object({
    id: z.string(),
    description: z.string(),
    status: z.enum(['pending', 'running', 'done', 'failed']),
    assignedTo: z.string().optional(),
    result: z.unknown().optional(),
    error: z.string().optional()
  })),

  subagents: z.array(z.object({
    id: z.string(),
    role: z.string(),
    status: z.enum(['idle', 'running', 'completed', 'failed']),
    output: z.unknown().optional()
  })),

  metrics: z.object({
    tokensUsed: z.number().nonnegative(),
    apiCalls: z.number().int().nonnegative(),
    startTime: z.number(),
    endTime: z.number().optional()
  }),

  errors: z.array(z.object({
    timestamp: z.number(),
    phase: z.string(),
    message: z.string(),
    stack: z.string().optional()
  }))
})

type HarnessState = z.infer<typeof HarnessStateSchema>

export class HarnessController {
  private state: HarnessState
  private disposers: Array<() => void> = []

  constructor() {
    this.state = schema(HarnessStateSchema).proxy<HarnessState>({
      phase: 'init',
      spec: null,
      plan: null,
      tasks: [],
      subagents: [],
      metrics: {
        tokensUsed: 0,
        apiCalls: 0,
        startTime: Date.now()
      },
      errors: []
    }, {
      parseSafe: true,
      errorHandler: (err) => {
        console.error('State validation failed:', err.issues)
      }
    })

    this.setupSubscriptions()
  }

  private setupSubscriptions() {
    // Log all phase transitions
    this.disposers.push(
      subscribe(this.state, () => {
        const snap = snapshot(this.state)
        console.log(`Phase: ${snap.phase}, Tasks: ${snap.tasks.length}`)
      })
    )

    // Persist metrics on change
    this.disposers.push(
      subscribe(this.state.metrics, () => {
        this.persistMetrics()
      })
    )
  }

  // Natural state mutations
  startPlanning(specPath: string) {
    this.state.phase = 'planning'
    this.state.spec = { path: specPath }
  }

  addTask(description: string) {
    this.state.tasks.push({
      id: crypto.randomUUID(),
      description,
      status: 'pending'
    })
  }

  startTask(taskId: string, agentId: string) {
    const task = this.state.tasks.find(t => t.id === taskId)
    if (task) {
      task.status = 'running'
      task.assignedTo = agentId
    }
  }

  completeTask(taskId: string, result: unknown) {
    const task = this.state.tasks.find(t => t.id === taskId)
    if (task) {
      task.status = 'done'
      task.result = result
    }
  }

  incrementMetrics(tokens: number, apiCalls: number = 1) {
    this.state.metrics.tokensUsed += tokens
    this.state.metrics.apiCalls += apiCalls
  }

  recordError(message: string, stack?: string) {
    this.state.errors.push({
      timestamp: Date.now(),
      phase: this.state.phase,
      message,
      stack
    })
  }

  // Immutable read access
  getSnapshot() {
    return snapshot(this.state)
  }

  // Serialization
  serialize() {
    return JSON.stringify(snapshot(this.state), null, 2)
  }

  // Cleanup
  dispose() {
    this.state.phase = 'completed'
    this.state.metrics.endTime = Date.now()
    this.disposers.forEach(d => d())
    this.disposers = []
  }

  private persistMetrics() {
    // Write to disk/DB
    const snap = snapshot(this.state.metrics)
    // ... persistence logic
  }
}

// Usage
const controller = new HarnessController()

controller.startPlanning('/specs/feature-001.md')
controller.addTask('Create specification')
controller.addTask('Generate plan')

const task1 = controller.getSnapshot().tasks[0]
controller.startTask(task1.id, 'agent-001')
controller.incrementMetrics(150, 1)

controller.completeTask(task1.id, { validated: true })

// Get immutable snapshot at any time
const currentState = controller.getSnapshot()
console.log(currentState.phase) // 'planning'
console.log(currentState.metrics.tokensUsed) // 150

// Serialize for persistence
const json = controller.serialize()

// Cleanup
controller.dispose()
```

---

## Summary

**For Open Harness agent state management, use Valtio + valtio-zod:**

1. **Natural mutations**: `state.x = y` (no boilerplate)
2. **Automatic validation**: Zod schemas enforce invariants
3. **Built-in snapshots**: Immutable reads for serialization
4. **Minimal API**: 3 functions (proxy, subscribe, snapshot)
5. **Excellent TypeScript**: Full inference, no type gymnastics
6. **Small bundle**: ~3kb (plus Zod)

This combination provides the best developer experience for schema-driven, type-safe agent state with automatic validation and natural mutation syntax.

**Alternatives**:
- Use **@vue/reactivity** if you need computed values built-in
- Use **MobX** if you have existing MobX code
- Use **Immer** if you only need immutable updates (no reactivity)
