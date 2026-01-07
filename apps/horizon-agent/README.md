# Horizon Agent

A multi-agent implementation system that uses Claude-powered agents in iterative loops to implement features.

## Overview

Horizon Agent demonstrates the kernel's loop edge capability through a practical coder-reviewer workflow:

```
                    ┌──────────────────────────────────────┐
                    │                                      │
                    ▼                                      │
Feature Request → Planner → Coder → Reviewer ──(rejected)─┘
                              │
                              └──(approved)→ Done
```

**Key Innovation**: The `coder → reviewer → coder` loop is implemented using the kernel's loop edge feature, enabling controlled cycles in what would otherwise be a DAG.

## Architecture

```
apps/horizon-agent/
├── flows/                    # YAML flow definitions
│   ├── agent-loop.yaml       # Full planner→foreach→coder↔reviewer
│   ├── simple-loop.yaml      # Simple coder↔reviewer (for testing)
│   └── test-loop.yaml        # Echo nodes (no Claude, fast tests)
│
├── prompts/                  # Agent system prompts
│   ├── planner.md            # Task breakdown prompt
│   ├── coder.md              # Implementation prompt
│   └── reviewer.md           # Code review prompt
│
├── src/
│   ├── cli.ts                # CLI with run/start/status/pause/resume
│   ├── server.ts             # WebSocket server for remote control
│   ├── logger.ts             # Pino structured logging
│   └── index.ts              # Package exports
│
├── logs/                     # Runtime logs (gitignored)
│   └── horizon.log           # Structured JSON logs
│
└── tests/
    └── integration.test.ts   # E2E tests
```

## Quick Start

### Direct Execution (CLI)

```bash
# Run with Terminal UI (default)
bun run src/cli.ts run "Create a TypeScript function that validates email addresses" \
  --flow ./flows/simple-loop.yaml

# Run headless with verbose output (shows Claude messages)
bun run src/cli.ts run "Create a utility function" \
  --flow ./flows/simple-loop.yaml \
  --no-tui \
  --verbose
```

### Server Mode (WebSocket)

```bash
# Start server
bun run src/cli.ts start --port 3002

# In another terminal, connect and send commands
wscat -c ws://localhost:3002/ws
> { "type": "start", "input": { "feature": "Create add function" } }
> { "type": "status" }
> { "type": "pause" }
> { "type": "resume" }
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `run <feature>` | Execute flow directly with TUI or headless |
| `start` | Start WebSocket server |
| `status` | Get server status |
| `pause` | Pause running flow (server mode) |
| `resume` | Resume paused flow (server mode) |

### Run Options

| Option | Default | Description |
|--------|---------|-------------|
| `-f, --flow <path>` | `./flows/agent-loop.yaml` | Flow definition file |
| `-m, --max-iterations <n>` | `5` | Max review loop iterations |
| `--no-tui` | `false` | Disable Terminal UI (headless mode) |
| `-v, --verbose` | `false` | Show Claude messages (headless mode only) |

### TUI Keybindings

When running with the Terminal UI (default):

| Key | Action |
|-----|--------|
| `q` | Quit and abort flow |
| `p` | Pause flow execution |
| `r` | Resume paused flow |
| `i` | Inject message dialog |
| `?` | Toggle help panel |

## Flow Definitions

### simple-loop.yaml (Recommended for testing)

Simple coder → reviewer loop without planner or foreach:

```yaml
nodes:
  - id: coder
    type: claude.agent
    input:
      prompt: "Implement: {{ flow.input.feature }}"

  - id: reviewer
    type: claude.agent
    input:
      prompt: "Review: {{ coder.text }}"

edges:
  - from: coder
    to: reviewer
  - from: reviewer
    to: coder
    type: loop
    maxIterations: 3
    when:
      not:
        equals:
          var: reviewer.structuredOutput.passed
          value: true
```

### agent-loop.yaml (Full workflow)

Complete workflow with planner and foreach:

```yaml
nodes:
  - id: planner    # Breaks feature into tasks
  - id: task_loop  # Foreach over tasks
  - id: coder      # Inside foreach
  - id: reviewer   # Inside foreach

edges:
  - from: planner
    to: task_loop
  - from: coder
    to: reviewer
  - from: reviewer
    to: coder
    type: loop
    maxIterations: "{{ flow.input.maxReviewIterations }}"
    when: ...
```

## Observability

### Structured Logging

All events are logged to `logs/horizon.log` in JSON format:

```bash
# Tail logs in real-time
tail -f logs/horizon.log | bunx pino-pretty
```

Example log entries:

```json
{"level":"info","component":"node","nodeId":"coder","event":"start"}
{"level":"info","component":"node","event":"claude:complete","messageCount":18,"numTurns":8,"durationMs":45085}
{"level":"info","component":"flow","event":"loop:iterate","from":"reviewer","to":"coder","iteration":1}
```

### Event Types

| Event | Description |
|-------|-------------|
| `node:start` | Node execution started |
| `node:complete` | Node execution finished |
| `node:error` | Node execution failed |
| `loop:iterate` | Loop edge triggered |
| `claude:message` | Claude SDK message received |
| `claude:complete` | Claude agent finished |
| `user:inject` | User injected a message |

## Testing

### Unit Tests

```bash
# Run unit tests (no network)
bun test tests/
```

### E2E Testing Without Claude

Use `test-loop.yaml` with echo nodes:

```bash
bun run src/cli.ts run "test" --flow ./flows/test-loop.yaml
```

### E2E Testing With Claude

```bash
# This makes real Claude API calls
bun run src/cli.ts run "Create a simple add function" \
  --flow ./flows/simple-loop.yaml \
  --verbose
```

## Extending Horizon Agent

### Adding New Agents

1. Create a prompt file in `prompts/`:

```markdown
# prompts/tester.md

You are a test engineer. Write tests for the provided code.

## Output Format
Return JSON: { "tests": [...], "coverage": number }
```

2. Add the node to your flow:

```yaml
- id: tester
  type: claude.agent
  input:
    prompt: |
      {{ prompts/tester.md }}  # Note: promptFile not yet supported

      Code to test:
      {{ coder.text }}
```

### Adding New Node Types

Register custom nodes in `cli.ts`:

```typescript
import { myCustomNode } from "./nodes/my-custom.js";

async function registerNodePacks(registry: NodeRegistry): Promise<void> {
  // ... existing registrations
  registry.register(myCustomNode);
}
```

### Creating Custom Flows

1. Create a new YAML file in `flows/`
2. Define your nodes and edges
3. Use `type: loop` for any edges that need to cycle
4. Always specify `maxIterations` on loop edges

## Production Readiness Checklist

### Must Have

- [ ] **Timeout handling** - Add node-level timeouts for Claude calls
- [ ] **Cost tracking** - The `totalCostUsd` is available, expose it
- [ ] **Retry logic** - Handle transient Claude failures
- [ ] **Session persistence** - Save/resume flow state across restarts
- [ ] **Error recovery** - Graceful handling of partial failures

### Should Have

- [ ] **Metrics export** - Prometheus/StatsD integration
- [ ] **Rate limiting** - Prevent runaway Claude usage
- [ ] **Authentication** - Secure WebSocket connections
- [ ] **Audit logging** - Track who ran what flows
- [ ] **Input validation** - Sanitize user-provided features

### Nice to Have

- [ ] **Web UI** - React interface for flow visualization
- [ ] **Prompt versioning** - Track prompt changes over time
- [ ] **A/B testing** - Compare different prompt strategies
- [ ] **Cost budgets** - Hard limits on per-flow spending

## Known Limitations

1. **Resume is incomplete** - Pause works via abort signal, but true resume requires flow state persistence (planned in kernel).

2. **promptFile not supported** - Currently prompts must be inlined in YAML. Support for external prompt files requires kernel changes.

3. **No structured output validation** - Reviewer returns JSON but it's not validated against a schema.

4. **Single Claude model** - All agents use the same model. Multi-model support would require node configuration.

## Troubleshooting

### "Claude agent failed with subtype: error_max_turns"

The agent exceeded the turn limit. Increase `maxTurns` in the kernel's Claude provider:

```typescript
// packages/kernel/src/providers/claude.ts
maxTurns: 50, // Increase as needed
```

### Loop never terminates

Check that your reviewer is returning proper structured output:

```json
{ "passed": true, "feedback": "..." }
```

The `when` condition expects `reviewer.structuredOutput.passed` to be exactly `true`.

### Logs not appearing

Ensure the logs directory exists and is writable:

```bash
mkdir -p logs
touch logs/horizon.log
```

## Dependencies

- `@open-harness/kernel` - Flow execution engine
- `pino` - Structured logging
- `commander` - CLI framework
- `yaml` - YAML parsing

---

*Last updated: 2026-01-03*
