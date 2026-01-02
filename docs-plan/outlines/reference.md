# Content Outlines: /reference/

**Priority**: P1 - Foundation (Do First)
**Diátaxis Quadrant**: Reference (Application + Theoretical)
**Audience**: All (lookup as needed)
**Voice**: Neutral, factual, technical, no opinions

---

## Design Principles for Reference

1. **Austere and factual**: No opinions, no instruction
2. **Structured consistently**: Every API page follows same format
3. **Complete**: All parameters, all options, all types
4. **Examples**: Short usage examples (not tutorials)
5. **Mirror product structure**: Organize by module/package

---

## Standard API Page Template

Each API reference page follows this structure:

```markdown
# [Function/Class Name]

Brief one-line description.

## Signature

\`\`\`typescript
function name<T>(param: Type): ReturnType
\`\`\`

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| param | Type | Yes/No | What it is |

## Returns

`ReturnType` - Description of return value

## Example

\`\`\`typescript
// Minimal working example
\`\`\`

## See Also

- Related function
- Related type
```

---

## Section: /reference/api/

### Page: index.mdx
**Purpose**: API reference overview and navigation
**Effort**: Small

**Content**:
- Module overview (kernel exports)
- Quick links to main functions
- Type exports overview

---

### Page: define-harness.mdx
**API**: defineHarness()
**Effort**: Medium (2-3 hours)

**Content**:
- Signature with generics (TInput, TState, TResult)
- Parameters: HarnessOptions object
  - name, agents, state, run
- Returns: HarnessFactory
- Example: Basic harness definition
- Related: HarnessFactory, ExecuteContext

---

### Page: hub.mdx
**API**: Hub class / createHub()
**Effort**: Medium (3-4 hours)

**Content**:
- createHub() factory
- Hub interface methods:
  - subscribe(pattern, handler)
  - emit(event)
  - scoped(context)
- Event patterns
- Example: Create, subscribe, emit
- Related: EventContext, BaseEvent

---

### Page: execute-flow.mdx
**API**: executeFlow()
**Effort**: Medium (2-3 hours)

**Content**:
- Signature
- Parameters: FlowYaml, NodeRegistry, ExecutionContext
- Returns: FlowResult
- Example: Full execution
- Related: compileFlow, parseFlowYaml

---

### Page: node-registry.mdx
**API**: NodeRegistry class
**Effort**: Medium (2-3 hours)

**Content**:
- Constructor
- Methods:
  - register(definition)
  - get(name)
  - has(name)
  - list()
- Example: Register custom nodes
- Related: NodeTypeDefinition

---

### Page: parse-flow.mdx
**API**: parseFlowYaml()
**Effort**: Small (1-2 hours)

**Content**:
- Signature
- Parameters: yaml string
- Returns: FlowYaml
- Throws: ParseError
- Example: Parse and handle errors

---

### Page: compile-flow.mdx
**API**: compileFlow()
**Effort**: Small (1-2 hours)

**Content**:
- Signature
- Parameters: FlowYaml
- Returns: CompiledFlow
- Validation performed
- Example: Compile and check

---

### Page: resolve-bindings.mdx
**API**: resolveBindings()
**Effort**: Small (1-2 hours)

**Content**:
- Signature
- Parameters: template, context
- Returns: resolved value
- Binding syntax reference
- Example: Resolution

---

### Page: evaluate-when.mdx
**API**: evaluateWhen()
**Effort**: Small (1-2 hours)

**Content**:
- Signature
- Parameters: WhenExpr, context
- Returns: boolean
- Operator semantics
- Example: Evaluation

---

### Page: anthropic-agent.mdx
**API**: createAnthropicTextAgent()
**Effort**: Medium (2-3 hours)

**Content**:
- Signature
- Parameters: config object
  - systemPrompt, model, replay options
- Returns: ExecutableAgent
- Auth notes (subscription)
- Example: Create and use

---

## Section: /reference/types/

### Page: flow-yaml.mdx
**Type**: FlowYaml interface
**Effort**: Medium (2-3 hours)

**Content**:
- Full interface definition
- Property breakdown:
  - flow (FlowMeta)
  - nodes (NodeSpec[])
  - edges (Edge[])
- Nested type references
- Example: Complete FlowYaml

---

### Page: node-spec.mdx
**Type**: NodeSpec interface
**Effort**: Medium (2-3 hours)

**Content**:
- Full interface
- Properties: id, type, input, when, policy, config
- Optional vs required
- Example: Various node specs

---

### Page: node-type-definition.mdx
**Type**: NodeTypeDefinition<TIn, TOut>
**Effort**: Medium (2-3 hours)

**Content**:
- Generic interface
- Properties: name, inputSchema, outputSchema, run, capabilities
- run function signature
- Example: Custom node type

---

### Page: agent-definition.mdx
**Type**: AgentDefinition interface
**Effort**: Small (1-2 hours)

**Content**:
- Full interface
- Properties breakdown
- Example: Agent definition

---

### Page: channel-definition.mdx
**Type**: ChannelDefinition interface
**Effort**: Small (1-2 hours)

**Content**:
- Full interface
- attach function signature
- Cleanup return type
- Example: Channel definition

---

### Page: event-context.mdx
**Type**: EventContext interface
**Effort**: Small (1-2 hours)

**Content**:
- Full interface
- Properties: sessionId, phase, task, agent
- Hierarchy explanation
- Example: Context usage

---

### Page: base-event.mdx
**Type**: BaseEvent union
**Effort**: Medium (2-3 hours)

**Content**:
- Union type definition
- All event types listed
- Common properties
- Discriminated union pattern
- Example: Event handling

---

### Page: enriched-event.mdx
**Type**: EnrichedEvent<T>
**Effort**: Small (1-2 hours)

**Content**:
- Generic interface
- Properties: id, timestamp, context, payload
- Example: Enriched event structure

---

## Section: /reference/schemas/

### Page: flow-yaml-schema.mdx
**Schema**: FlowYaml Zod schema
**Effort**: Medium (2 hours)

**Content**:
- Full Zod schema
- Validation rules
- Error messages
- Example: Validation usage

---

### Page: node-spec-schema.mdx
**Schema**: NodeSpec Zod schema
**Effort**: Small (1-2 hours)

**Content**:
- Schema definition
- Field validations
- Example

---

### Page: when-expr-schema.mdx
**Schema**: WhenExpr Zod schema
**Effort**: Small (1-2 hours)

**Content**:
- Schema definition
- Operator schemas
- Example

---

## Section: /reference/events/

### Page: workflow-events.mdx
**Events**: Workflow lifecycle
**Effort**: Medium (2-3 hours)

**Content**:
- workflow:started
- workflow:completed
- workflow:failed
- Each with: payload type, when emitted, example

---

### Page: agent-events.mdx
**Events**: Agent execution
**Effort**: Medium (2-3 hours)

**Content**:
- agent:started
- agent:response
- agent:completed
- agent:failed
- Each with payload and example

---

### Page: session-events.mdx
**Events**: Interactive session
**Effort**: Medium (2-3 hours)

**Content**:
- session:started
- session:message
- session:ended
- Each with payload and example

---

### Page: narrative-events.mdx
**Events**: Narrative/logging
**Effort**: Small (1-2 hours)

**Content**:
- narrative:log
- narrative:progress
- Each with payload and example

---

## Section: /reference/bindings/

### Page: a3-syntax.mdx
**Reference**: A3 binding syntax
**Effort**: Medium (2-3 hours)

**Content**:
- Syntax: `${{ expression }}`
- Path notation
- flow.input references
- nodeId.output references
- Nested paths
- Complete grammar

---

### Page: binding-errors.mdx
**Reference**: Binding error codes
**Effort**: Small (1-2 hours)

**Content**:
- Error code table
- Each with: code, cause, example, fix

---

## Section: /reference/when/

### Page: when-syntax.mdx
**Reference**: WhenExpr syntax
**Effort**: Medium (2 hours)

**Content**:
- Full syntax specification
- Node-level vs edge-level
- Complete grammar

---

### Page: operators.mdx
**Reference**: When operators
**Effort**: Small (1-2 hours)

**Content**:
- equals: signature, semantics, example
- and: signature, semantics, example
- or: signature, semantics, example
- not: signature, semantics, example

---

## Section: /reference/config/

### Page: harness-config.mdx
**Reference**: HarnessFactory configuration
**Effort**: Medium (2 hours)

**Content**:
- All configuration options
- Defaults
- Environment variables
- Example configurations

---

### Page: flow-config.mdx
**Reference**: Flow execution configuration
**Effort**: Small (1-2 hours)

**Content**:
- ExecutionContext options
- Timeout settings
- Concurrency options

---

## Section: /reference/kernel-spec/

**Note**: This section is auto-synced from `packages/kernel/docs/` via existing sync script.

### Page: index.mdx
**Purpose**: Entry point to kernel specification
**Effort**: Small (update existing)

**Content**:
- "For canonical specification details, see below"
- Links to spec sections
- Note: This is the source of truth

---

## Effort Summary

| Section | Pages | Total Effort |
|---------|-------|--------------|
| api | 10 | ~20 hours |
| types | 8 | ~15 hours |
| schemas | 3 | ~5 hours |
| events | 4 | ~8 hours |
| bindings | 2 | ~4 hours |
| when | 2 | ~3 hours |
| config | 2 | ~3 hours |
| kernel-spec | 1 + sync | ~1 hour |

**Total Reference**: ~59 hours of content creation

---

## Generation Strategy

Some reference pages can be partially auto-generated:

1. **Type pages**: Extract from TypeScript source
2. **Schema pages**: Extract from Zod definitions
3. **Event pages**: Extract from event type definitions

Manual effort focuses on:
- Examples
- Prose descriptions
- Cross-references
- Usage notes
