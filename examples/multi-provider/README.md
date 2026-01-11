# Multi-Harness Example

Demonstrates using multiple AI harnesses in a single reactive workflow.

## What This Shows

1. **Per-agent harnesses** - Each agent specifies its own `harness`
2. **Harness selection** - Choose harnesses based on task requirements
3. **Signal interoperability** - Signals work the same regardless of harness

## Architecture

```
workflow:start
      │
      ▼
┌───────────────┐
│   Analyzer    │ ──► [Claude] ──► analysis:complete
│   (Claude)    │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  Summarizer   │ ──► [Codex] ──► summary:complete
│   (Codex)     │
└───────────────┘
```

## Harness Selection Guidelines

| Harness | Best For | Trade-offs |
|---------|----------|------------|
| **Claude** | Nuanced analysis, complex reasoning, code review | Higher latency, higher cost |
| **Codex** | Fast tasks, summarization, simple transforms | Less nuanced, but faster |

## Running

```bash
# From repository root
bun run examples/multi-provider/index.ts
```

## Example Output

```
=== Multi-Harness Example ===

Demonstrating Claude + Codex in a single workflow.

=== Execution Summary ===

Duration: 8234ms
Agent Activations: 2

=== Signal Flow ===

[system] workflow:start
[analyzer] [claude] agent:activated
[analyzer] analysis:complete
[summarizer] [codex] agent:activated
[summarizer] summary:complete
[system] workflow:end

=== Harness Usage ===

- claude
- codex

=== Code Reviewed ===

function fetchUser(id) {
  const response = fetch('/api/users/' + id);
  return response.json();
}

=== Analysis (Claude) ===

{
  "issues": [
    "Missing await on fetch() call - response will be a Promise",
    "No error handling for failed requests",
    "String concatenation for URL is vulnerable to injection"
  ],
  "suggestions": [
    "Add async/await pattern",
    "Use template literals or URL builder",
    "Add try/catch with proper error handling"
  ],
  "quality": "needs-work"
}

=== Summary (Codex) ===

The code has critical issues including a missing await, no error handling, and potential URL injection vulnerability.
```

## Code Walkthrough

### 1. Create Multiple Harnesses

```typescript
// Claude for deep analysis
const claudeHarness = new ClaudeHarness({
  model: "claude-sonnet-4-20250514",
});

// Codex for quick tasks
const codexHarness = new CodexHarness({
  model: "gpt-4.1-nano",
});
```

### 2. Assign Harnesses to Agents

```typescript
const analyzer = agent({
  prompt: "Analyze this code...",
  activateOn: ["workflow:start"],
  emits: ["analysis:complete"],
  harness: claudeHarness,  // Uses Claude
});

const summarizer = agent({
  prompt: "Summarize the analysis...",
  activateOn: ["analysis:complete"],
  emits: ["summary:complete"],
  harness: codexHarness,  // Uses Codex
});
```

### 3. Run Without Default Harness

```typescript
const result = await runReactive({
  agents: { analyzer, summarizer },
  state: { code, analysis: null, summary: null },
  // No default harness - each agent has its own
});
```

## Harness Configuration

### Claude Harness

```typescript
const claude = new ClaudeHarness({
  model: "claude-sonnet-4-20250514",  // or "claude-opus-4-20250514"
});
```

### Codex Harness

```typescript
const codex = new CodexHarness({
  model: "gpt-4.1-nano",  // Fast, cost-effective
  // or "o4-mini" for more capable tasks
});
```

## Cost Optimization Patterns

### Use Claude Sparingly

Reserve Claude for tasks that benefit from its capabilities:
- Complex reasoning
- Nuanced analysis
- Code review with context

### Use Codex for Volume

Use Codex for high-volume, straightforward tasks:
- Summarization
- Simple transforms
- Quick validations

### Hybrid Approach

```typescript
// Claude analyzes, Codex formats
const analyst = agent({
  harness: claude,
  // Complex analysis...
});

const formatter = agent({
  harness: codex,
  // Format output...
});
```

## Next Steps

- See `examples/simple-reactive/` for basic patterns
- See `examples/trading-agent/` for complex workflows
- See `examples/testing-signals/` for testing patterns
