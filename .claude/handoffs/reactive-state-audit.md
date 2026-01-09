# Reactive State Impact Audit

## Mission
Audit the Open Harness codebase to understand the full impact of introducing signals-based reactive state. This is preparatory work for a major architectural change.

## Background

### What We're Adding
A signals-based reactive state system using `@maverick-js/signals`:

```typescript
// Three state layers:
HarnessState   // Definition-time: schema, tools, model, systemPrompt (persists)
RunState       // Per-execution: messages, metrics, status (ephemeral)
DerivedState   // Computed: isRunning, totalTokens, hasSchema (read-only)

// Access patterns:
const schema = harnessState.outputSchema()     // Read (call signal)
harnessState.setOutputSchema(newSchema)        // Write (call setter)
effect(() => console.log(harnessState.tools())) // React to changes
```

### Why This Matters
1. Fixes broken schema flow (schema defined in agent() doesn't reach provider)
2. Enables runtime configuration changes (add tools mid-conversation)
3. Unifies state access patterns across codebase
4. Simplifies code by removing manual state threading

## Your Task

Fan out 6 parallel audit agents. Collect their findings. Synthesize into actionable impact report.

---

## Audit Agent Prompts

### Agent 1: State Pattern Inventory
```
OBJECTIVE: Catalog all existing state management patterns

SEARCH SCOPE:
- packages/internal/core/src/state/
- packages/internal/core/src/api/
- packages/internal/core/src/runtime/

FIND:
1. StateStore interface and implementations
2. Snapshot mechanisms
3. Context passing patterns (NodeRunContext)
4. Any reactive/observable patterns already present

FOR EACH PATTERN FOUND:
- File path and line numbers
- Purpose (what problem it solves)
- Replaceable by reactive state? (yes/no/partial)
- If partial, what's the gap?

OUTPUT FORMAT:
```yaml
state_patterns:
  - file: "path/to/file.ts"
    line_range: "10-50"
    pattern_name: "StateStore"
    purpose: "Snapshot-based state access"
    replaceable: partial
    notes: "snapshot() stays, get/set/patch replaced by signals"
```
```

### Agent 2: API Surface Audit
```
OBJECTIVE: Identify all public API changes required

SEARCH SCOPE:
- packages/internal/core/src/api/types.ts
- packages/internal/core/src/api/*.ts
- packages/sdk/src/index.ts (re-exports)

ANALYZE:
1. Current exports from @open-harness/core
2. Which types/functions change signature
3. What new exports are needed
4. Breaking changes for downstream consumers

OUTPUT FORMAT:
```yaml
api_changes:
  modified:
    - export: "AgentConfig"
      current_signature: "{ prompt, state?, output? }"
      new_signature: "{ prompt, state?, output? }" # Same or different
      breaking: false
      migration: "none needed"

  added:
    - export: "getHarnessState"
      signature: "() => HarnessState"
      purpose: "Global reactive state access"

  removed:
    - export: "..."
      reason: "..."

  breaking_changes_count: N
```
```

### Agent 3: Data Flow Analysis
```
OBJECTIVE: Map current data flow and identify where reactive state fixes gaps

TRACE THIS PATH:
agent({ output: { schema: Z } })  →  run(agent, input)  →  provider.run()  →  SDK

SPECIFIC QUESTIONS:
1. Where is schema defined? (agent.ts)
2. Where does buildProviderInput() read from? (run.ts)
3. What does it currently pass to provider?
4. Where does the schema get LOST?

THEN TRACE NEW PATH:
How would reactive state change this flow?

OUTPUT FORMAT:
```
CURRENT FLOW:
agent() → stores schema in config.output.schema
   ↓
run() → calls buildProviderInput(agent, input)
   ↓
buildProviderInput() → extracts prompt, messages, systemPrompt
   ↓
[GAP: schema not extracted here]
   ↓
provider.run() → receives input WITHOUT schema
   ↓
SDK call → no structured output

NEW FLOW WITH REACTIVE STATE:
agent() → writes schema to harnessState.setOutputSchema()
   ↓
run() → calls buildProviderInput(agent, input)
   ↓
buildProviderInput() → reads harnessState.outputSchema()
   ↓
provider.run() → receives input WITH outputFormat
   ↓
SDK call → structured output enabled
```
```

### Agent 4: Simplification Opportunities
```
OBJECTIVE: Find code that becomes unnecessary or simpler

SEARCH FOR:
1. Manual state threading (passing state through function params)
2. Boilerplate for state access
3. Redundant state initialization
4. Complex prop drilling patterns

EVALUATE EACH:
- Can this be deleted entirely?
- Can this be simplified to one-liner?
- Estimated LOC reduction

OUTPUT FORMAT:
```yaml
simplifications:
  deletable_files:
    - file: "path/to/file.ts"
      reason: "Replaced by reactive state"
      loc: 150

  simplifiable_functions:
    - file: "path/to/file.ts"
      function: "buildProviderInput"
      current_loc: 25
      new_loc: 10
      change: "Remove manual schema threading, read from signal"

  total_loc_reduction: N
```
```

### Agent 5: Examples & Documentation Audit
```
OBJECTIVE: Catalog all examples and docs that need updating

SEARCH SCOPE:
- examples/
- apps/
- packages/sdk/docs/
- README.md files
- CLAUDE.md files

FOR EACH FILE:
- Does it show state management?
- Does it show schema definition?
- Does it show multi-node patterns?
- Would reactive state change the example?

OUTPUT FORMAT:
```yaml
docs_impact:
  rewrite_required:
    - file: "examples/basic-agent.ts"
      reason: "Shows old schema pattern"
      priority: high

  update_required:
    - file: "packages/sdk/docs/getting-started.md"
      sections: ["Configuration", "State Management"]
      priority: medium

  new_docs_needed:
    - topic: "Reactive State Guide"
      priority: high
      content_outline:
        - "Understanding HarnessState vs RunState"
        - "Reading and writing state"
        - "Reacting to state changes with effects"
```
```

### Agent 6: Integration Point Mapping
```
OBJECTIVE: Find all places that would interact with reactive state

SEARCH ENTIRE CODEBASE FOR:
1. Places that READ agent config (schema, tools, model)
2. Places that WRITE/UPDATE config
3. Places that need to REACT to config changes
4. Places that track execution state (status, metrics)

GROUP BY STATE TYPE:
- HarnessState readers
- HarnessState writers
- RunState updaters
- Effect subscription points

OUTPUT FORMAT:
```yaml
integration_points:
  harness_state:
    readers:
      - file: "run.ts"
        function: "buildProviderInput"
        reads: ["outputSchema", "systemPrompt"]

    writers:
      - file: "agent.ts"
        function: "agent"
        writes: ["outputSchema"]

  run_state:
    updaters:
      - file: "runtime.ts"
        function: "executeNode"
        updates: ["currentNode", "status", "metrics"]

  effect_points:
    - file: "..."
      purpose: "Log state changes"
      subscribes_to: ["status", "currentNode"]
```
```

---

## Synthesis Instructions

After all 6 agents complete, synthesize findings:

### 1. Aggregate Metrics
```yaml
impact_summary:
  files_affected: N
  functions_modified: N
  breaking_api_changes: N
  loc_added: N
  loc_removed: N
  net_loc_change: N
```

### 2. Critical Path
What MUST change first? Order by dependencies:
```yaml
critical_path:
  - step: 1
    description: "Add @maverick-js/signals dependency"
    files: ["package.json"]

  - step: 2
    description: "Create reactive state module"
    files: ["packages/internal/core/src/state/reactive.ts"]
    depends_on: [1]
```

### 3. Risk Assessment
```yaml
risks:
  - risk: "Breaking change to agent() return type"
    likelihood: medium
    impact: high
    mitigation: "Keep existing type, add reactive state as side effect"
```

### 4. Phased Implementation Plan
```yaml
phases:
  phase_1:
    name: "Foundation"
    scope: "Add reactive module, no integration yet"
    files: [...]
    testable: true

  phase_2:
    name: "Integration"
    scope: "Wire reactive state into buildProviderInput"
    files: [...]
    breaking: false
```

---

## Execution

1. Dispatch all 6 agents in PARALLEL using Task tool
2. Wait for all to complete
3. Read each agent's output
4. Synthesize into final report
5. Save report to `.claude/handoffs/reactive-state-audit-results.md`

## Output Location
Save final synthesized report to:
`/Users/abuusama/projects/open-harness/open-harness/.claude/handoffs/reactive-state-audit-results.md`
