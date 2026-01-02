# Content Outlines: /guides/ (How-to Guides)

**Priority**: P3 - After Reference and Concepts
**Diátaxis Quadrant**: How-to Guides (Application + Practical)
**Audience**: Flow SDK Consumer, Node Type Developer
**Voice**: Direct, task-focused ("To do X, do Y"), assumes competence

---

## Design Principles for How-to Guides

1. **Title format**: "How to [verb] [noun]"
2. **Assume competence**: User knows basics, has a specific goal
3. **No teaching**: Link to tutorials/concepts if background needed
4. **Action only**: Steps to accomplish the task, nothing more
5. **Practical**: Address real-world scenarios

---

## Section: /guides/flows/

### Page: parse-yaml-flow.mdx
**Task**: Parse and validate YAML flow files
**Effort**: Small (1 hour)

**Content**:
1. Import parseFlowYaml
2. Read YAML file
3. Parse and get FlowYaml object
4. Handle parse errors
5. Validate with validateFlowYaml (optional)

**Code**: parseFlowYaml example, error handling

---

### Page: execute-flow.mdx
**Task**: Execute a compiled flow
**Effort**: Small (1 hour)

**Content**:
1. Prerequisites: parsed flow, NodeRegistry
2. Create execution context
3. Call executeFlow
4. Handle result
5. Access outputs

**Code**: Full execution example

---

### Page: flow-inputs.mdx
**Task**: Pass inputs to flows
**Effort**: Small (1 hour)

**Content**:
1. Define input schema in flow.yaml
2. Pass inputs via execution context
3. Access inputs in nodes via bindings
4. Validate inputs
5. Handle missing inputs

**Code**: Input passing examples

---

### Page: conditional-execution.mdx
**Task**: Conditionally skip nodes
**Effort**: Small (1-2 hours)

**Content**:
1. Add when clause to node
2. When operators (equals, and, or, not)
3. Reference bindings in conditions
4. Edge-level when (alternative)
5. Debug condition evaluation

**Code**: When clause examples

---

### Page: error-handling.mdx
**Task**: Handle flow execution errors gracefully
**Effort**: Medium (2-3 hours)

**Content**:
1. Types of errors (parse, validation, runtime)
2. Try/catch around executeFlow
3. Node-level error handling
4. Error events via Hub
5. Retry patterns
6. Graceful degradation

**Code**: Error handling patterns

---

## Section: /guides/nodes/

### Page: register-nodes.mdx
**Task**: Register custom node types with NodeRegistry
**Effort**: Small (1 hour)

**Content**:
1. Create NodeRegistry instance
2. Define NodeTypeDefinition
3. Call registry.register()
4. Verify registration
5. Handle duplicate names

**Code**: Registration example

---

### Page: node-schemas.mdx
**Task**: Define input/output schemas for nodes
**Effort**: Medium (2 hours)

**Content**:
1. Input schema with Zod
2. Output schema with Zod
3. Complex nested schemas
4. Optional fields
5. Schema validation behavior
6. Error messages

**Code**: Various schema examples

---

### Page: node-capabilities.mdx
**Task**: Declare node capabilities
**Effort**: Small (1 hour)

**Content**:
1. What capabilities are
2. Declaring capabilities in NodeTypeDefinition
3. Built-in capability types
4. Custom capabilities
5. Capability checking at runtime

**Code**: Capability declaration

---

### Page: async-nodes.mdx
**Task**: Build async node implementations
**Effort**: Medium (2 hours)

**Content**:
1. Async run function signature
2. Awaiting external calls
3. Timeout handling
4. Cancellation patterns
5. Error propagation
6. Progress reporting (via Hub)

**Code**: Async node with fetch, timeout handling

---

## Section: /guides/hub/

### Page: subscribe-events.mdx
**Task**: Subscribe to Hub events
**Effort**: Small (1 hour)

**Content**:
1. Create/get Hub instance
2. Subscribe with pattern
3. Event handler signature
4. Unsubscribe (cleanup)
5. Common patterns

**Code**: Subscription examples

---

### Page: emit-events.mdx
**Task**: Emit custom events to Hub
**Effort**: Small (1 hour)

**Content**:
1. Event structure
2. hub.emit() method
3. Custom event types
4. Event metadata
5. When to emit custom events

**Code**: Custom event emission

---

### Page: event-context.mdx
**Task**: Use EventContext for correlation
**Effort**: Medium (2 hours)

**Content**:
1. EventContext structure (sessionId, phase, task, agent)
2. Automatic context propagation (AsyncLocalStorage)
3. Accessing current context
4. Scoping by context in handlers
5. Creating child contexts

**Code**: Context access and scoping

---

### Page: scoped-subscriptions.mdx
**Task**: Scope subscriptions by context
**Effort**: Small (1 hour)

**Content**:
1. Filter events by sessionId
2. Filter by phase/task
3. Pattern matching in subscriptions
4. Combining filters

**Code**: Scoped subscription examples

---

## Section: /guides/channels/

### Page: attach-channel.mdx
**Task**: Attach a channel to Hub
**Effort**: Small (1 hour)

**Content**:
1. ChannelDefinition interface
2. attach() function signature
3. Cleanup function return
4. Attach to hub
5. Detachment/cleanup

**Code**: Basic channel attachment

---

### Page: console-channel.mdx
**Task**: Build a console channel for terminal I/O
**Effort**: Medium (2-3 hours)

**Content**:
1. Read from stdin
2. Write to stdout
3. Subscribe to agent responses
4. Emit user input commands
5. Interactive loop
6. Formatting output

**Code**: Complete console channel

---

### Page: voice-channel.mdx
**Task**: Integrate voice with rtv-channel
**Effort**: Medium (2-3 hours)

**Content**:
1. Install @open-harness/rtv-channel
2. Configure OpenAI Realtime
3. Create voice channel
4. Attach to Hub
5. Handle voice events
6. TUI integration (optional)

**Code**: Voice channel setup

---

### Page: bidirectional-io.mdx
**Task**: Handle inbox/outbox patterns for ongoing I/O
**Effort**: Medium (2-3 hours)

**Content**:
1. When bidirectional is needed
2. Inbox pattern overview
3. sendToRun() method
4. Receiving from inbox
5. Session management
6. WebSocket example

**Code**: Bidirectional communication

---

## Section: /guides/agents/

### Page: define-agent.mdx
**Task**: Define an AgentDefinition
**Effort**: Small (1-2 hours)

**Content**:
1. AgentDefinition interface
2. Required properties
3. run function implementation
4. Input/output types
5. Registration with harness

**Code**: Agent definition example

---

### Page: anthropic-agent.mdx
**Task**: Use the Anthropic provider
**Effort**: Medium (2 hours)

**Content**:
1. Import createAnthropicTextAgent
2. Configuration options
3. System prompt
4. Streaming vs blocking
5. Replay mode for testing
6. Auth (Claude Code subscription)

**Code**: Anthropic agent setup

---

### Page: agent-inbox.mdx
**Task**: Use agent inbox for bidirectional communication
**Effort**: Medium (2-3 hours)

**Content**:
1. What is agent inbox
2. Enabling inbox in agent
3. Sending to agent during execution
4. Reading from inbox in agent
5. Use cases (multi-turn, streaming)

**Code**: Inbox usage pattern

---

## Section: /guides/testing/

### Page: unit-tests.mdx
**Task**: Write unit tests for nodes
**Effort**: Medium (2 hours)

**Content**:
1. Test file structure (bun:test)
2. Import node directly
3. Call run() with mock input
4. Assert on output
5. Test error cases
6. Mock external dependencies

**Code**: Node unit test examples

---

### Page: replay-tests.mdx
**Task**: Record and replay API fixtures
**Effort**: Medium (2-3 hours)

**Content**:
1. Recording mode setup
2. Run flow to record
3. Fixture file format
4. Replay in tests
5. Update fixtures when API changes
6. Golden fixture management

**Code**: Recording and replay setup

---

### Page: live-tests.mdx
**Task**: Run live integration tests
**Effort**: Small (1-2 hours)

**Content**:
1. When to use live tests
2. Test file naming (.live.test.ts)
3. Running with `bun run test:live`
4. Auth requirements
5. Rate limiting considerations
6. CI/CD considerations

**Code**: Live test example

---

## Section: /guides/debugging/

### Page: debug-flows.mdx
**Task**: Debug flow execution issues
**Effort**: Medium (2-3 hours)

**Content**:
1. Enable verbose logging
2. Subscribe to all Hub events
3. Inspect node inputs/outputs
4. Check edge resolution
5. Validate flow before running
6. Common issues and fixes

**Code**: Debugging setup, common patterns

---

### Page: inspect-events.mdx
**Task**: Inspect Hub event stream
**Effort**: Small (1-2 hours)

**Content**:
1. Log all events
2. Filter by type
3. Structured logging
4. Event timeline visualization
5. Export to file

**Code**: Event inspection utilities

---

### Page: common-errors.mdx
**Task**: Fix common errors
**Effort**: Medium (3-4 hours)

**Content**:
1. Parse errors (YAML syntax)
2. Validation errors (schema)
3. Binding resolution failures
4. Node not found
5. Type mismatches
6. Runtime errors
7. Each with: cause, solution, example

**Code**: Error examples and fixes

---

### Page: binding-resolution.mdx
**Task**: Debug A3 binding issues
**Effort**: Small (1-2 hours)

**Content**:
1. Binding resolution order
2. Missing value handling
3. Type coercion issues
4. Debugging with logs
5. Common mistakes

**Code**: Debugging binding examples

---

## Effort Summary

| Section | Pages | Total Effort |
|---------|-------|--------------|
| flows | 5 | ~7 hours |
| nodes | 4 | ~6 hours |
| hub | 4 | ~5 hours |
| channels | 4 | ~8 hours |
| agents | 3 | ~5 hours |
| testing | 3 | ~5 hours |
| debugging | 4 | ~8 hours |

**Total P2 How-to Guides**: ~44 hours of content creation

---

## Index Page: /guides/index.mdx

**Purpose**: Find the right guide
**Effort**: Small (1 hour)

**Content**:
1. Brief intro (2 sentences)
2. Categorized links to all guides
3. Search/filter functionality (if Fumadocs supports)
4. "Most popular" or "Start here" callouts
