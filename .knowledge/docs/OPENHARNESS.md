# OpenHarness: Production-Grade AI Agent Workflows

> **Build complex AI agent systems with clean architecture, provider flexibility, and interface composability.**

---

## What is OpenHarness?

OpenHarness is a TypeScript SDK for orchestrating multi-agent AI workflows. It provides a clean, composable architecture that separates three critical concerns:

- **Harness** (Workflow Orchestrator) - The brain that coordinates everything
- **Agents** (Task Executors) - LLM-powered workers that do the actual work
- **Channels** (Interface Adapters) - How users interact with the workflow

**Key Insight**: Define your workflow once, then attach any interface (voice, web, console, database) and use any LLM provider (Anthropic, Google, OpenAI) without changing your core logic.

---

## Quick Example

```typescript
import { defineHarness } from "@openharness/sdk";
import { PlannerAgent, CodingAgent } from "@openharness/anthropic/presets";
import { ElevenLabsChannel, ConsoleChannel } from "@openharness/channels";

// Define workflow once
const DevWorkflow = defineHarness({
  name: "dev-workflow",
  agents: { planner: PlannerAgent, coder: CodingAgent },
  
  run: async ({ agents, phase }) => {
    const plan = await phase("Planning", () => 
      agents.planner.execute({ goal: "Build auth system" })
    );
    
    const code = await phase("Coding", () => 
      agents.coder.execute({ tasks: plan.tasks })
    );
    
    return { plan, code };
  }
});

// Run with voice interface
await DevWorkflow.create()
  .attach(ElevenLabsChannel())    // Voice conversation
  .attach(ConsoleChannel())       // Debug logs
  .run();
```

**That's it.** You just built a voice-controlled AI coding assistant with progress tracking and debug logging.

---

## Core Concepts

### 1. Harness: The Workflow Orchestrator

**What it does**: Coordinates workflow execution, manages state, orchestrates agents

**What it doesn't do**: Execute LLM calls, manipulate files, make API requests (that's what agents do)

**Think of it as**: The conductor of an orchestra - coordinates musicians but doesn't play instruments

```typescript
const PrayerCompanionHarness = defineHarness({
  name: "prayer-companion",
  
  // Define which agents you'll use
  agents: {
    location: LocationAgent,
    prayerTimes: PrayerTimesAgent,
    calendar: CalendarAgent,
    brain: BrainAgent,
    taskScheduler: TaskSchedulerAgent,
  },
  
  // Initialize workflow state (includes temporal accumulation)
  state: (input: { userId: string }) => ({
    userId: input.userId,
    
    // Temporal Accumulation Pattern (TAP)
    agentOutputs: {
      location: [],      // History of location inferences
      prayerTimes: [],   // History of prayer time calculations
      calendar: [],      // History of calendar checks
      brain: [],         // History of decisions
    },
    
    scheduledTasks: [],
    patterns: {},
  }),
  
  // Orchestrate the workflow (runs every 15 minutes)
  run: async ({ agents, state, schedule, bus }) => {
    
    // Main reasoning loop (periodic)
    schedule.every("15 minutes", async () => {
      
      // 1. Location agent (builds on history)
      const locationOutput = await agents.location.execute({
        currentGPS: await fetchGPS(state.userId),
        previousOutputs: state.agentOutputs.location,  // TAP!
        timestamp: new Date(),
      });
      state.agentOutputs.location.push(locationOutput);
      
      // 2. Prayer times agent
      const prayerOutput = await agents.prayerTimes.execute({
        location: locationOutput.inferredLocation,
        date: new Date(),
      });
      state.agentOutputs.prayerTimes.push(prayerOutput);
      
      // 3. Calendar agent
      const calendarOutput = await agents.calendar.execute({
        prayerTimes: prayerOutput.times,
        previousOutputs: state.agentOutputs.calendar,  // TAP!
      });
      state.agentOutputs.calendar.push(calendarOutput);
      
      // 4. Brain agent (makes decisions, outputs TASKS)
      const decision = await agents.brain.execute({
        currentContext: {
          location: locationOutput,
          prayer: prayerOutput,
          calendar: calendarOutput,
        },
        history: state.agentOutputs,  // All agent histories!
        patterns: state.patterns,
      });
      state.agentOutputs.brain.push(decision);
      
      // 5. Task scheduler (manages WHEN things happen)
      if (decision.recommendedTasks.length > 0) {
        const scheduled = await agents.taskScheduler.execute({
          tasks: decision.recommendedTasks,
          existingTasks: state.scheduledTasks,
        });
        
        state.scheduledTasks = scheduled.tasks;
        
        // Execute tasks
        scheduled.tasks.forEach(task => {
          if (task.executeAt === "immediately") {
            bus.emit('task:execute', task);
          } else {
            bus.emit('task:schedule', task);
          }
        });
      }
    });
  }
});
```

**Key Insight**: This uses the **[Temporal Accumulation Pattern (TAP)](patterns/TEMPORAL-ACCUMULATION-PATTERN.md)** where agents build confidence over time by using their own output history as context. See the [TAP documentation](patterns/TEMPORAL-ACCUMULATION-PATTERN.md) for details.

**Key Properties**:
- **Pure control flow**: No business logic execution
- **Type-safe state**: Managed workflow state with TypeScript
- **Phase-based structure**: Clear workflow progression
- **Agent coordination**: Passes data between agents

---

### 2. Agents: The Task Executors

**What they do**: Execute LLM-powered tasks with tool access (file I/O, web search, APIs)

**Provider-agnostic**: Use Anthropic's Claude, Google's Gemini, OpenAI's GPT - same interface

**Think of it as**: The specialized workers that do the actual heavy lifting

```typescript
const PrayerTimesAgent = defineAnthropicAgent({
  name: "PrayerTimes",
  
  // Define input contract
  inputSchema: z.object({
    location: z.object({ 
      lat: z.number(), 
      lng: z.number() 
    }),
    date: z.date(),
  }),
  
  // Define output contract
  outputSchema: z.object({
    fajr: z.string(),
    dhuhr: z.string(),
    asr: z.string(),
    maghrib: z.string(),
    isha: z.string(),
  }),
  
  // Define the prompt
  prompt: PrayerTimesPrompt,
  
  // Configure LLM options
  options: {
    model: "claude-sonnet-4-20250514",
    maxTurns: 3,
  },
});
```

**Agent Types**:
- **Anthropic Agents** (`@openharness/anthropic`)
- **Gemini Agents** (`@openharness/gemini`) - Future
- **OpenAI Agents** (`@openharness/openai`) - Future
- **Custom Agents** (bring your own LLM)

**Key Properties**:
- **Type-safe I/O**: Zod schemas for inputs and outputs
- **Tool access**: Can use bash, file I/O, web search
- **Provider swappable**: Change LLM without changing workflow

---

### 3. Channels: The Interface Adapters

**What they do**: Translate between workflow events and user experiences

**The Key Insight**: Channels are NOT just output renderers - they're **bidirectional interface adapters**

**Think of it as**: Different ways to experience the same concert (in-person, radio, streaming)

```typescript
const ElevenLabsChannel = defineChannel({
  name: "ElevenLabs",
  
  // Channel state
  state: () => ({
    conversation: null,
    transcript: [],
    workflowContext: {
      currentPhase: "",
      completedTasks: 0,
      recentMonologues: [],
    }
  }),
  
  // Listen to workflow events (OUTPUT)
  on: {
    "phase:start": ({ event, state }) => {
      state.workflowContext.currentPhase = event.event.name;
      state.conversation.speak(`Starting ${event.event.name}`);
    },
    
    "task:complete": ({ event, state }) => {
      state.workflowContext.completedTasks++;
      state.conversation.speak(`Task ${event.event.id} complete`);
    },
    
    // IMPORTANT: Subscribe to agent thinking (monologues)
    "narrative": ({ event, state }) => {
      state.workflowContext.recentMonologues.push({
        agent: event.event.agentName,
        text: event.event.text,
      });
      
      // Optionally narrate important thoughts
      if (event.event.importance === "high") {
        state.conversation.speak(event.event.text);
      }
    },
  },
  
  // Initialize connection
  onStart: async ({ state, transport }) => {
    // Connect to ElevenLabs
    state.conversation = await connectElevenLabs({
      agentId: "...",
      systemPrompt: buildSystemPrompt({
        workflowName: "Prayer Companion",
        personality: "encouraging",
        // Inject workflow state access
        getCurrentPhase: () => transport.getCurrentPhase(),
        getCurrentTask: () => transport.getCurrentTask(),
        getMonologues: () => state.workflowContext.recentMonologues,
      }),
    });
    
    // Listen to user voice input (INPUT)
    state.conversation.on("user_transcript", (text) => {
      // User: "How's it going?"
      // Agent consults workflow state and recent monologues
      // Agent responds naturally based on context
    });
  },
  
  // Cleanup
  onComplete: ({ state }) => {
    state.conversation.endSession();
  }
});
```

**Channel Types**:
- **Voice Channel** (`ElevenLabsChannel`) - Conversational voice interface
- **Console Channel** (`ConsoleChannel`) - Terminal output for developers
- **Web Channel** (`WebSocketChannel`) - Browser UIs with real-time updates
- **Database Channel** (`DatabaseChannel`) - Persistence and audit logging
- **Metrics Channel** (`MetricsChannel`) - Analytics and monitoring
- **Slack Channel** (`SlackChannel`) - Team notifications

**Key Properties**:
- **Bidirectional**: Can receive events AND send commands to workflow
- **Stateful or Stateless**: Voice/Web are stateful, Console/Database are stateless
- **Composable**: Attach multiple channels to same workflow
- **Event-driven**: Subscribe to specific event patterns

---

## Why "Open" Harness?

### 1. Provider-Agnostic

**Not locked to Anthropic**: Use any LLM provider without changing your workflow

```typescript
// Use Anthropic Claude
const workflow = MyWorkflow.create()
  .withAgents({ 
    planner: defineAnthropicAgent({ ... }) 
  });

// Switch to Google Gemini - same workflow!
const workflow = MyWorkflow.create()
  .withAgents({ 
    planner: defineGeminiAgent({ ... }) 
  });
```

### 2. Channel-Agnostic

**Interface is pluggable**: Voice, web, console - same workflow

```typescript
// Development: Console logging
await MyWorkflow.create()
  .attach(ConsoleChannel())
  .run();

// Production: Voice interface
await MyWorkflow.create()
  .attach(ElevenLabsChannel())
  .run();

// Production: Multi-channel
await MyWorkflow.create()
  .attach(ElevenLabsChannel())    // User interface
  .attach(DatabaseChannel())      // Persistence
  .attach(MetricsChannel())       // Analytics
  .run();
```

### 3. Extensible Primitives

**Build complex workflows from simple building blocks**:

```typescript
// Compose workflows
const AuthWorkflow = defineHarness({ ... });
const DataWorkflow = defineHarness({ ... });

const AppWorkflow = defineHarness({
  run: async ({ call }) => {
    const auth = await call(AuthWorkflow, { userId });
    const data = await call(DataWorkflow, { auth });
    return { auth, data };
  }
});
```

---

## Real-World Examples

### Example 1: The Call (Islamic Prayer Companion)

**The Challenge**: Build a voice-first AI companion that helps Muslim professionals organize their lives around prayer times.

**The Solution**: OpenHarness workflow with voice interface

![[projects/the-call/diagrams-channels.excalidraw]]

**Architecture**:
- **Prayer Companion Harness** orchestrates all agents
- **Voice Channel** (ElevenLabs) - User talks and hears responses
- **Console Channel** - Developer sees debug logs
- **Database Channel** - App stores prayer history and audit trail

**Multi-Channel Usage**:
```typescript
await PrayerCompanionHarness
  .create({ userId: "123" })
  .attach(ElevenLabsChannel())     // Voice conversation
  .attach(DatabaseChannel())        // Store prayer history
  .attach(PushNotificationChannel()) // Send reminders
  .run();
```

**User Experience**:
```
User: "When is Fajr tomorrow?"

Agent: [Checks location, calculates times]
       "Fajr tomorrow is at 5:23 AM. You have a 
        meeting at 8 AM, so you'll have plenty 
        of time. Should I set a reminder?"

User: "Yes please"

Agent: [Sets reminder]
       "Done! I'll remind you at 5:00 AM."
```

**What Makes This Powerful**:
- **Same workflow** powers voice app, mobile app, and web dashboard
- **Agent thinking** (monologues) gives the voice interface memory
- **Provider flexibility** - can switch from Anthropic to Gemini
- **Channel composition** - voice + database + notifications all at once

---

### Example 2: DevAgent (Spec-Driven Development)

**The Challenge**: Voice-controlled coding assistant that follows a structured spec → plan → code → review workflow.

**The Solution**: OpenHarness workflow integrated with existing dev tools

```
Developer speaks (ElevenLabs Channel)
        ↓
Dev Workflow Harness orchestrates:
  ├─ Spec Agent (create specification)
  ├─ Plan Agent (generate implementation plan)
  ├─ Code Agent (write code with tool access)
  └─ Review Agent (validate output)
        ↓
Developer hears progress + sees detailed logs
```

**Multi-Channel Usage**:
```typescript
await DevWorkflow
  .create({ feature: "JWT authentication" })
  .attach(ElevenLabsChannel())     // Voice updates
  .attach(ConsoleChannel())         // Detailed logs
  .attach(WebSocketChannel())       // Live IDE updates
  .run();
```

**User Experience**:
```
Dev: "Build JWT authentication with refresh tokens"

Agent: "Got it. I'm starting the spec phase..."
       [Internally: Running SpecAgent]
       
       "Spec complete! Moving to planning..."
       [Internally: Running PlanAgent]
       
       "I've identified 6 tasks. Starting implementation..."
       [Internally: Running CodeAgent with bash/file tools]
       
       "Task 1 complete - JWT signing utility built."
       "Task 2 complete - Refresh token storage..."

Dev: "Wait, how's the security on those tokens?"

Agent: [Checks recent monologues from CodeAgent]
       "I'm using HTTP-only cookies with SameSite strict,
        stored in Redis with 7-day TTL, rotating on each use.
        Following OWASP recommendations."

Dev: "Perfect, continue"

Agent: "Task 3 complete - Auth middleware..."
       [Continues through all tasks]
       
       "Implementation complete! Running review..."
       [Internally: Running ReviewAgent]
       
       "Review passed. All security checks look good."
```

**What Makes This Powerful**:
- **Voice-first workflow** - hands-free coding
- **Monologue memory** - agent remembers what it built
- **Tool access** - agents can write actual files, run tests
- **Multi-channel** - voice narration + console logs + IDE updates

---

### Example 3: TradingAgent (Market Analysis)

**The Challenge**: Real-time market analysis with voice alerts and dashboard updates.

**The Solution**: OpenHarness workflow with multiple output channels

```
Market data stream (Input)
        ↓
Trading Harness orchestrates:
  ├─ Market Analysis Agent (analyze trends)
  ├─ Risk Assessment Agent (evaluate risk)
  ├─ Strategy Agent (recommend trades)
  └─ Execution Agent (place orders via API)
        ↓
Multiple outputs simultaneously
```

**Multi-Channel Usage**:
```typescript
await TradingHarness
  .create({ portfolio: "..." })
  .attach(ElevenLabsChannel())     // Voice alerts
  .attach(WebSocketChannel())      // Dashboard updates
  .attach(DatabaseChannel())       // Audit log
  .attach(SlackChannel())          // Team notifications
  .run();
```

**User Experience**:
```
[Market volatility detected]

Agent (Voice): "Attention - detecting unusual volatility 
                in tech sector. Running analysis..."

Agent (Dashboard): [Real-time chart updates]

Agent (Voice): "Analysis complete. High risk detected.
                Recommending defensive position."

Trader (Voice): "What's the risk level?"

Agent: [Checks recent analysis monologue]
       "Risk score is 7.8 out of 10. Seeing correlation
        breakdown between usual hedges. Suggesting 
        reducing exposure by 30%."

Trader: "Execute recommendation"

Agent: [Execution Agent places orders]
       "Orders placed. Reduced exposure as recommended.
        Logging to audit trail."
```

**What Makes This Powerful**:
- **Multi-channel output** - voice + dashboard + database + Slack
- **Real-time responsiveness** - workflow reacts to market events
- **Audit trail** - database channel logs every decision
- **Voice + visual** - trader can multitask while monitoring

---

## Channel Showcase: Beyond Voice

While voice (ElevenLabs) is incredibly powerful, it's **just one channel**. OpenHarness supports many interface patterns:

### Console Channel (Development)
```typescript
ConsoleChannel()
// ┌─ Phase 1: Planning
// │  ├─ Task: Analyze requirements
// │  └─ ✓ Complete
// ├─ Phase 2: Coding
// │  ├─ Task 1: Build auth
// │  └─ ✓ Complete
// └─ 🎉 Workflow complete!
```

**Use for**: Development, debugging, CI/CD pipelines

---

### Database Channel (Persistence)
```typescript
DatabaseChannel({ 
  connection: postgres,
  tables: {
    events: "workflow_events",
    monologues: "agent_thinking",
  }
})
```

**Stores**:
- All workflow events
- Agent monologues (thinking history)
- Phase/task completion times
- Input/output data

**Use for**: Audit trails, analytics, debugging production issues

---

### WebSocket Channel (Real-Time UIs)
```typescript
WebSocketChannel({ 
  port: 3000,
  events: ["phase:*", "task:*", "narrative"]
})
```

**Enables**:
- Live progress updates in browser
- Real-time agent thinking display
- Interactive approvals during workflow
- Team collaboration on workflows

**Use for**: Web dashboards, mobile apps, team tools

---

### Metrics Channel (Observability)
```typescript
MetricsChannel({
  provider: "datadog",
  metrics: {
    phaseLatency: true,
    agentTokenUsage: true,
    errorRates: true,
  }
})
```

**Tracks**:
- Phase execution times
- Agent LLM token usage
- Error rates and retry counts
- Custom business metrics

**Use for**: Production monitoring, cost tracking, performance optimization

---

### Slack Channel (Team Notifications)
```typescript
SlackChannel({
  webhook: process.env.SLACK_WEBHOOK,
  channels: {
    success: "#deployments",
    errors: "#incidents",
  }
})
```

**Notifies team**:
- Workflow completions
- Critical errors
- Approval requests
- Important agent decisions

**Use for**: Team collaboration, incident response, async approvals

---

## The Power of Multi-Channel Composition

**The Key Insight**: One workflow, multiple interfaces running **simultaneously**

```typescript
await ProductionWorkflow
  .create(input)
  .attach(ElevenLabsChannel())      // User talks to workflow
  .attach(ConsoleChannel())          // Developers see logs
  .attach(DatabaseChannel())         // Audit trail persisted
  .attach(WebSocketChannel())        // Dashboard updates live
  .attach(MetricsChannel())          // Datadog gets metrics
  .attach(SlackChannel())            // Team notified on completion
  .run();
```

**What happens**:
- User interacts via **voice** (ElevenLabs)
- Developer monitors via **console** (detailed logs)
- App stores history in **database** (audit trail)
- Dashboard updates in **real-time** (WebSocket)
- Metrics flow to **Datadog** (observability)
- Team gets **Slack notification** on completion

**All from ONE workflow definition.**

---

## Architecture Deep-Dive

### How It All Works Together

![[diagrams/openharness-architecture.excalidraw]]

**Platform Layers**:
- **Application Layer**: Your apps (The Call, DevAgent, TradingAgent)
- **SDK Layer**: OpenHarness framework
  - **Harness**: Workflow orchestrator (phases, tasks, state)
  - **Agents**: LLM providers (Anthropic, Gemini, OpenAI, Custom)
  - **Channels**: Interface adapters (Voice, Console, Web, Database)
  - **Event Bus**: Unified event system for observability

### Request Flow

```
1. Application starts workflow
   workflow.create(input).attach(channels).run()
        ↓
2. Harness initializes
   - Creates state
   - Attaches channels
   - Emits harness:start event
        ↓
3. First phase begins
   - Emits phase:start event
   - Channels react (voice speaks, console logs, etc.)
        ↓
4. Harness calls agent
   agents.planner.execute({ goal })
        ↓
5. Agent executes LLM request
   - Uses tools (bash, file I/O) if needed
   - Emits agent:thinking events (monologue)
   - Returns typed result
        ↓
6. Channels receive events
   - Voice channel speaks progress
   - Console channel logs details
   - Database channel stores monologue
        ↓
7. Harness continues to next phase
   - Passes agent result to next agent
   - Emits phase:complete event
        ↓
8. Workflow completes
   - Emits harness:complete event
   - Channels cleanup (close connections)
   - Returns final result
```

### Event System

**Event Types**:
- `harness:start/complete` - Overall workflow
- `phase:start/complete` - Phase transitions
- `task:start/complete` - Individual tasks
- `agent:start/complete` - Agent execution
- `agent:thinking` - Agent internal reasoning
- `narrative` - LLM-generated summaries of agent work
- `session:prompt/reply` - Interactive user prompts

**Event Patterns**:
```typescript
// Specific event
on: { "phase:start": handler }

// Wildcard
on: { "task:*": handler }  // Matches task:start, task:complete, etc.

// Multiple patterns
on: { 
  "phase:*": handlerA,
  "agent:thinking": handlerB,
  "narrative": handlerC,
}
```

### Monologue System

**What it does**: Converts agent events into human-readable narratives

**How it works**:
1. Agent executes task, emits low-level events (tool calls, thinking, etc.)
2. Monologue system buffers these events
3. LLM generates first-person narrative: "I analyzed the code and found..."
4. System emits `narrative` event with the summary
5. Channels can subscribe to narratives for context

**Why it matters**: 
- Voice channels speak narratives instead of raw events
- Gives agents "memory" of what they did
- Makes debugging easier (readable thinking history)

---

## Why OpenHarness vs Alternatives

### vs Building from Scratch

| Concern | From Scratch | OpenHarness |
|---------|-------------|-------------|
| Workflow orchestration | Build custom state machine | `defineHarness()` |
| LLM provider switching | Rewrite integration layer | Change agent config |
| Voice interface | Integrate ElevenLabs SDK directly | `attach(ElevenLabsChannel)` |
| Web dashboard | Build separate app + API | `attach(WebSocketChannel)` |
| State management | Roll your own | Built-in with type safety |
| Error handling | Custom retry logic | Built-in retry/recovery |
| Testing | Build test infrastructure | Built-in replay system |
| Observability | Integrate metrics libraries | `attach(MetricsChannel)` |
| **Time to production** | **12-16 weeks** | **2-3 weeks** |

### vs LangChain

| Feature | LangChain | OpenHarness |
|---------|-----------|-------------|
| **Architecture** | Chain-based (linear) | Harness-based (orchestration) |
| **Provider Support** | Many providers | Provider-agnostic pattern |
| **Interface Pattern** | Output callbacks | Channel composition |
| **State Management** | Memory classes | Type-safe harness state |
| **Type Safety** | Partial TypeScript | Full TypeScript + Zod |
| **Code Clarity** | Spread across abstractions | One file workflow |
| **Production Ready** | Prototype-focused | Production-focused |

**When to use LangChain**: Rapid prototyping, exploring capabilities
**When to use OpenHarness**: Production applications, complex workflows, team projects

---

## Getting Started

### Installation

```bash
npm install @openharness/sdk @openharness/anthropic
```

### Your First Workflow

```typescript
import { defineHarness } from "@openharness/sdk";
import { defineAnthropicAgent, createPromptTemplate } from "@openharness/anthropic";
import { ConsoleChannel } from "@openharness/sdk/channels";
import { z } from "zod";

// Define a simple agent
const GreeterAgent = defineAnthropicAgent({
  name: "Greeter",
  prompt: createPromptTemplate("Say hello to {{name}}!"),
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ greeting: z.string() }),
});

// Define a simple workflow
const GreetingWorkflow = defineHarness({
  name: "greeting",
  agents: { greeter: GreeterAgent },
  
  run: async ({ agents }) => {
    const result = await agents.greeter.execute({ name: "World" });
    return result;
  }
});

// Run it
const result = await GreetingWorkflow
  .create()
  .attach(ConsoleChannel())
  .run();

console.log(result.greeting); // "Hello, World!"
```

### Next Steps

- **[Examples](/examples)** - See complete working examples (The Call, DevAgent, TradingAgent)
- **[How It Works](/docs/how-it-works.md)** - Deep dive into architecture
- **[API Reference](/docs/api)** - Complete API documentation
- **[Contributing](/CONTRIBUTING.md)** - Join the community

---

## Philosophy

**Simplicity scales.**

OpenHarness is built on the principle that:
- **Simple to read** → Easier to understand what AI wrote for you
- **Simple to extend** → Anyone can write a channel or agent
- **Simple to compose** → Complex workflows from simple primitives
- **Simple to test** → Built-in replay and mocking

**The code you read should be as clear as the idea you started with.**

---

## Community & Support

- **GitHub**: [openharness/openharness](https://github.com/openharness/openharness)
- **Discord**: [Join our community](https://discord.gg/openharness)
- **Docs**: [docs.openharness.dev](https://docs.openharness.dev)
- **Examples**: [github.com/openharness/examples](https://github.com/openharness/examples)

---

## License

MIT - see [LICENSE](LICENSE) for details

---

*Build production-grade AI agents with clean architecture. One workflow, any interface, any provider.*
