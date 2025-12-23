# Integration Architecture

How the parts of Open Harness communicate and integrate.

## Dependency Graph

```
                    ┌─────────────────┐
                    │   @dao/config   │
                    │  (shared types) │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   @dao/sdk    │   │   apps/docs   │   │  apps/server  │
│  (core SDK)   │   │  (Next.js)    │   │    (Hono)     │
└───────┬───────┘   └───────────────┘   └───────────────┘
        │
        ▼
┌───────────────┐
│   @dao/cli    │
│ (imports SDK) │
└───────────────┘

┌───────────────┐
│ trading-bot   │ ← Standalone, demonstrates patterns
│ (standalone)  │   (doesn't import SDK directly)
└───────────────┘
```

## Integration Details

### CLI → SDK Integration

**Location:** `apps/cli/src/workflows/autonomous.ts`

**Integration Pattern:**
```typescript
import { createAgent, withMonologue } from "@dao/sdk";

// Create agents using SDK factory
const initializerAgent = createAgent({
  name: "InitializerAgent",
  prompt: initializerPrompt,
  model: initializerModel,
});

// Wrap with monologue for narrative output
const builderAgent = narratorEnabled
  ? withMonologue(baseBuilderAgent, {
      bufferSize: narratorBufferSize,
      onNarrative: (text) => console.log(`📖 ${text}`),
    })
  : baseBuilderAgent;

// Execute using SDK run method
await initializerAgent.run(prompt, sessionId, {
  permissionMode: "bypassPermissions",
  callbacks: {
    onText: (content) => process.stdout.write(content),
    onToolCall: (toolName) => console.log(`[Tool: ${toolName}]`),
    onResult: (result) => console.log(`Cost: $${result.total_cost_usd}`),
  },
});
```

**Data Flow:**
1. CLI loads YAML workflow config
2. CLI creates agents via `createAgent()`
3. CLI orchestrates execution loop
4. SDK handles Claude API interaction
5. Callbacks stream output to console

### CLI Configuration Schema

**Location:** `apps/cli/src/schemas/workflow.ts`

```typescript
const WorkflowConfigSchema = z.object({
  workflow: z.object({
    name: z.string(),
    type: z.literal("autonomous-coding"),
    projectDir: z.string(),
    maxIterations: z.number().optional(),
    autoContinueDelay: z.number().default(3000),
  }),
  agents: z.object({
    initializer: AgentConfigSchema.optional(),
    builder: AgentConfigSchema.optional(),
    narrator: NarratorConfigSchema.optional(),
  }).optional(),
});
```

### Trading Bot Pattern (Standalone)

The trading bot demonstrates SDK-like patterns without importing the SDK directly:

**Similar Patterns:**
- Custom `Container` class (`src/core/container.ts`)
- Workflow orchestration (`src/workflow/trading-workflow.ts`)
- Service injection pattern

**7-Stage Pipeline:**
```
OBSERVE → ANALYZE → VALIDATE → EXECUTE → NARRATE → MONITOR → FINAL_NARRATE
```

**Future Integration:**
The trading bot could import `@dao/sdk` to use:
- `createAgent()` for Claude-powered analysis
- `withMonologue()` for narrative trading logs
- `TaskList` for trade tracking

## Shared Configuration

### Workspace Package (`@dao/config`)

**Location:** `packages/config/`

**Purpose:** Shared TypeScript configuration

```json
// packages/config/tsconfig.base.json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true
  }
}
```

### Bun Catalog (Root package.json)

```json
{
  "workspaces": {
    "packages": ["apps/*", "packages/*"],
    "catalog": {
      "dotenv": "^17.2.2",
      "zod": "^4.1.13",
      "typescript": "^5",
      "@types/bun": "^1.3.4"
    }
  }
}
```

Packages use `catalog:` to reference shared versions:
```json
"dependencies": {
  "zod": "catalog:",
  "dotenv": "catalog:"
}
```

## Communication Patterns

### Current State

| From | To | Method | Status |
|------|-----|--------|--------|
| CLI | SDK | npm import | Working |
| Docs | Server | HTTP (planned) | Not implemented |
| Trading Bot | SDK | None | Standalone |

### Future Vision

```
┌─────────────┐     HTTP/WS      ┌─────────────┐
│  apps/docs  │ ◄──────────────► │ apps/server │
└─────────────┘                  └──────┬──────┘
                                        │
                                        │ imports
                                        ▼
                                 ┌─────────────┐
                                 │  @dao/sdk   │
                                 └─────────────┘
```

## Build & Development

### Turborepo Tasks

```json
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

**Build Order:**
1. `@dao/config` (base config)
2. `@dao/sdk` (core library)
3. `@dao/cli`, `apps/*` (applications)

### Development Commands

```bash
# Start all dev servers
bun run dev

# Start specific app
bun run dev:web     # docs site
bun run dev:server  # API server

# Build all
bun run build

# Type check all
bun run check-types
```

## API Contracts

### SDK Public API

```typescript
// Agent creation
function createAgent(type: BuiltInAgentType, options?: AgentOptions): BaseAgent;
function createAgent(config: AgentConfig, options?: AgentOptions): BaseAgent;
function createAgent(AgentClass: AgentClass, options?: AgentOptions): BaseAgent;

// Workflow creation
function createWorkflow<TAgents, TResult, TMeta>(
  config: WorkflowConfig<TAgents, TResult, TMeta>
): Workflow<TAgents, TResult, TMeta>;

// Monologue wrapper
function withMonologue(agent: BaseAgent, config?: MonologueConfig): MonologueWrappedAgent;

// Task management
class TaskList<TResult, TMeta> {
  add(input: TaskInput<TMeta>): Task<TResult, TMeta>;
  markInProgress(id: string): Task<TResult, TMeta>;
  markCompleted(id: string, result?: TResult): Task<TResult, TMeta>;
  getProgress(): TaskProgress;
}
```

### CLI YAML Schema

```yaml
# workflow.yaml
workflow:
  name: my-project
  type: autonomous-coding
  projectDir: ./output
  maxIterations: 10

agents:
  initializer:
    model: sonnet
    prompt: ./prompts/init.md
  builder:
    model: haiku
    prompt: ./prompts/build.md
  narrator:
    enabled: true
    bufferSize: 15
```

## Environment Variables

| Variable | Used By | Purpose |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | SDK | Claude API authentication |
| `REPLAY_MODE` | SDK | Enable replay mode |
| `CORS_ORIGIN` | Server | CORS configuration |

## Known Issues

1. **CLI "doesn't work"**: Integration issue between CLI and SDK - exact cause TBD
2. **Trading Bot isolation**: Doesn't import SDK, duplicates patterns
3. **Docs site empty**: No content beyond scaffold
4. **Server minimal**: Just a health check endpoint
