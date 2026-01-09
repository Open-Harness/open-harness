# Interview Questions Bank

Questions organized by category. Select based on discovery findings. Do NOT ask questions answerable from code analysis.

## 1. Debugging Pain Points

These reveal what the telemetry strategy must solve.

```
- What incident in the last 6 months was hardest to debug? What was missing?
- When a customer reports an issue, what's your current debugging workflow?
- How long does it typically take to find root cause for production issues?
- Which services are "black boxes" that you dread debugging?
- What questions do you find yourself asking that logs can't answer today?
```

## 2. Business Priority

These inform sampling and alerting strategies.

```
- Which user segments are highest priority? (enterprise, premium, new users?)
- What transactions absolutely cannot fail silently?
- Are there specific customers whose requests should always be fully logged?
- What's your definition of a "critical" vs "normal" error?
- Which features are in active A/B testing or gradual rollout?
```

## 3. Compliance & Security

These determine redaction and retention rules.

```
- What PII must never appear in logs? (SSN, credit card, etc.)
- What data needs to be retained for compliance? For how long?
- Are there audit logging requirements separate from operational logs?
- Do you need to support "right to be forgotten" / GDPR deletion?
- Which internal fields should be redacted from logs? (API keys, tokens?)
```

## 4. Operational Constraints

These shape sampling and cost management.

```
- What's your current logging volume? (events/second, GB/day)
- What's your observability budget constraint?
- Which log storage/analysis tools are you using or planning to use?
- What's your retention policy for different log types?
- Are there peak traffic patterns that affect logging decisions?
```

## 5. Query Patterns

These determine which fields are essential.

```
- "Show me all failures for user X in the last hour" - critical?
- "What's the error rate by subscription tier?" - needed?
- "Which deployment caused this latency regression?" - needed?
- "What's the p99 latency for the checkout flow?" - needed?
- What other questions do you need logs to answer?
```

## 6. Team & Process

These inform implementation approach.

```
- Who will be implementing the logging changes?
- Is there a preferred code review process for infrastructure changes?
- Are there existing coding standards or patterns to follow?
- What's the deployment cadence? (affects rollout strategy)
- Who should be consulted for business context decisions?
```

## 7. Existing Tooling Integration

These determine transport and format requirements.

```
- What log aggregation system do you use? (DataDog, Grafana, ELK, etc.)
- Do you have existing dashboards that depend on log format?
- Is there distributed tracing in place? (OpenTelemetry, Jaeger, etc.)
- Do you need logs in a specific format for the aggregation system?
- Are there existing alerting rules based on log patterns?
```

## Question Selection Guidelines

**High priority questions (always ask):**
- Debugging pain points (at least 1)
- Business priority users/transactions
- PII redaction requirements
- Query patterns needed

**Conditional questions:**
- Compliance: Only if regulated industry
- Budget constraints: Only if cost mentioned
- Tooling: Only if not detected in code

**Skip if:**
- Answer obvious from codebase
- Already answered in previous response
- Not relevant to detected architecture

## Interview Flow Example

```
Message 1: Pain Points + Business Priority
"Before I design the telemetry strategy, I need to understand a few things 
that I can't determine from the code:

1. What recent production incident was hardest to debug? What information 
   was missing that would have helped?

2. Which user segments should we prioritize in logging? (e.g., enterprise 
   customers, premium users, new signups)

3. What questions do you frequently need logs to answer that they can't 
   today?"

Message 2: Compliance + Constraints (based on answers)
"Thanks. A few follow-up questions:

1. [If PII concern mentioned] What specific fields must be redacted?

2. [If compliance mentioned] What's the required retention period?

3. Do you have observability budget constraints I should design around?"

Message 3: Confirm understanding
"Let me confirm I understand the priorities:
- [Summarize key points]
- [List redaction requirements]  
- [Note sampling preferences]

Is there anything I'm missing before I generate the telemetry manifest?"
```
