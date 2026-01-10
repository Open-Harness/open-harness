# Trading Agent Example

Flagship multi-agent workflow demonstrating the v0.3.0 reactive architecture.

## What This Shows

1. **Parallel Execution** - Analyst and Risk Assessor run simultaneously on `harness:start`
2. **Signal Chaining** - Agents trigger downstream agents via signals
3. **Guard Conditions** - Executor only runs if trade is approved
4. **State-Driven Decisions** - Confidence thresholds control activation
5. **Template Expansion** - Dynamic prompts with `{{ state.x }}` syntax

## Architecture

```
harness:start
      │
      ├───────────────┬───────────────┐
      ▼               ▼               │
┌──────────┐   ┌─────────────┐       │
│ Analyst  │   │ Risk        │       │
│          │   │ Assessor    │       │
└────┬─────┘   └──────┬──────┘       │
     │                │              │
     ▼                │              │
analysis:complete     ▼              │
     │         risk:assessed         │
     │                               │
     └───────────┬───────────────────┘
                 ▼
           ┌──────────┐
           │  Trader  │ ─── when: confidence >= threshold
           └────┬─────┘
                │
                ▼
         trade:proposed
                │
                ▼
          ┌──────────┐
          │ Reviewer │
          └────┬─────┘
               │
               ▼
        trade:reviewed
               │
               ▼
         ┌──────────┐
         │ Executor │ ─── when: review.approved === true
         └────┬─────┘
              │
              ▼
       trade:executed
```

## The Agents

### 1. Market Analyst
- **Activates**: `harness:start`
- **Emits**: `analysis:complete`
- **Purpose**: Analyzes market trends and provides confidence score

### 2. Risk Assessor
- **Activates**: `harness:start` (parallel with Analyst)
- **Emits**: `risk:assessed`
- **Purpose**: Evaluates position risk and sets limits

### 3. Trader
- **Activates**: `analysis:complete`
- **Emits**: `trade:proposed`
- **Guard**: Only activates if `analysis.confidence >= confidenceThreshold`
- **Purpose**: Proposes buy/sell/hold based on analysis

### 4. Reviewer
- **Activates**: `trade:proposed`
- **Emits**: `trade:reviewed`
- **Purpose**: Safety check - approves or rejects trades

### 5. Executor
- **Activates**: `trade:reviewed`
- **Emits**: `trade:executed`
- **Guard**: Only activates if `review.approved === true`
- **Purpose**: Executes approved trades

## Running

```bash
# From repository root
bun run examples/trading-agent/index.ts
```

## Example Output

```
=== Trading Agent Example ===

Demonstrating parallel execution, signal chaining, and guard conditions.

=== Execution Summary ===

Duration: 4523ms
Agent Activations: 5
Terminated Early: true

=== Signal Flow ===

[system] harness:start
[analyst] agent:activated
[riskAssessor] agent:activated
[analyst] analysis:complete
[riskAssessor] risk:assessed
[trader] agent:activated
[trader] trade:proposed
[reviewer] agent:activated
[reviewer] trade:reviewed
[executor] agent:activated
[executor] trade:executed

=== Final State ===

Market Analysis:
  Trend: bullish (75% confidence)
  Summary: Strong momentum with positive earnings outlook

Risk Assessment:
  Level: medium
  Max Position: $2500
  Warnings: Elevated volatility expected

Trade Proposal:
  Action: buy
  Quantity: 10
  Price: $185.50
  Reason: Bullish trend with acceptable risk profile

Review Decision:
  Approved: true
  Feedback: Trade aligns with analysis and respects risk limits

Execution Result:
  Order ID: ORD-7X92K4
  Status: filled
  Timestamp: 2024-01-15T10:30:45.123Z

=== Outcome ===

Trade executed successfully.
```

## State Shape

```typescript
type TradingState = {
  // Input
  symbol: string;
  confidenceThreshold: number;
  balance: number;

  // Populated by agents
  analysis: {
    trend: "bullish" | "bearish" | "neutral";
    confidence: number;
    summary: string;
  } | null;

  risk: {
    level: "low" | "medium" | "high";
    maxPosition: number;
    warnings: string[];
  } | null;

  proposal: {
    action: "buy" | "sell" | "hold";
    quantity: number;
    price: number;
    reason: string;
  } | null;

  review: {
    approved: boolean;
    feedback: string;
  } | null;

  execution: {
    orderId: string;
    status: "filled" | "rejected" | "pending";
    timestamp: string;
  } | null;
};
```

## Key Concepts Demonstrated

### Parallel Activation

Multiple agents subscribe to the same signal:

```typescript
// Both activate on harness:start
const analyst = agent({
  activateOn: ["harness:start"],
  // ...
});

const riskAssessor = agent({
  activateOn: ["harness:start"],
  // ...
});
```

### Guard Conditions

Conditional activation based on state:

```typescript
const trader = agent({
  activateOn: ["analysis:complete"],
  when: (ctx) => {
    const analysis = ctx.state.analysis;
    return analysis !== null &&
           analysis.confidence >= ctx.state.confidenceThreshold;
  },
});
```

### Template Expansion

Dynamic prompts with state interpolation:

```typescript
const analyst = agent({
  prompt: `Analyze market conditions for {{ state.symbol }}.
           Current balance: ${{ state.balance }}`,
});
```

### Early Termination

End the harness when conditions are met:

```typescript
const result = await runReactive({
  agents: { /* ... */ },
  state: { /* ... */ },
  endWhen: (state) =>
    state.execution !== null ||
    state.review?.approved === false ||
    state.proposal?.action === "hold",
});
```

## Customization Ideas

- **Different symbols**: Change `symbol: "AAPL"` to any stock
- **Risk tolerance**: Adjust `confidenceThreshold` (0-100)
- **Account size**: Modify `balance` for different position sizing
- **Add agents**: Insert a `compliance` agent between reviewer and executor
- **Multi-provider**: Use different models for different agents

## Next Steps

- See `examples/simple-reactive/` for a minimal example
- See `examples/multi-provider/` for using multiple AI providers
- See `packages/signals/README.md` for signal documentation
