# Temporal Accumulation Pattern (TAP)

> **The foundational pattern for building intelligent, context-aware AI agents that learn and improve over time**

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
Input + History → Agent → Output + Confidence + Evidence
                    ↓
              Store in History
                    ↓
              Future executions use this
```

- Each execution builds on previous outputs
- Confidence increases with evidence
- Patterns emerge over time
- Agents get smarter

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
interface HarnessState {
  // Temporal accumulation for each agent
  agentOutputs: {
    location: AgentOutput<LocationData>[],
    calendar: AgentOutput<CalendarData>[],
    brain: AgentOutput<Decision>[],
    // ... all agents store history
  },
  
  // Quick access to latest
  latest: {
    location: AgentOutput<LocationData>,
    calendar: AgentOutput<CalendarData>,
    // ...
  },
  
  // Learned patterns (computed from history)
  patterns: {
    userBehavior: UserPatterns,
    locationPatterns: LocationPatterns,
    // ...
  }
}
```

---

### 3. Scheduling is Everything

**Key Principle**: Agents don't execute actions - they schedule tasks.

**Even "immediate" execution is just scheduling with `executeAt: "immediately"`**

```typescript
// Brain Agent output
{
  decision: {
    shouldIntervene: true,
    reasoning: "User commuting, prayer in 90 min, check when they arrive"
  },
  
  // Output is TASKS, not ACTIONS
  recommendedTasks: [
    {
      action: "check_arrival_and_notify",
      executeAt: "2025-01-15T09:00:00Z",  // ← Schedule for later
      parameters: { expectedLocation: "WORK" },
      reasoning: "Wait until arrival, then notify"
    }
  ]
}
```

**Immediate execution**:
```typescript
{
  recommendedTasks: [
    {
      action: "send_urgent_notification",
      executeAt: "immediately",  // ← Schedule NOW
      parameters: { message: "⚠️ Prayer window closing!" },
      reasoning: "Critical time window"
    }
  ]
}
```

**Task Scheduler Agent** manages WHEN things happen:
- Schedules tasks for specific times
- Cancels superseded tasks
- Handles task conflicts
- Triggers execution when time arrives

---

## Architecture Overview

![[diagrams/temporal-accumulation-overview.excalidraw]]

### Component Responsibilities

**1. Harness (Orchestrator)**
- Maintains agent output histories
- Provides history to agents on each run
- Manages task scheduling
- Triggers task execution

**2. Specialist Agents (Data + Inference)**
- Process domain-specific data
- Build on own history
- Output: Data + Confidence + Evidence + Reasoning
- Examples: LocationAgent, CalendarAgent, PrayerTimesAgent

**3. Brain Agent (Decision Maker)**
- Analyzes context from all specialists
- Uses full history for reasoning
- Output: Decisions + Recommended Tasks
- NO tools (pure reasoning)

**4. Task Scheduler Agent (Temporal Executive)**
- Schedules tasks from Brain
- Manages task lifecycle
- Handles conflicts/cancellations
- Triggers execution at scheduled time

---

## The TAP Workflow

### 1. Main Loop (Periodic Check)

```typescript
const MyHarness = defineHarness({
  name: "my-harness",
  
  agents: {
    specialist1: Specialist1Agent,
    specialist2: Specialist2Agent,
    brain: BrainAgent,
    taskScheduler: TaskSchedulerAgent
  },
  
  state: (input) => ({
    agentOutputs: {
      specialist1: [],
      specialist2: [],
      brain: []
    },
    scheduledTasks: [],
    patterns: {}
  }),
  
  run: async ({ agents, schedule, state, bus }) => {
    
    // === MAIN REASONING LOOP ===
    schedule.every("15 minutes", async () => {
      
      // 1. Specialist agents gather data (with history)
      const specialist1Output = await agents.specialist1.execute({
        currentData: await fetchData1(),
        previousOutputs: state.agentOutputs.specialist1,  // ← History!
        timestamp: new Date()
      });
      
      state.agentOutputs.specialist1.push(specialist1Output);
      
      
      const specialist2Output = await agents.specialist2.execute({
        currentData: await fetchData2(),
        previousOutputs: state.agentOutputs.specialist2,  // ← History!
        timestamp: new Date()
      });
      
      state.agentOutputs.specialist2.push(specialist2Output);
      
      
      // 2. Brain analyzes with FULL history from all agents
      const decision = await agents.brain.execute({
        currentContext: {
          specialist1: specialist1Output,
          specialist2: specialist2Output
        },
        history: {
          specialist1: state.agentOutputs.specialist1,
          specialist2: state.agentOutputs.specialist2,
          previousDecisions: state.agentOutputs.brain
        },
        patterns: state.patterns,
        timestamp: new Date()
      });
      
      state.agentOutputs.brain.push(decision);
      
      
      // 3. Task Scheduler manages timing
      if (decision.recommendedTasks.length > 0) {
        const scheduled = await agents.taskScheduler.execute({
          tasks: decision.recommendedTasks,
          existingTasks: state.scheduledTasks,
          timestamp: new Date()
        });
        
        state.scheduledTasks = scheduled.tasks;
        
        // Emit tasks for execution
        scheduled.tasks.forEach(task => {
          if (task.executeAt === "immediately") {
            bus.emit('task:execute', task);
          } else {
            bus.emit('task:schedule', task);
          }
        });
      }
    });
    
    
    // === TASK EXECUTION ===
    bus.on('task:due', async (event) => {
      const task = event.data;
      await executeTask(task);
      task.status = "completed";
    });
  }
});
```

---

## Agent Design with TAP

### Agent Input Schema

```typescript
const LocationAgent = defineAnthropicAgent({
  name: "Location",
  
  inputSchema: z.object({
    // Current data
    currentGPS: GPSSchema,
    timestamp: z.date(),
    
    // Temporal accumulation (from harness)
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
  
  prompt: createPromptTemplate(`
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
  `)
});
```

---

## Confidence Accumulation

![[diagrams/confidence-over-time.excalidraw]]

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

![[diagrams/agent-temporal-flow.excalidraw]]

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

## Task Scheduling Architecture

![[diagrams/scheduling-everything.excalidraw]]

### The Scheduling Principle

**Everything is a scheduled task - even "now"**

```typescript
interface Task {
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

### Task Scheduler Responsibilities

1. **Schedule Management**
   - Add new tasks to schedule
   - Cancel superseded tasks
   - Resolve conflicts

2. **Timing Logic**
   - Determine optimal execution time
   - Handle "immediately" vs future scheduling
   - Respect priorities

3. **Execution Triggering**
   - Emit events when task is due
   - Track execution status
   - Store results

**Example Task Scheduler Output**:
```typescript
{
  tasks: [
    {
      taskId: "t1",
      action: "send_notification",
      executeAt: "2025-01-15T11:55:00Z",
      parameters: { message: "Prayer in 20 min" },
      reasoning: "Notify 20 min before prayer, user typically needs this lead time",
      status: "pending",
      scheduledAt: "2025-01-15T11:30:00Z",
      createdBy: "BrainAgent"
    }
  ],
  cancelledTasks: ["t0"],  // Old task superseded
  reasoning: "Updated notification time based on user's current location (at work, not commuting)"
}
```

---

## Output Storage Strategies

### 1. Rolling Window

Keep last N outputs per agent:

```typescript
// After each agent run
state.agentOutputs[agentName].push(newOutput);

// Maintain window size
if (state.agentOutputs[agentName].length > MAX_OUTPUTS) {
  state.agentOutputs[agentName].shift();  // Remove oldest
}
```

**Recommended sizes**:
- High-frequency agents (run every 5 min): Keep last 100 outputs (~8 hours)
- Medium-frequency agents (run every 15 min): Keep last 50 outputs (~12 hours)
- Low-frequency agents (run hourly): Keep last 24 outputs (1 day)

---

### 2. Compressed Archives

For long-term pattern learning:

```typescript
schedule.daily(async () => {
  // Compute daily summary
  const dailySummary = {
    date: today,
    mostCommonState: computeMode(state.agentOutputs.location),
    transitions: countTransitions(state.agentOutputs.location),
    avgConfidence: average(state.agentOutputs.location.map(o => o.confidence)),
    patterns: extractPatterns(state.agentOutputs.location)
  };
  
  // Store compressed summary
  state.patterns.locationPatterns.dailySummaries.push(dailySummary);
  
  // Clear old detailed outputs (keep last 24 hours)
  state.agentOutputs.location = state.agentOutputs.location.slice(-96);
});
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

// Update patterns after each output
const updatePatterns = (newOutput: AgentOutput) => {
  // Recompute patterns from accumulated history
  state.patterns = computePatterns(state.agentOutputs);
};
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
  decision.urgency = "LOW";
  decision.reasoning = "User location unclear, waiting for more data";
  
} else if (locationOutput.confidence > 0.9) {
  // High confidence - be proactive
  decision.urgency = "MEDIUM";
  decision.reasoning = "High confidence user is at work, proactively suggesting prayer";
}
```

---

### 4. Debugging

Full history makes debugging easy:

```
User: "Why did you notify me at 11:45?"

Developer checks logs:
- Location history shows: HOME → COMMUTING → AT_WORK (arrived 11:40)
- Brain history shows: "User just arrived at work, prayer in 30 min, historical pattern shows user prays 15-20 min after arrival"
- Task history shows: Task scheduled for 11:45 based on pattern

Answer: App learned your pattern and timed notification perfectly!
```

---

## Real-World Example: Prayer Companion

See [The Call TAP Implementation](./the-call-tap.md) for a complete worked example.

**High-level flow**:

```
08:00 - Location: HOME (conf: 0.95)
        Brain: Too early, schedule check for 08:30
        
08:15 - Location: COMMUTING (conf: 0.72, transition from HOME)
        Brain: User commuting, check arrival at 09:00
        
09:00 - Location: AT_WORK (conf: 0.88, transition from COMMUTING)
        Brain: User arrived, prayer at 12:15, check at 11:55
        
11:55 - Location: AT_WORK (conf: 0.95, stable)
        Calendar: Free time until 13:00 meeting
        Brain: Good time to notify
        Task: send_notification (executeAt: "immediately")
        
12:00 - User: Receives notification
        "Dhuhr in 15 min. Prayer room on Floor 3. 
         You have time before your 1 PM meeting."
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
- [ ] `latest` provides quick access to most recent
- [ ] `patterns` cache for computed insights
- [ ] Rolling window to limit memory

✅ **Brain Agent**:
- [ ] Outputs tasks (not actions)
- [ ] Uses history from ALL agents
- [ ] Provides reasoning for every decision
- [ ] No tools (pure reasoning)

✅ **Task Scheduler**:
- [ ] Manages task lifecycle
- [ ] Handles conflicts/cancellations
- [ ] Supports `executeAt: "immediately"`
- [ ] Provides reasoning for scheduling decisions

✅ **Execution**:
- [ ] Tasks emit events when due
- [ ] Results stored back into task
- [ ] Patterns updated from outcomes

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
const agent = (input, history) => {
  const patterns = analyzeHistory(history);
  return processInput(input, patterns);
}
```

---

❌ **Don't**: Have Brain execute actions directly
```typescript
// BAD
const brain = async (context) => {
  if (shouldNotify) {
    await sendNotification();  // Direct execution!
  }
}
```

✅ **Do**: Have Brain schedule tasks
```typescript
// GOOD
const brain = async (context) => {
  if (shouldNotify) {
    return {
      recommendedTasks: [{
        action: "send_notification",
        executeAt: "immediately"
      }]
    };
  }
}
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
  notify();
} else if (location.confidence < 0.7) {
  // Low confidence - wait for more data
  scheduleCheckIn15Min();
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
```

---

## Summary

**TAP Principles**:
1. Every agent has memory (temporal accumulation)
2. Confidence builds with evidence
3. All actions are scheduled tasks
4. Reasoning is explicit and traceable
5. Patterns emerge from history

**TAP Benefits**:
- Agents get smarter over time
- Decisions are explainable
- Confidence-based behavior
- Easy debugging
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
- [The Call TAP Example](./the-call-tap.md)
- [TAP Diagrams](../diagrams/)

---

*Temporal Accumulation Pattern - Building intelligence through memory*