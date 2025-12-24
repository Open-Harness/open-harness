# bun-vi 🤖

**An extensible workflow SDK for building Anthropic Agent applications with ease.**

Turn complex agent workflows into simple, readable code. No DI complexity, no container hell—just clean APIs and powerful patterns.

---

## ✨ Key Features

- **🎯 Four Core Primitives**: Agent, Workflow, Task, Monologue
- **🚀 Zero Ceremony**: Create agents in one line, no containers exposed
- **🔧 Fully Extensible**: Build custom agents and workflows easily
- **📖 Monologue Mode**: Transform tool noise into readable narrative (killer feature!)
- **📋 Task Management**: Built-in progress tracking and state management
- **🎭 Three Agent Patterns**: Config-based, class-based, or built-in
- **💪 Type-Safe**: Full TypeScript support with IntelliSense

---

## 🚀 Quick Start

### Install

```bash
bun install
```

### Create Your First Agent

```typescript
import { createAgent } from 'bun-vi';

const agent = createAgent('coder', { model: 'haiku' });

await agent.run('Write a hello world function', 'session_1', {
  callbacks: {
    onText: (text) => console.log(text)
  }
});
```

That's it! No containers, no tokens, no ceremony.

---

## 💎 The Killer Feature: Monologue

Long-running agents produce tons of tool calls. **Monologue** turns that noise into human-readable narrative:

```typescript
import { createAgent, withMonologue } from 'bun-vi';

const agent = withMonologue(
  createAgent('coder'),
  {
    onNarrative: (text) => console.log(`🤖 ${text}`)
  }
);

await agent.run('Build a complex feature', 'session_1');

// Output:
// 🤖 "I'm analyzing the requirements and planning the architecture..."
// 🤖 "I've created the core modules and I'm now adding tests..."
```

**Why this matters**: Tool calls are for machines. Monologue is for humans.

---

## 📚 Core Concepts

### 1. Agent - Reusable AI Behavior

Three ways to create agents:

```typescript
// Built-in
const coder = createAgent('coder');

// Config-based
const summarizer = createAgent({
  name: 'Summarizer',
  prompt: 'Summarize this: {{text}}',
  model: 'haiku'
});

// Class-based (advanced)
class MyAgent extends BaseAgent {
  async analyze(data: any) {
    return this.run(`Analyze: ${data}`, 'session_1');
  }
}
const agent = createAgent(MyAgent);
```

### 2. Workflow - Multi-Agent Orchestration

```typescript
import { createAgent, createWorkflow } from 'bun-vi';

const workflow = createWorkflow({
  name: 'Code-Review',
  
  tasks: [
    { id: '1', description: 'Write function' },
    { id: '2', description: 'Write tests' }
  ],
  
  agents: {
    coder: createAgent('coder'),
    reviewer: createAgent('reviewer')
  },
  
  async execute({ agents, state, tasks }) {
    for (const task of tasks) {
      state.markInProgress(task.id);
      
      const code = await agents.coder.run(task.description, `s_${task.id}`);
      
      state.markComplete(task.id, { code });
    }
  }
});

await workflow.run();
```

### 3. Task - Work Unit with State

Tasks track progress automatically:

```typescript
const progress = state.getProgress();
// { total: 2, completed: 1, pending: 1, percentComplete: 50 }
```

### 4. Monologue - Readable Output Layer

Opt-in feature for long-running agents:

```typescript
const narrativeAgent = withMonologue(agent, {
  bufferSize: 5,        // Events before synthesizing
  onNarrative: (text) => console.log(text)
});
```

---

## 📖 Documentation

### Full Guide
See **[QUICKSTART.md](./QUICKSTART.md)** for:
- Detailed examples
- Mental models
- Common patterns
- Pro tips

### Examples (Living Documentation)

```bash
# Basic agent
bun example:basic

# Workflow with task management
bun example:workflow

# Custom agent patterns
bun run src/examples/custom-agent.ts

# Custom workflow with monologue
bun run src/examples/custom-workflow.ts
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│         YOUR APPLICATION            │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────┐      ┌──────────┐    │
│  │  Agent   │      │ Workflow │    │
│  │          │──────│          │    │
│  │ (Prompt  │      │ (Tasks + │    │
│  │  Logic)  │      │  Agents) │    │
│  └──────────┘      └──────────┘    │
│                                     │
│  ┌────────────────────────────────┐ │
│  │      Monologue                 │ │
│  │  (Readable Output Layer)       │ │
│  └────────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│     bun-vi SDK (Clean API)          │
├─────────────────────────────────────┤
│   DI Container (Hidden from you)    │
├─────────────────────────────────────┤
│         Anthropic SDK               │
└─────────────────────────────────────┘
```

**Key Design Principles:**
- 🎯 **Zero Leakage**: DI/container complexity is internal
- 🧩 **Composable**: Mix and match agents and workflows
- 📦 **Extensible**: Built-in agents are just examples
- 🔍 **Type-Safe**: Full TypeScript support

---

## 🧪 Testing

```bash
# Run all tests
bun test

# Unit tests
bun test:unit

# Integration tests
bun test:integration
```

---

## 📦 Main Exports

```typescript
import {
  // Factories
  createAgent,
  createWorkflow,
  withMonologue,
  
  // Primitives
  TaskList,
  BaseAgent,
  
  // Built-in Agents (examples)
  CodingAgent,
  ReviewAgent,
  
  // Types
  StreamCallbacks,
  AgentEvent,
  Task,
  TaskStatus,
  // ... more
} from 'bun-vi';
```

---

## 🎯 Use Cases

### ✅ Perfect For:
- Multi-agent workflows (code-review-deploy pipelines)
- Long-running automation with progress tracking
- Custom agent behaviors with state
- Readable output from complex agent interactions

### ❌ Not For:
- Single-prompt LLM calls (use Anthropic SDK directly)
- Real-time chat applications (different architecture needed)

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Run tests: `bun test`
5. Submit a PR

---

## 📄 License

MIT

---

## 🚀 Showcase: 24-Hour Autonomous Agent

**The killer demo** - Recreate Anthropic's autonomous coding pattern in TypeScript:

```bash
# Run the autonomous agent that builds apps for hours/days
bun example:autonomous --project-dir ./claude_clone

# It will:
# 1. Generate 200+ test cases from specification
# 2. Set up project structure
# 3. Implement features incrementally
# 4. Test thoroughly
# 5. Auto-continue across fresh sessions
# 6. Run until all features complete
```

**What makes this special:**
- **Fresh Context Per Session**: Each session starts with empty context
- **State Persistence**: Progress saved in `feature_list.json` + git
- **Monologue Output**: See readable narrative instead of tool noise
- **Auto-Continuation**: Runs coherently for hours without intervention
- **Task Management**: Built-in progress tracking with TaskList

See `src/examples/autonomous-agent/README.md` for full details.

---

## 🙏 Built With

- [Bun](https://bun.sh) - Fast all-in-one JavaScript runtime
- [@anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) - Official Anthropic agent SDK
- [@needle-di/core](https://www.npmjs.com/package/@needle-di/core) - Lightweight dependency injection

---

## ⭐ Star Us!

If you find this useful, give us a star on GitHub! It helps others discover the project.

---

**Happy building!** 🚀
