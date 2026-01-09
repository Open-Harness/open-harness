# What Can I Build

**Status:** Complete  
**Purpose:** Concrete examples of agentic systems you can build

---

## Overview

Open Harness enables you to build production-ready agentic systems across any domain. Here are concrete examples with code patterns.

---

## Coding Workflows

### PRD-to-Code Pipeline (SpecKit)

The SpecKit example demonstrates a complete coding workflow:

```typescript
const specKit = harness({
  agents: {
    spec: specAgent,      // PRD → Tasks
    coder: codingAgent,   // Tasks → Code
    reviewer: reviewerAgent, // Code → Approval
  },
  edges: [
    { from: "spec", to: "coder" },
    { from: "coder", to: "reviewer" },
  ],
});

const result = await run(specKit, {
  prompt: "PRD: Build a user authentication system with email/password login",
});
```

**Agents:**
- **Spec Agent**: Analyzes PRDs, creates task breakdown with acceptance criteria
- **Coder Agent**: Implements tasks with self-validation
- **Reviewer Agent**: Validates code against criteria, approves or rejects

### Code Review Bot

```typescript
const codeReviewBot = harness({
  agents: {
    analyzer: agent({ prompt: "Analyze for bugs and security issues..." }),
    styleChecker: agent({ prompt: "Check code style and best practices..." }),
    testSuggester: agent({ prompt: "Suggest missing test cases..." }),
    summarizer: agent({ prompt: "Write a PR review summary..." }),
  },
  edges: [
    { from: "analyzer", to: "summarizer" },
    { from: "styleChecker", to: "summarizer" },
    { from: "testSuggester", to: "summarizer" },
  ],
});
```

---

## Trading Systems

### Trading Analyst

```typescript
const tradingAnalyst = agent({
  prompt: `You are a quantitative trading analyst.
  
Analyze the provided market data for:
- Trend direction (RSI, MACD crossovers)
- Support/resistance levels
- Volume patterns
- Entry/exit signals

Output format:
## ANALYSIS
[Technical analysis]

## SIGNAL
BUY | SELL | HOLD

## CONFIDENCE
HIGH | MEDIUM | LOW`,
  
  state: {
    signalsGenerated: 0,
    lastSignal: null,
  },
});
```

### Full Trading Pipeline

```typescript
const tradingSystem = harness({
  agents: {
    analyst: tradingAnalystAgent,    // Market analysis
    riskManager: riskManagerAgent,   // Position sizing, stop-loss
    executor: executionAgent,        // Order placement
  },
  edges: [
    { from: "analyst", to: "riskManager" },
    { from: "riskManager", to: "executor" },
  ],
  state: {
    positions: [],
    riskBudget: 1000,
    maxDrawdown: 0.1,
  },
});
```

**Key pattern:** Wrap your trading libraries as scripts:

```python
# scripts/fetch_candles.py
import ccxt
exchange = ccxt.binance()
candles = exchange.fetch_ohlcv('BTC/USDT', '1h')
print(json.dumps(candles))
```

The agent calls this via bash and receives the data.

---

## Data Pipelines

### ETL Pipeline

```typescript
const etlPipeline = harness({
  agents: {
    extractor: agent({ 
      prompt: "Extract data from the provided source. Parse into structured JSON." 
    }),
    validator: agent({ 
      prompt: "Validate data quality. Check for nulls, duplicates, schema compliance." 
    }),
    transformer: agent({ 
      prompt: "Transform data: normalize formats, enrich with calculated fields." 
    }),
    loader: agent({ 
      prompt: "Generate SQL INSERT statements for the transformed data." 
    }),
  },
  edges: [
    { from: "extractor", to: "validator" },
    { from: "validator", to: "transformer" },
    { from: "transformer", to: "loader" },
  ],
});
```

**Key pattern:** Use fixtures to test your pipeline without hitting real databases:

```typescript
// Record the full pipeline once
const result = await run(etlPipeline, input, withFixture("etl-customer-data"));

// Replay in CI (free, instant)
bun test
```

---

## Research & Analysis

### Research Synthesis Pipeline

```typescript
const researchPipeline = harness({
  agents: {
    searcher: agent({ 
      prompt: "Find relevant papers and sources on the given topic." 
    }),
    summarizer: agent({ 
      prompt: "Summarize each source in 2-3 sentences." 
    }),
    synthesizer: agent({ 
      prompt: "Identify key themes, agreements, and gaps across sources." 
    }),
    writer: agent({ 
      prompt: "Write a literature review combining all insights." 
    }),
  },
  edges: [
    { from: "searcher", to: "summarizer" },
    { from: "summarizer", to: "synthesizer" },
    { from: "synthesizer", to: "writer" },
  ],
});

const result = await run(researchPipeline, {
  prompt: "Research: State of quantum error correction in 2025",
});
```

---

## Customer Support

### Support Triage System

```typescript
const supportSystem = harness({
  agents: {
    triage: agent({
      prompt: `Classify support requests:
      - BILLING: Payment, subscription, refund issues
      - TECHNICAL: Bugs, errors, how-to questions
      - FEATURE: Feature requests, suggestions
      - URGENT: Security issues, data loss, critical bugs
      
      Output: CATEGORY | PRIORITY (1-5) | SUMMARY`
    }),
    resolver: agent({
      prompt: "Attempt to resolve the issue. Provide step-by-step solution."
    }),
    escalator: agent({
      prompt: "Prepare escalation package for human agent with all context."
    }),
  },
  edges: [
    { from: "triage", to: "resolver" },
    // Could add conditional: { from: "resolver", to: "escalator", when: "..." }
  ],
});
```

---

## DevOps & Automation

### Deployment Pipeline

```typescript
const deploymentPipeline = harness({
  agents: {
    validator: agent({
      prompt: "Validate deployment configuration. Check for missing env vars, port conflicts."
    }),
    deployer: agent({
      prompt: "Generate deployment commands for the target environment."
    }),
    verifier: agent({
      prompt: "Verify deployment succeeded. Check health endpoints, logs."
    }),
  },
  edges: [
    { from: "validator", to: "deployer" },
    { from: "deployer", to: "verifier" },
  ],
});
```

**Key pattern:** Agents can call your existing tools:

```typescript
// Agent can run: bash scripts/deploy.sh staging
// Agent can run: kubectl get pods
// Agent can run: docker logs <container>
```

---

## Building Custom Systems

### The Recipe

1. **Define your agents** with specialized prompts
2. **Define the edges** (execution order)
3. **Define shared state** (what persists across agents)
4. **Add fixtures** for testing
5. **Add quality gates** for CI

### Example: Custom Document Processor

```typescript
// 1. Define agents
const parser = agent({
  prompt: "Parse the document. Extract: title, sections, key entities.",
  state: { documentsProcessed: 0 },
});

const analyzer = agent({
  prompt: "Analyze the parsed document for sentiment, topics, and action items.",
});

const reporter = agent({
  prompt: "Generate an executive summary report.",
});

// 2. Compose into harness
const documentProcessor = harness({
  agents: { parser, analyzer, reporter },
  edges: [
    { from: "parser", to: "analyzer" },
    { from: "analyzer", to: "reporter" },
  ],
  state: { processedCount: 0 },
});

// 3. Test with fixtures
const result = await run(
  documentProcessor,
  { prompt: "[Your document content]" },
  withFixture("doc-processor-test"),
);

// 4. Add quality gates
expect(result.metrics.cost).toBeLessThan(0.10);
expect(parseReport(result.output).hasSummary).toBe(true);
```

---

## Key Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| **Pipeline** | Linear flow through agents | Spec → Code → Review |
| **Fan-out** | Multiple agents process in parallel | 3 researchers → synthesizer |
| **Loop** | Retry until condition met | Coder → Reviewer → (if rejected) → Coder |
| **Human-in-loop** | Pause for human approval | Proposal → Human Review → Execute |

---

## Getting Started

1. **Start small**: Build a single agent first
2. **Add validation**: Make agents self-validate
3. **Compose**: Combine agents into harnesses
4. **Test**: Record fixtures for deterministic testing
5. **Deploy**: Add quality gates for CI

See the [SpecKit Tutorial](./speckit-tutorial.md) for a complete walkthrough.
