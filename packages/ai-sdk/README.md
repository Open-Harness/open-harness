# @open-harness/ai-sdk

Vercel AI SDK adapter for Open Harness multi-agent flows.

## Installation

```bash
bun add @open-harness/ai-sdk @open-harness/sdk ai
```

## Basic Usage

```tsx
import { useChat } from '@ai-sdk/react';
import { OpenHarnessChatTransport } from '@open-harness/ai-sdk';
import { createHarness, parseFlowYaml } from '@open-harness/sdk';

const flow = parseFlowYaml(flowYaml);
const harness = createHarness({ flow });

function Chat() {
  const { messages, input, handleSubmit } = useChat({
    transport: new OpenHarnessChatTransport(harness.runtime),
  });
  // ...
}
```

## Configuration Options

- `sendReasoning` (default: `true`) - Include thinking/reasoning parts
- `sendStepMarkers` (default: `true`) - Include step-start parts for nodes
- `sendFlowMetadata` (default: `false`) - Include custom data parts for flow status
- `sendNodeOutputs` (default: `false`) - Include custom data parts for node outputs

## Documentation

See [specs/001-vercel-ai-adapter/quickstart.md](../../specs/001-vercel-ai-adapter/quickstart.md) for full documentation.
