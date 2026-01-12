# Open Harness 1.1 Spec: Batteries Included

**Status**: Draft
**Date**: 2026-01-12
**Philosophy**: Convention over Configuration with Environment Escape Hatches

---

## Overview

Version 1.1 transforms Open Harness from an "infrastructure toolkit" into a "batteries-included framework". The goal: **zero-config workflows that just work**, with escape hatches for production deployments.

### Design Principles

1. **Zero Config First**: `workflow({ name, agents })` should work with no setup
2. **Smart Defaults**: Auto-detect paths, use sensible models, enable observability
3. **Environment Aware**: `NODE_ENV` controls behavior, not code changes
4. **Progressive Disclosure**: Simple things simple, complex things possible
5. **No Surprises**: File system writes only to `.open-harness/`, clearly documented

---

## The Dream API

### Level 1: Zero Config (Target: 80% of users)

```typescript
import { workflow } from "@open-harness/core";

const result = await workflow({
  name: "greeting-flow",
  agents: {
    greeter: "Say hello about the weather",
    responder: "Respond to the greeting warmly"
  }
});

console.log(result.state.greeter);   // "Hello! What a beautiful sunny day..."
console.log(result.state.responder); // "Thank you! Yes, the weather is lovely..."
```

**What happens automatically**:
- Claude Code path auto-detected
- Model defaults to `claude-3-5-haiku-latest` (or `OPEN_HARNESS_MODEL`)
- Agents run sequentially in declaration order
- Workflow ends when last agent completes
- Logs written to `.open-harness/logs/`
- Recording saved to `.open-harness/recordings/`
- Tool calls emitted as signals
- State values are clean strings (text extracted from responses)

### Level 2: Simple Overrides (Target: 15% of users)

```typescript
const result = await workflow({
  name: "greeting-flow",
  model: "claude-sonnet-4-20250514",
  agents: {
    greeter: "Say hello about the weather",
    responder: {
      prompt: "Respond to the greeting",
      activateOn: ["greeter:done"],  // Explicit dependency
      raw: true                       // Get full response object
    }
  },
  endWhen: (state) => state.responder !== null,
  recording: false,  // Disable recording for this run
});
```

### Level 3: Full Control (Target: 5% of users)

```typescript
import { workflow, createHarness, FileSignalStore } from "@open-harness/core";

const harness = createHarness({
  model: "claude-sonnet-4-20250514",
  claudePath: "/custom/path/to/cli.js",
  // ... full harness options
});

const store = new FileSignalStore("/custom/recordings");

const result = await workflow({
  name: "greeting-flow",
  harness,
  signalStore: store,
  agents: { ... },
  observability: {
    logging: {
      enabled: true,
      dir: "/var/log/open-harness",
      level: "debug",
      format: "json"
    },
    recording: {
      enabled: true,
      dir: "/var/recordings",
      format: "ndjson"
    },
    wideEvents: {
      enabled: true,
      endpoint: "https://otel.example.com/v1/traces",
      headers: { "Authorization": "Bearer ${OTEL_TOKEN}" }
    }
  }
});
```

---

## Auto-Detection

### Claude Code Path Resolution

Search order (first match wins):

```typescript
const CLAUDE_CODE_SEARCH_PATHS = [
  // Bun global
  `${HOME}/.bun/install/global/node_modules/@anthropic-ai/claude-code/cli.js`,
  // npm global (Unix)
  `/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js`,
  // npm global (macOS with nvm)
  `${HOME}/.nvm/versions/node/*/lib/node_modules/@anthropic-ai/claude-code/cli.js`,
  // npm global (Windows)
  `${APPDATA}/npm/node_modules/@anthropic-ai/claude-code/cli.js`,
  // yarn global
  `${HOME}/.config/yarn/global/node_modules/@anthropic-ai/claude-code/cli.js`,
  // pnpm global
  `${HOME}/.local/share/pnpm/global/*/node_modules/@anthropic-ai/claude-code/cli.js`,
  // Local node_modules (monorepo)
  `${CWD}/node_modules/@anthropic-ai/claude-code/cli.js`,
  // Parent node_modules
  `${CWD}/../node_modules/@anthropic-ai/claude-code/cli.js`,
];
```

**Override**: `OPEN_HARNESS_CLAUDE_PATH` environment variable

**Error on failure**:
```
Error: Could not auto-detect Claude Code installation.

Searched:
  - ~/.bun/install/global/node_modules/@anthropic-ai/claude-code/cli.js
  - /usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js
  - ... (list all searched paths)

Solutions:
  1. Install Claude Code globally: npm install -g @anthropic-ai/claude-code
  2. Set OPEN_HARNESS_CLAUDE_PATH=/path/to/cli.js
  3. Pass claudePath option to createHarness()
```

### Model Resolution

Priority order:
1. `model` option in workflow/harness config
2. `OPEN_HARNESS_MODEL` environment variable
3. Default: `claude-3-5-haiku-latest`

---

## Directory Convention

```
.open-harness/
├── logs/
│   ├── 2026-01-12T10-30-00_greeting-flow.log
│   └── 2026-01-12T10-35-22_research-flow.log
├── recordings/
│   ├── 2026-01-12T10-30-00_greeting-flow.json
│   └── 2026-01-12T10-35-22_research-flow.json
└── config.json  # Optional project-level config
```

**File naming**: `{ISO-timestamp}_{workflow-name}.{ext}`

**Creation behavior**:
- Directory created on first write
- `.gitignore` entry suggested in CLI output (once)
- `recordings/` can be committed for replay/testing

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPEN_HARNESS_MODEL` | Default model for all harnesses | `claude-3-5-haiku-latest` |
| `OPEN_HARNESS_CLAUDE_PATH` | Path to Claude Code cli.js | Auto-detect |
| `OPEN_HARNESS_LOG_DIR` | Log directory | `.open-harness/logs` |
| `OPEN_HARNESS_RECORDING_DIR` | Recording directory | `.open-harness/recordings` |
| `OPEN_HARNESS_MODE` | Preset mode override | Based on `NODE_ENV` |
| `NODE_ENV` | Standard Node environment | `development` |

### Mode Behavior

| Feature | `development` | `production` | `test` |
|---------|---------------|--------------|--------|
| Logging to disk | ✅ | ❌ (stdout) | ❌ |
| Recording to disk | ✅ | ❌ | ✅ (for replay) |
| Wide events | ✅ (local) | ✅ (OTLP) | ❌ |
| Verbose errors | ✅ | ❌ | ✅ |
| Auto-detect paths | ✅ | ✅ | ✅ |
| Tool call signals | ✅ | ✅ | ✅ |

---

## Agent Configuration

### Short Form (string)

```typescript
agents: {
  greeter: "Say hello about the weather"
}
```

Expands to:
```typescript
agents: {
  greeter: {
    prompt: "Say hello about the weather",
    activateOn: [],        // Activates based on position (see below)
    updates: "greeter",    // Updates state key matching agent name
    raw: false             // Extract text content
  }
}
```

### Full Form (object)

```typescript
agents: {
  greeter: {
    prompt: "Say hello about the weather",
    activateOn: ["workflow:start"],  // Explicit trigger
    updates: "greeting",              // Custom state key
    emits: ["greeting:done"],         // Custom signal
    raw: true,                        // Keep full response
    model: "claude-sonnet-4-20250514",          // Override model for this agent
  }
}
```

### Sequential Activation Default

When `activateOn` is not specified, agents activate sequentially by declaration order:

```typescript
agents: {
  first: "...",   // activateOn: ["workflow:start"]
  second: "...",  // activateOn: ["first:done"]
  third: "..."    // activateOn: ["second:done"]
}
```

This means declaration order matters. First agent starts on workflow start, each subsequent agent waits for previous.

**Override with explicit `activateOn`**:
```typescript
agents: {
  a: "...",
  b: { prompt: "...", activateOn: ["workflow:start"] },  // Parallel with 'a'
  c: { prompt: "...", activateOn: ["a:done", "b:done"] } // Waits for both
}
```

---

## Signal Types

### Core Signals (always emitted)

| Signal | Payload | When |
|--------|---------|------|
| `workflow:start` | `{ name, state, timestamp }` | Workflow begins |
| `workflow:end` | `{ name, state, duration }` | Workflow completes |
| `workflow:error` | `{ name, error, state }` | Unhandled error |
| `{agent}:start` | `{ agent, prompt, state }` | Agent activation |
| `{agent}:done` | `{ agent, response, state }` | Agent completes |
| `{agent}:error` | `{ agent, error }` | Agent errors |

### Tool Signals (NEW in 1.1)

| Signal | Payload | When |
|--------|---------|------|
| `harness:tool:call` | `{ agent, tool, args, callId }` | Tool invoked |
| `harness:tool:result` | `{ agent, tool, result, callId, duration }` | Tool returns |
| `harness:tool:error` | `{ agent, tool, error, callId }` | Tool fails |

**Example**: When an agent uses the Task tool:
```typescript
// Signal emitted:
{
  type: "harness:tool:call",
  payload: {
    agent: "researcher",
    tool: "Task",
    args: {
      prompt: "Search for recent news about...",
      subagent_type: "Explore"
    },
    callId: "tc_abc123"
  },
  timestamp: "2026-01-12T10:30:00.000Z"
}
```

---

## Response Handling

### Default: Text Extraction

By default, agent responses are extracted to clean text:

```typescript
const result = await workflow({
  agents: { greeter: "Say hello" }
});

// result.state.greeter is a string:
"Hello! It's a beautiful day today."
```

### Raw Mode

With `raw: true`, get the full response object:

```typescript
const result = await workflow({
  agents: {
    greeter: { prompt: "Say hello", raw: true }
  }
});

// result.state.greeter is the full object:
{
  role: "assistant",
  content: "Hello! It's a beautiful day today.",
  model: "claude-3-5-haiku-latest",
  usage: { input_tokens: 10, output_tokens: 15 },
  // ... full metadata
}
```

### Utility Function

```typescript
import { getCleanState } from "@open-harness/core";

const result = await workflow({ ... });
const clean = getCleanState(result.state);
// All values converted to clean strings
```

---

## Configuration File

Optional `.open-harness/config.json`:

```json
{
  "model": "claude-3-5-haiku-latest",
  "claudePath": null,
  "observability": {
    "logging": {
      "enabled": true,
      "level": "info"
    },
    "recording": {
      "enabled": true,
      "format": "json"
    },
    "wideEvents": {
      "enabled": false
    }
  }
}
```

**Precedence**: Code options > Environment variables > Config file > Defaults

---

## Logging Format

### Development (human-readable)

```
[10:30:00.123] INFO  workflow:start name=greeting-flow
[10:30:00.125] INFO  greeter:start prompt="Say hello about..."
[10:30:01.456] DEBUG harness:tool:call tool=Task agent=greeter
[10:30:03.789] DEBUG harness:tool:result tool=Task duration=2333ms
[10:30:04.012] INFO  greeter:done duration=3887ms
[10:30:04.015] INFO  responder:start prompt="Respond to..."
[10:30:05.234] INFO  responder:done duration=1219ms
[10:30:05.236] INFO  workflow:end duration=5113ms
```

### Production (JSON lines)

```json
{"level":"info","event":"workflow:start","name":"greeting-flow","timestamp":"2026-01-12T10:30:00.123Z"}
{"level":"info","event":"greeter:start","agent":"greeter","timestamp":"2026-01-12T10:30:00.125Z"}
{"level":"debug","event":"harness:tool:call","tool":"Task","agent":"greeter","timestamp":"2026-01-12T10:30:01.456Z"}
```

---

## Recording Format

### JSON (default)

```json
{
  "workflow": "greeting-flow",
  "startedAt": "2026-01-12T10:30:00.123Z",
  "completedAt": "2026-01-12T10:30:05.236Z",
  "duration": 5113,
  "finalState": {
    "greeter": "Hello! What a beautiful sunny day...",
    "responder": "Thank you! Yes, the weather is lovely..."
  },
  "signals": [
    { "type": "workflow:start", "payload": {...}, "timestamp": "..." },
    { "type": "greeter:start", "payload": {...}, "timestamp": "..." },
    // ... all signals
  ],
  "metadata": {
    "model": "claude-3-5-haiku-latest",
    "openHarnessVersion": "1.1.0",
    "nodeVersion": "20.10.0"
  }
}
```

### NDJSON (for streaming/large workflows)

Each line is a signal:
```
{"type":"workflow:start","payload":{...},"timestamp":"..."}
{"type":"greeter:start","payload":{...},"timestamp":"..."}
```

---

## Error Messages

All errors should be actionable with clear solutions:

```
OpenHarnessError: Could not auto-detect Claude Code installation

Searched locations:
  ✗ ~/.bun/install/global/node_modules/@anthropic-ai/claude-code/cli.js
  ✗ /usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js

Solutions:
  1. Install globally: npm install -g @anthropic-ai/claude-code
  2. Set environment: export OPEN_HARNESS_CLAUDE_PATH=/path/to/cli.js
  3. Configure in code: workflow({ claudePath: "/path/to/cli.js", ... })

Documentation: https://open-harness.dev/docs/setup#claude-code
```

---

## Migration from 1.0

### Breaking Changes

None. All existing APIs continue to work.

### New Exports

```typescript
// New in 1.1
export { workflow } from "@open-harness/core";          // Dream API
export { getCleanState } from "@open-harness/core";     // Utility
export { FileSignalStore } from "@open-harness/core";   // New store type

// Existing (unchanged)
export { createWorkflow, ClaudeHarness, MemorySignalStore, ... };
```

### Deprecations

None in 1.1. The low-level API remains for power users.

---

## Implementation Checklist

### Phase 1: Core Dream API
- [ ] `workflow()` function export
- [ ] Agent short form (string) support
- [ ] Sequential activation by declaration order
- [ ] Auto `endWhen` (last agent completes)
- [ ] Text extraction by default

### Phase 2: Auto-Detection
- [ ] Claude Code path search
- [ ] Model from environment
- [ ] Helpful error messages with solutions

### Phase 3: Observability
- [ ] `.open-harness/` directory convention
- [ ] Logging with NODE_ENV awareness
- [ ] Recording on by default (dev)
- [ ] Tool call signals (`harness:tool:call`, `harness:tool:result`)
- [ ] Wide event emission

### Phase 4: Configuration
- [ ] Environment variable support
- [ ] `.open-harness/config.json` support
- [ ] Mode presets (development/production/test)

### Phase 5: Polish
- [ ] `getCleanState()` utility
- [ ] `FileSignalStore` for disk persistence
- [ ] Documentation update
- [ ] Migration guide

---

## Open Questions

1. **Should recordings be git-committed by default?**
   - Pro: Enables replay testing, reproducibility
   - Con: Can grow large, may contain sensitive data
   - Proposal: Add to `.gitignore` suggestion, document use cases

2. **Wide events destination in production?**
   - Option A: OTLP endpoint (configurable)
   - Option B: Stdout as structured JSON
   - Option C: Both, configurable
   - Proposal: Default to stdout JSON, OTLP opt-in

3. **Should we support OpenAI harness in dream API?**
   - Current: Only Claude harness
   - Proposal: Add `provider: "openai" | "claude"` option for 1.2

---

## Success Metrics

1. **Time to first workflow**: < 5 minutes from install to running workflow
2. **Lines of code for basic workflow**: < 15 lines
3. **Zero config works**: 80% of users never touch configuration
4. **Error actionability**: 100% of errors have suggested solutions
