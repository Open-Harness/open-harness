# Examples

Working examples showing the Promise + Callbacks pattern.

## The Pattern

Every agent call follows the same pattern:

```typescript
await agent.run(prompt, sessionId, {
  model: "haiku",
  callbacks: {
    // Session lifecycle
    onSessionStart: (metadata, event) => { ... },
    onSessionEnd: (message, isError, event) => { ... },

    // Content
    onText: (content, event) => { ... },
    onThinking: (thought, event) => { ... },

    // Tools
    onToolCall: (toolName, input, event) => { ... },
    onToolResult: (result, event) => { ... },
    onToolProgress: (toolName, elapsedSeconds, event) => { ... },

    // Results
    onResult: (result, event) => { ... },
    onError: (error, event) => { ... },
  }
});
```

## Callbacks Reference

| Callback | When Fired | Data |
|----------|------------|------|
| `onSessionStart` | Session initialized | `metadata: { model, tools, cwd }` |
| `onText` | Text content received | `content: string` |
| `onThinking` | Extended thinking | `thought: string` |
| `onToolCall` | Tool invocation | `toolName, input` |
| `onToolResult` | Tool completed | `result: { content, is_error }` |
| `onToolProgress` | Tool running | `toolName, elapsedSeconds` |
| `onResult` | Final result | `{ success, duration_ms, usage, structured_output }` |
| `onSessionEnd` | Session ended | `message, isError` |
| `onError` | Error occurred | `error: string` |

## Examples

### basic-agent.ts
Standard usage with core callbacks.
```bash
bun src/examples/basic-agent.ts
```

### callbacks.ts
All callback types demonstrated.
```bash
bun src/examples/callbacks.ts
```

### workflow-demo.ts
Multi-agent workflow with shared callbacks.
```bash
bun src/examples/workflow-demo.ts
```

### recording-demo.ts
Record and replay sessions.
```bash
bun src/examples/recording-demo.ts
```

### callback-validation.ts
Validates all callbacks fire correctly.
```bash
bun src/examples/callback-validation.ts
```

## Key Point

No async generators. No `for await`. Just:
1. `await` the Promise
2. Handle events in callbacks
