# Open Harness Vision Document

**The Operating System for Autonomous AI**

**Author:** Abdullah  
**Date:** December 24, 2025  
**Version:** 1.0

---

## I. Vision Statement

Open Harness is building the infrastructure for autonomous AI agents that work in days and weeks, not seconds and minutes.

We envision a world where creating long-running AI workflows is as simple as having a conversation—where developers build sophisticated multi-agent systems once, and everyone else configures them forever. Where AI isn't just a tool you use for moments, but a colleague you delegate to for marathons.

**Our Mission:** Make autonomous AI workflows buildable once, reusable forever.

**Our Platform:** The two-layer architecture that bridges expert developers and everyday users—TypeScript SDK for building, YAML configs for customizing, Anthropic Skills for onboarding.

**Our Future:** The operating system where autonomous AI agents are created, shared, deployed, and run by millions.

---

## II. The Problem We Solve

### AI That Can't Persist

Every night, millions of developers close their laptops with unfinished work. The AI helped for an hour—wrote some functions, suggested fixes—but then stopped. Tomorrow, they'll start over, re-explaining context, rebuilding momentum. The AI is brilliant, but it can't *persist*. It's a tool, not a colleague.

Meanwhile, traders stare at screens for hours, making split-second decisions their trading algorithms can't handle. The bots are fast but dumb. The humans are smart but slow. What's missing? An AI that can execute complex strategies over days, learning and adapting, while the trader sleeps.

**The constraint we've accepted:** AI works in moments, not marathons.

### Why Current Frameworks Fall Short

Today's AI frameworks are built for one-shot interactions:

- **Anthropic SDK (Direct):** Low-level primitives, no workflow orchestration, no state persistence
- **LangChain/LlamaIndex:** RAG-focused, complex abstractions, not designed for multi-day autonomy
- **Custom Solutions:** Everyone rebuilds the same patterns—session management, checkpointing, retry logic, iterative loops

**The gap:** No framework exists for long-running autonomous execution with coherent decision-making across extended time periods.

---

## III. The Solution: The Harness Pattern

Think about a baby learning to walk. You don't explain physics or muscle memory. You give them a *harness*—something that provides structure, catches them when they fall, helps them persist through the learning loop until they succeed.

AI agents need the same thing. Not handcuffs. Not limitations. A *harness*—infrastructure that enables long-running autonomy while maintaining coherence.

### Core Architecture

The Harness pattern provides four fundamental capabilities:

#### 1. State Persistence
Agents remember what they were doing across sessions. Not just chat history—actual decision state, progress tracking, goal context. When a session ends and a new one begins, the agent doesn't start from scratch.

#### 2. Iterative Decision Loops
Not request/response. Not one-shot prompts. Goal-driven iteration that continues until objectives are met—whether that takes 10 minutes or 10 days.

```
Traditional Pattern:           Harness Pattern:
User → Prompt → Response      Goal → [Session 1] → Checkpoint
                              Checkpoint → [Session 2] → Checkpoint  
                              Checkpoint → [Session N] → Complete
```

#### 3. Session Boundary Management
Long-running agents hit context window limits. The Harness pattern manages session boundaries intelligently—fresh context windows that maintain coherent goals across breaks. Each session knows what came before without being burdened by the entire history.

#### 4. Execution Safety Rails
Guardrails for long-running autonomy: timeouts, checkpoints, progress validation, graceful failure handling, and rollback capability. Agents work autonomously, but safely.

### Why This Matters

Anthropic proved this pattern works with their computer-use demo—agents running for hours, completing complex tasks across multiple sessions. But their code was purpose-built for one use case.

**Open Harness makes this pattern reusable.** Build any long-running workflow once. Configure it for infinite use cases. Share it with the world.

---

## IV. What We're Shipping: v1.0

Open Harness v1.0 is production-ready today for local autonomous workflows. Here's what ships:

### Core Platform

**1. SDK (TypeScript/Bun Primitives)**

Four core building blocks for framework developers:

- **Agent:** Reusable AI behavior (config-based, class-based, or built-in)
- **Workflow:** Multi-agent orchestration with task management
- **Task:** Work units with automatic progress tracking
- **Monologue:** Readable output layer that transforms tool noise into human narrative

```typescript
import { createAgent, createWorkflow, withMonologue } from '@openharness/sdk';

// Create agents
const coder = createAgent('coder', { model: 'claude-3-7-sonnet-20250219' });
const reviewer = createAgent('reviewer');

// Add readable output
const narrativeCoder = withMonologue(coder, {
  onNarrative: (text) => console.log(`🤖 ${text}`)
});

// Build workflows
const workflow = createWorkflow({
  name: 'Feature-Implementation',
  agents: { coder: narrativeCoder, reviewer },
  tasks: [
    { id: '1', description: 'Write function' },
    { id: '2', description: 'Write tests' }
  ],
  async execute({ agents, state, tasks }) {
    for (const task of tasks) {
      state.markInProgress(task.id);
      const result = await agents.coder.run(task.description, `session_${task.id}`);
      state.markComplete(task.id, { result });
    }
  }
});
```

**2. CLI Workflow Runner (Local Execution)**

Run workflows via YAML configuration—no coding required:

```bash
npm install -g @openharness/cli

# Run a workflow
harness run ./trading-agent-config.yaml

# Monitor progress
harness status session_abc123
```

**3. YAML Configuration System**

Declarative workflow definitions that anyone can customize:

```yaml
workflow:
  name: "momentum-trading-agent"
  
agents:
  trader:
    type: "custom"
    model: "claude-3-7-sonnet-20250219"
    prompt: |
      You are a trading agent executing momentum strategies.
      Buy when RSI < 30, sell when RSI > 70.
      Risk level: {{RISK_LEVEL}}
    tools:
      - market-data-mcp
      - portfolio-manager

tasks:
  - id: "monitor"
    description: "Monitor market conditions"
    checkpoint_interval: "1hour"
  - id: "execute"
    description: "Execute trades based on strategy"
```

**4. State Persistence (Local Files)**

Workflows save state automatically:
- Task progress tracking
- Agent decision history
- Checkpoint recovery
- Session resumption

### Flagship Examples

Two production-ready examples that prove the pattern works:

#### Example 1: Horizon Agent (Autonomous Software Engineering)

Imagine assigning a feature to an AI on Monday morning and getting a pull request Friday afternoon—fully implemented, tested, and debugged. Not a toy example. A real feature requiring 200+ interconnected tasks, architectural decisions, edge case handling.

**That's the Horizon Agent.**

It works in multi-day sessions, persisting progress, making iterative improvements, learning from test failures. It doesn't replace senior engineers—it replaces the grind. The 80% of feature work that's mechanical but time-consuming.

**Use Case:**
- Multi-day feature implementation
- Test-driven development workflows
- Technical debt cleanup marathons
- Autonomous refactoring projects

#### Example 2: Trading Agent (24/7 Strategy Execution)

A seasoned trader has a strategy that works—proven over months of manual execution. But it requires 24/7 monitoring, split-second decisions, and disciplined consistency. Humans can't sustain that.

**The Trading Agent can.**

Configure it with your strategy (YAML), feed it market data (MCP integration), and let it run. It executes your approach continuously, adapting to market conditions, logging every decision for your review. It's not making up strategy—it's executing *yours*, autonomously.

**Use Case:**
- 24/7 market monitoring
- Automated strategy execution
- Portfolio rebalancing over weeks/months
- Backtesting that runs for days

### Zero-Friction Onboarding: Anthropic Skills

Here's the unlock for v1.0: **Anthropic Skills for conversational onboarding.**

Skills are just markdown files with scripts. No cloud infrastructure. No complex setup. Just instructions that teach Claude how to help users create workflows.

**Why Skills Matter:**

What if creating an autonomous AI agent was as simple as having a conversation?

No terminal commands. No YAML syntax to memorize. Just open Claude and say: *"Help me build a trading agent."*

**The Skills We're Shipping:**

**Skill 1: "Create Workflow"**
- Interactive YAML generator
- Claude asks questions, generates config
- Templates for trading, coding, research agents

```
User: "Help me create a trading agent"
Claude (via Skill): "Great! I'll help you configure one. 
  What's your trading strategy?"
User: "Buy when RSI < 30, sell when RSI > 70"
Claude: "Risk level? (conservative/moderate/aggressive)"
User: "Moderate"
Claude: "Generating workflow config..."
[Creates trading-agent-config.yaml]
Claude: "Done! Run it with: harness run ./trading-agent-config.yaml"
```

**Skill 2: "Run Workflow"**
- Wrapper around CLI commands
- Status monitoring
- Error troubleshooting assistance

**Skill 3: "Explore Examples"**
- Guided tour of Horizon + Trading examples
- Architecture explanations
- Customization suggestions

**Installation:**
1. Open Claude Desktop or Claude Code
2. Install "Open Harness" skill from marketplace
3. Start building workflows through conversation

**Impact:** 10x larger addressable market. Non-coders can now build autonomous agents.

---

## V. The Two-Layer Architecture

Open Harness serves two completely different users—and that's the genius.

### Layer 1: Build Once (For Framework Developers)

You're an expert developer. You understand the complexity: multi-agent coordination, state management, retry logic, checkpoint recovery. You build the *workflow* in TypeScript using our SDK. You define the agents, the flow, the decision points. You create something sophisticated—like our Horizon Agent that autonomously builds applications across 200+ tickets over multiple days.

**Your Tools:**
- TypeScript/Bun SDK
- Full control over agent behavior
- Custom workflow orchestration
- Advanced state management

**Your Output:**
- Reusable workflow patterns
- Production-ready examples
- Contributions to the ecosystem

### Layer 2: Configure Forever (For Everyone Else)

You're a trader with a proven strategy. Or a team lead who needs documentation generated. You don't want to build a framework—you want to *use* one. So you take an existing workflow, customize it with a YAML config file (change the prompts, swap the model, inject your data), and run it with a single CLI command. No code. Just configuration.

**Your Tools:**
- YAML configuration files
- CLI commands
- Anthropic Skills (conversational interface)

**Your Output:**
- Customized workflows for your needs
- Autonomous agents running locally
- Results without coding

### Skills Bridge the Gap

The Anthropic Skills layer makes Layer 2 accessible to non-technical users:

**Natural Language → YAML Generation → Running Agent**

You don't need to know YAML syntax. You don't need to understand workflow architecture. You just describe what you want, and Claude (via our Skill) generates the configuration for you.

**The Magic:**

Workflow creators build complex systems once. Workflow consumers configure and reuse them forever. It's like Docker for AI—experts build images, everyone runs containers.

---

## VI. Why Anthropic? Why Now?

We didn't start with Anthropic's SDK by accident. We bet on the platform investing earliest and fastest in agent infrastructure:

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
- Native support for long-running patterns
- Streaming, tool use, state management
- Built for autonomy, not just chat

**4. Claude's Reasoning**
- Best-in-class for complex decision-making
- Extended thinking mode for hard problems
- Reliable tool use and iteration

### Multi-Provider Future

Could we support OpenRouter, Ollama, other providers? **Yes—and we will.**

But we started with Anthropic because they're building the future of agent infrastructure *today*. When they ship new primitives, we integrate immediately. Early adopter advantage.

Open Harness abstracts the agent runtime. Adding new providers is a matter of adapter implementation, not architectural overhaul.

**The Bet:** Anthropic is moving fastest on agent infrastructure. We're riding that wave while building abstraction layers that future-proof the platform.

---

## VII. The Roadmap

### v1.0 (Now) - Foundation

**Status:** Shipping  
**Timeline:** Current release

**What's Included:**
- ✅ SDK published to npm (`@openharness/sdk`)
- ✅ CLI workflow runner (`@openharness/cli`)
- ✅ YAML configuration system
- ✅ Two flagship examples (Horizon Agent, Trading Agent)
- ✅ **Anthropic Skills** for conversational onboarding
- ✅ Local execution (zero infrastructure cost)
- ✅ Documentation and quickstart guides

**Target Users:** 
- Framework developers building custom workflows
- Technical users configuring existing workflows
- Non-coders using Skills to generate agents

**Business Model:** Free and open-source

**Success Metrics:**
- 1,000 GitHub stars
- 10+ community-contributed workflows
- 100+ active users
- First external PR within 30 days

---

### v1.1 (3-6 Months) - Community & Ecosystem

**Focus:** Workflow discovery and contribution

**Features:**
- 🎯 **CLI Generators** (`harness generate trading-bot`)
  - Interactive scaffolding for new workflows
  - Template-based project creation
  - Best practices baked in
- 🎯 **Workflow Gallery** (Documentation site)
  - Searchable workflow library
  - Community ratings and reviews
  - Live examples and demos
- 🎯 **Enhanced Skills**
  - More workflow templates
  - Better error handling
  - Progress monitoring from Claude UI
- 🎯 **10+ Community Workflows**
  - Documentation agent
  - Research agent
  - Data processing workflows
  - Creative use cases

**Target Users:**
- Growing developer community
- Workflow contributors
- First enterprise early adopters

**Business Model:** Still free, validating demand

**Success Metrics:**
- 10,000 GitHub stars
- 50+ community workflows
- 1,000+ active users
- First "Harness-native" project (company built on framework)

---

### v2.0 (6-12 Months) - Cloud & Monetization

**Focus:** Hosted execution and revenue

**Features:**
- 🎯 **E2B Cloud Sandboxes**
  - Cloud-based workflow execution
  - No local setup required
  - Isolated, secure runtime environments
  - API for programmatic deployment
- 🎯 **Hosted Runner Dashboard**
  - Monitor workflows in real-time
  - Logs, metrics, performance analytics
  - Cost tracking and optimization
  - Team collaboration features
- 🎯 **Freemium Model**
  - Free: Local execution (unlimited)
  - Free: Cloud execution (10 hours/month)
  - Paid: Cloud execution (unlimited, $19/month)
  - Enterprise: Custom pricing, SLA, support

**Target Users:**
- Users who want "set and forget" agents
- Teams running 24/7 workflows
- Enterprise customers with compliance needs

**Business Model:** Freemium SaaS

**Success Metrics:**
- 1,000 paying customers
- $20K MRR
- 99.9% uptime SLA
- Enterprise pilot customers

---

### v3.0+ (12+ Months) - Platform Maturity

**Focus:** Ecosystem dominance

**Vision Features:**
- 💭 **Workflow Marketplace**
  - Buy/sell premium workflows
  - Revenue sharing for creators
  - Verified/certified workflows
- 💭 **Multi-Provider Support**
  - OpenRouter integration
  - Ollama (local models)
  - Azure OpenAI
  - Custom model endpoints
- 💭 **Enterprise Platform**
  - SSO/SAML authentication
  - Audit logs and compliance
  - Team workspace management
  - Fine-grained access control
- 💭 **Workflow IDE**
  - Visual workflow builder
  - No-code editor
  - Real-time collaboration
  - Version control integration
- 💭 **Advanced Monitoring**
  - APM-style observability
  - Cost optimization recommendations
  - Performance profiling
  - A/B testing for prompts

**Target Users:**
- Enterprise customers at scale
- Workflow marketplace creators
- Platform integrators and partners

**Business Model:** Multi-tier SaaS + marketplace revenue share

**Success Metrics:**
- "Harness-compatible" becomes industry term
- 100,000+ active workflows running
- Strategic partnerships (Anthropic, cloud providers)
- Category leadership in autonomous AI

---

## VIII. What Open Harness IS (and ISN'T)

### What Open Harness IS

✅ **A framework for long-running autonomous AI workflows**  
Built for agents that work in days and weeks, maintaining coherent decision-making across extended time periods.

✅ **A two-layer architecture (Build + Configure)**  
TypeScript SDK for expert developers who build workflows. YAML configs for everyone else who uses them.

✅ **Built on the Anthropic stack**  
Leveraging MCP, Skills, Agent SDK, and Claude for best-in-class agent infrastructure.

✅ **Opinionated and focused**  
We solve one problem extremely well: long-running autonomous execution. Not trying to be everything.

✅ **Production-ready today (locally)**  
The SDK, CLI, and examples work NOW. Local execution is stable and documented.

✅ **Open-source and community-driven**  
Framework code is public, contributions welcome, roadmap shaped by users.

✅ **Designed for three user types**  
Framework developers (build workflows), technical users (configure workflows), non-coders (use Skills).

### What Open Harness ISN'T

❌ **NOT a chatbot framework**  
Use Vercel AI SDK, LangChain, or similar for conversational UIs. We're for autonomous workflows, not chat.

❌ **NOT a replacement for the Anthropic SDK**  
We wrap it, extend it, and add workflow orchestration. The Anthropic SDK is our foundation.

❌ **NOT for one-shot prompts**  
If your use case is "send prompt, get response, done"—just use the Anthropic SDK directly.

❌ **NOT cloud-hosted yet (v1.0)**  
Current release runs locally. Cloud sandboxes and hosted execution come in v2.0.

❌ **NOT trying to support every LLM provider (yet)**  
Started with Anthropic for strategic reasons. Multi-provider support comes later after validation.

❌ **NOT a no-code platform (yet)**  
Skills make onboarding conversational, but you still need CLI access. True no-code visual builder is v3.0+.

---

## IX. Target Use Cases

### Software Engineering Agents

**The Pattern:**  
Assign a feature, get a PR. Multi-day autonomous coding with test-driven development.

**Examples:**
- Feature implementation (200+ interconnected tasks)
- Technical debt cleanup marathons
- Automated refactoring projects
- Documentation generation from codebases

**Why Open Harness:**
- State persistence across coding sessions
- Iterative test-fix loops
- Checkpoint recovery when tests fail
- Progress tracking for complex features

**Target Users:** Engineering teams, solo developers, dev agencies

---

### Trading & Finance Agents

**The Pattern:**  
24/7 strategy execution with continuous market monitoring and autonomous decision-making.

**Examples:**
- Momentum trading (RSI-based strategies)
- Portfolio rebalancing over weeks/months
- Backtesting complex strategies (multi-day simulations)
- Risk monitoring and alerting

**Why Open Harness:**
- Runs continuously without human intervention
- Adapts to changing market conditions
- Logs every decision for audit/review
- Executes trader's strategy, doesn't invent one

**Target Users:** Retail traders, hedge funds, quant teams

---

### Meta-Agents & Workflow Orchestrators

**The Pattern:**  
Coordinate multiple specialized agents for complex business processes.

**Examples:**
- BMAD-style multi-agent teams (analyst → architect → PM → dev)
- Research agents working for weeks
- Data processing pipelines with human-in-the-loop
- Content generation workflows (research → write → edit → publish)

**Why Open Harness:**
- Multi-agent orchestration built-in
- Task management and progress tracking
- State shared across agents
- Session boundaries for long-running processes

**Target Users:** Enterprises, automation consultants, AI-native companies

---

### Research & Analysis Agents

**The Pattern:**  
Deep research over extended periods with iterative refinement.

**Examples:**
- Competitive analysis (scrape → analyze → report)
- Market research spanning weeks
- Literature reviews (search → read → summarize → synthesize)
- Due diligence automation

**Why Open Harness:**
- Persistence across research sessions
- Incremental knowledge building
- Checkpoint when new insights emerge
- Synthesize findings at the end

**Target Users:** Analysts, researchers, consultants

---

## X. The Strategic Vision

### The Platform Play

Open Harness isn't just a framework—it's a **two-sided marketplace** in the making:

**Side 1 - Workflow Creators:**
- Expert developers build sophisticated workflows
- Share as YAML templates and Skills
- Build reputation as workflow architects
- Eventually: monetize premium workflows

**Side 2 - Workflow Consumers:**
- Download/fork workflow configs
- Customize for their needs (YAML or Skills)
- Run locally or in cloud (v2.0+)
- Contribute improvements back

**The Flywheel:**

```
More workflows published 
  → More users attracted 
    → More workflows created 
      → Network effects unlock 
        → Platform dominance
```

### Network Effects

**Stage 1 (v1.0):** Skills onboarding brings users  
**Stage 2 (v1.1):** CLI generators make contribution easy  
**Stage 3 (v2.0):** Cloud sandboxes enable "set and forget"  
**Stage 4 (v3.0):** Marketplace monetizes creators  

**Result:** The more workflows exist, the more valuable the platform becomes. Classic network effect.

### Capital Efficiency

**The Smart Sequencing:**

Traditional approach (expensive):
1. Build cloud infrastructure first
2. Then build distribution
3. Hope users come

**Open Harness approach (smart):**
1. v1.0: Free distribution (Skills) + local execution (zero hosting cost)
2. Validate demand, build community
3. v2.0: Once you HAVE users, build paid infrastructure (E2B)

**No infrastructure burn until demand is proven.**

### Strategic Moats

**1. First-Mover Advantage**  
Own the "long-running autonomous AI" category before competitors exist.

**2. Ecosystem Lock-In (The Good Kind)**  
Developers build careers around Open Harness patterns. Companies build on the platform. Migration cost increases over time.

**3. Anthropic Amplification**  
Every Anthropic feature → Open Harness integrates first. Official Skills marketplace → free distribution. Potential strategic partnership.

**4. Workflow Library Becomes Irreplaceable**  
"Where else would I get these workflows?" The library becomes the moat.

---

## XI. Success Metrics

### Developer Success

- **5-Minute Rule:** Clone to running example in under 5 minutes
- **Self-Evident Structure:** No "where do I put this?" questions
- **First External PR:** Within 30 days of publishing

### User Success

- **Skills Onboarding:** Non-coder creates first agent via conversation
- **Workflow Reuse:** 80% of users start from existing templates
- **Autonomous Duration:** Average workflow runs > 4 hours successfully

### Business Success

- **v1.0:** 1,000 GitHub stars, 10 contributors, 100 active users
- **v1.1:** 10,000 stars, 50 workflows, 1,000 users
- **v2.0:** 1,000 paying customers, $20K MRR
- **v3.0:** Category leadership, "Harness-compatible" as industry term

---

## XII. Call to Action

The future of work isn't humans doing everything or AI doing everything. It's humans delegating complex, time-intensive goals to AI colleagues who work autonomously while we focus on strategy, creativity, and judgment.

**Open Harness makes that future buildable today.**

Not in a lab. In production. With TypeScript, Bun, and the Anthropic stack.

The infrastructure is ready. The examples prove it works. The ecosystem is forming.

### For Developers

Build workflows in TypeScript. Contribute to the ecosystem. Shape the future of autonomous AI.

```bash
npm install @openharness/sdk
```

### For Technical Users

Configure workflows with YAML. Run autonomous agents locally. Customize for your needs.

```bash
npm install -g @openharness/cli
harness run ./your-workflow.yaml
```

### For Everyone Else

Install our Skill in Claude. Describe what you want. Watch your autonomous agent come to life.

```
Install "Open Harness" skill → Chat with Claude → Agent running
```

---

## **Built for conversation. Designed for autonomy.**

**What will you build?**

---

**Repository:** https://github.com/yourusername/open-harness  
**Documentation:** https://docs.openharness.dev  
**Skills Marketplace:** Coming soon  
**Community:** Discord, GitHub Discussions

---

*Open Harness is open-source software. Licensed under MIT.*
