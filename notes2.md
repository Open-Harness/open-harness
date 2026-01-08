# OpenPros and Open Harness Integration Notes

## Key Insights

What's really interesting about OpenPros is how it captures many of the same concepts we've been working with. This forces us to rethink how we build 0.3.0. When we go into the planning sprint, we need to account for how these systems complement each other.

## The Boundary Between OpenPros and Open Harness

OpenPros is a well-architected system that we want to leverage rather than rebuild. The key question is: where do these two things fit together? What's the boundary, and what problems does each solve?

The similarities between OpenPros and Open Harness show we're coming from the same mental model, but they're fundamentally different:

**OpenPros** is a compiler for human language. It's fantastic at what it does, but you're still constrained to the terminal and your active session. Whether you're in a terminal window or a GUI, you're directly interacting within a particular Claude Code session. You're bound by the context window and the harness itself—whatever execution environment (Claude Code, Open Code, etc.) decides how your agent system operates.

**Open Harness** operates at a level above that. You're programmatically creating your agent system. OpenPros prompts (pros) exist *within* each agent. Agents utilize skills (potentially including the OpenPros skill), compile those pros, and use them as prompts. This gives us all the benefits of programmability, testability, auditability, automatic evaluations, and production-grade system building—a different paradigm altogether.

## 0.2.0 Progress

Over the last two days, I've been working on 0.2.0—a massive upgrade and crystallization that incorporates many elements from OpenPros. Once I finish and push this release, it will include:

- New code and significantly improved documentation
- A section on Open Harness's mission and core ideas
- Comprehensive architectural clarity

## What's New in v0.2.0

### Provider Abstraction

We were tightly coupled to Claude Code SDK. Now we have a clean provider trait that supports Claude, OpenCode, and Codex. Workflows work on any provider.

### Recording & Replay

Every provider call is recorded. Replay is deterministic. This enables the evals system.

### Built-In Evaluations

The main focus. Not just "run a workflow"—record it, compare variants, measure improvement, get data on what's actually better. Built-in, automatic, production-grade.

## On Complexity

I know this is hard to follow. It's moving fast and it IS genuinely complex.

But the whole point is: **the complexity lives in the framework**. Good frameworks encapsulate irreducible complexity and give you a clean interface.

You define skills + scripts + evals. The framework handles orchestration, state, recording, evals, scaling to production.

## Where To Learn

Don't read the code. Read the docs: `**apps/docs/content/0.2.0/01-foundations/zen.md**`

That's the mental model. Start there.

## OpenPros Integration

For v0.3.0 planning, we'll figure out how pros compile into provider trait prompts. But that's later. Right now, focus on understanding what Open Harness does.

## Next Steps

**For 0.2.0 Review:**
I'd like you to review the documentation (not the code) when I open the PR. Focus on providing feedback on the docs—that's where I really want your input.

**For 0.3.0 Planning:**
We'll do the planning together. We need to think through and explicitly define the boundary—how we use OpenPros inside Open Harness and how we compose these systems together. 