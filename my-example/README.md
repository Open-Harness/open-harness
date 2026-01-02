# How to Use Open Harness SDK Locally

Since the SDK isn't published to npm yet, you can use it directly from this monorepo.

## Quick Start

### 1. Install Dependencies

```bash
cd /tmp/open-harness
bun install
```

### 2. Create Your Script

Create a TypeScript file that imports from the SDK:

```typescript
import { executeFlow, createHub, NodeRegistry, corePack } from "../packages/kernel/src/index.js";
import { loadFlowYamlFile } from "../packages/kernel/src/flow/loader.js";

async function main() {
  // Load your flow YAML
  const flow = await loadFlowYamlFile("flow.yaml");

  // Create the event bus
  const hub = createHub("my-example");
  await hub.start();

  // Listen to events
  hub.subscribe((event) => {
    console.log(`[Event] ${event.type}`);
  });

  // Register node packs
  const registry = new NodeRegistry();
  corePack.register(registry);

  // Execute the flow
  const ctx = {
    hub,
    phase: async (name, fn) => fn(),
    task: async (id, fn) => fn(),
  };

  const result = await executeFlow(flow, registry, ctx);
  console.log("Outputs:", result.outputs);

  await hub.stop();
}

main();
```

### 3. Run It

```bash
cd /tmp/open-harness
bun run your-script.ts
```

## Alternative: Relative Imports

You can also use workspace dependencies if you create a package in the monorepo:

```json
{
  "name": "my-package",
  "type": "module",
  "dependencies": {
    "@open-harness/kernel": "workspace:*"
  }
}
```

Then import with:
```typescript
import { executeFlow, createHub } from "@open-harness/kernel";
```

## Core APIs

- **`createHub(sessionId)`** - Creates the event bus for communication
- **`loadFlowYamlFile(path)`** - Loads a flow YAML file
- **`NodeRegistry`** - Registry for node types
- **`corePack`** - Built-in node pack (echo, constant, condition, foreach)
- **`executeFlow(flow, registry, ctx, inputOverrides)`** - Executes a flow

## See Examples

- `packages/kernel-tutorial/lessons/` - Tutorial examples
- This directory (`my-example/`) - Simple example
