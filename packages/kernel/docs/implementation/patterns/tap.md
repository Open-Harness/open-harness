# Temporal Accumulation Pattern (TAP)

> **The foundational pattern for building intelligent, context-aware AI agents that learn and improve over time**

**Note**: This is an **implementation pattern**, not part of the kernel protocol spec. It uses **extension events** (e.g. `schedule:*`) that are allowed by the protocol but not required or standardized.

---

## What is TAP?

The **Temporal Accumulation Pattern (TAP)** is an architectural approach where agents build knowledge by accumulating their outputs over time, rather than being stateless functions. Each agent execution builds on previous outputs, increasing confidence and enabling sophisticated temporal reasoning.

**Core Principle**: *Every agent has memory. Every output becomes context for future decisions.*

---

## The Paradigm Shift

### Traditional Agent Architecture (Stateless)

```
Input → Agent → Output
        (no memory)
```

- Each execution is independent
- No learning from previous runs
- No confidence building
- No pattern recognition

### TAP Architecture (Temporal Accumulation)

```
Input + History → Agent → Output + Confidence + Evidence + Schedule
                    ↓
              Store in History
                    ↓
              Future executions use this
```

- Each execution builds on previous outputs
- Confidence increases with evidence
- Patterns emerge over time
- Agents schedule future work via **extension events** interpreted by drivers

---

## Core Concepts

### 1. Temporal Accumulation

**Definition**: Agents store their outputs over time and use this history as context for future executions.

**Example - Location Agent**:

**Run 1** (08:00 AM):
```typescript
{
  inferredLocation: "HOME",
  confidence: 0.95,
  evidence: ["GPS matches home address", "Stable for 8+ hours"],
  timestamp: "08:00"
}
```

**Run 2** (08:15 AM) - *Uses Run 1 as context*:
```typescript
{
  inferredLocation: "COMMUTING", 
  confidence: 0.72,
  evidence: [
    "GPS moving away from home",
    "Previous state was HOME (from Run 1)",  // ← Using history!
    "Direction matches work commute"
  ],
  stateTransition: {
    from: "HOME",
    to: "COMMUTING",
    reasoning: "Started moving from home location"
  },
  timestamp: "08:15"
}
```

**Run 3** (08:30 AM) - *Uses Run 1 + 2 as context*:
```typescript
{
  inferredLocation: "COMMUTING",
  confidence: 0.89,  // ← Higher confidence!
  evidence: [
    "Continued movement toward work",
    "Traveled 600m in 15 min (consistent with driving)",
    "Previous 2 outputs show HOME → COMMUTING transition"  // ← Full history!
  ],
  pattern: {
    matchesHistoricalCommute: true,
    reasoning: "Matches Tuesday morning pattern from past 4 weeks"
  },
  timestamp: "08:30"
}
```

**Key Insight**: The agent becomes MORE CONFIDENT as it sees consistent patterns over time.

---

### 2. Every Agent is Temporal

**All agents maintain output history**:

```typescript
interface AgentOutput<T> {
  agentName: string;
  timestamp: Date;
  runId: string;
  
  // The actual output
  output: T;
  
  // Metadata
  confidence: number;
  evidence: string[];
  reasoning: string;
  
  // Context
  previousOutputCount: number;
  stateTransition?: {
    from: string;
    to: string;
    transitionTime: Date;
    reasoning: string;
  };
}
```

**Harness State**:
```typescript
interface TAPState {
  // Current trigger for this run (set by driver)
  trigger: TriggerEvent;

  // Temporal accumulation for each agent
  agentOutputs: {
    location: AgentOutput<LocationData>[];
    calendar: AgentOutput<CalendarData>[];
    brain: AgentOutput<Decision>[];
    // ... all agents store history
  };
  
  // Quick access to latest (optional derived cache)
  latest?: {
    location: AgentOutput<LocationData>;
    calendar: AgentOutput<CalendarData>;
    // ...
  };
  
  // Learned patterns (computed from history)
  patterns: {
    userBehavior: UserPatterns;
    locationPatterns: LocationPatterns;
    // ...
  };
  
  // Pending scheduled tasks
  scheduledTasks: ScheduledTask[];
}
```

---

### 3. Agent Autonomy via Events

**Key Principle**: Agents don't execute actions directly - they emit events to schedule work.

The Hub is bidirectional:
- **Events OUT**: Agents emit events, including **extension events** (e.g. `schedule:*`) that drivers interpret
- **Commands IN**: External systems can send messages to trigger runs

**Agents schedule future work by emitting extension events**:

```typescript
// Inside an agent's execution
emit({ 
  type: "schedule:task", 
  taskId: "notify-prayer",
  executeAt: "2025-01-15T09:00:00Z",
  action: "send_notification",
  parameters: { message: "Prayer in 20 min" },
  reasoning: "User typically needs 20 min lead time"
});

// Schedule the next harness run
emit({
  type: "schedule:run",
  trigger: { type: "periodic-check" },
  executeAt: "2025-01-15T08:30:00Z",
  reasoning: "Regular 15-minute check"
});
```

**Immediate execution is still scheduling**:
```typescript
emit({
  type: "schedule:task",
  taskId: "urgent-notify",
  executeAt: "immediately",
  action: "send_urgent_notification",
  parameters: { message: "⚠️ Prayer window closing!" },
  reasoning: "Critical time window"
});
```

---

## Architecture Overview

### The Two-Layer Model

TAP uses a clean separation between **orchestration logic** (harness) and **execution timing** (driver):

```
┌─────────────────────────────────────────────────────────────┐
│                         DRIVER                               │
│  (Dumb plumbing - handles persistence and timing)           │
│                                                              │
│  1. Load state from store                                    │
│  2. Create harness + run                                     │
│  3. Save returned state                                      │
│  4. Read schedule:* extension events, set up timers          │
│  5. When timer fires, goto 1                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        HARNESS                               │
│  (All business logic - bounded, testable, pure)             │
│                                                              │
│  • Receives: trigger + previous state                       │
│  • Runs agents with full history                            │
│  • Agents emit schedule:* extension events for future work  │
│  • Returns: updated state + events + result                 │
└─────────────────────────────────────────────────────────────┘
```

**Key Insight**: The harness is the single source of truth for state. The driver doesn't own any business state - it just persists what the harness returns and respects schedule events.

### Component Responsibilities

**1. Harness (Orchestrator)**
- Owns all business logic
- Maintains agent output histories in state
- Provides history to agents on each run
- Bounded execution: `run()` → `HarnessResult`
- Agents emit `schedule:*` extension events for future work

**2. Specialist Agents (Data + Inference)**
- Process domain-specific data
- Build on own history
- Output: Data + Confidence + Evidence + Reasoning
- Examples: LocationAgent, CalendarAgent, PrayerTimesAgent

**3. Brain Agent (Decision Maker)**
- Analyzes context from all specialists
- Uses full history for reasoning
- Output: Decisions + Schedule Events
- NO tools (pure reasoning)

**4. Driver (External Runtime)**
- Persists harness state between runs
- Reads `schedule:*` extension events from harness output
- Sets up timers/triggers for scheduled work
- Invokes harness when triggers fire
- **Contains zero business logic**

---

## The TAP Workflow

### Harness Definition

```typescript
// ============================================
// TAP HARNESS - owns all business logic
// ============================================

interface TAPInput {
  trigger: TriggerEvent;      // What caused this run
  previousState?: TAPState;   // Loaded by driver
}

const TAPHarness = defineHarness({
  name: "tap-harness",
  
  agents: {
    location: LocationAgent,
    calendar: CalendarAgent,
    brain: BrainAgent,
  },
  
  state: (input: TAPInput): TAPState => {
    const base = input.previousState ?? {
      agentOutputs: { location: [], calendar: [], brain: [] },
      patterns: {},
      scheduledTasks: []
    };
    return { ...base, trigger: input.trigger };
  },
  
  run: async ({ agents, state, emit, task }) => {
    const { trigger } = state;
    
    // ========== PERIODIC CHECK ==========
    if (trigger.type === "periodic-check" || trigger.type === "startup") {
      
      // --- Location Agent (with history) ---
      await task("location-inference", async () => {
        const output = await agents.location.execute({
          currentGPS: await fetchGPS(),
          previousOutputs: state.agentOutputs.location,  // ← Full history!
          patterns: state.patterns
        });
        
        state.agentOutputs.location.push(output);
        
        // Rolling window - keep last 100
        if (state.agentOutputs.location.length > 100) {
          state.agentOutputs.location.shift();
        }
      });
      
      // --- Calendar Agent (with history) ---
      await task("calendar-sync", async () => {
        const output = await agents.calendar.execute({
          currentTime: new Date(),
          previousOutputs: state.agentOutputs.calendar,
        });
        state.agentOutputs.calendar.push(output);
      });
      
      // --- Brain Agent (analyzes everything) ---
      await task("brain-decision", async () => {
        const decision = await agents.brain.execute({
          currentContext: {
            location: state.agentOutputs.location.at(-1)!,
            calendar: state.agentOutputs.calendar.at(-1)!,
          },
          fullHistory: state.agentOutputs,
          patterns: state.patterns
        });
        
        state.agentOutputs.brain.push(decision);
        
        // ⭐ AGENT SCHEDULES TASKS VIA EVENTS
        for (const task of decision.recommendedTasks) {
          emit({ 
            type: "schedule:task",
            taskId: task.taskId,
            executeAt: task.executeAt,
            action: task.action,
            parameters: task.parameters,
            reasoning: task.reasoning
          });
        }
      });
      
      // ⭐ SCHEDULE NEXT RUN
      emit({
        type: "schedule:run",
        trigger: { type: "periodic-check" },
        executeAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        reasoning: "Regular 15-minute check"
      });
    }
    
    // ========== TASK DUE ==========
    else if (trigger.type === "task-due") {
      await task(`execute-${trigger.taskId}`, async () => {
        const scheduledTask = state.scheduledTasks.find(
          t => t.taskId === trigger.taskId
        );
        if (scheduledTask) {
          await executeTask(scheduledTask);
          scheduledTask.status = "completed";
        }
      });
    }
    
    // Return latest decision
    return state.agentOutputs.brain.at(-1) ?? null;
  }
});
```

### Driver Implementation

```typescript
// ============================================
// DRIVER - dumb plumbing, no business logic
// ============================================

class TAPDriver {
  private store: StateStore;  // SQLite, Redis, file, etc.
  private timers: Map<string, NodeJS.Timeout> = new Map();
  
  async handleTrigger(trigger: TriggerEvent) {
    // 1. Load state (harness state IS the state)
    const previousState = await this.store.load();
    
    // 2. Run harness
    const harness = TAPHarness.create({ trigger, previousState });
    const result = await harness.run();
    
    // 3. Persist state
    await this.store.save(result.state);
    
    // 4. Process schedule events
    for (const event of result.events) {
      if (event.event.type === "schedule:run") {
        this.scheduleRun(event.event);
      } else if (event.event.type === "schedule:task") {
        this.scheduleTask(event.event);
      }
    }
  }
  
  private scheduleRun(event: ScheduleRunEvent) {
    const delay = new Date(event.executeAt).getTime() - Date.now();
    if (delay <= 0) {
      this.handleTrigger(event.trigger);
    } else {
      const timer = setTimeout(() => {
        this.handleTrigger(event.trigger);
      }, delay);
      this.timers.set(`run-${event.executeAt}`, timer);
    }
  }
  
  private scheduleTask(event: ScheduleTaskEvent) {
    const delay = event.executeAt === "immediately" 
      ? 0 
      : new Date(event.executeAt).getTime() - Date.now();
    
    const timer = setTimeout(() => {
      this.handleTrigger({ 
        type: "task-due", 
        taskId: event.taskId,
        parameters: event.parameters 
      });
    }, Math.max(0, delay));
    
    this.timers.set(`task-${event.taskId}`, timer);
  }
  
  // Bootstrap
  start() {
    this.handleTrigger({ type: "startup" });
  }
}

// ============================================
// USAGE
// ============================================

const driver = new TAPDriver();
driver.start();  // First run schedules subsequent runs
```

---

## Schedule Event Types (Extension)

Agents communicate scheduling intent through **extension events**. These shapes are **not** part of the kernel protocol; they are a TAP convention that drivers interpret.

```typescript
// Schedule a future harness run (extension event)
interface ScheduleRunEvent {
  type: "schedule:run";
  trigger: TriggerEvent;
  executeAt: string;  // ISO timestamp
  reasoning: string;
}

// Schedule a task execution (extension event)
interface ScheduleTaskEvent {
  type: "schedule:task";
  taskId: string;
  executeAt: string | "immediately";
  action: string;
  parameters: Record<string, unknown>;
  reasoning: string;
}

// Cancel a previously scheduled item (extension event)
interface ScheduleCancelEvent {
  type: "schedule:cancel";
  targetId: string;  // taskId or run ID
  reasoning: string;
}

// Trigger types the harness responds to (example input contract)
type TriggerEvent = 
  | { type: "startup" }
  | { type: "periodic-check" }
  | { type: "task-due"; taskId: string; parameters?: Record<string, unknown> }
  | { type: "user-action"; action: string; data?: unknown }
  | { type: "external-event"; source: string; payload: unknown };
```

---

## Agent Design with TAP

### Agent Input Schema

```typescript
const LocationAgent = defineAgent({
  name: "Location",
  
  inputSchema: z.object({
    // Current data
    currentGPS: GPSSchema,
    timestamp: z.date(),
    
    // Temporal accumulation (from harness state)
    previousOutputs: z.array(LocationOutputSchema),
    
    // Learned patterns
    userPatterns: z.object({
      homeLocation: GPSSchema.optional(),
      workLocation: GPSSchema.optional(),
      typicalRoutes: z.array(RouteSchema)
    }).optional()
  }),
  
  outputSchema: z.object({
    // Inference
    inferredLocation: z.object({
      type: z.enum(["HOME", "WORK", "COMMUTING", "TRAVELING", "UNKNOWN"]),
      confidence: z.number().min(0).max(1),
      evidence: z.array(z.string()),
      reasoning: z.string()
    }),
    
    // Raw data
    rawGPS: GPSSchema,
    timestamp: z.date(),
    
    // Metadata
    metadata: z.object({
      stability: z.enum(["stable", "moving", "variable"]),
      velocity: z.number().optional(),
      heading: z.string().optional()
    }),
    
    // State transition (if any)
    stateTransition: z.object({
      from: z.string(),
      to: z.string(),
      transitionTime: z.date(),
      reasoning: z.string()
    }).optional(),
    
    // Pattern matching
    pattern: z.object({
      matchesHistoricalPattern: z.boolean(),
      patternName: z.string().optional(),
      confidence: z.number()
    }).optional()
  }),
  
  prompt: `
You are a location inference agent. Determine WHERE the user is with CONFIDENCE.

Current GPS: {{currentGPS}}
Timestamp: {{timestamp}}

Previous Outputs:
{{#each previousOutputs}}
- {{this.timestamp}}: {{this.inferredLocation.type}} (confidence: {{this.inferredLocation.confidence}})
  Evidence: {{join this.inferredLocation.evidence ", "}}
{{/each}}

Known Patterns:
- Home: {{userPatterns.homeLocation}}
- Work: {{userPatterns.workLocation}}

CRITICAL:
1. Use previous outputs to detect STATE TRANSITIONS
2. Confidence should INCREASE with consistent patterns
3. Always provide EVIDENCE for your inference
4. If ambiguous, say so (lower confidence)
5. Compare with historical patterns when available

Infer the user's current location with reasoning.
  `
});
```

---

## Confidence Accumulation

### How Confidence Builds

**Initial Run** (No history):
```typescript
confidence = baseInference()  // 0.5-0.7
```

**With History** (Consistent pattern):
```typescript
confidence = baseInference()
  + consistencyBonus(previousOutputs)      // +0.1-0.2
  + patternMatchBonus(historicalPatterns)  // +0.1-0.15
  + temporalStabilityBonus()               // +0.05-0.1

// Result: 0.75-0.95 confidence
```

**With Contradictions** (Ambiguous):
```typescript
confidence = baseInference()
  - inconsistencyPenalty(previousOutputs)  // -0.1-0.3

// Result: 0.3-0.6 confidence (appropriately low!)
```

**Key Principle**: Confidence reflects EVIDENCE, not guessing.

---

## State Transitions with Reasoning

### Detecting Transitions

```typescript
const detectTransition = (currentInference, previousOutputs) => {
  if (previousOutputs.length === 0) {
    return null;  // No history, no transition
  }
  
  const lastOutput = previousOutputs[previousOutputs.length - 1];
  
  if (currentInference.type !== lastOutput.inferredLocation.type) {
    return {
      from: lastOutput.inferredLocation.type,
      to: currentInference.type,
      transitionTime: currentInference.timestamp,
      reasoning: buildTransitionReasoning(lastOutput, currentInference)
    };
  }
  
  return null;
};
```

**Example Transition**:
```typescript
{
  from: "AT_WORK",
  to: "COMMUTING_HOME",
  transitionTime: "2025-01-15T17:00:00Z",
  reasoning: "Left work location at 5 PM, moving toward home, matches historical evening commute pattern"
}
```

---

## Task Scheduling

### The Scheduling Principle

**Everything is a scheduled task - even "now"**

```typescript
interface ScheduledTask {
  taskId: string;
  action: string;
  executeAt: Date | "immediately";
  parameters: Record<string, unknown>;
  reasoning: string;
  
  // Lifecycle
  status: "pending" | "executing" | "completed" | "cancelled";
  scheduledAt: Date;
  executedAt?: Date;
  result?: unknown;
  
  // Context
  createdBy: string;  // Which agent created this task
  supersedes?: string[];  // Task IDs this replaces
}
```

### Brain Agent Emits Schedule Events

```typescript
// Inside BrainAgent execution
const decision = {
  shouldNotify: true,
  reasoning: "User at work, prayer in 30 min, good time to notify",
  recommendedTasks: [
    {
      taskId: "notify-dhuhr-" + Date.now(),
      action: "send_notification",
      executeAt: "2025-01-15T11:55:00Z",
      parameters: { 
        message: "Dhuhr in 20 min",
        priority: "normal" 
      },
      reasoning: "Notify 20 min before, user typically needs this lead time"
    }
  ]
};

// Harness converts these to schedule events
for (const task of decision.recommendedTasks) {
  emit({ type: "schedule:task", ...task });
}
```

---

## Output Storage Strategies

### 1. Rolling Window

Keep last N outputs per agent:

```typescript
// Inside harness run, after each agent run
state.agentOutputs[agentName].push(newOutput);

// Maintain window size
if (state.agentOutputs[agentName].length > MAX_OUTPUTS) {
  state.agentOutputs[agentName].shift();  // Remove oldest
}
```

**Recommended sizes**:
- High-frequency runs (every 5 min): Keep last 100 outputs (~8 hours)
- Medium-frequency runs (every 15 min): Keep last 50 outputs (~12 hours)
- Low-frequency runs (hourly): Keep last 24 outputs (1 day)

---

### 2. Compressed Archives

For long-term pattern learning, schedule a daily compression task:

```typescript
// Brain agent can recommend a compression task
if (shouldCompressDaily()) {
  emit({
    type: "schedule:task",
    taskId: "daily-compress",
    executeAt: "2025-01-16T00:00:00Z",  // Midnight
    action: "compress_history",
    parameters: {},
    reasoning: "Daily compression to save memory and extract patterns"
  });
}

// When the task executes:
async function executeCompressHistory(state: TAPState) {
  const dailySummary = {
    date: today,
    mostCommonState: computeMode(state.agentOutputs.location),
    transitions: countTransitions(state.agentOutputs.location),
    avgConfidence: average(state.agentOutputs.location.map(o => o.confidence)),
    patterns: extractPatterns(state.agentOutputs.location)
  };
  
  state.patterns.locationPatterns.dailySummaries.push(dailySummary);
  
  // Keep only last 24 hours of detailed outputs
  state.agentOutputs.location = state.agentOutputs.location.slice(-96);
}
```

---

### 3. Pattern Cache

Computed patterns for fast access:

```typescript
interface PatternCache {
  userBehavior: {
    typicalWakeTime: string;
    typicalBedTime: string;
    workdays: string[];
    typicalLocations: {
      home: GPS;
      work: GPS;
      gym?: GPS;
    };
  };
  
  locationPatterns: {
    dailySummaries: DailySummary[];
    weeklyPatterns: WeeklyPattern[];
    commonRoutes: Route[];
  };
  
  prayerHabits: {
    preferredPrayerTimes: Record<string, string>;
    preferredLocations: Record<string, string>;
    averageResponseTime: number;
  };
}

// Update patterns after each brain decision
function updatePatterns(state: TAPState) {
  state.patterns = computePatterns(state.agentOutputs);
}
```

---

## Deployment Patterns

### Long-Running Process (Node.js/Bun)

```typescript
// Simple in-memory driver
const driver = new TAPDriver();
driver.start();

// State persisted to SQLite/Redis between runs
// Timers managed in-memory
```

### Serverless (AWS Lambda + EventBridge)

```typescript
export async function handler(event: LambdaEvent) {
  // Load state from DynamoDB
  const previousState = await loadFromDynamo(event.userId);
  
  // Run harness
  const result = await TAPHarness.create({
    trigger: event.trigger,
    previousState
  }).run();
  
  // Persist state
  await saveToDynamo(event.userId, result.state);
  
  // Schedule future runs via EventBridge
  for (const e of result.events) {
    if (e.event.type === "schedule:run") {
      await eventBridge.putRule({
        name: `tap-${event.userId}-${e.event.executeAt}`,
        scheduleExpression: `at(${e.event.executeAt})`,
        target: {
          functionArn: context.functionArn,
          input: JSON.stringify({ 
            userId: event.userId, 
            trigger: e.event.trigger 
          })
        }
      });
    }
  }
  
  return result.result;
}
```

### Edge/Mobile (React Native)

```typescript
// Use background tasks API
BackgroundFetch.configure({
  minimumFetchInterval: 15,
}, async (taskId) => {
  const previousState = await AsyncStorage.getItem('tap-state');
  
  const result = await TAPHarness.create({
    trigger: { type: "periodic-check" },
    previousState: JSON.parse(previousState)
  }).run();
  
  await AsyncStorage.setItem('tap-state', JSON.stringify(result.state));
  
  // Handle immediate tasks
  for (const e of result.events) {
    if (e.event.type === "schedule:task" && e.event.executeAt === "immediately") {
      await executeTask(e.event);
    }
  }
  
  BackgroundFetch.finish(taskId);
});
```

---

## Benefits of TAP

### 1. Intelligence Over Time

Agents become smarter as they accumulate evidence:

**Week 1**: Generic behavior, low confidence
**Week 4**: Personalized to user patterns, high confidence
**Week 12**: Predictive, anticipates user needs

---

### 2. Explainability

Every decision has a reasoning trace:

```typescript
{
  decision: "Send notification now",
  reasoning: "User transitioned from COMMUTING to AT_WORK 5 minutes ago (detected from location history), prayer is in 30 min, user typically prays 15-20 min after arriving at work (pattern from last 3 weeks)"
}
```

Users can see WHY the app made a decision.

---

### 3. Confidence-Based Actions

Agents can be conservative when uncertain:

```typescript
if (locationOutput.confidence < 0.7) {
  // Low confidence - be conservative
  emit({
    type: "schedule:run",
    trigger: { type: "periodic-check" },
    executeAt: fifteenMinutesFromNow,
    reasoning: "Location unclear, check again soon"
  });
  
} else if (locationOutput.confidence > 0.9) {
  // High confidence - take action
  emit({
    type: "schedule:task",
    taskId: "notify-prayer",
    executeAt: "immediately",
    action: "send_notification",
    parameters: { message: "Prayer time!" },
    reasoning: "High confidence user is at work"
  });
}
```

---

### 4. Debugging

Full history makes debugging easy:

```
User: "Why did you notify me at 11:45?"

Developer checks harness events:
- Location history shows: HOME → COMMUTING → AT_WORK (arrived 11:40)
- Brain history shows: "User just arrived at work, prayer in 30 min"
- Schedule event: { type: "schedule:task", executeAt: "11:45", reasoning: "..." }

Answer: App learned your pattern and timed notification perfectly!
```

---

### 5. Testability

Because harness runs are bounded and pure:

```typescript
import { test, expect } from "bun:test";

test("schedules notification after arrival at work", async () => {
  const result = await TAPHarness.create({
    trigger: { type: "periodic-check" },
    previousState: {
      agentOutputs: {
        location: [
          { inferredLocation: { type: "HOME" }, timestamp: "08:00" },
          { inferredLocation: { type: "COMMUTING" }, timestamp: "08:15" },
        ]
      }
    }
  }).run();
  
  // Assert on schedule events
  const scheduleEvents = result.events.filter(e => e.event.type === "schedule:task");
  expect(scheduleEvents).toHaveLength(1);
  expect(scheduleEvents[0].event.action).toBe("send_notification");
});
```

---

## Real-World Example: Prayer Companion

**High-level flow**:

```
08:00 - Trigger: startup
        Location: HOME (conf: 0.95)
        Brain: Too early, schedule next check
        Emits: schedule:run at 08:15
        
08:15 - Trigger: periodic-check
        Location: COMMUTING (conf: 0.72, transition from HOME)
        Brain: User commuting, check on arrival
        Emits: schedule:run at 08:30
        
08:30 - Trigger: periodic-check
        Location: COMMUTING (conf: 0.85)
        Brain: Still commuting
        Emits: schedule:run at 08:45
        
08:45 - Trigger: periodic-check
        Location: AT_WORK (conf: 0.88, transition from COMMUTING)
        Brain: User arrived, prayer at 12:15
        Emits: schedule:task at 11:55 (notify)
        Emits: schedule:run at 11:50 (pre-notify check)
        
11:50 - Trigger: periodic-check
        Location: AT_WORK (conf: 0.95, stable)
        Calendar: Free until 13:00 meeting
        Brain: Confirm notification
        
11:55 - Trigger: task-due (notify)
        Action: send_notification
        Message: "Dhuhr in 20 min. You have time before your 1 PM meeting."
```

---

## Implementation Checklist

When implementing TAP:

✅ **Agent Design**:
- [ ] Input schema includes `previousOutputs`
- [ ] Output schema includes `confidence`, `evidence`, `reasoning`
- [ ] Output schema includes `stateTransition` (if applicable)
- [ ] Prompt instructs agent to use history
- [ ] Confidence increases with evidence

✅ **Harness State**:
- [ ] `agentOutputs` stores history per agent
- [ ] `patterns` cache for computed insights
- [ ] Rolling window to limit memory
- [ ] State passed in and returned out (pure function)

✅ **Brain Agent**:
- [ ] Recommends tasks (not executes them)
- [ ] Uses history from ALL agents
- [ ] Provides reasoning for every decision
- [ ] Harness emits schedule extension events based on recommendations

✅ **Schedule Events (Extension)**:
- [ ] `schedule:run` for future harness invocations
- [ ] `schedule:task` for specific actions
- [ ] `schedule:cancel` to cancel previous schedules
- [ ] All events include `reasoning`

✅ **Driver**:
- [ ] Loads state before run
- [ ] Saves state after run
- [ ] Processes `schedule:*` extension events
- [ ] Contains zero business logic

---

## Anti-Patterns (What NOT to Do)

❌ **Don't**: Make agents stateless
```typescript
// BAD
const agent = (input) => {
  return processInput(input);  // No memory!
}
```

✅ **Do**: Pass history to agents
```typescript
// GOOD  
const agent = (input, previousOutputs) => {
  const patterns = analyzeHistory(previousOutputs);
  return processInput(input, patterns);
}
```

---

❌ **Don't**: Execute actions directly in agents
```typescript
// BAD
const brain = async (context) => {
  if (shouldNotify) {
    await sendNotification();  // Direct execution!
  }
}
```

✅ **Do**: Emit schedule events
```typescript
// GOOD
const brain = async (context, emit) => {
  if (shouldNotify) {
    emit({
      type: "schedule:task",
      taskId: "notify",
      executeAt: "immediately",
      action: "send_notification",
      reasoning: "User needs notification now"
    });
  }
}
```

---

❌ **Don't**: Put business logic in the driver
```typescript
// BAD
class Driver {
  async handleTrigger(trigger) {
    if (trigger.type === "task-due" && isWeekend()) {
      return;  // Business logic in driver!
    }
    // ...
  }
}
```

✅ **Do**: Keep driver dumb
```typescript
// GOOD
class Driver {
  async handleTrigger(trigger) {
    const state = await this.store.load();
    const harness = TAPHarness.create({ trigger, previousState: state });
    const result = await harness.run();
    await this.store.save(result.state);
    // Process schedule events...
  }
}
// Weekend logic lives in the harness/agents
```

---

❌ **Don't**: Ignore confidence scores
```typescript
// BAD
if (location.type === "AT_WORK") {
  notify();  // What if confidence is 0.3?
}
```

✅ **Do**: Use confidence appropriately
```typescript
// GOOD
if (location.type === "AT_WORK" && location.confidence > 0.8) {
  emit({ type: "schedule:task", action: "notify", ... });
} else if (location.confidence < 0.7) {
  // Low confidence - schedule another check soon
  emit({ type: "schedule:run", executeAt: soonTimestamp, ... });
}
```

---

## Advanced Patterns

### Multi-Agent Confidence Aggregation

```typescript
const computeOverallConfidence = (outputs) => {
  const weights = {
    location: 0.4,
    calendar: 0.3,
    prayerTimes: 0.2,
    userState: 0.1
  };
  
  const weightedConfidence = 
    outputs.location.confidence * weights.location +
    outputs.calendar.confidence * weights.calendar +
    outputs.prayerTimes.confidence * weights.prayerTimes +
    outputs.userState.confidence * weights.userState;
  
  return weightedConfidence;
};
```

---

### Temporal Reasoning Queries

Agents can query their own history:

```typescript
const findLastTransition = (history, targetState) => {
  return history
    .reverse()
    .find(output => 
      output.stateTransition && 
      output.stateTransition.to === targetState
    );
};

const avgConfidenceLastHour = (history) => {
  const lastHour = history.filter(
    output => output.timestamp > (Date.now() - 3600000)
  );
  return average(lastHour.map(o => o.confidence));
};

const timeSinceLastTransition = (history) => {
  const lastTransition = history.findLast(o => o.stateTransition);
  if (!lastTransition) return Infinity;
  return Date.now() - new Date(lastTransition.timestamp).getTime();
};
```

---

## Summary

**TAP Principles**:
1. Every agent has memory (temporal accumulation)
2. Confidence builds with evidence
3. Agents schedule work via events (autonomous)
4. Harness is bounded and pure (testable)
5. Driver is dumb plumbing (no business logic)
6. Reasoning is explicit and traceable
7. Patterns emerge from history

**TAP Benefits**:
- Agents get smarter over time
- Decisions are explainable
- Confidence-based behavior
- Easy debugging
- Fully testable
- Extensible to any domain

**When to Use TAP**:
- Context-aware applications
- Time-based decision making
- Learning from user patterns
- Need for explainability
- Complex multi-agent systems

---

## References

- [OpenHarness Documentation](../OPENHARNESS.md)
- [Kernel Protocol Spec](../../../packages/kernel/docs/README.md)
- [Hub API Reference](../../../packages/kernel/docs/spec/hub.md)

---

*Temporal Accumulation Pattern - Building intelligence through memory*
