# 001-effect-refactor Retrospective

**Date**: 2026-01-22
**Branch**: `001-effect-refactor`
**Status**: Partial implementation - core works, demo incomplete

---

## Summary

The Effect-based workflow runtime (core-v2) is architecturally sound and the LLM integration works. The demo app revealed gaps in our approach - primarily that we built the wrong UI and lacked event visibility for debugging.

---

## What Works (Verified)

### Core Architecture
- `createWorkflow`, `defineHandler`, `defineEvent`, `agent()` - all functional
- Effect Layer/Context dependency injection pattern
- TypeScript strict mode compliance
- Zod schema integration for structured output

### Provider System
- `LLMProviderService` interface with Effect types
- `makeClaudeProviderService()` using Claude Agent SDK
- Provider injection into Workflow via `definition.provider`
- Browser/server export separation (no Node.js deps in browser bundle)

### Runtime Execution
- Event queue processing with Effect Queue
- Handler dispatch and state updates
- Agent activation on event patterns
- SSE streaming from server to client
- LLM actually being called (verified via server logs: 33s, 10min executions)

### Structured Output (Partial)
- Planner agent works - creates tasks, advances phase
- JSON parsing fallback for markdown code blocks added
- Executor agent activates but task completion tracking broken

---

## What's Broken / Incomplete

### Task Completion Tracking
- `Done: 0` despite executor running for 10+ minutes
- Either: executor output parsing fails, OR `task:executed` events not emitted, OR `handleTaskExecuted` not processing
- Root cause unverified due to lack of visibility

### Demo UI Fundamentally Wrong
- Chat interface for a workflow runner makes no sense
- `projectEventsToMessages()` hides the events we need to see
- No visibility into: `workflow:start`, `agent:started`, `plan:created`, `text:delta`, tool calls
- User should input a PRD/spec (markdown editor), not chat messages
- Should see ALL events in timeline, not collapsed "messages"

### Missing Event Visibility
- No way to see raw events during execution
- No logging in runtime for debugging
- Had to guess what was happening

---

## Key Insights

### 1. Use Effect Primitives Properly
Effect has built-in primitives we underutilized:
- `PubSub` for event broadcasting
- `Stream` for event sequences
- `Queue` for backpressure (we used this)
- `Scope` for resource management
- `Layer` composition for DI

Instead of custom SSE handling, could use Effect's HTTP server with streaming.

### 2. TUI Over Heavy Frontend
Consider OpenTUI instead of Next.js/React:
- Lighter weight, faster iteration
- Terminal is natural for event streams
- No webpack/bundler complexity
- Effect works natively in Node.js
- Better for developer tooling use case

### 3. Event Visibility First
Before any UI, need raw event viewer:
```
[0] user:input { text: "Create a todo app" }
[1] workflow:start { goal: "Create a todo app" }
[2] agent:started { agentName: "planner" }
[3] text:delta { delta: "Let me..." }
```
This is the #1 debugging tool.

### 4. Decouple Domain from Core
- `TaskExecutor` is a demo domain, not the core feature
- Core = event-sourced runtime + tape controls
- Demo should be minimal: verify events stream correctly first

---

## Lessons for Rebuilding

### Phase 1: Event Visibility
- CLI/TUI that connects to workflow
- Shows raw JSON events in order
- No projection, no abstraction, just events

### Phase 2: Minimal Workflow
- One handler: `user:input` → state update
- One agent: echo back (no structured output)
- Verify: events stream, state updates

### Phase 3: Structured Output
- Add `outputSchema` to agent
- Test with real LLM
- Verify parsing and `onOutput`

### Phase 4: Multi-step
- Add planner/executor
- Debug with event viewer
- Verify each step

### Phase 5: Proper UI
- Design based on actual event shapes
- Tape controls that work
- Domain-appropriate input (markdown editor for specs)

---

## Technical Debt Identified

1. **No runtime logging** - Add structured logging to WorkflowRuntime
2. **No event inspector** - Build before next demo attempt
3. **SSE is custom** - Consider Effect HTTP primitives
4. **Demo couples too many concerns** - Separate core verification from domain demo

---

## Files Changed (This Branch)

### Core Package (`packages/core-v2/`)
- `src/workflow/Workflow.ts` - Added `provider` option to `WorkflowDefinition`
- `src/workflow/WorkflowRuntime.ts` - JSON parsing fallback for structured output
- `src/provider/index.browser.ts` - Browser-safe provider exports
- `src/index.browser.ts` - Updated browser entry point

### Demo App (`apps/core-v2-demo/`)
- `src/lib/workflow.ts` - Added `handleUserInput` handler
- `src/lib/workflow-server.ts` - Server workflow with Claude provider
- `src/app/api/workflow/route.ts` - Uses server workflow

---

## Recommendation

Don't continue debugging the current demo. Instead:

1. **Land this branch** with current state (core works)
2. **New branch** for proper event visibility tooling
3. **Use OpenTUI** for lightweight event viewer
4. **Use Effect primitives** more idiomatically
5. **Build demo UI last** after core is verified

The meta-goal is learning to write effective ralph loops - this retrospective captures the lessons.
