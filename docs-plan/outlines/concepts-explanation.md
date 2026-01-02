# Content Outlines: /concepts/ (Explanation)

**Priority**: P1 - Foundation (Do alongside Reference)
**Diátaxis Quadrant**: Explanation (Learning + Theoretical)
**Audience**: All (deeper understanding)
**Voice**: Discursive, reflective, connects ideas, presents rationale

---

## Design Principles for Explanation

1. **Understanding-oriented**: Build conceptual knowledge
2. **Discursive**: Permit reflection, make connections
3. **Context and rationale**: Why things are the way they are
4. **Bounded**: Each page has a clear topic scope
5. **Not instructional**: Link to tutorials/guides for how-to

---

## Section: /concepts/architecture/

### Page: overview.mdx
**Topic**: High-level architecture
**Effort**: Medium (3-4 hours)

**Content**:
1. **What is Open Harness?**
   - AI workflow orchestration framework
   - Built for declarative, event-driven workflows

2. **The Big Picture**
   - Visual: Architecture diagram (Hub at center, Flows, Agents, Channels)
   - How components fit together

3. **Design Philosophy**
   - Event-driven over imperative
   - Declarative over procedural
   - Composable primitives

4. **Why This Architecture?**
   - Testability (replay, fixtures)
   - Observability (all events via Hub)
   - Extensibility (custom nodes, channels)

5. **Historical Context**
   - Evolution from harness-based to flow-based
   - Why we consolidated

**Links**: Kernel primitives, harness-vs-flow

---

### Page: kernel-primitives.mdx
**Topic**: Hub, Agent, Channel, Flow - the core primitives
**Effort**: Large (4-5 hours)

**Content**:
1. **The Four Primitives**
   - Visual: Primitive relationship diagram

2. **Hub: The Central Nervous System**
   - What it is and why it exists
   - Events out, commands in
   - Why a central bus vs direct communication

3. **Agent: The Executor**
   - What agents do
   - Why this abstraction
   - Comparison to other frameworks

4. **Channel: The Adapter**
   - I/O boundary abstraction
   - Why channels vs direct I/O
   - Bidirectional pattern

5. **Flow: The Orchestrator**
   - DAG-based workflow
   - Why declarative YAML
   - Comparison to code-first

6. **How They Interact**
   - Flow uses Hub, registers Agents, attaches Channels
   - Event flow through the system

**Links**: Event-driven, harness-vs-flow

---

### Page: harness-vs-flow.mdx
**Topic**: When to use Harness (imperative) vs Flow (declarative)
**Effort**: Medium (3-4 hours)

**Content**:
1. **Two Runtime Models**
   - Harness: Code-first, imperative
   - Flow: YAML-first, declarative

2. **Historical Context**
   - Started with Harness
   - Added Flow for declarative use cases
   - Now Flow is primary

3. **When to Use Flow (Recommended)**
   - Standard AI workflows
   - Visual editing potential
   - Easy testing and modification

4. **When to Use Harness**
   - Complex programmatic logic
   - Dynamic workflow construction
   - Legacy compatibility

5. **Making the Choice**
   - Decision tree
   - Migration considerations

6. **The Future**
   - Flow-first direction
   - Harness as escape hatch

**Links**: dag-model, architecture overview

---

### Page: event-driven.mdx
**Topic**: Event-driven design philosophy
**Effort**: Medium (3-4 hours)

**Content**:
1. **Why Event-Driven?**
   - Decoupling
   - Observability
   - Testability

2. **Events vs Commands**
   - Events: Facts about what happened
   - Commands: Requests for action
   - Hub handles both

3. **Event Sourcing Lite**
   - Not full event sourcing, but event-centric
   - Replay testing based on events

4. **Trade-offs**
   - Indirection complexity
   - Debugging challenges
   - Benefits outweigh costs for AI workflows

5. **Comparison to Alternatives**
   - Direct function calls
   - Message queues
   - Actor model

**Links**: Hub event bus, context propagation

---

## Section: /concepts/flows/

### Page: dag-model.mdx
**Topic**: Understanding DAG execution
**Effort**: Medium (3-4 hours)

**Content**:
1. **What is a DAG?**
   - Directed Acyclic Graph basics
   - Why DAG for workflows

2. **Flow as a DAG**
   - Nodes are operations
   - Edges are data flow
   - Visual: Example flow DAG

3. **Execution Order**
   - Topological sort
   - Parallel execution of independent nodes
   - Why explicit edges matter

4. **Data Flow**
   - Bindings carry data between nodes
   - Output of one → Input of another

5. **Conditional Execution**
   - When expressions skip nodes
   - Doesn't break the DAG

6. **Why Not Other Models?**
   - State machines
   - Petri nets
   - Simple DAG is enough for most AI workflows

**Links**: binding-system, when-expressions

---

### Page: binding-system.mdx
**Topic**: Why A3 bindings work this way
**Effort**: Medium (3-4 hours)

**Content**:
1. **The Problem**
   - How do nodes share data?
   - Explicit vs implicit data flow

2. **A3 Binding Syntax**
   - `${{ nodeId.output.field }}`
   - Why this syntax
   - Design decisions

3. **Resolution**
   - When bindings resolve
   - Order of resolution
   - Error handling

4. **Alternatives Considered**
   - Direct references
   - Global state
   - Why A3 won

5. **Trade-offs**
   - Verbosity vs clarity
   - Runtime vs compile-time

**Links**: a3-syntax reference

---

### Page: when-expressions.mdx
**Topic**: Conditional execution model
**Effort**: Medium (2-3 hours)

**Content**:
1. **Why Conditions?**
   - Not all nodes should always run
   - Dynamic workflows

2. **When Expressions**
   - Operators: equals, and, or, not
   - Binding references in conditions

3. **Node-level vs Edge-level**
   - When on nodes: skip the node
   - When on edges: skip the edge
   - When to use each

4. **Design Rationale**
   - Simple expression language
   - Not Turing-complete (intentional)
   - Predictable evaluation

**Links**: operators reference

---

### Page: node-lifecycle.mdx
**Topic**: Node execution lifecycle
**Effort**: Medium (2-3 hours)

**Content**:
1. **Lifecycle Phases**
   - Registration
   - Input resolution
   - Execution
   - Output capture

2. **Schema Validation**
   - When validation happens
   - Error propagation

3. **Error Handling**
   - Node failures
   - Retry policies
   - Graceful degradation

4. **Events During Lifecycle**
   - What events are emitted
   - Observing node execution

**Links**: execute-flow reference, workflow-events

---

## Section: /concepts/hub/

### Page: event-bus.mdx
**Topic**: Hub as central event bus
**Effort**: Medium (3-4 hours)

**Content**:
1. **The Hub Concept**
   - Central nervous system metaphor
   - All events flow through Hub

2. **Why Central?**
   - Single point of observation
   - Consistent event handling
   - Simpler testing

3. **Patterns**
   - Pub/sub
   - Request/response
   - Event sourcing lite

4. **Comparison**
   - EventEmitter
   - Message brokers
   - Why Hub is different

**Links**: subscribe-events guide

---

### Page: context-propagation.mdx
**Topic**: AsyncLocalStorage and context
**Effort**: Medium (3-4 hours)

**Content**:
1. **The Problem**
   - How to correlate events?
   - Threading context through async

2. **AsyncLocalStorage**
   - Node.js mechanism
   - Automatic propagation

3. **EventContext**
   - sessionId, phase, task, agent
   - Hierarchical structure

4. **Why Automatic?**
   - No manual threading
   - Less error-prone
   - Consistent context

5. **Trade-offs**
   - "Magic" behavior
   - Debugging complexity
   - Worth it for correctness

**Links**: event-context type reference

---

### Page: commands-vs-events.mdx
**Topic**: Events out, commands in
**Effort**: Small (2-3 hours)

**Content**:
1. **The Distinction**
   - Events: Notifications of what happened
   - Commands: Requests for action

2. **Flow Direction**
   - Events flow out (to observers)
   - Commands flow in (from channels)

3. **Why Separate?**
   - Clear semantics
   - Easier reasoning
   - Better patterns

4. **Examples**
   - Event: agent:response
   - Command: user:input

**Links**: Hub reference

---

## Section: /concepts/channels/

### Page: adapter-pattern.mdx
**Topic**: Channel as adapter
**Effort**: Medium (2-3 hours)

**Content**:
1. **The Adapter Pattern**
   - Translate between worlds
   - Hub ↔ External I/O

2. **Channel Responsibilities**
   - Observe events
   - Inject commands
   - Manage lifecycle

3. **Why This Pattern?**
   - Separation of concerns
   - Testability
   - Swappable I/O

4. **Examples**
   - Console channel
   - WebSocket channel
   - Voice channel

**Links**: attach-channel guide

---

### Page: bidirectional.mdx
**Topic**: Understanding bidirectional I/O
**Effort**: Medium (2-3 hours)

**Content**:
1. **The Challenge**
   - Simple request/response isn't enough
   - Ongoing conversation, streaming

2. **Inbox Pattern**
   - Agent receives during execution
   - Not just at start

3. **Use Cases**
   - Multi-turn conversation
   - Streaming responses
   - User interruption

4. **Design Rationale**
   - Why inbox vs callbacks
   - Predictable async

**Links**: bidirectional-io guide, agent-inbox

---

## Section: /concepts/agents/

### Page: execution-model.mdx
**Topic**: How agents execute
**Effort**: Medium (2-3 hours)

**Content**:
1. **Agent Lifecycle**
   - Creation
   - Execution
   - Completion

2. **Run Function**
   - Input → Output
   - Access to Hub, context

3. **Async Execution**
   - Awaiting external calls
   - Streaming

4. **Integration with Flow**
   - Agent as node type
   - Event emission

**Links**: agent-definition reference

---

### Page: inbox-pattern.mdx
**Topic**: Inbox for bidirectional communication
**Effort**: Medium (2-3 hours)

**Content**:
1. **Why Inbox?**
   - Agents need input during execution
   - Not just at start

2. **How It Works**
   - sendToRun() pushes to inbox
   - Agent reads from inbox
   - Async/await

3. **Use Cases**
   - Human-in-the-loop
   - Multi-turn LLM conversation
   - External confirmations

4. **Design Decisions**
   - Queue vs callback
   - Ordering guarantees

**Links**: agent-inbox guide

---

## Section: /concepts/testing/

### Page: replay-model.mdx
**Topic**: Understanding fixture replay
**Effort**: Medium (3-4 hours)

**Content**:
1. **The Problem**
   - AI responses are non-deterministic
   - External APIs are slow/expensive

2. **Replay Testing**
   - Record API responses
   - Replay in tests
   - Deterministic execution

3. **Fixture Files**
   - What they contain
   - How they're organized
   - Golden fixtures

4. **Trade-offs**
   - Maintenance burden
   - Drift detection
   - Worth it for reliability

**Links**: replay-tests guide

---

### Page: conformance.mdx
**Topic**: Conformance testing philosophy
**Effort**: Medium (2-3 hours)

**Content**:
1. **What is Conformance?**
   - Implementation matches specification
   - Provable correctness

2. **Test Tiers**
   - Unit tests
   - Replay tests
   - Live tests

3. **Spec-to-Test Mapping**
   - How specs become tests
   - Traceability

4. **Gates**
   - What must pass
   - CI/CD enforcement

**Links**: testing guides, conformance guide

---

## Section: /concepts/design-decisions/

### Page: naming.mdx
**Topic**: Why "flow" not "workflow"
**Effort**: Small (1-2 hours)

**Content**:
- The decision and rationale
- Link to ADR

---

### Page: edges-required.mdx
**Topic**: Why explicit edges
**Effort**: Small (1-2 hours)

**Content**:
- The decision and rationale
- Trade-offs
- Link to ADR

---

### Page: bindings-a3.mdx
**Topic**: Why A3 binding syntax
**Effort**: Small (1-2 hours)

**Content**:
- The decision and rationale
- Alternatives considered
- Link to ADR

---

## Effort Summary

| Section | Pages | Total Effort |
|---------|-------|--------------|
| architecture | 4 | ~14 hours |
| flows | 4 | ~12 hours |
| hub | 3 | ~9 hours |
| channels | 2 | ~5 hours |
| agents | 2 | ~5 hours |
| testing | 2 | ~6 hours |
| design-decisions | 3 | ~4 hours |

**Total Concepts**: ~55 hours of content creation

---

## Cross-Linking Strategy

Concepts pages should liberally link to:
- **Tutorials**: "To try this, see [tutorial]"
- **Guides**: "For step-by-step, see [guide]"
- **Reference**: "For complete API, see [reference]"
- **Other Concepts**: "Related: [concept]"

This creates a web of understanding rather than isolated articles.
