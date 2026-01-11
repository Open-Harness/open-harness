# Proxy-Based Reactive State: Side-by-Side Comparison

## The Same Agent State, Four Ways

Let's implement the same agent state management system using all four libraries to see the differences in practice.

**Requirements**:
- Track agent status, current task, metrics
- Validate state changes (Zod schema)
- Subscribe to state changes
- Serialize/deserialize state
- TypeScript type safety

---

## 1. Valtio + valtio-zod

```typescript
import { proxy, subscribe, snapshot } from 'valtio'
import { schema } from 'valtio-zod'
import { z } from 'zod'

// Schema
const AgentStateSchema = z.object({
  status: z.enum(['idle', 'running', 'paused']),
  currentTask: z.string().nullable(),
  metrics: z.object({
    tokensUsed: z.number().nonnegative(),
    tasksCompleted: z.number().nonnegative()
  })
})

type AgentState = z.infer<typeof AgentStateSchema>

// Create validated state
const state = schema(AgentStateSchema).proxy<AgentState>({
  status: 'idle',
  currentTask: null,
  metrics: { tokensUsed: 0, tasksCompleted: 0 }
}, {
  parseSafe: true,
  errorHandler: (err) => console.error('Validation failed:', err)
})

// Mutate naturally
state.status = 'running'
state.currentTask = 'analyze-logs'
state.metrics.tokensUsed += 150

// Invalid mutations rejected automatically
state.status = 'invalid' // Keeps old value
state.metrics.tokensUsed = -100 // Validation fails

// Subscribe
const unsubscribe = subscribe(state, () => {
  console.log('State changed:', snapshot(state))
})

// Serialize
const json = JSON.stringify(snapshot(state))

// Deserialize
const loaded = JSON.parse(json)
Object.assign(state, loaded)

// Cleanup
unsubscribe()
```

**Lines of code**: ~30
**Mutation style**: Direct assignment
**Validation**: Automatic via valtio-zod
**Subscription**: Simple `subscribe()`
**Snapshot**: Built-in `snapshot()`

**Pros**:
- Minimal boilerplate
- Automatic Zod validation
- Natural mutations
- Built-in snapshots

**Cons**:
- No old/new values in subscription
- Manual subscription cleanup

---

## 2. @vue/reactivity

```typescript
import { reactive, watch, toRaw, readonly } from '@vue/reactivity'
import { z } from 'zod'

// Schema
const AgentStateSchema = z.object({
  status: z.enum(['idle', 'running', 'paused']),
  currentTask: z.string().nullable(),
  metrics: z.object({
    tokensUsed: z.number().nonnegative(),
    tasksCompleted: z.number().nonnegative()
  })
})

type AgentState = z.infer<typeof AgentStateSchema>

// Create reactive state (unvalidated)
const state = reactive<AgentState>({
  status: 'idle',
  currentTask: null,
  metrics: { tokensUsed: 0, tasksCompleted: 0 }
})

// Manual validation wrapper
function validateState(newState: AgentState) {
  const result = AgentStateSchema.safeParse(newState)
  if (!result.success) {
    console.error('Validation failed:', result.error)
    return false
  }
  return true
}

// Watch for validation (must validate manually)
watch(state, (newState) => {
  validateState(toRaw(newState))
}, { deep: true })

// Mutate naturally
state.status = 'running'
state.currentTask = 'analyze-logs'
state.metrics.tokensUsed += 150

// Invalid mutations NOT prevented (manual validation)
state.status = 'invalid' as any // TypeScript error, but runs
// Must manually revert or handle

// Watch with old/new values
const stop = watch(
  () => state.status,
  (newVal, oldVal) => {
    console.log(`Status: ${oldVal} -> ${newVal}`)
  }
)

// Serialize (manual)
const json = JSON.stringify(toRaw(state))

// Deserialize
const loaded = JSON.parse(json)
Object.assign(state, loaded)

// Cleanup
stop()
```

**Lines of code**: ~45
**Mutation style**: Direct assignment
**Validation**: Manual Zod checks
**Subscription**: `watch()` with old/new values
**Snapshot**: Manual `toRaw()` + clone

**Pros**:
- Old/new values in watchers
- Fine-grained watch control
- Computed values built-in
- Battle-tested performance

**Cons**:
- No automatic Zod integration
- Manual validation logic
- No built-in snapshots
- More verbose

---

## 3. MobX

```typescript
import { makeAutoObservable, autorun, reaction, toJS } from 'mobx'
import { z } from 'zod'

// Schema
const AgentStateSchema = z.object({
  status: z.enum(['idle', 'running', 'paused']),
  currentTask: z.string().nullable(),
  metrics: z.object({
    tokensUsed: z.number().nonnegative(),
    tasksCompleted: z.number().nonnegative()
  })
})

type AgentStateType = z.infer<typeof AgentStateSchema>

// Class-based observable
class AgentState implements AgentStateType {
  status: 'idle' | 'running' | 'paused' = 'idle'
  currentTask: string | null = null
  metrics = { tokensUsed: 0, tasksCompleted: 0 }

  constructor() {
    makeAutoObservable(this)

    // Validate on any change
    reaction(
      () => this.toObject(),
      (data) => {
        const result = AgentStateSchema.safeParse(data)
        if (!result.success) {
          console.error('Validation failed:', result.error)
          // Must manually revert
        }
      }
    )
  }

  // Actions (recommended pattern)
  setStatus(status: typeof this.status) {
    this.status = status
  }

  setTask(task: string | null) {
    this.currentTask = task
  }

  incrementTokens(amount: number) {
    this.metrics.tokensUsed += amount
  }

  completeTask() {
    this.metrics.tasksCompleted++
    this.currentTask = null
  }

  private toObject(): AgentStateType {
    return {
      status: this.status,
      currentTask: this.currentTask,
      metrics: { ...this.metrics }
    }
  }
}

const state = new AgentState()

// Mutate via actions (recommended)
state.setStatus('running')
state.setTask('analyze-logs')
state.incrementTokens(150)

// Or direct mutation (works but not idiomatic)
state.status = 'paused'

// Subscribe
const dispose = autorun(() => {
  console.log('State changed:', toJS(state))
})

// Reaction with old/new values
const dispose2 = reaction(
  () => state.metrics.tokensUsed,
  (tokens, prevTokens) => {
    console.log(`Tokens: ${prevTokens} -> ${tokens}`)
  }
)

// Serialize
const json = JSON.stringify(toJS(state))

// Deserialize
const loaded = JSON.parse(json)
Object.assign(state, loaded)

// Cleanup
dispose()
dispose2()
```

**Lines of code**: ~65
**Mutation style**: Actions (methods) or direct
**Validation**: Manual Zod checks in reaction
**Subscription**: `autorun()` / `reaction()`
**Snapshot**: Manual `toJS()` + clone

**Pros**:
- Old/new values in reactions
- Mature ecosystem
- Good debugging tools
- Powerful computed values

**Cons**:
- Most boilerplate (class + actions)
- No automatic Zod integration
- Manual validation logic
- Verbose compared to Valtio

---

## 4. Immer (No Reactivity)

```typescript
import produce from 'immer'
import { z } from 'zod'

// Schema
const AgentStateSchema = z.object({
  status: z.enum(['idle', 'running', 'paused']),
  currentTask: z.string().nullable(),
  metrics: z.object({
    tokensUsed: z.number().nonnegative(),
    tasksCompleted: z.number().nonnegative()
  })
})

type AgentState = z.infer<typeof AgentStateSchema>

// Manual subscription system
type Listener = (state: AgentState) => void
const listeners = new Set<Listener>()

let state: AgentState = {
  status: 'idle',
  currentTask: null,
  metrics: { tokensUsed: 0, tasksCompleted: 0 }
}

// Validated setState
function setState(updater: (draft: AgentState) => void) {
  const nextState = produce(state, updater)

  // Validate before committing
  const result = AgentStateSchema.safeParse(nextState)
  if (result.success) {
    state = nextState
    listeners.forEach(fn => fn(state))
  } else {
    console.error('Validation failed:', result.error)
    // State unchanged
  }
}

// Subscribe
function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Mutate via setState
setState(draft => {
  draft.status = 'running'
  draft.currentTask = 'analyze-logs'
  draft.metrics.tokensUsed += 150
})

// Invalid mutations rejected during validation
setState(draft => {
  draft.status = 'invalid' as any // Validation fails
})

// Subscribe
const unsubscribe = subscribe((newState) => {
  console.log('State changed:', newState)
})

// Serialize (state is already plain object)
const json = JSON.stringify(state)

// Deserialize
state = JSON.parse(json)

// Cleanup
unsubscribe()
```

**Lines of code**: ~50
**Mutation style**: `produce()` callback
**Validation**: Manual Zod check in setState
**Subscription**: DIY subscription system
**Snapshot**: State is always immutable

**Pros**:
- Immutability guaranteed
- Structural sharing (efficient)
- No proxy overhead in production
- Explicit state updates

**Cons**:
- No built-in reactivity
- Must build subscription layer
- More boilerplate
- Not truly "reactive"

---

## Feature Matrix

| Feature | Valtio | @vue/reactivity | MobX | Immer |
|---------|--------|-----------------|------|-------|
| **Mutation syntax** | Direct | Direct | Direct/Actions | `produce()` |
| **Zod integration** | ✅ Official | ❌ Manual | ❌ Manual | ❌ Manual |
| **Built-in snapshots** | ✅ Yes | ❌ Manual | ❌ Manual | ✅ Immutable |
| **Subscriptions** | ✅ Simple | ✅ Powerful | ✅ Powerful | ❌ DIY |
| **Old/new values** | ❌ No | ✅ Yes | ✅ Yes | N/A |
| **Computed values** | ❌ No | ✅ Yes | ✅ Yes | N/A |
| **TypeScript** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Bundle size** | 3kb | 10kb | 16kb | 13kb |
| **Boilerplate** | Minimal | Medium | High | Medium |
| **Learning curve** | Easy | Medium | Steep | Easy |
| **Node.js ready** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |

---

## Real-World Scenario: Agent Controller

Let's implement a realistic agent controller with all four approaches.

### Valtio Version

```typescript
import { proxy, subscribe, snapshot } from 'valtio'
import { schema } from 'valtio-zod'
import { z } from 'zod'

const StateSchema = z.object({
  phase: z.enum(['init', 'running', 'paused', 'completed']),
  tasks: z.array(z.object({
    id: z.string(),
    status: z.enum(['pending', 'running', 'done'])
  })),
  metrics: z.object({ tokens: z.number(), duration: z.number() })
})

class AgentController {
  state = schema(StateSchema).proxy({
    phase: 'init',
    tasks: [],
    metrics: { tokens: 0, duration: 0 }
  })

  private disposers: Array<() => void> = []

  constructor() {
    this.disposers.push(
      subscribe(this.state, () => this.onStateChange())
    )
  }

  addTask(id: string) {
    this.state.tasks.push({ id, status: 'pending' })
  }

  startTask(id: string) {
    const task = this.state.tasks.find(t => t.id === id)
    if (task) task.status = 'running'
  }

  private onStateChange() {
    console.log('State changed:', snapshot(this.state))
  }

  dispose() {
    this.disposers.forEach(d => d())
  }
}

const controller = new AgentController()
controller.addTask('task-1')
controller.startTask('task-1')
```

**Total lines**: ~40
**Complexity**: Low
**Type safety**: Excellent
**Validation**: Automatic

---

### @vue/reactivity Version

```typescript
import { reactive, watch, computed } from '@vue/reactivity'
import { z } from 'zod'

const StateSchema = z.object({
  phase: z.enum(['init', 'running', 'paused', 'completed']),
  tasks: z.array(z.object({
    id: z.string(),
    status: z.enum(['pending', 'running', 'done'])
  })),
  metrics: z.object({ tokens: z.number(), duration: z.number() })
})

class AgentController {
  state = reactive({
    phase: 'init' as const,
    tasks: [] as Array<{ id: string; status: 'pending' | 'running' | 'done' }>,
    metrics: { tokens: 0, duration: 0 }
  })

  completedTasks = computed(() =>
    this.state.tasks.filter(t => t.status === 'done').length
  )

  private stops: Array<() => void> = []

  constructor() {
    this.stops.push(
      watch(this.state, (newState) => {
        const result = StateSchema.safeParse(newState)
        if (!result.success) {
          console.error('Invalid state:', result.error)
        }
      }, { deep: true })
    )
  }

  addTask(id: string) {
    this.state.tasks.push({ id, status: 'pending' })
  }

  startTask(id: string) {
    const task = this.state.tasks.find(t => t.id === id)
    if (task) task.status = 'running'
  }

  dispose() {
    this.stops.forEach(stop => stop())
  }
}

const controller = new AgentController()
controller.addTask('task-1')
controller.startTask('task-1')
console.log(controller.completedTasks.value) // Computed
```

**Total lines**: ~45
**Complexity**: Medium
**Type safety**: Excellent
**Validation**: Manual
**Bonus**: Computed values

---

### MobX Version

```typescript
import { makeAutoObservable, autorun, computed } from 'mobx'
import { z } from 'zod'

const StateSchema = z.object({
  phase: z.enum(['init', 'running', 'paused', 'completed']),
  tasks: z.array(z.object({
    id: z.string(),
    status: z.enum(['pending', 'running', 'done'])
  })),
  metrics: z.object({ tokens: z.number(), duration: z.number() })
})

class AgentController {
  phase: 'init' | 'running' | 'paused' | 'completed' = 'init'
  tasks: Array<{ id: string; status: 'pending' | 'running' | 'done' }> = []
  metrics = { tokens: 0, duration: 0 }

  private disposers: Array<() => void> = []

  constructor() {
    makeAutoObservable(this, {
      completedTasks: computed
    })

    this.disposers.push(
      autorun(() => {
        const data = this.toObject()
        const result = StateSchema.safeParse(data)
        if (!result.success) {
          console.error('Invalid state:', result.error)
        }
      })
    )
  }

  get completedTasks() {
    return this.tasks.filter(t => t.status === 'done').length
  }

  addTask(id: string) {
    this.tasks.push({ id, status: 'pending' })
  }

  startTask(id: string) {
    const task = this.tasks.find(t => t.id === id)
    if (task) task.status = 'running'
  }

  private toObject() {
    return {
      phase: this.phase,
      tasks: this.tasks.slice(),
      metrics: { ...this.metrics }
    }
  }

  dispose() {
    this.disposers.forEach(d => d())
  }
}

const controller = new AgentController()
controller.addTask('task-1')
controller.startTask('task-1')
console.log(controller.completedTasks) // Computed getter
```

**Total lines**: ~55
**Complexity**: Medium-High
**Type safety**: Good
**Validation**: Manual
**Bonus**: Computed values, OOP style

---

## Performance Comparison (Relative)

### Mutation Speed
```
Plain object:  1.0x (baseline)
Immer:         0.9x (structural sharing overhead)
Valtio:        0.85x (proxy tracking)
Vue:           0.85x (proxy tracking)
MobX:          0.80x (observable tracking)
```

### Memory Overhead (per 100 objects)
```
Plain object:  0 KB (baseline)
Immer:         ~2 KB (structural sharing metadata)
Valtio:        ~10 KB (proxy wrappers)
Vue:           ~10 KB (reactive proxies)
MobX:          ~20 KB (observables + metadata)
```

### Subscription Trigger Time
```
Manual notify: 1.0x (baseline)
Valtio:        1.1x (proxy change detection)
Vue:           1.0x (highly optimized)
MobX:          1.0x (highly optimized)
Immer:         N/A (no subscriptions)
```

**Takeaway**: All are fast enough for agent state. Differences are microseconds.

---

## Decision Matrix

### Choose Valtio if:
- ✅ You want minimal boilerplate
- ✅ You need Zod validation built-in
- ✅ You prefer natural mutations
- ✅ You want built-in snapshots
- ✅ Bundle size matters
- ✅ Simple reactive patterns suffice

### Choose @vue/reactivity if:
- ✅ You need computed values (many)
- ✅ You want fine-grained control
- ✅ You need old/new values
- ✅ Maximum performance is critical
- ✅ Complex reactivity requirements

### Choose MobX if:
- ✅ You have existing MobX code
- ✅ You prefer OOP/class-based style
- ✅ You need complex computed graphs
- ✅ You want mature debugging tools

### Choose Immer if:
- ✅ You only need immutable updates
- ✅ You're using Redux/Zustand
- ✅ You don't need reactivity
- ✅ You want explicit state updates

---

## Final Recommendation for Open Harness

**Use Valtio + valtio-zod** for agent state management.

**Why**:
1. **Minimal boilerplate**: ~30 lines vs ~55 for MobX
2. **Automatic validation**: Built-in Zod integration
3. **Natural mutations**: Just assign values
4. **Built-in snapshots**: Immutable reads for free
5. **Small bundle**: 3kb vs 16kb (MobX)
6. **TypeScript-first**: Excellent inference
7. **Node.js native**: Zero DOM dependencies

**Example**:
```typescript
const state = schema(AgentStateSchema).proxy(initialState, {
  parseSafe: true,
  errorHandler: (err) => console.error(err)
})

// Just mutate naturally
state.status = 'running'
state.metrics.tokensUsed += 100

// Invalid changes rejected automatically
state.status = 'invalid' // Keeps old value

// Get immutable snapshot anytime
const snap = snapshot(state)
```

This gives you the best DX for schema-driven, type-safe agent state with automatic validation and minimal complexity.
