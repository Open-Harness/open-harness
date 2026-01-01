# Content Outlines: /learn/ (Tutorials)

**Priority**: P3 - After Reference and Concepts
**Diátaxis Quadrant**: Tutorials (Learning + Practical)
**Audience**: Flow SDK Consumer (beginner-intermediate)
**Voice**: First-person plural ("We will..."), encouraging, step-by-step

---

## Page: /learn/index.mdx

**Purpose**: Overview of learning path, orient new users
**Prereqs**: None
**Effort**: Small (1-2 hours)

### Content Sections

1. **Welcome to Open Harness**
   - One paragraph: What is Open Harness?
   - "Build declarative AI workflows using YAML and TypeScript"

2. **Learning Path**
   - Visual: Learning path diagram (quickstart → first-flow → deeper topics)
   - Suggested order: Quickstart (5 min) → First Flow (30 min) → Custom Node → Hub Events

3. **Prerequisites**
   - Bun installed (`curl -fsSL https://bun.sh/install | bash`)
   - Basic TypeScript knowledge
   - Familiarity with AI/LLM concepts (helpful but not required)

4. **Quick Links**
   - Cards linking to each tutorial with time estimate

### Code Examples Needed
- None (navigation page)

---

## Page: /learn/quickstart.mdx

**Purpose**: 5-minute "hello world" - user runs their first flow
**Prereqs**: Bun installed
**Effort**: Medium (2-4 hours)

### Content Sections

1. **What You'll Build**
   - Screenshot/output of the result
   - "By the end, you'll have a working flow that calls Claude"

2. **Step 1: Create Project**
   ```bash
   mkdir my-first-flow && cd my-first-flow
   bun init -y
   bun add @open-harness/kernel
   ```

3. **Step 2: Create Your Flow (YAML)**
   - Create `flow.yaml` with minimal flow
   - 2-3 nodes: input → agent → output
   - Explain nothing, just show

4. **Step 3: Run It**
   - Create `run.ts` with parseFlowYaml + executeFlow
   - `bun run run.ts`
   - Show expected output

5. **What Just Happened?**
   - 2-3 bullet points (keep brief)
   - "You created a DAG workflow that..."
   - Link to First Flow tutorial for details

6. **Next Steps**
   - Link to First Flow tutorial
   - Link to Concepts for understanding

### Code Examples Needed
- `flow.yaml` - minimal working flow
- `run.ts` - execution script

### Validation
- Must execute without errors
- Output should be visible and meaningful
- Total read-through: under 5 minutes

---

## Page: /learn/first-flow.mdx

**Purpose**: Complete tutorial - understand flow structure and execution
**Prereqs**: Completed Quickstart
**Effort**: Large (4-6 hours)

### Content Sections

1. **What You'll Learn**
   - Flow YAML structure
   - Nodes, edges, and data flow
   - Executing and observing results

2. **Project Setup**
   - Start fresh or continue from quickstart
   - Install dependencies

3. **Understanding Flow Structure**
   - Visual: DAG diagram of the flow we'll build
   - "A flow is a directed graph of nodes"
   - Brief (2 sentences) - don't over-explain

4. **Step 1: Define the Flow Header**
   ```yaml
   flow:
     name: greeting-flow
     version: "1.0"
     input:
       name: { type: string }
   ```
   - Explain each field briefly

5. **Step 2: Add Nodes**
   - Start with a constant node
   - Add a second node that uses the first node's output
   - Show binding syntax: `${{ nodeId.output.field }}`

6. **Step 3: Define Edges**
   - Explain why explicit edges
   - Show edge syntax
   - Visual: Updated DAG with edges

7. **Step 4: Execute the Flow**
   - Create TypeScript runner
   - Register node types
   - Parse and execute
   - Show output

8. **Step 5: Add an Agent Node**
   - Add Anthropic agent node
   - Configure with system prompt
   - Wire up edges
   - Run and see Claude respond

9. **Experimenting**
   - Try changing input
   - Try adding another node
   - Encourage experimentation

10. **Recap**
    - What we learned
    - Key takeaways
    - Links to next tutorials

### Code Examples Needed
- Complete `flow.yaml` at each step (incremental)
- `run.ts` - full execution script
- Output at each stage

### Validation
- Each step must produce visible output
- User should feel confident to experiment

---

## Page: /learn/custom-node.mdx

**Purpose**: Build a custom NodeTypeDefinition
**Prereqs**: First Flow tutorial
**Effort**: Large (4-6 hours)

### Content Sections

1. **What You'll Build**
   - A custom node that transforms data
   - Example: "UppercaseNode" that uppercases text

2. **Understanding Node Types**
   - Brief: What is a NodeTypeDefinition?
   - Input schema, output schema, run function
   - Visual: Node anatomy diagram

3. **Step 1: Define the Node Type**
   ```typescript
   const uppercaseNode: NodeTypeDefinition<
     { text: string },
     { result: string }
   > = {
     name: 'uppercase',
     inputSchema: z.object({ text: z.string() }),
     outputSchema: z.object({ result: z.string() }),
     run: async ({ input }) => ({
       result: input.text.toUpperCase()
     })
   };
   ```

4. **Step 2: Register the Node**
   - Create NodeRegistry
   - Register the node type
   - Explain registration

5. **Step 3: Use in Flow**
   - Update flow.yaml to use the new node
   - Wire up edges
   - Run and verify

6. **Step 4: Add Validation**
   - Schema validation with Zod
   - What happens on invalid input
   - Error handling in nodes

7. **Step 5: Async Operations**
   - Make the node async (fetch data, call API)
   - Handle errors gracefully
   - Return structured output

8. **Best Practices**
   - Keep nodes focused (single responsibility)
   - Clear input/output schemas
   - Error handling patterns

9. **Challenge**
   - Suggestion: Build a node that fetches weather
   - Or: Build a node that formats dates

### Code Examples Needed
- `uppercase-node.ts` - complete node implementation
- Updated `flow.yaml` using the node
- `run.ts` with registration
- Async node example

---

## Page: /learn/hub-events.mdx

**Purpose**: Subscribe to and handle Hub events
**Prereqs**: First Flow tutorial
**Effort**: Medium (3-4 hours)

### Content Sections

1. **What You'll Learn**
   - What the Hub is
   - How to subscribe to events
   - How to react to flow execution

2. **Understanding the Hub**
   - Visual: Hub as central event bus
   - Events flow out, commands flow in
   - Brief conceptual intro (3-4 sentences)

3. **Step 1: Create a Hub**
   ```typescript
   import { createHub } from '@open-harness/kernel';
   const hub = createHub();
   ```

4. **Step 2: Subscribe to All Events**
   ```typescript
   hub.subscribe('*', (event) => {
     console.log('Event:', event.type, event.payload);
   });
   ```
   - Run a flow and see all events

5. **Step 3: Subscribe to Specific Events**
   - Filter by event type
   - Show workflow:started, agent:response, workflow:completed
   - Explain event structure

6. **Step 4: Use Event Context**
   - EventContext: sessionId, phase, task, agent
   - How context is automatically propagated
   - Filter by context

7. **Step 5: Build an Event Logger**
   - Practical example: structured logging
   - Write events to console with formatting
   - Could extend to file/database

8. **Common Patterns**
   - Progress tracking
   - Error monitoring
   - Metrics collection

### Code Examples Needed
- Hub creation and subscription
- Event filtering
- Context usage
- Logger example

---

## Page: /learn/channels.mdx

**Purpose**: Attach a channel to Hub for I/O
**Prereqs**: Hub Events tutorial
**Effort**: Medium (3-4 hours)

### Content Sections

1. **What You'll Build**
   - A console channel that reads user input
   - Interactive flow execution

2. **Understanding Channels**
   - Channel as I/O adapter
   - Observes events, injects commands
   - Visual: Channel attached to Hub

3. **Step 1: Create a Simple Channel**
   ```typescript
   const consoleChannel: ChannelDefinition = {
     name: 'console',
     attach: (hub) => {
       // Subscribe to events
       // Return cleanup function
     }
   };
   ```

4. **Step 2: Handle Output Events**
   - Subscribe to agent:response
   - Print to console
   - Format nicely

5. **Step 3: Inject Input**
   - Read from stdin
   - Emit input command to Hub
   - Wire up to flow

6. **Step 4: Full Interactive Loop**
   - Complete console channel
   - Run flow interactively
   - User types, agent responds

7. **Understanding Bidirectional I/O**
   - Inbox pattern for ongoing conversation
   - When to use channels vs direct execution

### Code Examples Needed
- ConsoleChannel implementation
- Interactive flow runner
- Bidirectional example

---

## Page: /learn/testing.mdx

**Purpose**: Write tests for flows
**Prereqs**: First Flow, Custom Node tutorials
**Effort**: Medium (3-4 hours)

### Content Sections

1. **Why Test Flows?**
   - Deterministic verification
   - Catch regressions
   - Document expected behavior

2. **Testing Strategy**
   - Unit tests: Individual nodes
   - Replay tests: Flow execution with fixtures
   - Live tests: Real API calls (sparingly)

3. **Step 1: Unit Test a Node**
   - Direct node.run() testing
   - Zod schema validation
   - Mock dependencies

4. **Step 2: Record a Fixture**
   - Run flow in recording mode
   - Fixture captures API responses
   - Store in `recordings/golden/`

5. **Step 3: Replay Test**
   - Run flow with fixture
   - Deterministic execution
   - Assert on outputs

6. **Step 4: Test Error Cases**
   - Invalid input handling
   - Network failures
   - Graceful degradation

7. **Best Practices**
   - Keep fixtures small
   - Test edge cases
   - Don't over-mock

### Code Examples Needed
- Unit test for custom node
- Fixture recording setup
- Replay test example

---

## Page: /learn/advanced/conditional-flows.mdx

**Purpose**: When expressions and branching
**Prereqs**: First Flow tutorial
**Effort**: Medium (3-4 hours)

### Content Sections

1. **What You'll Learn**
   - When expressions syntax
   - Conditional node execution
   - Branching flow patterns

2. **When Expression Basics**
   - `when: { equals: [...] }`
   - Operators: equals, and, or, not
   - Binding references in conditions

3. **Step 1: Simple Condition**
   - Skip node based on input
   - Example: Only run if flag is true

4. **Step 2: Complex Conditions**
   - Combine operators
   - Reference previous node outputs
   - Practical example

5. **Step 3: Branching Patterns**
   - If/else with two paths
   - Multiple branches
   - Merge branches

6. **Edge-Level When**
   - Conditions on edges vs nodes
   - When to use each

### Code Examples Needed
- Simple conditional flow
- Complex branching flow
- Edge-level conditions

---

## Page: /learn/advanced/bindings-deep-dive.mdx

**Purpose**: Master A3 binding syntax
**Prereqs**: First Flow tutorial
**Effort**: Medium (2-3 hours)

### Content Sections

1. **Binding Syntax Overview**
   - `${{ expression }}` format
   - Path notation: `nodeId.output.field`

2. **Flow Input Bindings**
   - `${{ flow.input.fieldName }}`
   - Accessing nested input

3. **Node Output Bindings**
   - `${{ nodeId.output.field }}`
   - Chaining outputs

4. **Special Cases**
   - Missing values (undefined)
   - Default values
   - Type coercion

5. **Debugging Bindings**
   - Common errors
   - Resolution order
   - Logging for debugging

### Code Examples Needed
- Various binding patterns
- Error scenarios
- Debugging examples

---

## Page: /learn/advanced/multi-agent.mdx

**Purpose**: Orchestrate multiple agents
**Prereqs**: First Flow, Hub Events tutorials
**Effort**: Large (4-5 hours)

### Content Sections

1. **Multi-Agent Patterns**
   - Sequential agents
   - Parallel agents
   - Agent handoff

2. **Step 1: Sequential Flow**
   - Agent A → Agent B → Agent C
   - Data passing between agents

3. **Step 2: Parallel Execution**
   - Multiple agents running concurrently
   - Merge results

4. **Step 3: Agent Coordination**
   - Using Hub events for coordination
   - Shared context

5. **Best Practices**
   - Keep agent roles clear
   - Handle failures gracefully
   - Monitor with Hub events

### Code Examples Needed
- Sequential multi-agent flow
- Parallel execution example
- Coordination pattern

---

## Effort Summary

| Page | Effort | Priority |
|------|--------|----------|
| index | Small | P1 |
| quickstart | Medium | P1 - CRITICAL |
| first-flow | Large | P1 |
| custom-node | Large | P1 |
| hub-events | Medium | P1 |
| channels | Medium | P1 |
| testing | Medium | P1 |
| advanced/conditional-flows | Medium | P2 |
| advanced/bindings-deep-dive | Medium | P2 |
| advanced/multi-agent | Large | P2 |

**Total P1 Estimate**: ~20-30 hours of content creation
