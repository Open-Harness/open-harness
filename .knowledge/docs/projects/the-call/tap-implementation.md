# The Call: Temporal Accumulation Pattern Example

> **Real-world implementation of TAP** in an Islamic prayer companion app

---

## Overview

"The Call" is a voice-first AI companion that helps Muslim professionals organize their lives around prayer times. This document shows the **complete TAP implementation** - how temporal accumulation enables the app to become smarter over time.

**Related Documentation**:
- [Temporal Accumulation Pattern (TAP)](../../patterns/TEMPORAL-ACCUMULATION-PATTERN.md) - The pattern explained
- [The Call Architecture](./architecture.md) - Overall system architecture
- [OpenHarness](../../OPENHARNESS.md) - The framework

---

## The Challenge

**Problem**: Static notification apps are annoying and unhelpful.

**Examples**:
- Notify "Dhuhr in 20 min" when user is commuting (can't pray)
- Don't notify when user arrives at work (actually CAN pray)
- Generic timing (doesn't learn user preferences)

**Solution**: An intelligent agent that learns user patterns and makes context-aware decisions.

---

## TAP Implementation

### Harness: The Orchestrator

```typescript
import { defineHarness } from "@openharness/sdk";

export const PrayerCompanionHarness = defineHarness({
  name: "prayer-companion",
  
  agents: {
    location: LocationAgent,
    calendar: CalendarAgent,
    prayerTimes: PrayerTimesAgent,
    brain: BrainAgent,
    taskScheduler: TaskSchedulerAgent,
  },
  
  // TAP: State includes output histories
  state: (input: { userId: string }) => ({
    userId: input.userId,
    
    // Temporal accumulation
    agentOutputs: {
      location: [],      // Growing history
      calendar: [],      // Growing history
      prayerTimes: [],   // Growing history
      brain: [],         // Growing history
    },
    
    // Scheduled tasks
    scheduledTasks: [],
    
    // Learned patterns (computed from history)
    patterns: {
      userBehavior: {
        typicalWakeTime: null,
        typicalBedTime: null,
        workdays: [],
      },
      locationPatterns: {
        homeLocation: null,
        workLocation: null,
        typicalRoutes: [],
      },
      prayerHabits: {
        preferredPrayerTimes: {},
        preferredLocations: {},
        averageResponseTime: null,
      },
    },
  }),
  
  run: async ({ agents, state, schedule, bus }) => {
    
    // === MAIN REASONING LOOP (Every 15 minutes) ===
    schedule.every("15 minutes", async () => {
      
      // 1. LOCATION AGENT (Uses history)
      const locationOutput = await agents.location.execute({
        currentGPS: await fetchGPS(state.userId),
        previousOutputs: state.agentOutputs.location,  // ← TAP!
        userPatterns: state.patterns.locationPatterns,
        timestamp: new Date(),
      });
      
      // Store in history
      state.agentOutputs.location.push(locationOutput);
      
      
      // 2. CALENDAR AGENT (Uses history)
      const calendarOutput = await agents.calendar.execute({
        userId: state.userId,
        currentTime: new Date(),
        previousOutputs: state.agentOutputs.calendar,  // ← TAP!
        timestamp: new Date(),
      });
      
      state.agentOutputs.calendar.push(calendarOutput);
      
      
      // 3. PRAYER TIMES AGENT
      const prayerOutput = await agents.prayerTimes.execute({
        location: locationOutput.inferredLocation,
        date: new Date(),
        calculation: "ISNA", // Islamic Society of North America
      });
      
      state.agentOutputs.prayerTimes.push(prayerOutput);
      
      
      // 4. BRAIN AGENT (Uses ALL histories)
      const decision = await agents.brain.execute({
        currentContext: {
          location: locationOutput,
          calendar: calendarOutput,
          prayerTimes: prayerOutput,
        },
        history: {
          location: state.agentOutputs.location,
          calendar: state.agentOutputs.calendar,
          prayerTimes: state.agentOutputs.prayerTimes,
          previousDecisions: state.agentOutputs.brain,
        },
        patterns: state.patterns,
        timestamp: new Date(),
      });
      
      state.agentOutputs.brain.push(decision);
      
      
      // 5. TASK SCHEDULER (Manages timing)
      if (decision.recommendedTasks.length > 0) {
        const scheduled = await agents.taskScheduler.execute({
          tasks: decision.recommendedTasks,
          existingTasks: state.scheduledTasks,
          timestamp: new Date(),
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
      
      
      // 6. UPDATE PATTERNS (Daily)
      if (shouldUpdatePatterns()) {
        state.patterns = computePatterns(state.agentOutputs);
      }
    });
    
    
    // === TASK EXECUTION ===
    bus.on('task:due', async (event) => {
      const task = event.data;
      
      if (task.action === "send_notification") {
        await sendPushNotification({
          userId: state.userId,
          title: task.parameters.title,
          message: task.parameters.message,
        });
        task.status = "completed";
      }
      
      if (task.action === "check_arrival") {
        // Re-run location agent to check if user arrived
        const currentLocation = await agents.location.execute({
          currentGPS: await fetchGPS(state.userId),
          previousOutputs: state.agentOutputs.location,
          userPatterns: state.patterns.locationPatterns,
          timestamp: new Date(),
        });
        
        if (currentLocation.inferredLocation.type === task.parameters.expectedLocation) {
          // User arrived! Schedule notification
          bus.emit('task:execute', {
            action: "send_notification",
            executeAt: "immediately",
            parameters: {
              title: "You've arrived!",
              message: task.parameters.arrivalMessage,
            },
          });
        }
        
        task.status = "completed";
      }
    });
  },
});
```

---

## Agent Implementations

### 1. Location Agent (Specialist + TAP)

```typescript
import { defineAnthropicAgent, createPromptTemplate } from "@openharness/anthropic";
import { z } from "zod";

const LocationOutputSchema = z.object({
  inferredLocation: z.object({
    type: z.enum(["HOME", "WORK", "COMMUTING", "TRAVELING", "MOSQUE", "UNKNOWN"]),
    confidence: z.number().min(0).max(1),
    evidence: z.array(z.string()),
    reasoning: z.string(),
  }),
  rawGPS: z.object({ lat: z.number(), lng: z.number() }),
  timestamp: z.date(),
  metadata: z.object({
    stability: z.enum(["stable", "moving", "variable"]),
    velocity: z.number().optional(),
    heading: z.string().optional(),
  }),
  stateTransition: z.object({
    from: z.string(),
    to: z.string(),
    transitionTime: z.date(),
    reasoning: z.string(),
  }).optional(),
  pattern: z.object({
    matchesHistoricalPattern: z.boolean(),
    patternName: z.string().optional(),
    confidence: z.number(),
  }).optional(),
});

export const LocationAgent = defineAnthropicAgent({
  name: "Location",
  
  inputSchema: z.object({
    currentGPS: z.object({ lat: z.number(), lng: z.number() }),
    timestamp: z.date(),
    previousOutputs: z.array(LocationOutputSchema),
    userPatterns: z.object({
      homeLocation: z.object({ lat: z.number(), lng: z.number() }).optional(),
      workLocation: z.object({ lat: z.number(), lng: z.number() }).optional(),
      typicalRoutes: z.array(z.any()),
    }).optional(),
  }),
  
  outputSchema: LocationOutputSchema,
  
  prompt: createPromptTemplate(`
You are a location inference agent. Determine WHERE the user is with CONFIDENCE.

**Current GPS**: {{currentGPS.lat}}, {{currentGPS.lng}}
**Timestamp**: {{timestamp}}

**Previous Outputs** (Temporal History):
{{#each previousOutputs}}
- {{this.timestamp}}: {{this.inferredLocation.type}} (confidence: {{this.inferredLocation.confidence}})
  Evidence: {{join this.inferredLocation.evidence ", "}}
  {{#if this.stateTransition}}
  Transition: {{this.stateTransition.from}} → {{this.stateTransition.to}}
  {{/if}}
{{/each}}

**Known Patterns**:
{{#if userPatterns.homeLocation}}
- Home: {{userPatterns.homeLocation.lat}}, {{userPatterns.homeLocation.lng}}
{{/if}}
{{#if userPatterns.workLocation}}
- Work: {{userPatterns.workLocation.lat}}, {{userPatterns.workLocation.lng}}
{{/if}}

**CRITICAL - Temporal Accumulation Pattern**:
1. Use previous outputs to detect STATE TRANSITIONS
2. Confidence should INCREASE with consistent patterns
3. Always provide EVIDENCE for your inference
4. If ambiguous, say so (lower confidence)
5. Compare current GPS with historical patterns when available
6. If this is the SAME state as previous output, confidence should be HIGHER (consistency bonus)
7. If this is a DIFFERENT state (transition), explain the transition with reasoning

**Confidence Building**:
- First time seeing a location: 0.5-0.7
- Consistent with previous output: +0.1-0.2 confidence
- Matches historical pattern: +0.1-0.15 confidence
- Stable for multiple outputs: +0.05-0.1 confidence
- Ambiguous or contradictory: -0.1-0.3 confidence

Infer the user's current location with reasoning.
  `),
  
  options: {
    model: "claude-sonnet-4-20250514",
    maxTurns: 2,
  },
});
```

**Key TAP Features**:
- ✅ Takes `previousOutputs` as input
- ✅ Outputs `confidence`, `evidence`, `reasoning`
- ✅ Detects `stateTransition` when location changes
- ✅ Compares with `userPatterns` for pattern matching
- ✅ Confidence increases with consistency

---

### 2. Brain Agent (Decision Maker + TAP)

```typescript
const BrainOutputSchema = z.object({
  decision: z.object({
    shouldIntervene: z.boolean(),
    urgency: z.enum(["LOW", "MEDIUM", "HIGH"]),
    reasoning: z.string(),
  }),
  recommendedTasks: z.array(z.object({
    action: z.string(),
    executeAt: z.union([z.date(), z.literal("immediately")]),
    parameters: z.record(z.unknown()),
    reasoning: z.string(),
  })),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
});

export const BrainAgent = defineAnthropicAgent({
  name: "Brain",
  
  inputSchema: z.object({
    currentContext: z.object({
      location: LocationOutputSchema,
      calendar: z.any(),
      prayerTimes: z.any(),
    }),
    history: z.object({
      location: z.array(LocationOutputSchema),
      calendar: z.array(z.any()),
      prayerTimes: z.array(z.any()),
      previousDecisions: z.array(BrainOutputSchema),
    }),
    patterns: z.any(),
    timestamp: z.date(),
  }),
  
  outputSchema: BrainOutputSchema,
  
  prompt: createPromptTemplate(`
You are the Brain Agent for a prayer companion app. You make DECISIONS about when and how to help the user pray.

**Current Context**:
- Location: {{currentContext.location.inferredLocation.type}} (conf: {{currentContext.location.inferredLocation.confidence}})
  {{currentContext.location.inferredLocation.reasoning}}
- Next Prayer: {{currentContext.prayerTimes.nextPrayer.name}} at {{currentContext.prayerTimes.nextPrayer.time}}
- Calendar: {{#if currentContext.calendar.upcomingMeetings}}Busy{{else}}Free{{/if}}

**Location History** (last 5 outputs):
{{#each (slice history.location -5)}}
- {{this.timestamp}}: {{this.inferredLocation.type}} (conf: {{this.inferredLocation.confidence}})
{{/each}}

**Previous Decisions** (last 3):
{{#each (slice history.previousDecisions -3)}}
- {{this.timestamp}}: {{#if this.decision.shouldIntervene}}INTERVENE{{else}}WAIT{{/if}} (urgency: {{this.decision.urgency}})
  Tasks: {{this.recommendedTasks.length}}
  Reasoning: {{this.decision.reasoning}}
{{/each}}

**Learned Patterns**:
- User typically prays {{patterns.prayerHabits.preferredPrayerTimes.dhuhr}} for Dhuhr
- User prefers {{patterns.prayerHabits.preferredLocations.dhuhr}} location
- User responds to notifications in ~{{patterns.prayerHabits.averageResponseTime}} minutes

**YOUR TASK**:
Decide if you should intervene (notify user) and SCHEDULE TASKS for future execution.

**CRITICAL - Scheduling Principle**:
- You do NOT execute actions directly
- You output RECOMMENDED TASKS with executeAt times
- Task Scheduler will manage WHEN things happen
- Use "immediately" for urgent tasks
- Use specific time for future tasks

**Decision Framework**:
1. If user is in a state where they CAN'T pray (COMMUTING, TRAVELING), DON'T notify immediately
2. If user just arrived at a location where they CAN pray (AT_WORK, AT_MOSQUE), consider notifying
3. If prayer time is approaching and user is stable, notify ahead of their preferred lead time
4. Use historical patterns to personalize timing
5. If confidence in location is LOW (<0.7), be conservative

**Confidence Building**:
- Your confidence should reflect the QUALITY of your reasoning
- High confidence: Location stable, clear calendar, matches patterns
- Low confidence: Location ambiguous, conflicting signals, no historical data

Output your decision with recommended tasks and reasoning.
  `),
  
  options: {
    model: "claude-sonnet-4-20250514",
    maxTurns: 3,
  },
});
```

**Key TAP Features**:
- ✅ Receives context from ALL agents
- ✅ Uses full `history` from all agents
- ✅ Uses learned `patterns`
- ✅ Outputs TASKS (not actions)
- ✅ Provides detailed `reasoning`
- ✅ NO tools (pure reasoning)

---

### 3. Task Scheduler Agent

```typescript
const TaskSchema = z.object({
  taskId: z.string(),
  action: z.string(),
  executeAt: z.union([z.date(), z.literal("immediately")]),
  parameters: z.record(z.unknown()),
  reasoning: z.string(),
  status: z.enum(["pending", "executing", "completed", "cancelled"]),
  scheduledAt: z.date(),
  executedAt: z.date().optional(),
  createdBy: z.string(),
  supersedes: z.array(z.string()).optional(),
});

export const TaskSchedulerAgent = defineAnthropicAgent({
  name: "TaskScheduler",
  
  inputSchema: z.object({
    tasks: z.array(z.object({
      action: z.string(),
      executeAt: z.union([z.date(), z.literal("immediately")]),
      parameters: z.record(z.unknown()),
      reasoning: z.string(),
    })),
    existingTasks: z.array(TaskSchema),
    timestamp: z.date(),
  }),
  
  outputSchema: z.object({
    tasks: z.array(TaskSchema),
    cancelledTasks: z.array(z.string()),
    reasoning: z.string(),
  }),
  
  prompt: createPromptTemplate(`
You are the Task Scheduler Agent. You manage WHEN things happen.

**Incoming Tasks** (from Brain Agent):
{{#each tasks}}
- Action: {{this.action}}
  Execute At: {{this.executeAt}}
  Reasoning: {{this.reasoning}}
{{/each}}

**Existing Scheduled Tasks**:
{{#each existingTasks}}
- [{{this.taskId}}] {{this.action}} at {{this.executeAt}} (status: {{this.status}})
{{/each}}

**YOUR TASK**:
1. Add new tasks to the schedule
2. Resolve conflicts (e.g., don't notify twice for same prayer)
3. Cancel superseded tasks
4. Assign unique taskIds
5. Determine optimal execution time

**Conflict Resolution**:
- If new task is same action + same time window, cancel old task
- If new task supersedes old task (e.g., new location update), cancel old
- Always provide reasoning for cancellations

Output the updated task list with cancellations and reasoning.
  `),
  
  options: {
    model: "claude-sonnet-4-20250514",
    maxTurns: 2,
  },
});
```

---

## Example Execution: One Morning

### Run 1: 08:00 AM (At Home)

**Location Agent**:
```typescript
{
  inferredLocation: {
    type: "HOME",
    confidence: 0.95,
    evidence: [
      "GPS coordinates match home address",
      "Stable location for 8+ hours",
      "Matches pattern: User at home at 8 AM on weekdays",
    ],
    reasoning: "High confidence user is at home based on stable GPS and historical pattern",
  },
  stateTransition: null,  // No previous output
  pattern: {
    matchesHistoricalPattern: true,
    patternName: "weekday_morning_at_home",
    confidence: 0.9,
  },
}
```

**Brain Agent**:
```typescript
{
  decision: {
    shouldIntervene: false,
    urgency: "LOW",
    reasoning: "User at home, Fajr prayer completed. Next prayer (Dhuhr) in 4 hours. No action needed now.",
  },
  recommendedTasks: [
    {
      action: "check_location_and_notify",
      executeAt: new Date("2025-01-15T11:45:00Z"),  // 11:45 AM
      parameters: { prayer: "Dhuhr", expectedTime: "12:15 PM" },
      reasoning: "Check location 30 min before Dhuhr to determine if user can pray",
    },
  ],
  confidence: 0.9,
}
```

**Stored**: Output 1 for both agents

---

### Run 2: 08:15 AM (Started Commuting)

**Location Agent**:
```typescript
{
  inferredLocation: {
    type: "COMMUTING",
    confidence: 0.72,  // Lower - just transitioned
    evidence: [
      "GPS moving away from home",
      "Previous state was HOME (from Run 1)",  // ← Using history!
      "Direction matches work commute route",
      "Velocity: 45 mph (driving)",
    ],
    reasoning: "User just started commuting to work, confidence lower due to recent transition",
  },
  stateTransition: {
    from: "HOME",
    to: "COMMUTING",
    transitionTime: new Date("2025-01-15T08:15:00Z"),
    reasoning: "Detected movement from home location toward work",
  },
  pattern: {
    matchesHistoricalPattern: true,
    patternName: "weekday_morning_commute",
    confidence: 0.85,
  },
}
```

**Brain Agent**:
```typescript
{
  decision: {
    shouldIntervene: true,
    urgency: "MEDIUM",
    reasoning: "User commuting to work. Adjust Dhuhr notification plan - wait until arrival.",
  },
  recommendedTasks: [
    {
      action: "check_arrival_and_notify",
      executeAt: new Date("2025-01-15T09:00:00Z"),  // 9:00 AM (expected arrival)
      parameters: { 
        expectedLocation: "WORK",
        prayer: "Dhuhr",
        arrivalMessage: "Dhuhr in 3 hours. Prayer room on Floor 3.",
      },
      reasoning: "Wait until user arrives at work, then notify about prayer",
    },
  ],
  confidence: 0.85,
}
```

**Task Scheduler**:
```typescript
{
  tasks: [
    {
      taskId: "t2",
      action: "check_arrival_and_notify",
      executeAt: new Date("2025-01-15T09:00:00Z"),
      status: "pending",
      createdBy: "BrainAgent",
    },
  ],
  cancelledTasks: ["t1"],  // Cancel old task from Run 1
  reasoning: "Cancelled 11:45 AM check - user is commuting. New plan: check at 9 AM when they arrive.",
}
```

**Stored**: Output 2 for all agents

---

### Run 3: 08:30 AM (Still Commuting)

**Location Agent**:
```typescript
{
  inferredLocation: {
    type: "COMMUTING",
    confidence: 0.89,  // ← Higher confidence!
    evidence: [
      "Continued movement toward work",
      "Traveled 600m in 15 min (consistent with driving)",
      "Previous 2 outputs show HOME → COMMUTING transition",  // ← Full history!
      "Still on typical commute route",
    ],
    reasoning: "High confidence user is commuting - consistent with previous outputs and patterns",
  },
  stateTransition: null,  // No transition (still commuting)
  pattern: {
    matchesHistoricalPattern: true,
    patternName: "weekday_morning_commute",
    confidence: 0.92,
  },
}
```

**Brain Agent**:
```typescript
{
  decision: {
    shouldIntervene: false,
    urgency: "LOW",
    reasoning: "User still commuting (consistent with previous decision). Task already scheduled for 9 AM.",
  },
  recommendedTasks: [],  // No new tasks
  confidence: 0.9,
}
```

**Stored**: Output 3 for both agents

---

### Run 4: 08:45 AM (Arrived at Work!)

**Location Agent**:
```typescript
{
  inferredLocation: {
    type: "AT_WORK",
    confidence: 0.92,
    evidence: [
      "GPS stopped at work address",
      "Previous state was COMMUTING (Run 2-3)",  // ← History!
      "Matches historical work location pattern",
      "Velocity: 0 (stationary)",
    ],
    reasoning: "User arrived at work - high confidence based on GPS and transition from COMMUTING",
  },
  stateTransition: {
    from: "COMMUTING",
    to: "AT_WORK",
    transitionTime: new Date("2025-01-15T08:45:00Z"),
    reasoning: "Arrived at work location after typical commute duration",
  },
  pattern: {
    matchesHistoricalPattern: true,
    patternName: "weekday_arrival_at_work",
    confidence: 0.95,
  },
}
```

**Brain Agent**:
```typescript
{
  decision: {
    shouldIntervene: true,
    urgency: "MEDIUM",
    reasoning: "User arrived at work 15 min early. Can notify about Dhuhr now instead of waiting for scheduled task.",
  },
  recommendedTasks: [
    {
      action: "send_notification",
      executeAt: "immediately",  // ← Execute NOW
      parameters: {
        title: "Dhuhr prayer in 3 hours",
        message: "Prayer room on Floor 3. You have time before your 1 PM meeting.",
      },
      reasoning: "User arrived early, good time to notify about upcoming prayer",
    },
  ],
  confidence: 0.88,
}
```

**Task Scheduler**:
```typescript
{
  tasks: [
    {
      taskId: "t3",
      action: "send_notification",
      executeAt: "immediately",
      status: "pending",
      createdBy: "BrainAgent",
    },
  ],
  cancelledTasks: ["t2"],  // Cancel scheduled 9 AM check
  reasoning: "User arrived early. Immediate notification better than waiting for scheduled check.",
}
```

**Task Execution**: Harness receives `task:execute` event → sends push notification

**Stored**: Output 4 for all agents

---

## Confidence Evolution

```
Location Agent Confidence:
Run 1 (08:00): 0.95 (HOME)           - High (stable, matches pattern)
Run 2 (08:15): 0.72 (COMMUTING)      - Lower (just transitioned)
Run 3 (08:30): 0.89 (COMMUTING)      - Higher (consistent)
Run 4 (08:45): 0.92 (AT_WORK)        - High (arrived, matches pattern)

Brain Agent Confidence:
Run 1: 0.90 - Clear situation (at home)
Run 2: 0.85 - Commuting (adjusted plan)
Run 3: 0.90 - Consistent (no change needed)
Run 4: 0.88 - Good decision (notify now)
```

**Key Insight**: Confidence builds as evidence accumulates!

---

## Learned Patterns (After 4 Weeks)

After running for 4 weeks, the system learns:

```typescript
state.patterns = {
  userBehavior: {
    typicalWakeTime: "07:30 AM",
    typicalBedTime: "11:00 PM",
    workdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  },
  locationPatterns: {
    homeLocation: { lat: 40.7128, lng: -74.0060 },
    workLocation: { lat: 40.7589, lng: -73.9851 },
    typicalRoutes: [
      {
        from: "HOME",
        to: "WORK",
        typicalDuration: "35 minutes",
        departureWindow: "08:10-08:20 AM",
      },
      {
        from: "WORK",
        to: "HOME",
        typicalDuration: "40 minutes",
        departureWindow: "05:30-06:00 PM",
      },
    ],
  },
  prayerHabits: {
    preferredPrayerTimes: {
      fajr: "before work",
      dhuhr: "12:30-12:45 PM (after arrival at work)",
      asr: "at work",
      maghrib: "at home",
      isha: "at home",
    },
    preferredLocations: {
      dhuhr: "WORK",
      asr: "WORK",
    },
    averageResponseTime: 8, // minutes from notification to action
  },
};
```

**Now the Brain can**:
- Predict when user will leave for work
- Know user prefers praying Dhuhr at work around 12:30 PM
- Notify 20 min before (user needs 8 min lead time + buffer)
- Skip notifications during commute (user can't pray)

---

## Week 5: Smart Behavior

**Friday 09:00 AM**:

```typescript
// Brain Agent reasoning (using learned patterns)
{
  decision: {
    shouldIntervene: true,
    urgency: "HIGH",
    reasoning: `
      User just arrived at work. Jumu'ah (Friday prayer) at 1:00 PM.
      
      Historical pattern shows:
      - User always attends Jumu'ah at local mosque
      - Typically leaves work at 12:30 PM on Fridays
      - Mosque is 15 min drive from work
      
      Recommendation: Notify about Jumu'ah NOW (9 AM) to ensure they plan ahead.
    `,
  },
  recommendedTasks: [
    {
      action: "send_notification",
      executeAt: "immediately",
      parameters: {
        title: "Jumu'ah today at 1:00 PM",
        message: "Masjid An-Nur (15 min drive). Consider leaving work by 12:30 PM. You have a meeting at 11 AM.",
      },
      reasoning: "Early notification for Jumu'ah based on user's historical attendance pattern",
    },
  ],
  confidence: 0.95,  // Very high - strong pattern evidence
}
```

**The app learned**:
- ✅ User's Friday prayer habit (from 4 weeks of data)
- ✅ Preferred mosque location
- ✅ Optimal departure time
- ✅ Proactively notify EARLY (9 AM vs 12:30 PM)

**User reaction**: "Wow, it knows I go to Jumu'ah! And it reminded me early!"

---

## Anti-Pattern: What NOT to Do

### ❌ BAD: Stateless Brain Agent

```typescript
// BAD - No history, no learning
const decision = await agents.brain.execute({
  location: "AT_WORK",
  nextPrayer: "Dhuhr at 12:15 PM",
});
```

**Problems**:
- No memory of user patterns
- Can't detect state transitions
- Can't build confidence over time
- Generic decisions

### ✅ GOOD: TAP Brain Agent

```typescript
// GOOD - Uses full history
const decision = await agents.brain.execute({
  currentContext: { location, prayer, calendar },
  history: {
    location: state.agentOutputs.location,     // All location history
    calendar: state.agentOutputs.calendar,     // All calendar checks
    previousDecisions: state.agentOutputs.brain, // All past decisions
  },
  patterns: state.patterns,  // Learned patterns
});
```

**Benefits**:
- ✅ Remembers user behavior
- ✅ Detects patterns
- ✅ Builds confidence
- ✅ Personalized decisions

---

## Summary

**The Temporal Accumulation Pattern enables**:

1. **Intelligence Over Time**: App becomes smarter each week
2. **Context-Aware Decisions**: Uses state transitions (HOME → COMMUTING → AT_WORK)
3. **Confidence Building**: Higher confidence with consistent evidence
4. **Pattern Learning**: Discovers user habits automatically
5. **Proactive Behavior**: Anticipates needs based on history
6. **Explainable AI**: Every decision has detailed reasoning

**TAP Principles Applied**:
- ✅ Every agent has memory (temporal accumulation)
- ✅ Confidence builds with evidence
- ✅ All actions are scheduled tasks
- ✅ Reasoning is explicit and traceable
- ✅ Patterns emerge from history

**Result**: A prayer companion that truly understands the user.

---

## Related Documentation

- [Temporal Accumulation Pattern](../../patterns/TEMPORAL-ACCUMULATION-PATTERN.md) - The pattern explained
- [TAP Diagrams](../../diagrams/) - Visual representations
- [The Call Architecture](./architecture.md) - Overall system design
- [OpenHarness](../../OPENHARNESS.md) - The framework

---

*Temporal Accumulation Pattern - Building intelligence through memory*
