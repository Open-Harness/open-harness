# Core

Shared contracts used across the V3 kernel. Everything else (runtime, registry,
transport, persistence) depends on the types and interfaces defined here.

## What's here
- Flow definition types (nodes, edges, state) and Zod schemas.
- Runtime command/event shapes.
- State store and patch interfaces.

## Structure
- types.ts: FlowDefinition/NodeDefinition/EdgeDefinition/WhenExpr + Zod schemas.
- events.ts: RuntimeEvent/RuntimeCommand/RuntimeStatus.
- state.ts: StateStore, StatePatch, CommandInbox.

## Usage
Use these types to validate flows and to shape events/commands sent across the
runtime and transports.

```ts
import { FlowDefinitionSchema } from "../core/types.js";

const flow = FlowDefinitionSchema.parse(rawFlow);
```

## Extending
- Add new RuntimeEvent or RuntimeCommand variants here and update emitters,
  listeners, and transports accordingly.
- Add new StatePatch operations and implement handling in StateStore
  implementations.
- Keep schemas and documentation synchronized with any new fields.
