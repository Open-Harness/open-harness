# @open-harness/sdk

Event-driven workflow orchestration for multi-agent AI systems.

## Installation

```bash
bun add @open-harness/sdk
```

## Quick Start

Define a flow in YAML:

```yaml
name: hello-world
nodes:
  - id: researcher
    type: claude.agent
    input:
      prompt: "Research: {{ flow.input.topic }}"

  - id: summarizer
    type: claude.agent
    input:
      prompt: "Summarize this research: {{ researcher.text }}"

edges:
  - from: researcher
    to: summarizer
```

Run it:

```typescript
import { runFlow, parseFlowYaml } from "@open-harness/sdk";
import { readFileSync } from "node:fs";

const flow = parseFlowYaml(readFileSync("flow.yaml", "utf-8"));
const snapshot = await runFlow({ flow, input: { topic: "quantum computing" } });

console.log("Results:", snapshot.outputs);
```

## Features

- **Declarative Workflows**: Define agent pipelines in YAML
- **JSONata Expressions**: Powerful data bindings and conditional logic
- **Event-Driven Architecture**: Full observability through event streaming
- **State Management**: Track run state across executions
- **Replay Testing**: Record and replay flow executions
- **Claude Agent Integration**: Built-in support for Claude agents

## Documentation

- 📚 [Full Documentation](https://docs.open-harness.dev)
- 🚀 [Quickstart Tutorial](https://docs.open-harness.dev/docs/learn/quickstart)
- 🏗️ [Architecture](https://docs.open-harness.dev/docs/concepts/architecture)
- 📖 [API Reference](https://docs.open-harness.dev/docs/reference/api/hub)

## Development

```bash
# Clone the repo
git clone https://github.com/your-org/open-harness.git
cd open-harness/packages/sdk

# Install dependencies
bun install

# Run tests
bun run test

# Type checking
bun run typecheck

# Lint
bun run lint

# Build
bun run build
```

## Contributing

We welcome contributions! See the [main contributing guide](../../CONTRIBUTING.md) for details.

## License

MIT - see [LICENSE](../../LICENSE) for details.

---

**Status**: Alpha - APIs may evolve. Please report issues and provide feedback.
