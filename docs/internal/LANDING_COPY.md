# Open Harness - Landing Page Copy

## Hero Section

### Headline
**Debug Agent Workflows Like You Debug Code**

### Subheadline
Time-travel through your AI agent execution. See exact state at any point. Replay recordings for free.

### CTA
```
[Get Started]  [View on GitHub]
```

### Hero Code Snippet
```typescript
// Bug at 3am? Load the session, jump to the problem
const tape = await workflow.load("failed-session");
await tape.stepTo(47);

console.log(tape.state);   // Exact state at event 47
console.log(tape.current); // Event that caused the change

await tape.stepBack();     // Step backward through history
```

---

## Pain Point Section

### Headline
**Agent Debugging Doesn't Scale**

### Body
2 agents? Console.log works.
5 agents? You're spending hours.
15 agents updating shared state? You're praying.

When your multi-agent workflow fails, you need to see what happened—not guess from logs.

---

## Feature Blocks

### Feature 1: Time-Travel Debugging

**Headline:** Jump to Any Point in Execution

**Body:** Load a recorded session. Step forward, backward, or jump directly to any event. See the exact state when things went wrong. No re-running. No adding logs.

**Code:**
```typescript
await tape.stepTo(47);    // Jump to event 47
console.log(tape.state);  // See exact state
await tape.stepBack();    // Go backward
```

---

### Feature 2: Record & Replay

**Headline:** Test for Free. Forever.

**Body:** Record workflow sessions once. Replay them infinitely without API calls. Same state transitions. Same handler execution. Zero cost.

**Code:**
```typescript
// Record (costs money)
await workflow.run({ record: true });

// Replay 1000x (costs $0)
const tape = await workflow.load(sessionId);
await tape.play();
```

---

### Feature 3: State Reconstruction

**Headline:** State is Derived, Not Stored

**Body:** Every event is an immutable fact. Handlers are pure functions. This means you can reconstruct state at any point by replaying events—perfect for debugging and testing.

**Visual:**
```
Event 1 → State 1
Event 2 → State 2
   ...
Event N → State N  ← Jump here, see exact state
```

---

### Feature 4: Multi-Agent Ready

**Headline:** Built for Complexity

**Body:** Planners, executors, reviewers, validators—each agent emits events. Track exactly which agent updated what, when, and why. Causality tracking built in.

**Code:**
```typescript
const event = tape.current;
// { name: "task:failed", causedBy: "evt-45", agent: "executor" }
```

---

### Feature 5: Real Testing, Not Mocking

**Headline:** Fixtures, Not Mocks

**Body:** Record real workflow executions. Use them as test fixtures. Assert state at any position. No mocking LLM responses—use real recorded data.

**Code:**
```typescript
test("handles retry correctly", async () => {
  const tape = await workflow.load("fixtures/retry-scenario");
  await tape.stepTo(retryEvent);
  expect(tape.state.retryCount).toBe(3);
});
```

---

### Feature 6: Framework Agnostic

**Headline:** Same Pattern, Better Tooling

**Body:** The plan-execute loop you already use. Open Harness adds observability without changing your architecture. Works with Claude, GPT, or any LLM.

---

## Social Proof Section (Future)

### Headline
**Built for Agent Developers**

### Testimonial Placeholders
- "Finally, I can debug my 20-agent workflow without losing my mind."
- "Replay testing cut our API costs by 90%."
- "Time-travel debugging is a game changer."

---

## Comparison Section

### Headline
**What You Get vs. Traditional Debugging**

| Traditional | Open Harness |
|-------------|--------------|
| Grep through logs | `tape.stepTo(47)` |
| Re-run with more logging | Jump directly to the bug |
| Mock everything for tests | Replay real recordings |
| Hope state was captured | Reconstruct any state |
| $$ per test run | $0 replay |

---

## Technical Credibility Section

### Headline
**Serious Engineering Under the Hood**

### Points
- **Effect-TS** for bulletproof async handling
- **Event Sourcing** architecture—state derived from immutable log
- **Pure Handlers** ensure deterministic replay
- **Zod Schemas** for type-safe events
- **SQLite** for production-grade persistence

---

## CTA Section

### Headline
**Stop Debugging Blind**

### Body
Get time-travel debugging for your agent workflows in 5 minutes.

### Code
```bash
bunx create-open-harness my-agent
```

### Buttons
```
[Get Started]  [Read the Docs]  [Star on GitHub]
```

---

## Footer Tagline

**Open Harness** — The pattern you know. The debugging you need.

---

## SEO Keywords
- AI agent debugging
- Multi-agent workflow
- Time-travel debugging
- Agent testing framework
- LLM workflow debugging
- Agentic loop debugging
- Agent observability
- Claude Code debugging
- AI agent development
