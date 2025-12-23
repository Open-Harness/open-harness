# Autonomous Coding Agent Example

**Build a 24-hour autonomous coding agent using bun-vi SDK**

This example recreates Anthropic's autonomous coding pattern (from their Python reference) in TypeScript using our clean SDK. The agent can run coherently for hours or days, building complete applications from specifications.

## Quick Start

```bash
# Run the autonomous agent
bun run src/examples/autonomous-agent/index.ts --project-dir ./my_project

# Limit iterations for testing
bun run src/examples/autonomous-agent/index.ts --project-dir ./my_project --max-iterations 3
```

## How It Works

### Two-Agent Pattern

**1. Initializer Agent (Session 1)**
- Reads `app_spec.txt` specification
- Generates 200+ detailed test cases in `feature_list.json`
- Creates `init.sh` setup script
- Initializes git repository
- Sets up project structure

**2. Builder Agent (Sessions 2+)**
- Gets bearings (reads feature list, progress, git log)
- Verifies previous work still passes
- Picks next failing test from `feature_list.json`
- Implements feature thoroughly
- Tests via actual execution
- Marks test as passing
- Commits progress
- Auto-continues to next session

### Session Management

- **Fresh Context**: Each session starts with empty context window
- **State Persistence**: Progress saved in `feature_list.json` and git
- **Auto-Continuation**: 3-second delay between sessions
- **Interruptible**: Press Ctrl+C to pause, run again to resume

## Architecture Using bun-vi SDK

```typescript
import { createAgent, createWorkflow, TaskList, withMonologue } from 'bun-vi';

// 1. Create specialized agents
const initializer = createAgent({
  name: 'InitializerAgent',
  prompt: await Bun.file('./prompts/initializer.md').text(),
  model: 'sonnet'
});

const builder = withMonologue(
  createAgent({
    name: 'BuilderAgent', 
    prompt: await Bun.file('./prompts/builder.md').text(),
    model: 'sonnet'
  }),
  {
    onNarrative: (text) => console.log(`🤖 ${text}`)
  }
);

// 2. Create workflow with task management
const workflow = createWorkflow({
  name: 'AutonomousCoding',
  
  // Tasks loaded from feature_list.json
  tasks: loadTasks('./my_project/feature_list.json'),
  
  agents: { initializer, builder },
  
  async execute({ agents, state, tasks }) {
    // First session: Initialize
    if (!featureListExists()) {
      await agents.initializer.run(
        'Read app_spec.txt and set up project',
        'session_init'
      );
    }
    
    // Subsequent sessions: Build
    while (!state.isComplete()) {
      const nextTask = tasks.find(t => t.status === 'pending');
      
      state.markInProgress(nextTask.id);
      
      await agents.builder.run(
        `Implement feature: ${nextTask.description}`,
        `session_${nextTask.id}`
      );
      
      state.markComplete(nextTask.id);
      
      // Auto-continue delay
      await Bun.sleep(3000);
    }
  }
});

// 3. Run with progress tracking
await workflow.run();
```

## Key SDK Features Used

### 1. Custom Agents with Prompts

```typescript
const agent = createAgent({
  name: 'BuilderAgent',
  prompt: `
    ## YOUR ROLE - CODING AGENT
    
    You are continuing work on a long-running task.
    This is a FRESH context window.
    
    ### STEP 1: GET YOUR BEARINGS
    - Read feature_list.json
    - Read claude-progress.txt
    - Check git log
    
    ### STEP 2: IMPLEMENT NEXT FEATURE
    ...
  `,
  model: 'sonnet'
});
```

### 2. TaskList for State Management

```typescript
const tasks = new TaskList([
  { id: '1', description: 'Implement login' },
  { id: '2', description: 'Add authentication' }
]);

tasks.markInProgress('1');
tasks.markComplete('1', { result: 'Login works!' });

const progress = tasks.getProgress();
// { total: 2, completed: 1, pending: 1, percentComplete: 50 }
```

### 3. Monologue for Readable Output

```typescript
const narrativeAgent = withMonologue(builder, {
  bufferSize: 5,
  onNarrative: (text) => {
    console.log(`🤖 Agent: "${text}"`);
    // "I'm reading the specification and planning the architecture..."
    // "I've implemented the login feature and I'm now testing it..."
  }
});
```

### 4. Workflow Orchestration

```typescript
const workflow = createWorkflow({
  name: 'LongRunning',
  tasks: loadedTasks,
  agents: { initializer, builder },
  
  async execute({ agents, state, tasks }) {
    // Your orchestration logic
    // Full control over session management
    // Progress tracking built-in
  }
});
```

## Project Structure

```
my_project/
├── feature_list.json         # 200+ test cases (source of truth)
├── app_spec.txt              # Application specification
├── init.sh                   # Setup script
├── claude-progress.txt       # Session progress notes
├── .git/                     # Git repository
└── [application files]       # Generated code
```

## Running with Dashboard

The dashboard provides real-time visualization of progress:

```bash
# Start with dashboard UI
bun run src/examples/autonomous-agent/dashboard.tsx
```

Dashboard shows:
- Progress bar (42/200 tasks complete)
- Current task being worked on
- Agent narrative (monologue)
- Recent completed tasks
- Runtime statistics
- Live git commits

## Feature List Format

```json
[
  {
    "category": "functional",
    "description": "User can log in with email and password",
    "steps": [
      "Navigate to login page",
      "Enter credentials", 
      "Click login button",
      "Verify redirect to dashboard"
    ],
    "passes": false
  }
]
```

**CRITICAL**: Only the `"passes"` field is ever modified. Features are never removed or edited.

## Prompts

### Initializer Prompt (`prompts/initializer.md`)

Creates the foundation:
- Generates 200+ test cases in `feature_list.json`
- Creates `init.sh` setup script
- Initializes git
- Sets up project structure
- Optionally starts implementation

### Builder Prompt (`prompts/builder.md`)

Incremental implementation:
- Gets bearings (read feature list, progress, git)
- Verifies previous work
- Implements one feature at a time
- Tests thoroughly
- Updates feature_list.json
- Commits progress
- Updates claude-progress.txt

## Example: Building a Claude.ai Clone

```bash
# 1. Create app specification
cat > my_project/app_spec.txt << 'EOF'
Build a fully functional clone of claude.ai with:
- Clean chat interface
- Streaming responses
- Conversation management
- Artifact rendering
- Project organization
...
EOF

# 2. Run autonomous agent
bun run src/examples/autonomous-agent/index.ts \
  --project-dir ./my_project \
  --model sonnet

# Agent will:
# - Generate 200+ test cases
# - Set up React + Express stack
# - Implement features incrementally
# - Test each feature
# - Run for hours/days until complete
```

## Comparison to Python Reference

| Python Version | bun-vi SDK |
|----------------|------------|
| `ClaudeSDKClient` | `createAgent()` |
| Manual event loop | `createWorkflow()` |
| Custom progress tracking | `TaskList` primitive |
| Print statements | `withMonologue()` |
| 500+ lines of boilerplate | ~100 lines clean code |

## Testing Strategy

**Docs-First Approach:**
1. Write this README showing ideal SDK usage
2. Implement code to match the documentation
3. Validate scripts run, type-check, and lint
4. Test first 3 iterations end-to-end

## Advanced: Custom Workflow Logic

```typescript
const workflow = createWorkflow({
  // ... agents and tasks
  
  async execute({ agents, state, tasks }) {
    let sessionCount = 0;
    
    // Initialization phase
    if (isFirstRun()) {
      console.log('🎬 Session 1: Initializing...');
      await agents.initializer.run('...', 'init');
      sessionCount++;
    }
    
    // Build phase
    while (!state.isComplete() && sessionCount < maxSessions) {
      sessionCount++;
      console.log(`\n🔨 Session ${sessionCount}: Building...`);
      
      // Verification pass
      const passingTests = tasks.filter(t => t.status === 'completed');
      if (passingTests.length > 0) {
        console.log('✅ Verifying previous work...');
        // Run verification logic
      }
      
      // Implementation
      const nextTask = tasks.find(t => t.status === 'pending');
      if (nextTask) {
        state.markInProgress(nextTask.id);
        
        await agents.builder.run(
          `Implement: ${nextTask.description}`,
          `session_${sessionCount}`
        );
        
        state.markComplete(nextTask.id);
      }
      
      // Progress report
      const progress = state.getProgress();
      console.log(`📊 Progress: ${progress.percentComplete}%`);
      
      // Auto-continue delay
      console.log('⏸️  Continuing in 3s...');
      await Bun.sleep(3000);
    }
    
    console.log('🎉 All features complete!');
  }
});
```

## Files in This Example

```
src/examples/autonomous-agent/
├── README.md                 # This file (docs-first!)
├── index.ts                  # Main entry point
├── src/
│   ├── agents/
│   │   ├── initializer.ts   # Initializer agent
│   │   └── builder.ts       # Builder agent
│   ├── workflow.ts          # Workflow orchestration
│   └── utils.ts             # Helpers (load tasks, etc)
├── dashboard/
│   ├── index.tsx            # Dashboard UI
│   └── server.ts            # WebSocket server
├── prompts/
│   ├── initializer.md       # Initializer prompt
│   ├── builder.md           # Builder prompt
│   └── app_spec.txt         # Example specification
└── package.json             # Scripts and dependencies
```

## Running the Demo

```bash
# Basic run
bun run autonomous-agent

# With custom project dir
bun run autonomous-agent --project-dir ./claude_clone

# Limit iterations for testing
bun run autonomous-agent --max-iterations 5

# With dashboard
bun run autonomous-agent:dashboard
```

## Next Steps

1. ✅ Read this README (you're here!)
2. 📝 Look at `prompts/initializer.md` and `prompts/builder.md`
3. 🔍 Check `src/agents/` for agent implementations
4. 🎯 Run the demo: `bun run autonomous-agent`
5. 🎨 Open dashboard: `bun run autonomous-agent:dashboard`

---

**This example demonstrates the power of bun-vi SDK:**
- Clean, type-safe agent creation
- Workflow orchestration made simple
- Built-in progress tracking
- Readable narrative output
- Production-ready patterns

**Build autonomous agents in TypeScript with confidence!** 🚀
