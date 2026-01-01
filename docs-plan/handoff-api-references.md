# Handoff: API Reference Documentation Phase

## Context

The Open Harness documentation site (111 pages) has been created with the following sections complete:
- Learn (tutorials)
- Guides (task-focused)
- Concepts (explanations)
- Reference structure (created but some pages are stubs)

**Current State**: Reference pages vary in completeness. Some are comprehensive (execute-flow, hub, parse-flow, compile-flow, flow-yaml types/schemas), while others are stubs (agent, channel, events, anthropic-agent, etc.).

## Objective

Complete all API reference pages with comprehensive documentation using Fumadocs components, particularly TypeTable for type definitions.

---

## Available Components

### TypeTable (already in mdx-components.tsx)

```tsx
import { TypeTable } from 'fumadocs-ui/components/type-table';

// Usage in MDX - each property is a TypeNode with these fields:
<TypeTable
  type={{
    propertyName: {
      type: 'string',              // Type signature (short) - REQUIRED
      description: 'Description',  // Additional description
      default: 'defaultValue',     // Default value
      required: true,              // Is required?
      deprecated: false,           // Is deprecated?
      typeDescription: 'string',   // Type signature (full) - optional
      typeDescriptionLink: '/link', // Link for the type - optional
    },
    optionalProp: {
      type: 'number',
      description: 'Optional property',
      required: false,
    },
  }}
/>
```

**TypeNode Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `ReactNode` | Yes | Short type signature |
| `description` | `ReactNode` | No | Field description |
| `default` | `ReactNode` | No | Default value |
| `required` | `boolean` | No | Whether field is required |
| `deprecated` | `boolean` | No | Whether field is deprecated |
| `typeDescription` | `ReactNode` | No | Full type signature |
| `typeDescriptionLink` | `string` | No | Link for the type |
| `parameters` | `ParameterNode[]` | No | For function types |
| `returns` | `ReactNode` | No | For function return types |

### Other Available Components

- `Steps` / `Step` - For step-by-step procedures
- `Accordion` / `Accordions` - For collapsible sections
- `Banner` - For callouts
- `Mermaid` - For diagrams
- `GithubInfo` - For repo info

---

## Pages to Complete

### High Priority (Stub Pages - Need Full Content)

| File | Lines | Status | Source File |
|------|-------|--------|-------------|
| `reference/api/agent.mdx` | 15 | Stub | `protocol/agent.ts` |
| `reference/api/channel.mdx` | 16 | Stub | `protocol/channel.ts` |
| `reference/api/events.mdx` | ~20 | Stub | `protocol/events.ts` |
| `reference/api/anthropic-agent.mdx` | ~20 | Stub | `providers/anthropic.ts` |
| `reference/api/define-harness.mdx` | ~20 | Stub | `engine/harness.ts` |
| `reference/api/flow-runtime.mdx` | ~20 | Stub | `flow/executor.ts` |
| `reference/api/resolve-bindings.mdx` | ~20 | Stub | `flow/bindings.ts` |
| `reference/api/evaluate-when.mdx` | ~20 | Stub | `flow/when.ts` |
| `reference/api/node-registry.mdx` | ~20 | Stub | `flow/registry.ts` |

### Type Pages to Verify

| File | Status | Source |
|------|--------|--------|
| `reference/types/node-spec.mdx` | Verify | `protocol/flow.ts` |
| `reference/types/node-type-definition.mdx` | Verify | `flow/registry.ts` |
| `reference/types/agent-definition.mdx` | Verify | `protocol/agent.ts` |
| `reference/types/channel-definition.mdx` | Verify | `protocol/channel.ts` |
| `reference/types/event-context.mdx` | Verify | `engine/events.ts` |
| `reference/types/base-event.mdx` | Verify | `protocol/events.ts` |
| `reference/types/enriched-event.mdx` | Verify | `protocol/events.ts` |

---

## Reference Template (Use for Consistency)

### API Function Template

```mdx
---
title: functionName
description: One-line description
---

# functionName

Brief description of what this function does.

## Signature

\`\`\`typescript
function functionName(param1: Type1, param2?: Type2): ReturnType
\`\`\`

## Parameters

<TypeTable
  type={{
    param1: {
      type: 'Type1',
      description: 'Description of param1',
    },
    param2: {
      type: 'Type2',
      description: 'Optional description',
      default: 'defaultValue',
    },
  }}
/>

## Returns

`ReturnType` - Description of return value.

## Throws

- `ErrorType` - When condition occurs

## Example

\`\`\`typescript
import { functionName } from "@open-harness/kernel";

const result = functionName(value);
\`\`\`

## See Also

- [Related API](/reference/api/related) - Description
- [Related Type](/reference/types/related) - Description
```

### Type/Interface Template

```mdx
---
title: TypeName
description: One-line description
---

# TypeName

Brief description of what this type represents.

## Definition

\`\`\`typescript
interface TypeName {
  property1: string;
  property2?: number;
}
\`\`\`

## Properties

<TypeTable
  type={{
    property1: {
      type: 'string',
      description: 'Description',
    },
    property2: {
      type: 'number',
      description: 'Optional description',
      default: 'undefined',
    },
  }}
/>

## Example

\`\`\`typescript
const example: TypeName = {
  property1: "value",
};
\`\`\`

## See Also

- [Related Type](/reference/types/related) - Description
```

---

## Source Files Reference

All types should be documented from the kernel source:

```
packages/kernel/src/
├── engine/
│   ├── events.ts      → EventContext, event enrichment
│   ├── harness.ts     → defineHarness, HarnessConfig
│   ├── hub.ts         → Hub implementation
│   └── inbox.ts       → AgentInbox implementation
├── flow/
│   ├── bindings.ts    → resolveBindings
│   ├── compiler.ts    → compileFlow, CompiledFlow
│   ├── executor.ts    → executeFlow, FlowExecutionContext
│   ├── parser.ts      → parseFlowYaml
│   ├── registry.ts    → NodeRegistry, NodeTypeDefinition
│   ├── validator.ts   → Flow validation
│   └── when.ts        → evaluateWhen, WhenExpr
├── protocol/
│   ├── agent.ts       → AgentDefinition, AgentExecuteContext
│   ├── channel.ts     → ChannelDefinition, ChannelContext
│   ├── events.ts      → BaseEvent, EnrichedEvent
│   ├── flow.ts        → FlowYaml, NodeSpec, Edge
│   ├── harness.ts     → HarnessDefinition
│   └── hub.ts         → Hub interface
└── providers/
    ├── anthropic.ts   → AnthropicAgent
    └── index.ts       → Provider exports
```

---

## Key Types from Source

### AgentDefinition (protocol/agent.ts)

```typescript
interface AgentDefinition<TIn = unknown, TOut = unknown> {
  name: string;
  emitsStartComplete?: boolean;
  execute(input: TIn, ctx: AgentExecuteContext): Promise<TOut>;
}

interface AgentExecuteContext {
  hub: Hub;
  inbox: AgentInbox;
  runId: string;
}

interface AgentInbox extends AsyncIterable<InjectedMessage> {
  pop(): Promise<InjectedMessage>;
  drain(): InjectedMessage[];
}
```

### ChannelDefinition (protocol/channel.ts)

```typescript
interface ChannelDefinition<TState> {
  name: string;
  state?: () => TState;
  onStart?: (ctx: ChannelStartContext<TState>) => void | Promise<void>;
  onComplete?: (ctx: ChannelCompleteContext<TState>) => void | Promise<void>;
  on: Record<string, ChannelHandler<TState>>;
}

interface ChannelContext<TState> {
  hub: Hub;
  state: TState;
  event: EnrichedEvent<BaseEvent>;
  emit: (event: BaseEvent) => void;
}
```

---

## Validation Checklist

For each API reference page:

- [ ] Accurate signature from source
- [ ] All parameters documented with types
- [ ] Return type documented
- [ ] Error conditions listed
- [ ] Working code example
- [ ] TypeTable used for complex types
- [ ] Cross-links to related pages
- [ ] Consistent with kernel source

---

## Commands

```bash
# Sync kernel docs (if updated)
bun run sync:kernel-docs

# Run dev server
cd apps/docs && bun run dev

# Verify no broken links
# (manual check via navigation)
```

---

## Example: Completing agent.mdx

Current (stub):
```mdx
---
title: Agent API
description: Agent definition and execution interface
---

Agents are executable units that implement business logic and emit events.

## Learn More
- [Agent Spec](/docs/reference/kernel-spec/spec/agent)
```

Should become (comprehensive):
```mdx
---
title: AgentDefinition
description: Define agents that execute business logic and emit events
---

# AgentDefinition

Agents are executable units that implement business logic, receive messages via inbox, and emit events through the Hub.

## Definition

\`\`\`typescript
interface AgentDefinition<TIn = unknown, TOut = unknown> {
  name: string;
  emitsStartComplete?: boolean;
  execute(input: TIn, ctx: AgentExecuteContext): Promise<TOut>;
}
\`\`\`

## Properties

<TypeTable
  type={{
    name: {
      type: 'string',
      description: 'Unique agent identifier',
      required: true,
    },
    emitsStartComplete: {
      type: 'boolean',
      description: 'Whether agent emits start/complete events',
      default: 'false',
      required: false,
    },
    execute: {
      type: '(input: TIn, ctx: AgentExecuteContext) => Promise<TOut>',
      description: 'Main execution function',
      required: true,
      typeDescriptionLink: '#agentexecutecontext',
    },
  }}
/>

## AgentExecuteContext

<TypeTable
  type={{
    hub: {
      type: 'Hub',
      description: 'Event bus for emitting events',
      required: true,
      typeDescriptionLink: '/docs/reference/api/hub',
    },
    inbox: {
      type: 'AgentInbox',
      description: 'Receive injected messages',
      required: true,
    },
    runId: {
      type: 'string',
      description: 'Unique execution identifier',
      required: true,
    },
  }}
/>

## Example

\`\`\`typescript
import type { AgentDefinition } from "@open-harness/kernel";

const myAgent: AgentDefinition<{ topic: string }, string> = {
  name: "researcher",
  emitsStartComplete: true,
  async execute(input, ctx) {
    ctx.hub.emit({
      type: "narrative",
      text: `Researching: ${input.topic}`,
    });

    // Check for injected messages
    const messages = ctx.inbox.drain();

    return `Research complete for ${input.topic}`;
  },
};
\`\`\`

## See Also

- [Hub API](/reference/api/hub) - Event emission
- [Agent Events](/reference/events/agent-events) - Event types
- [Agent Spec](/reference/kernel-spec/spec/agent) - Protocol specification
```

---

## Priority Order

1. **agent.mdx** - Core primitive
2. **channel.mdx** - Core primitive
3. **events.mdx** - Core primitive
4. **node-registry.mdx** - Flow execution
5. **define-harness.mdx** - Harness setup
6. **resolve-bindings.mdx** - A3 bindings
7. **evaluate-when.mdx** - Conditional execution
8. **anthropic-agent.mdx** - Provider
9. Verify all type pages match source
