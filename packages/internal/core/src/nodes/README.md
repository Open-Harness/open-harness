---
title: "Node Registry"
lastUpdated: "2026-01-07T16:37:37.893Z"
lastCommit: "72a1693673d110e1b19885762e3ceaafec16c6da"
lastCommitDate: "2026-01-07T16:12:52Z"
scope:
  - node-registry
  - contracts
  - extensibility
---

# Registry

Node registry and node type contracts. This is how the runtime looks up the
implementation behind each node in a flow.

## What's here
- NodeRunContext: the execution context passed to node implementations.
- NodeTypeDefinition: contract for node types (type id, schemas, run function).
- NodeRegistry: registration and lookup interface.

## Structure
- registry.ts: interfaces + DefaultNodeRegistry declaration.

## Usage
Register node types with a registry, then pass the registry into the runtime.

```ts
import { DefaultNodeRegistry } from "../registry/registry.js";

const registry = new DefaultNodeRegistry();
registry.register({
  type: "echo",
  run: async (_ctx, input: { text: string }) => ({ text: input.text }),
});
```

## Extending
- Add new node types by implementing NodeTypeDefinition.
- Use NodeRunContext.emit/state/signal to integrate with the runtime.
- Provide your own NodeRegistry if you need lazy loading or remote resolution.
