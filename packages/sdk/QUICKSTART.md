# 🚀 bun-vi Quick Start Guide

**bun-vi** is an extensible workflow SDK for building Anthropic Agent applications with ease.

## 🎯 Core Concepts

The SDK is built around **four primitives**:

| Primitive | Purpose | Example |
|-----------|---------|---------|
| **Agent** | Encapsulates prompt logic and state | `createAgent('coder')` |
| **Workflow** | Orchestrates multiple agents | `createWorkflow({...})` |
| **Task** | Work unit with status tracking | `{ id: '1', description: '...' }` |
| **Monologue** | Readable narrative from tool calls | `withMonologue(agent)` |

---

## 📦 Installation

```bash
bun install
```

---

## 🏃 Quick Examples

### 1. Create and Run an Agent (5 seconds)

```typescript
import { createAgent } from 'bun-vi';

const agent = createAgent('coder', { model: 'haiku' });

await agent.run('Write a hello world function', 'session_1', {
  callbacks: {
    onText: (text) => console.log(text)
  }
});
```

**That's it!** No containers, no tokens, no DI complexity.

---

### 2. Create a Custom Agent (3 modes)

#### Mode A: Simple Config
```typescript
const summarizer = createAgent({
  name: 'Summarizer',
  prompt: 'Summarize this: {{text}}',
  model: 'haiku'
});

await summarizer.run({ text: 'Long article...' }, 'session_1');
```

#### Mode B: Config with State
```typescript
const expert = createAgent({
  name: 'Expert',
  prompt: 'You are a {{domain}} expert. {{question}}',
  state: { domain: 'TypeScript' }
});

await expert.run({ question: 'What is DI?' }, 'session_1');
```

#### Mode C: Class-Based (Advanced)
```typescript
import { BaseAgent } from 'bun-vi';

class MyAgent extends BaseAgent {
  async analyze(data: any) {
    return this.run(`Analyze: ${data}`, 'session_1');
  }
}

const agent = createAgent(MyAgent);
```

---

### 3. Create a Workflow

```typescript
import { createAgent, createWorkflow } from 'bun-vi';

const workflow = createWorkflow({
  name: 'Code-Review',
  
  tasks: [
    { id: '1', description: 'Write login function' },
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
      const review = await agents.reviewer.run(`Review: ${code}`, `r_${task.id}`);
      
      state.markComplete(task.id, { code, review });
    }
  }
});

await workflow.run();
```

---

### 4. Add Monologue (Killer Feature!)

Turn noisy tool calls into readable narrative:

```typescript
import { createAgent, withMonologue } from 'bun-vi';

const agent = createAgent('coder');

const narrativeAgent = withMonologue(agent, {
  bufferSize: 5,
  onNarrative: (text) => {
    console.log(`🤖 Agent: "${text}"`);
  }
});

await narrativeAgent.run('Build a complex feature', 'session_1');

// Output:
// 🤖 Agent: "I'm analyzing the requirements and planning the architecture..."
// 🤖 Agent: "I've created the core modules and I'm now adding tests..."
```

**Why this matters:** Long-running agents produce tons of tool calls. Monologue gives you a human-readable stream instead.

---

## 🎓 Mental Model

### How to Think About the SDK

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
│  ┌────────────────────────────┐    │
│  │      Monologue             │    │
│  │  (Readable Output Layer)   │    │
│  └────────────────────────────┘    │
│                                     │
├─────────────────────────────────────┤
│         ANTHROPIC SDK               │
│      (Hidden from you)              │
└─────────────────────────────────────┘
```

### Design Philosophy

1. **You care about WHAT, not HOW**
   - Create agents easily
   - Build workflows naturally
   - Don't think about containers or DI

2. **Four Primitives, Infinite Possibilities**
   - Agent = Reusable AI behavior
   - Workflow = Orchestration logic
   - Task = Work unit with state
   - Monologue = UX layer

3. **Extensibility First**
   - Built-in agents (CodingAgent, ReviewAgent) are EXAMPLES
   - You create your own agents and workflows
   - The SDK gets out of your way

---

## 📚 Next Steps

### Run the Examples

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

### Key Files to Explore

| File | Purpose |
|------|---------|
| `src/index.ts` | Main SDK exports |
| `src/agents/coding-agent.ts` | Example: Class-based agent |
| `src/examples/custom-agent.ts` | Three ways to create agents |
| `src/examples/custom-workflow.ts` | Advanced workflow patterns |

---

## 💡 Pro Tips

### 1. **Start Simple**
Use built-in agents and config-based custom agents first. Graduate to class-based agents when you need custom methods.

### 2. **Workflows are Flexible**
The `execute` function is just async TypeScript. You have full control over orchestration logic, error handling, and conditional flows.

### 3. **Monologue is Opt-In**
Don't add it everywhere. Use it for long-running agents where you want high-level progress updates.

### 4. **Task State is Powerful**
The TaskList tracks history, progress, and results. Use it to build dashboards, resume workflows, or debug issues.

---

## 🆘 Common Patterns

### Pattern: Retry Failed Tasks
```typescript
async execute({ agents, state, tasks }) {
  for (const task of tasks) {
    let retries = 3;
    while (retries > 0) {
      try {
        await agents.coder.run(task.description, `s_${task.id}`);
        state.markComplete(task.id);
        break;
      } catch (error) {
        retries--;
        if (retries === 0) state.markFailed(task.id, String(error));
      }
    }
  }
}
```

### Pattern: Conditional Task Execution
```typescript
async execute({ agents, state, tasks }) {
  for (const task of tasks) {
    // Skip low-priority if time is running out
    if (task.metadata.priority === 'low' && isTimeRunningOut()) {
      state.markSkipped(task.id);
      continue;
    }
    
    // Execute task...
  }
}
```

### Pattern: Agent Collaboration
```typescript
agents: {
  planner: createAgent({ name: 'Planner', prompt: '...' }),
  coder: createAgent('coder'),
  tester: createAgent({ name: 'Tester', prompt: '...' })
},

async execute({ agents, state, tasks }) {
  // Planner creates detailed specs
  const spec = await agents.planner.run('Plan feature X', 'plan');
  
  // Coder implements based on spec
  const code = await agents.coder.run(spec, 'code');
  
  // Tester validates
  const tests = await agents.tester.run(code, 'test');
}
```

---

## 🎉 You're Ready!

You now understand:
- ✅ The four primitives
- ✅ How to create agents (3 ways)
- ✅ How to build workflows
- ✅ How to use monologue for readable output
- ✅ Common patterns

**Go build something amazing!** 🚀

---

## 📖 Reference

### Built-in Agents
- `coder` - Coding tasks with structured output
- `reviewer` - Code review with read-only tools

### Main Exports
```typescript
import {
  createAgent,      // Agent factory
  createWorkflow,   // Workflow factory
  withMonologue,    // Monologue wrapper
  TaskList,         // Task management
  BaseAgent,        // Base class for custom agents
  // ... types
} from 'bun-vi';
```

---

Need help? Check the examples in `src/examples/` - they're living documentation! 📚
