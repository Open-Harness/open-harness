# Lessons from Cursor's FastRender: Building Long-Horizon Agentic Workflows

**Research Synthesis for OpenScaffold Workflow Design**

---

## Executive Summary

Cursor's FastRender project—a web browser built by thousands of parallel GPT-5.2 agents running for a week—represents the most ambitious public experiment in multi-agent coordination for software development. This document distills the key lessons into actionable patterns for designing long-horizon workflows with OpenScaffold.

**Key Numbers:**
- ~2,000 concurrent agents at peak
- ~30,000 commits
- 1M+ lines of Rust code
- 168 hours (1 week) of continuous autonomous operation
- Thousands of commits per hour at peak throughput

---

## Part 1: What Failed (and Why It Matters)

### 1.1 Democratic Flat Coordination

**The Attempt:** Equal-status agents self-coordinating via shared files. Each agent checks what others are doing, claims a task via locks, updates status.

**What Happened:**
- 20 agents slowed to the throughput of 2-3
- Lock contention became the primary bottleneck
- Agents held locks too long or forgot to release them
- Agents crashed while holding locks
- Agents updated files without acquiring locks

**OpenScaffold Implication:** Don't use shared state files for coordination between parallel agents. The `forEach` pattern with state updates should handle coordination through the framework, not through agent-level negotiation.

### 1.2 Optimistic Concurrency Control

**The Attempt:** Agents read freely, writes fail if state changed since last read. Simpler than locks.

**What Happened:**
- Technically more robust
- But agents became **risk-averse**
- Avoided difficult tasks
- Made small, safe changes
- No agent took responsibility for hard problems
- Work churned without progress

**OpenScaffold Implication:** Avoid patterns where agents can choose which tasks to work on. Task assignment should come from planners, not self-selection. Workers should have no knowledge of what other workers are doing.

### 1.3 The Integrator Role

**The Attempt:** Added an "integrator" agent for quality control and conflict resolution between workers.

**What Happened:**
- Created more bottlenecks than it solved
- Workers were already capable of handling conflicts themselves

**OpenScaffold Implication:** Resist the urge to add coordination complexity. The Judge pattern at cycle boundaries is sufficient. Don't add mid-workflow quality gates unless absolutely necessary.

---

## Part 2: The Architecture That Worked

### 2.1 The Planner-Worker-Judge Triangle

```
┌─────────────────────────────────────────────────────────────────┐
│                         PLANNER LAYER                            │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐   │
│  │Planner 1│     │Planner 2│     │Planner 3│     │Planner N│   │
│  │  (CSS)  │     │  (DOM)  │     │  (JS)   │     │  (...)  │   │
│  └────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘   │
│       │               │               │               │         │
│       │    Can spawn sub-planners for specific areas            │
│       ▼               ▼               ▼               ▼         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Tasks
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         WORKER LAYER                             │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐     ┌────────┐    │
│  │Worker 1│ │Worker 2│ │Worker 3│ │Worker 4│ ... │Worker N│    │
│  └────────┘ └────────┘ └────────┘ └────────┘     └────────┘    │
│                                                                  │
│  • Workers don't coordinate with each other                      │
│  • Workers don't worry about the big picture                     │
│  • Workers just grind on assigned task until done                │
│  • Workers push changes and move on                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Results
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          JUDGE LAYER                             │
│                                                                  │
│  At end of each cycle:                                           │
│  • Evaluate progress                                             │
│  • Determine whether to continue                                 │
│  • Next iteration starts fresh                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Properties of Workers

From the interview with Wilson Lin:

> "Workers pick up tasks and focus entirely on completing them. They don't coordinate with other workers or worry about the big picture. They just grind on their assigned task until it's done, then push their changes."

**Critical insight:** Worker isolation is a feature, not a bug. The lack of inter-worker communication is what enables massive parallelism without coordination overhead.

### 2.3 Key Properties of Planners

- Continuously explore the codebase
- Create tasks with clear scopes
- Can spawn sub-planners for specific areas
- Planning itself is parallel and recursive
- Responsible for dividing work to minimize overlap

**Why minimal merge conflicts occurred:**

> "The harness itself is able to quite effectively split out and divide the scope and tasks such that it tries to minimize the amount of overlap of work. That's also reflected in the code structure—commits will be made at various times and they don't tend to touch each other at the same time."

---

## Part 3: Key Patterns

### 3.1 Hierarchical Planning with Parallel Execution

- Decompose goal into independent areas
- Parallel planners create tasks per area
- Parallel workers execute tasks (isolated, no coordination)
- Judge evaluates and decides continue/stop
- Fresh cycle if continuing

### 3.2 Worker Isolation

Workers receive ONLY their task context:
- Task title, description, acceptance criteria
- Relevant files
- NO knowledge of other workers
- NO global progress awareness

### 3.3 Planner Overlap Minimization

Planners must:
- Assign tasks to different files/modules
- Make dependent tasks sequential
- Provide clear boundaries
- Define explicit acceptance criteria

### 3.4 Judge Fresh Cycles

At cycle end:
- Evaluate progress
- Decide continue/stop
- Reset context for next cycle (fights drift)
- Provide guidance for next planning round

---

## Part 4: Critical Operational Lessons

### 4.1 Model Selection Per Role

| Role | Best Model | Why |
|------|------------|-----|
| Planner | GPT-5.2 (general) | Better at expansive instructions, autonomous behavior |
| Worker | Claude Sonnet 4 or GPT-5.2 | Fast, reliable, focused tasks |
| Judge | Opus 4.5 | Strongest reasoning for critical decisions |

### 4.2 Prompts Matter More Than Infrastructure

> "A surprising amount of the system's behavior comes down to how we prompt the agents."

Key prompt elements:
- Clear termination criteria
- Guardrails against hoarding
- Anti-drift instructions
- Fresh start support

### 4.3 Intermittent Errors Are OK

> "Errors get introduced, but small errors... then they get fixed really quickly after a few commits. So there's a little bit of slack in the system."

Optimize for progress over perfection.

---

## Part 5: Anti-Patterns

### Agent Self-Selection of Tasks
❌ Let agents pick their own tasks
✅ Planners assign, workers execute

### Workers Coordinating
❌ Show workers what others are doing
✅ Complete isolation

### Planner Over-Engineering
❌ Elaborate multi-phase architectures for simple tasks
✅ "Founder Mindset" — bias for action, start simple

### Adding Coordination Roles
❌ Integrators, coordinators, reviewers between layers
✅ Judge only at cycle boundaries

---

## Part 6: Key Takeaways

1. **Hierarchy over democracy** — Planners assign, workers execute, judges evaluate
2. **Isolation over coordination** — Workers don't know about each other
3. **Fresh cycles over continuous memory** — Reset context to fight drift
4. **Prompts over infrastructure** — The words matter most
5. **Progress over perfection** — Small errors are OK if they get fixed
6. **Different models for different roles** — General models can be better planners

---

*Document generated for OpenScaffold workflow design. Source: Cursor Blog, Simon Willison interview, FastRender GitHub.*
