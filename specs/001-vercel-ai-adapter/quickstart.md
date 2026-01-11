# Quickstart: Vercel AI SDK Adapter

**Branch**: `001-vercel-ai-adapter` | **Date**: 2025-01-05

Get Open Harness working with the Vercel AI SDK `useChat()` hook in 5 minutes.

---

## Prerequisites

- Node.js 18+ or Bun 1.0+
- A React/Next.js application
- Basic familiarity with Open Harness flows

## Installation

```bash
# Install the adapter and dependencies
bun add @open-harness/ai-sdk @open-harness/sdk ai
```

## Basic Usage

### 1. Create a Flow

Define your agent flow in YAML:

```yaml
# flows/chat.yaml
name: chat-flow
nodes:
  - id: assistant
    type: claude.agent
    input:
      prompt: "{{ flow.input.message }}"
      systemPrompt: "You are a helpful assistant."

edges: []
```

### 2. Set Up the Transport

Create a chat component using `useChat()`:

```tsx
// app/chat/page.tsx
'use client';

import { useChat } from '@ai-sdk/react';
import { OpenHarnessChatTransport } from '@open-harness/ai-sdk';
import { createHarness, parseFlowYaml } from '@open-harness/sdk';
import { useMemo } from 'react';

// Load your flow (in real app, this would come from a file/API)
const flowYaml = `
name: chat-flow
nodes:
  - id: assistant
    type: claude.agent
    input:
      prompt: "{{ flow.input.message }}"
edges: []
`;

export default function ChatPage() {
  // Create harness and transport once
  const transport = useMemo(() => {
    const flow = parseFlowYaml(flowYaml);
    const harness = createHarness({ flow });
    return new OpenHarnessChatTransport(harness.runtime);
  }, []);

  // Use the standard useChat hook
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    transport,
  });

  return (
    <div className="flex flex-col h-screen p-4">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-3 rounded-lg ${
              message.role === 'user' ? 'bg-blue-100 ml-auto' : 'bg-gray-100'
            }`}
          >
            {message.parts.map((part, i) => {
              if (part.type === 'text') {
                return <p key={i}>{part.text}</p>;
              }
              if (part.type === 'reasoning') {
                return (
                  <details key={i} className="text-sm text-gray-600">
                    <summary>Thinking...</summary>
                    <p>{part.text}</p>
                  </details>
                );
              }
              return null;
            })}
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 mt-4">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
          className="flex-1 p-2 border rounded"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
```

That's it! You now have a working chat interface powered by Open Harness.

---

## Configuration Options

### Enable Extended Thinking

Show the AI's reasoning process:

```tsx
const transport = new OpenHarnessChatTransport(harness.runtime, {
  sendReasoning: true, // Default: true
});
```

### Show Multi-Step Progress

Display step boundaries for multi-node flows:

```tsx
const transport = new OpenHarnessChatTransport(harness.runtime, {
  sendStepMarkers: true, // Default: true
});
```

### Access Flow Metadata

Get flow status and node outputs for custom UIs:

```tsx
const transport = new OpenHarnessChatTransport(harness.runtime, {
  sendFlowMetadata: true,  // Include flow:paused, flow:complete events
  sendNodeOutputs: true,   // Include node:complete outputs
});
```

---

## Displaying Tool Calls

Tool invocations are automatically included in message parts:

```tsx
{message.parts.map((part, i) => {
  // Check for tool parts (they have type 'tool-{toolName}' or 'dynamic-tool')
  if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
    const tool = part as ToolUIPart;
    return (
      <div key={i} className="bg-yellow-50 p-2 rounded text-sm">
        <strong>Tool: {tool.toolName}</strong>
        <pre>{JSON.stringify(tool.input, null, 2)}</pre>
        {tool.state === 'output-available' && (
          <pre className="text-green-600">
            {JSON.stringify(tool.output, null, 2)}
          </pre>
        )}
        {tool.state === 'error' && (
          <p className="text-red-600">{tool.errorText}</p>
        )}
      </div>
    );
  }
  // ... other part types
})}
```

---

## Multi-Agent Flows

For flows with multiple nodes, step markers help visualize progress:

```yaml
# flows/research.yaml
name: research-flow
nodes:
  - id: researcher
    type: claude.agent
    input:
      prompt: "Research: {{ flow.input.topic }}"

  - id: summarizer
    type: claude.agent
    input:
      prompt: "Summarize: {{ researcher.text }}"

edges:
  - from: researcher
    to: summarizer
```

```tsx
{message.parts.map((part, i) => {
  if (part.type === 'step-start') {
    return <hr key={i} className="my-4 border-dashed" />;
  }
  // ... other part types
})}
```

---

## Error Handling

Errors are surfaced through the `error` chunk type:

```tsx
const { messages, error } = useChat({ transport });

// Global error
{error && (
  <div className="bg-red-100 p-4 rounded">
    Error: {error.message}
  </div>
)}

// Per-message errors (in parts)
{message.parts.map((part, i) => {
  if (part.type === 'error') {
    return (
      <div key={i} className="text-red-600">
        {part.errorText}
      </div>
    );
  }
})}
```

---

## Next Steps

- **AI Elements**: Use [Vercel AI Elements](https://github.com/vercel/ai-elements) for pre-built chat components
- **Multi-Agent Patterns**: See [Open Harness docs](/docs/guides/flows/control-flow) for complex flows
- **Persistence**: Add RunStore for conversation history and resume
- **WebSocket**: Use WebSocketTransport for real-time bidirectional communication

---

## Troubleshooting

### Messages not appearing

1. Check that the flow is valid: `parseFlowYaml()` should not throw
2. Verify the runtime is running: `harness.runtime.getSnapshot().status`
3. Check browser console for errors

### Tool calls not showing

1. Ensure your flow has tools configured on the agent
2. Check that the agent is using tools (not all prompts trigger tools)

### Streaming feels slow

1. The adapter streams as events arrive - latency is from the LLM
2. Check network tab for chunk timing
3. Consider enabling `sendReasoning: true` to see thinking progress
