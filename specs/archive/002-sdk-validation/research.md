# Research: SDK Validation via Speckit Dogfooding

**Feature**: 002-sdk-validation
**Date**: 2025-12-25

## Research Topics

### 1. Extending BaseHarness for Task Execution

**Question**: How should TaskHarness extend BaseHarness to support task queue execution?

**Decision**: TaskHarness extends BaseHarness with:
- `TState` = `TaskHarnessState` (task queue, retry counts, current task)
- `TInput` = `ParsedTask` (the task being executed)
- `TOutput` = `TaskExecutionResult` (coding result + validation result)

**Rationale**:
- BaseHarness already handles step tracking and state persistence
- execute() generator yields one step per task
- State includes task queue for resume capability

**Alternatives Considered**:
- Composition (has-a BaseHarness): Rejected - loses step tracking benefits
- Standalone class: Rejected - duplicates state management code

### 2. Dependency Resolution (Topological Sort)

**Question**: How to execute tasks in dependency order?

**Decision**: Use Kahn's algorithm for topological sort:
1. Build adjacency list from task dependencies
2. Track in-degree (dependency count) for each task
3. Start with tasks having in-degree 0
4. As each task completes, decrement dependents' in-degrees
5. Queue newly-ready tasks (in-degree becomes 0)

**Rationale**:
- O(V + E) complexity, efficient for ~70 tasks
- Detects cycles during sorting (cycle = no remaining zero in-degree nodes)
- Familiar algorithm, easy to test

**Alternatives Considered**:
- DFS-based sort: Same complexity but cycle detection is trickier
- Runtime resolution: Check dependencies on each iteration - less efficient

### 3. Exponential Backoff for Rate Limits

**Question**: How to implement exponential backoff for API rate limits?

**Decision**: Implement retry with exponential backoff:
```
delay = min(baseDelay * (2 ^ attempt), maxDelay) + jitter
```
- Base delay: 1000ms
- Max delay: 60000ms
- Jitter: 0-500ms random
- Max attempts: 10 (then fail)

**Rationale**:
- Standard pattern for rate limit handling
- Jitter prevents thundering herd
- 10 attempts with exponential backoff = ~2 minutes max wait

**Alternatives Considered**:
- Fixed delay: Wastes time on short limits, insufficient for long ones
- Immediate retry: Will hit rate limit again immediately

### 4. Parser Agent Prompt Design

**Question**: How should the Parser Agent prompt be structured?

**Decision**: Prompt includes:
1. Instructions to parse markdown task format
2. Schema for structured output (ParsedTask[])
3. Examples of the tasks.md format
4. Rules for inferring validation criteria

**Rationale**:
- LLM is excellent at markdown parsing
- Structured output ensures type safety
- Examples improve parsing accuracy

**Alternatives Considered**:
- Regex parsing: Fragile, hard to handle edge cases
- AST-based markdown parser: Over-engineered for this use case

### 5. Monologue Aggregation Strategy

**Question**: How should harness aggregate narratives from multiple agents?

**Decision**: Harness implements narrative aggregation:
1. Each agent has its own monologue wrapper
2. Agent narratives routed to harness via onNarrative callback
3. Harness adds context (e.g., "Parser says: ...", "Coder says: ...")
4. Unified stream emitted to user's onNarrative callback

**Rationale**:
- Preserves agent identity in narrative
- Single callback for user simplicity
- Harness can inject transition narratives ("Now moving to review...")

**Alternatives Considered**:
- Single monologue for all agents: Loses agent context
- Separate callbacks per agent: Complicates user code

### 6. State Persistence Format

**Question**: How should harness state be persisted for resume?

**Decision**: JSONL file at `recordings/harness/{sessionId}/state.jsonl`:
- One line per state change
- Each line: `{ timestamp, event, state_snapshot }`
- Events: "task_started", "task_completed", "task_failed", "task_validated"

**Rationale**:
- Append-only for crash safety
- Human-readable for debugging
- Consistent with recording format

**Alternatives Considered**:
- Single JSON file: Loses crash recovery (partial writes corrupt file)
- SQLite: Over-engineered for single-session state

---

## Unknowns Resolved

| Unknown | Resolution |
|---------|------------|
| How to extend BaseHarness? | TState=TaskHarnessState, TInput=ParsedTask, TOutput=TaskExecutionResult |
| Dependency resolution? | Kahn's algorithm for topological sort |
| Rate limit handling? | Exponential backoff with jitter, max 10 attempts |
| Parser prompt structure? | Instructions + schema + examples + inference rules |
| Monologue aggregation? | Harness routes all agent narratives to unified callback |
| State persistence? | JSONL append-only format with state snapshots |
