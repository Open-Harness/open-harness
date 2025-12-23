# Open Harness Vision Document

**Step-Aware Autonomous Agents**

**Author:** Abdullah  
**Date:** December 24, 2025  
**Version:** 2.1  

---

## I. Vision Statement

Open Harness is building step-aware autonomous agents that work in out-of-loop mode for extended time periods.

We envision a world where creating autonomous AI agents is simple—where developers build time-aware systems using composable primitives, and users configure them via YAML. Where AI isn't just responding to prompts—it's taking steps toward goals, knowing where it is in time, with persistent state across those steps.

**Our Mission:** Make step-by-step autonomous agents buildable for any domain—trading, coding, research, monitoring, whatever you need.

**Our Platform:** Opinionated primitives (Harness, Agent, Step, State) that you compose powerfully. Not complex graphs. Not black boxes. Simple Lego building blocks that enable sophisticated autonomous behavior.

**Our Future:** A platform where agents are time-aware, transparent, and composable for any use case.

---

## II. The Problem We Solve

### Out-Of-Loop Agents Exist, But...

Autonomous AI agents already exist. Cursor background agents. OpenAI Canvas. Anthropic artifacts. Google Gems. Augment Code.

They work. They execute tasks autonomously while you do other things. That's **out-of-loop** execution—you give a goal, agent works, returns when done.

**But they have limitations:**

**1. Black Box Opacity**
You can't see what the agent is doing. It just says "working..." and eventually shows you results. No transparency into results. No audit log. No way to understand *why* it made choices.

**2. Domain-Specific**
Cursor background agents are great for coding. OpenAI Canvas works for documents. But try using Cursor for trading—impossible. Each tool is locked to one domain.

**3. No Time Awareness**
The agent doesn't know it's in a temporal loop. Each session feels like a fresh conversation. The agent doesn't plan for steps ahead. It just reacts to the current prompt.

**4. No Persistent State**
State exists only during execution. Stop the agent, restart it—state is lost. No checkpoint recovery. No resumption from where it left off.

**5. Hard to Customize**
Patterns are locked. You get what the platform gives you. Can't add tools. Can't change behavior. Can't adapt to your needs.

### What If You Had...

A **general-purpose** framework for building out-of-loop agents that's:
- **Time-aware:** Agent knows it's at step 7 of 100, planning for steps 8-15
- **Transparent:** See every step, every action/result, in a readable log
- **Domain-agnostic:** Build for trading, coding, research—anything
- **Stateful:** Persistent semantic memory that survives step boundaries
- **Composable:** Primitives you can mix and match

**That's Open Harness.**

---

## III. The Harness Pattern

### What Is a Harness?

A **harness** is code that defines state, behavior, and constraints of a system such that it can act within a defined space.

It adds **time dimensionality** to agents. Instead of "prompting repeatedly," you give agents awareness that they're iterating through **steps**—knowing what came before, planning what comes next.

### The Four Primitives

#### 1. HARNESS

The system around the context window that gives agents time dimensionality.

```typescript
class Harness<AgentState, StepInput, StepOutput> {
  // The agent that runs
  private agent: Agent<AgentState, StepInput, StepOutput>;

  // Persistent state across steps
  private state: PersistentState<AgentState>;

  // History of all steps
  private stepHistory: Step<AgentState, StepInput, StepOutput>[];

  // Current step number
  private currentStep: number = 0;

  /**
   * The CORE METHOD: Take one step
   * Flexible cadence - YOU control when to call this!
   */
  async step(input: StepInput): Promise<StepOutput> {
    this.currentStep++;

    // Load relevant context (not full history)
    const context = this.state.loadContext(input);

    // Agent runs WITH step awareness (runs have side effects)
    const result = await this.agent.run({
      input,
      context,
      stepNumber: this.currentStep,      // CRITICAL: Time awareness
      stepHistory: this.state.getRecentSteps(10),
      constraints: this.constraints
    });

    // Persist this step (record the result)
    this.state.record(this.currentStep, result);

    return result;
  }
}
```

#### 2. AGENT

A step-aware runner that knows:
- What step it's on
- What happened in previous steps
- What constraints it's working within
- When it's complete

```typescript
class Agent<AgentState, StepInput, StepOutput> {
  async run(params: {
    input: StepInput;
    context: AgentState;
    stepNumber: number;
    stepHistory: Step[];
    constraints: Constraints;
  }): Promise<StepOutput> {
    // Agent runs (with side effects: write file, call API, execute trade)
    // Agent can now say:
    // "I'm at step 7, based on step 5's result..."
    // "Planning for steps 8-10..."
    // "The last 3 runs failed, I'll try a different approach..."
  }

  isComplete(state: AgentState): boolean {
    // Define when agent is done
    // Trading: Never complete (runs forever)
    // Coding: All tickets done
  }
}
  
  isComplete(state: AgentState): boolean {
    // Define when the agent is done
    // Trading: Never complete (runs forever)
    // Coding: All tickets done
  }
}
```

#### 3. STEP

A single execution point in time—the fundamental unit of execution.

```typescript
interface Step<AgentState, StepInput, StepOutput> {
  stepNumber: number;
  timestamp: number;
  input: StepInput;
  output: StepOutput;
  stateDelta: StateDelta;  // What changed this step
}
```

**Examples of Steps:**
- **Trading Agent:** Every market data update (every 5 seconds)
- **Coding Agent:** Every subtask completion (write test, run test, fix bug)
- **Monitoring Agent:** Every scheduled check (every hour)
- **Research Agent:** Every information processing step (read paper, extract insights)

#### 4. STATE

Persistent semantic memory that survives step boundaries. Not chat history—semantic state.

```typescript
interface PersistentState<AgentState> {
  // Goal we're working toward (persists across steps)
  goal: Goal;

  // Progress toward goal
  progress: Progress;

  // Actions/results made (for audit/review)
  actionLog: ActionLog;

  // Knowledge accumulated (not raw history)
  knowledge: KnowledgeGraph;

  // Load relevant context for THIS step
  loadContext(stepInput: StepInput): Context {
    return {
      goal: this.goal,
      recentActions: this.getRecentActions(10),
      relevantKnowledge: this.knowledge.query(stepInput)
    };
  }
}
```

---

## IV. Layered Architecture

### Two Layers, Clear Separation

Open Harness uses a **layered architecture** that separates user-facing primitives from internal infrastructure:

```
┌─────────────────────────────────────────────────────────┐
│ EXTERNAL API (NEW - User-Facing)                        │
├─────────────────────────────────────────────────────────┤
│  • createHarness() factory                               │
│  • Agent.run() method                                    │
│  • Harness class                                         │
│  • Step, State primitives                                │
│  • Simple, time-aware, composable                        │
└─────────────────────────────────────────────────────────┘
                          ↓ wraps
┌─────────────────────────────────────────────────────────┐
│ INTERNAL API (EXISTING - Infrastructure)                │
├─────────────────────────────────────────────────────────┤
│  • BaseAgent.run() method                                │
│  • TaskList class                                        │
│  • StreamCallbacks                                       │
│  • DI container                                          │
│  • IAgentRunner interface                                │
│  • Complex, working, unchanged                          │
└─────────────────────────────────────────────────────────┘
```

### How It Works

**EXTERNAL → INTERNAL Mapping:**

| External API | Internal API | Purpose |
|--------------|--------------|---------|
| `Harness.step()` | `BaseAgent.run()` | Execute one step |
| `Agent.run()` | `BaseAgent.run()` | Run agent with step context |
| `PersistentState` | `TaskList` | State management |
| `StreamCallbacks` | `StreamCallbacks` | Event system (same!) |

**Key Principle:** External simplicity wraps internal complexity. Reuse what works, expose what users need.

### Why Two Layers?

**INTERNAL API** (Existing Code):
- Already battle-tested in production
- Complex infrastructure (DI, events, streaming)
- Not user-friendly for simple use cases
- **Keep unchanged** - it works!

**EXTERNAL API** (New Layer):
- Simple, opinionated primitives
- Time-aware from the start
- Designed for out-of-loop agents
- **Mirror internal patterns** where sensible

Example: `Harness.step()` internally calls `BaseAgent.run()`, but adds:
- Step number tracking
- Step history management
- Context loading (not full history)
- Result persistence

Same underlying power, cleaner interface.

---

## V. Time Awareness: The Key Differentiator

### Without Harness vs. With Harness

**Traditional Pattern:**
```
Agent: "I don't know time"
Prompt: "What should I do?"
Response: "Here's what I'll do..."

[Next prompt - agent thinks fresh conversation]
Agent: "What do you want?"
```

**Harness Pattern:**
```
Agent: "I'm at step 7 of 100"
       "Based on step 5's result, I should..."
       "Planning for steps 8-12..."
       "The last 3 actions failed, adjusting strategy..."
       "Working toward goal from step 0"
```

### What Time Awareness Enables

**1. Planning, Not Just Reacting**
Agent doesn't just respond to current input—it plans for future steps.

**2. Learning Across Steps**
Agent remembers what worked, what didn't, and adapts strategy.

**3. Coherent Goal Pursuit**
Agent knows it's working toward a goal established at step 0, maintaining coherence.

**4. Auditability**
Every step is logged with reasoning, inputs, outputs. See exactly *why* agent made choices.

### Flexible Cadence: You Control When

The harness doesn't decide when to step—**you do**.

**Time-Based (Trading):**
```typescript
// Step every 5 seconds
setInterval(async () => {
  const marketUpdate = await getMarketData();
  await harness.step(marketUpdate);
}, 5000);
```

**Event-Based (Monitoring):**
```typescript
// Step when condition met
market.on('rsi-threshold-hit', async (data) => {
  await harness.step(data);
});
```

**Task-Completion-Based (Coding):**
```typescript
// Step after subtask completes
while (!harness.isComplete()) {
  const ticket = getNextTicket();
  await implementTicket(ticket);
  
  await harness.step({ ticket, status: 'complete' });
}
```

**This is the Django/Rails philosophy:** Give you simple primitives. You compose them however fits your use case. Not complex DAGs. Not rigid workflows. Just `harness.step()`—called however you want.

---

## VI. In-Loop vs. Out-Loop

### The Key Difference: Feedback Loop Presence

The distinction is **not** about whether the agent works in the background—it's about whether there's a conversation/feedback loop while execution happens.

### In-Loop (Feedback Loop Active)

User is in a **feedback loop** with the agent—even if the agent works independently for minutes making tool calls, the user eventually gets results back and can respond.

```
You: "Help me think through this problem"
[Agent analyzes, makes several tool calls over 2 minutes]
Agent: "Here's my analysis with 3 possible solutions..."
You: "Good point, what about approach X?"
[Agent thinks, runs more tools]
Agent: "Approach X is viable because..."
```

**Characteristics:**
- **Conversational feedback loop** exists
- User receives results, can respond, agent replies
- Agent may work independently temporarily, but loop remains open
- User is "in the conversation" even if not actively prompting

**Examples:**
- Claude Desktop (even with background work, you get results back)
- Cursor (background agents return results you can act on)
- V0 (coding assistant with iterative feedback)
- Any chat-based AI tool

### Out-Of-Loop (No Feedback Loop)

User **sets up, leaves, returns to result**. No conversation happens during execution. No feedback loop exists while running.

```
You: "Implement this feature and run all tests"
[You go do other things]
[Hours/days pass - agent works autonomously]
[No conversation happens during execution]
[Agent logs to file, but no feedback to you]
[You return later]
You: "Check status..." (new conversation, separate session)
System: "Feature implemented, all tests passed"
```

**Characteristics:**
- **No feedback loop** during execution
- User is not "in the conversation" while agent runs
- Execution happens autonomously without user involvement
- User starts a separate conversation to check status/results

**Examples:**
- Cron jobs (run on schedule, you check logs later)
- 24/7 trading bots (run continuously, you check results weekly)
- Autonomous research agents (run overnight, you review findings next day)
- Scheduled CI/CD pipelines (run on triggers, you check results later)

### Why "Out-Of-Loop" Matters

Both modes exist and are useful:

| Mode | Best For | User Experience |
|------|----------|-----------------|
| **In-Loop** | Iterative work, debugging, brainstorming | Conversational, interactive |
| **Out-Of-Loop** | Long-running tasks, monitoring, automation | Fire-and-forget, scheduled |

**Open Harness targets OUT-OF-LOOP**—agents that run autonomously for extended periods (hours, days, weeks) without user interaction.

**Existing Out-Of-Loop Tools:**
- Cursor background agents (work on background task, return results)
- OpenAI Canvas (edit autonomously, you check later)
- Anthropic artifacts (generate independently)
- Google Gems (run tasks in background)
- Augment Code (autonomous code generation)

**What Open Harness Does Differently:**

| Dimension | Current Tools | Open Harness |
|-----------|---------------|--------------|
| **Scope** | Domain-specific (coding, documents) | General-purpose (any domain) |
| **Time Awareness** | None (just "working...") | **Step-aware, planning horizons** |
| **State** | Ephemeral (lost on restart) | **Persistent semantic state** |
| **Visibility** | Black box | **Transparent (every step logged)** |
| **Customization** | Locked patterns | **Unlimited (composable primitives)** |
| **Philosophy** | "We figure it out" | "You have control via simple primitives" |

---

## VII. What We're Shipping: v1.0

Open Harness v1.0 is production-ready today for local autonomous agents with time awareness.

### Core Platform

**1. SDK (TypeScript/Bun Primitives)**

Four core building blocks:

```typescript
import { Harness, Agent, PersistentState } from '@openharness/sdk';

// Define your state schema
interface TradingState {
  portfolio: Portfolio;
  marketData: MarketData;
  position: Position | null;
}

// Create agent
const trader = new Agent<TradingState, MarketUpdate, TradeResult>({
  async run({ input, context, stepNumber, stepHistory }) {
    console.log(`Step ${stepNumber}: ${input.indicators.rsi}`);

    const rsi = input.indicators.rsi;
    const lastResult = stepHistory[stepHistory.length - 1]?.output;

    if (rsi < 30 && !lastResult?.buy) {
      return { action: 'BUY', amount: 0.1 };
    }
    if (rsi > 70 && lastResult?.buy) {
      return { action: 'SELL', amount: 0.1 };
    }

    return { action: 'HOLD' };
  },

  isComplete(state: TradingState) {
    // Trading never completes
    return false;
  }
});

// Wrap in harness
const harness = new Harness({
  agent: trader,
  initialState: {
    portfolio: { balance: 10000, btc: 0 },
    marketData: {},
    position: null
  },
  constraints: { maxDrawdown: 0.1, maxPositions: 1 }
});

// Run with flexible cadence
setInterval(async () => {
  const marketUpdate = await getMarketData();
  await harness.step(marketUpdate);
}, 5000);
```

**2. CLI Harness Runner (Local Execution)**

```bash
npm install -g @openharness/cli

# Run a harness
harness run ./trading-harness.yaml

# Monitor progress
harness status session_abc123

# View step history (actions/results)
harness history session_abc123
```

**3. YAML Configuration System**

Declarative harness definitions:

```yaml
harness:
  name: "momentum-trading-agent"
  stepStrategy: time-based  # OR: event-based, task-completion
  stepInterval: 5000  # 5 seconds
  
agent:
  type: custom
  model: claude-3-7-sonnet-20250219
  prompt: |
    You are a trading agent executing momentum strategies.
    Buy when RSI < 30, sell when RSI > 70.
    Risk level: {{RISK_LEVEL}}
  tools:
    - market-data-mcp
    - portfolio-manager
  
state:
  portfolio:
    balance: 10000
    btc: 0
  marketData: {}
  position: null
  
constraints:
  maxDrawdown: 0.1
  maxPositions: 1
```

### Flagship Examples

#### Example 1: Coding Agent (Ticket-Based)

**Characteristics:**
- Time Dimensionality: Task-completion based
- Cadence: Steps after subtasks complete
- State Model: Simple (current ticket, tickets progress, test results)

**Usage:**
```typescript
interface CodingState {
  currentTicket: string;
  ticketsProgress: Record<string, boolean>;
  tests: TestResults;
}

const coder = new Agent<CodingState, Ticket, CodingOutput>({...});
const harness = new Harness({ agent: coder, initialState: {...} });

while (!harness.isComplete()) {
  const ticket = getNextTicket();
  await implementTicket(ticket);
  await harness.step({ ticket, status: 'complete' });
}
```

#### Example 2: Trading Agent (Time-Based)

**Characteristics:**
- Time Dimensionality: Time-based (rigid)
- Cadence: Steps every N seconds or when condition met
- State Model: Complex (portfolio, market data, trade history, strategy state)

**Usage:**
```typescript
interface TradingState {
  portfolio: Portfolio;
  marketData: MarketData;
  tradeHistory: Trade[];
}

const trader = new Agent<TradingState, MarketUpdate, TradeResult>({...});
const harness = new Harness({ agent: trader, initialState: {...} });

setInterval(async () => {
  const marketData = await getMarketData();
  await harness.step(marketData);
}, 5000);
```

### Zero-Friction Onboarding: Anthropic Skills

**Skill for conversational harness creation:**

```
User: "Help me create a trading agent"
Claude (via Skill): "Great! I'll help you configure one. 
  What's your trading strategy?"
User: "Buy when RSI < 30, sell when RSI > 70"
Claude: "Risk level? (conservative/moderate/aggressive)"
User: "Moderate"
Claude: "Generating harness config..."
[Creates trading-harness.yaml]
Claude: "Done! Run it with: harness run ./trading-harness.yaml"
```

---

## VIII. Why Anthropic? Why Now?

### The Anthropic Advantage

**1. MCP (Model Context Protocol)**
- Standardized tool integration
- Plug-and-play external systems
- Growing ecosystem of MCP servers

**2. Skills Marketplace**
- Distribution built-in
- Conversational interfaces
- Non-coder accessibility

**3. Agent SDK**
- Native support for agent patterns
- Streaming, tool use, state management
- Built for autonomy

**4. Claude's Reasoning**
- Best-in-class for complex decision-making
- Extended thinking mode for hard problems
- Reliable tool use

### Multi-Provider Future

Could we support OpenRouter, Ollama, others? **Yes—and we will.**

But we started with Anthropic because they're building agent infrastructure fastest. Open Harness abstracts the agent runtime—adding new providers is an adapter implementation, not architectural overhaul.

---

## IX. The Roadmap

### v1.0 (Now) - Foundation

- ✅ SDK with generics: `Harness<S, I, O>`
- ✅ Four primitives: Harness, Agent, Step, State
- ✅ CLI runner
- ✅ YAML configuration
- ✅ Two examples (Coding, Trading)
- ✅ Anthropic Skills for onboarding
- ✅ Local execution

### v1.1 (3-6mo) - Community

- 🎯 Harness generators: `harness generate trading-bot`
- 🎯 Harness gallery (searchable library)
- 🎯 10+ community harnesses
- 🎯 Enhanced Skills

### v2.0 (6-12mo) - Cloud

- 🎯 E2B cloud sandboxes
- 🎯 Hosted dashboard
- 🎯 Freemium model

### v3.0+ - Platform

- 🎯 Harness marketplace
- 🎯 Multi-provider support
- 🎯 Enterprise features

---

## X. What Open Harness IS (and ISN'T)

### What Open Harness IS

✅ **A framework for step-aware autonomous agents**  
Built for agents that know time, plan ahead, persist state across steps.

✅ **Four primitives: Harness, Agent, Step, State**  
Simple, composable Lego blocks you combine powerfully.

✅ **General-purpose**  
Build for any domain—trading, coding, research, monitoring.

✅ **Time-aware**  
Agents know step number, step history, planning horizon.

✅ **Transparent**  
See every step, every decision, logged and readable.

✅ **Built on Anthropic stack**  
MCP, Skills, Agent SDK—betting on fastest-moving platform.

✅ **Production-ready (locally)**  
SDK, CLI, examples work NOW.

✅ **Django/Rails philosophy**  
Opinionated primitives, not infinitely flexible. Simple tools you compose.

### What Open Harness ISN'T

❌ **NOT a chatbot framework**  
Use Vercel AI SDK for chat. We're for out-of-loop autonomous agents.

❌ **NOT replacing Anthropic SDK**  
We wrap it, extend it, add time awareness.

❌ **NOT in-loop**  
We don't do conversational, human-in-the-loop execution.

❌ **NOT a workflow engine**  
No graphs, no DAGs. Just `harness.step()`—you control cadence.

❌ **NOT a no-code platform (yet)**  
Skills help onboarding, but you still use CLI/code.

❌ **NOT cloud-hosted yet**  
v1.0 is local. Cloud comes in v2.0.

---

## XI. The Philosophy

### Django/Rails, Not LangChain

**The Problem with LangChain:**
- Infinite flexibility
- Thousands of abstractions
- Complex graphs, chains, agents...
- Steep learning curve
- Over-engineered for most use cases

**The Django/Rails Approach:**
- Few, opinionated primitives
- Simple, composable
- Productive from day one
- Convention over configuration

**Open Harness Philosophy:**

Give you 4 primitives:
1. **Harness** - Step-aware execution system
2. **Agent** - Runner (takes actions, returns results)
3. **Step** - Time slice
4. **State** - Persistent memory

Wrap tools (MCPs, CLIs, libraries). Give autonomy to the model. Tune prompts. That's it.

From that simple foundation, build powerful agents:

```typescript
// Trading: Wrap CCXT CLI, give model autonomy
const tradingHarness = new Harness({
  agent: tradingAgent,
  initialState: portfolio
});

// Coding: Wrap tools, give model autonomy
const codingHarness = new Harness({
  agent: coder,
  initialState: tickets
});

// Monitoring: Wrap APIs, give model autonomy
const monitorHarness = new Harness({
  agent: monitor,
  initialState: metrics
});
```

**Same pattern. Different tools. Any domain.**

### Delegate to the Model

We don't orchestrate everything. We give the model:
- Tools (MCPs, CLIs, libraries)
- State (persistent memory)
- Time awareness (step number, step history)
- Constraints (bounds of decision space)

The model figures out the rest.

**Minimal primitives. Maximum model autonomy.**

---

## XII. Target Use Cases

### Software Engineering

**Pattern:** Task-completion steps across tickets

**Why Harness:**
- State persists across coding sessions
- Test-fix loops become step iterations
- Checkpoint recovery from failed tests
- Progress tracking across 200+ tickets

**Target:** Engineering teams, solo devs, dev agencies

### Trading & Finance

**Pattern:** Time-based steps with complex state

**Why Harness:**
- Runs continuously (24/7)
- Time-aware decisions (knows history)
- Complex state management (portfolio, trades, strategy)
- Transparent audit log

**Target:** Retail traders, hedge funds, quant teams

### Research & Analysis

**Pattern:** Information processing steps

**Why Harness:**
- Knowledge accumulation across steps
- Checkpoint when insights emerge
- Synthesize findings at completion
- Persistent research state

**Target:** Analysts, researchers, consultants

### Monitoring & Alerts

**Pattern:** Event-based steps

**Why Harness:**
- Step when conditions met
- Alert history persists
- Stateful monitoring patterns
- Flexible cadence (time OR event)

**Target:** DevOps, SREs, operations teams

---

## XIII. Call to Action

**Step-aware autonomous agents. Time dimensionality. Persistent state. General-purpose. Simple primitives.**

Open Harness makes this buildable today.

### For Developers

```typescript
npm install @openharness/sdk

// Define state
interface MyState { ... }

// Create agent
const agent = new Agent<MyState, Input, Output>({...});

// Wrap in harness
const harness = new Harness({ agent, initialState: {...} });

// Step however fits your use case
await harness.step(input);
```

### For Everyone Else

Install our Anthropic Skill. Describe what you want. We'll generate the harness config. Run it with CLI.

```
Install "Open Harness" skill → Chat with Claude → Harness running
```

---

## **Step-Aware. Time-Dimensional. Simple Primitives.**

**What will you build?**

---

**Repository:** https://github.com/yourusername/open-harness  
**Documentation:** https://docs.openharness.dev  
**Skills Marketplace:** Coming soon  
**Community:** Discord, GitHub Discussions  

---

*Open Harness is open-source software. Licensed under MIT.*
