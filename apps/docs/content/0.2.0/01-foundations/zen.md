# Zen of Open Harness

**Purpose:** Mental model for building agentic systems in the new paradigm  
**Status:** Complete (Phase 1)  
**Last Updated:** 2026-01-07

---

## What This Is

The Zen of Open Harness is not about implementation details. It's not about YAML syntax, workflow engines, or SDKs.

It's about **how to think** when you're building agentic systems.

When you understand this, you can build anything.

---

## The Core Pattern

Everything in Open Harness flows from one pattern:

```
Skills (what you know) + Scripts (what you use) + Evals (how you improve)
= Expert Agentic System
```

**Skills**: Your domain expertise, encoded for agents to use  
**Scripts**: Your tools and libraries, wrapped for universal access  
**Evals**: Your quality criteria, tracked automatically so you get better

When you combine these, you get:

- Agent with expert capabilities (via skills)
- Access to ANY behavior (via scripts)
- Automatic improvement (via evals)
- Production-grade reliability (via framework)

---

## State Is The Substrate

Skills, scripts, and evals are *portable assets*.

**State is your system.** It’s what must persist across time:

- Prior analyses and decisions
- Positions / orders / artifacts
- Context that evolves (time, history, “what happened before”)
- Human-in-the-loop checkpoints (pause → review → resume)

Open Harness is opinionated about this: **the harness owns and manages state** while your workflow runs.

---

## How to Think in This Paradigm

### The Mental Shift

**Before (Old Paradigm):**

- "I need to learn Agent SDK APIs"
- "I need to write agent orchestration code"
- "I need to build glue from scratch"
- "I hope this prompt change helps" (no way to know)

**After (Open Harness):**

- "I create a skill for what I already know"
- "I wrap scripts for tools I already use"
- "I define evals for what 'better' means"
- "Framework orchestrates, I define the system"

### What Changes

**Your job shifts from:**

- Writing complex agent code → **Defining skills and rules**
- Learning SDK details → **Using tools you already know**
- Guessing if improvements help → **Evals tell you automatically**
- Building systems from scratch → **Composing skills + scripts + evals**

**The framework's job:**

- Execute workflows
- Stream events
- Manage state
- Record for evals
- Retry, timeout, scale to production

**Your job:**

- Create skills (prompt + rules + scripts)
- Define evals (what "better" means)
- Iterate based on data

---

## Pattern Recognition

When you build agentic systems in Open Harness, you'll see these patterns everywhere:

### 1. Skills Are Domain Expertise, Not Code

<>
A skill is NOT "how to write an agent."  
A skill IS "what the agent should know about your domain."

**Example - Trading Analyst Skill:**

```yaml
name: trading-analyst
systemPrompt: "You are a trading analyst. Analyze RSI, MACD, volume patterns."
```

- You don't write agent code
- You encode your trading knowledge
- The agent uses it

### 2. Scripts Are Universal Access, Not Tool Development

Scripts are NOT "building a new tool."  
Scripts ARE "wrapping libraries you already use so agents can call them."

**Example - CCXT Wrapper Script:**

```python
# fetch_candles.py
import ccxt

def fetch_candles(symbol='BTC/USDT'):
    exchange = ccxt.binance()
    return exchange.fetch_ohlcv(symbol, timeframe='1h')

if __name__ == '__main__':
    print(fetch_candles())
```

- You already use CCXT
- You wrap it in a simple script
- Agent calls it via bash
- Result: Universal access to ANY library

### 3. Evals Are Data, Not Subjective

Evals are NOT "I think this is better."  
Evals ARE "comparing recordings to see if this is actually better."

**Example - Before and After:**

```
Run 1: Trading analyst with prompt A
  - Recording saved: trading-run-001.json
  - Eval score: 65/100 (missed opportunities)

Run 2: Trading analyst with prompt B
  - Recording saved: trading-run-002.json
  - Eval score: 78/100 (+13 points, objectively better)
  - Result: Prompt B IS better (data proves it)
```

- You don't guess
- You compare
- Evals tell you

### 4. Bash Optimization = Universal Access

The shell tool in agent SDKs gives agents access to everything in the execution environment.

**What this means:**

- Agents can call ANY Python script
- Agents can call ANY TypeScript script
- Agents can use ANY CLI tool (kubectl, docker, aws, terraform)
- Agents can use ANY library (pandas, numpy, CCXT, Web3.py)

**The pattern:**

1. You create a script that does what you want (wrap a library)
2. You expose it via the shell tool (e.g. bash)
3. You add it to a skill (agent knows when/how to use it)
4. Agent executes via the shell tool (universal access)

**Result:**

- Agent (zero knowledge of the domain) → Expert-level capability
- You (zero knowledge of agent building) → Production agentic system

### 5. Stateful Workflows, Not Stateless Runs

The harness executes workflows as systems that evolve over time: they have memory, they can pause, and they can resume.

**What this means:**

- Your custom state persists across steps (your system’s memory)
- Pause/resume is a first-class part of building real workflows
- You build systems with history, not one-off prompts

### Stateful Workflows vs Stateful Agents

There are two kinds of “state” to keep distinct:

- **Workflow state**: your custom state (positions, prior analysis, decisions, artifacts)
- **Agent session state**: provider-managed conversation continuity (e.g. `sessionId`)

**The pattern:**

```yaml
nodes:
  - id: trader
    type: claude.agent
    input:
      messages: ["Analyze BTC chart"]
      sessionId: "{{ state.resumeSessionId }}"
```

- SDK maintains history (not your job)
- Resume is simple (sessionId + new prompt)
- Stateful agents = better context, fewer tokens

---

## Composition

You compose agentic systems by combining:

### Skills + Scripts

- Skill defines PROMPT + RULES
- Scripts define CAPABILITIES
- Together = Domain agent

### Skills + Evals

- Skill defines SYSTEM
- Evals define SUCCESS
- Together = System that improves automatically

### Skills + Scripts + Evals + Workflows

- Skills = Domain expertise
- Scripts = Universal access
- Evals = Automatic improvement
- Workflow = Orchestration (nodes, edges, state, events)
- Together = Production agentic system

**Example - Trading System:**

```
Skill: Trading Analyst (prompt + rules + CCXT scripts)
  ↓
Skill: Risk Manager (prompt + rules + position sizing scripts)
  ↓
Workflow: Execute analysis → Check risk → Place trade → Record → Eval
  ↓
Result: Automated trading system that improves every run
```

---

## The React Moment

In the early days of React, developers had to learn a new way of thinking.

**The shift:**

- Before: "Imperative DOM manipulation" (jQuery style)
- After: "Declarative component composition" (React style)

**The challenge:**

- JSX was unconventional (HTML in JavaScript)
- Components were a new mental model
- State management was confusing
- But: It was beautiful. It was powerful.

**The result:**
React changed how everyone builds UI forever.

### Open Harness Is React for Agentic Systems

**The shift:**

- Before: "Imperative agent orchestration" (write code)
- After: "Declarative workflow composition" (define in YAML)

**The challenge:**

- Workflows are a new mental model
- Skills pattern is different from "just write code"
- Evals replace "I think it's better" with data
- But: It will be beautiful. It will be powerful.

**The result:**
Open Harness will change how everyone builds agentic systems forever.

---

## How This Changes Building

### Before: Expert Systems Were Hard

**To build an expert system, you needed:**

- Deep domain knowledge (10+ years)
- Agent SDK expertise (Claude, OpenAI APIs)
- System architecture skills
- Testing/evaluation expertise
- Integration skills
- YEARS of development time

**Result:** Very few people could do it.

### After: Expert Systems Are Easy

**To build an expert system, you need:**

- Your domain knowledge (what you already know)
- A library you already use (CCXT, pandas, terraform)
- Open Harness (framework)
- DAYS of development time

**Result:** Anyone can do it.

---

## The Mental Model

### When Building with Open Harness

**Ask yourself:**

1. "What do I already know?" → Encode as **skill**
2. "What tools do I already use?" → Wrap as **script**
3. "What does 'better' mean?" → Define as **eval**
4. "How should this work?" → Define as **workflow**
5. "What must persist over time?" → Define **state**
6. "Where do humans intervene?" → Define **pause/resume points**

**Don't ask:**

- ❌ "How do I write agent code?" (Framework does this)
- ❌ "How do I integrate SDKs?" (Providers do this)
- ❌ "Is this prompt better?" (Evals tell you)
- ❌ "How do I test this?" (Recording + replay)

### The Flow

```
1. You Define Skill
   • Prompt (what agent knows)
   • Scripts (what agent can do)
   • Rules (what agent must do)
   
2. You Define Evals
   • Assertions (what must be true)
   • Scorers (how to measure quality)
   
3. You Define Workflow
   • Nodes (what runs)
   • Edges (what connects)
   • Bindings (what flows)
   
4. Framework Executes
   • Runs workflow
   • Streams events (full visibility)
   • Records everything (for evals)
   
5. Evals Improve
   • Compare recordings
   • Measure changes
   • Data-driven iteration
   
6. System Gets Better
   • Automatically
   • Without guesswork
```

---

## What This Is Not

**Zen of Open Harness is NOT:**

- ❌ A tutorial on YAML syntax
- ❌ A guide to Agent SDK APIs
- ❌ A comparison to other frameworks
- ❌ About "non-expert empowerment" (you ARE an expert in your domain)
- ❌ About "coding agents are amazing" (hype, not real)

**Zen of Open Harness IS:**

- ✅ A mental model for building agentic systems
- ✅ A pattern for composing skills + scripts + evals
- ✅ A way to leverage what you already know
- ✅ A path from "I know something" to "I have an expert system"
- ✅ The React moment for agentic development

---

## The Result

When you understand the Zen of Open Harness, you realize:

**Your job:**

- Create skills (what you know)
- Create scripts (what you use)
- Define evals (what "better" means)

**Framework's job:**

- Provide agents (stateful, capable)
- Execute workflows (orchestration, state, events)
- Record everything (for evals)
- Scale to production (retries, timeout, observability)

**Together:**

- You build expert systems (in days, not years)
- System improves automatically (via evals)
- You get better (data, not guesswork)
- Agentic capabilities (for everyone, not just experts)

---

This is the Zen of Open Harness.

Everything else flows from here.
