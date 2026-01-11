---
name: wide-events-pino
description: Design and implement canonical log line / wide event telemetry strategies for Node.js codebases using Pino. Use when asked to improve logging, implement observability, design telemetry strategy, add structured logging, implement wide events, or create canonical log lines. This skill interviews stakeholders, analyzes the codebase, creates a telemetry manifest, and generates implementation tasks to bring logging into compliance with wide event best practices.
---

# Wide Events Telemetry Strategy Skill

Transform scattered console.log statements into queryable, context-rich wide events using Pino.

## Core Philosophy

**Instead of logging what code is doing, log what happened to this request.**

One wide event per request per service, containing all context needed for debugging. Stop treating logs as debugging diaries; treat them as structured records of business events.

## Workflow Overview

```
Phase 1: Discovery (subagents gather data)
├── Codebase Analysis → Services, routes, existing logging
├── Infrastructure Detection → Databases, caches, queues, APIs
└── Business Domain Mapping → Entities, transactions, critical paths

Phase 2: Interview (main thread)
├── Load discovery results into context summary
├── Ask ONLY questions that cannot be answered from code
└── Capture answers in context summary

Phase 3: Manifest Generation
├── Synthesize discoveries + interview answers
├── Generate telemetry-manifest.json
└── Define canonical event schemas per service

Phase 4: Task Generation
├── Create implementation tasks
├── Prioritize by impact and risk
└── Output TELEMETRY_TASKS.md
```

## Phase 1: Discovery

Launch parallel subagents. After each completes, update the context summary in main thread.

### Subagent 1: Service Architecture

Identify all services, their types, and entry points.

```
Find:
- package.json files (monorepo structure)
- HTTP server setup (Express, Fastify, Hono, Koa)
- GraphQL resolvers/schemas
- Queue consumers (Bull, BullMQ, Kafka, RabbitMQ)
- Cron/scheduled tasks
- WebSocket handlers

Output format:
{
  "services": [{
    "name": "string",
    "type": "http|graphql|worker|cron|websocket",
    "framework": "string",
    "entryPoints": ["file paths"],
    "routes": ["GET /api/users", "POST /checkout"]
  }]
}
```

### Subagent 2: Infrastructure

Map all infrastructure dependencies.

```
Find:
- Database clients: Prisma, Drizzle, Knex, TypeORM, pg, mysql2, mongoose
- Cache: Redis, ioredis, Keyv, node-cache
- Queues: Bull, BullMQ, amqplib, kafkajs
- HTTP clients: fetch, axios, got, undici
- Storage: @aws-sdk/client-s3, @google-cloud/storage

Output format:
{
  "infrastructure": [{
    "type": "database|cache|queue|http|storage",
    "client": "package name",
    "configFile": "path"
  }]
}
```

### Subagent 3: Logging Audit

Assess current logging state.

```
Find and count:
- console.log/warn/error/info/debug statements
- Existing Pino usage and configuration
- Other loggers (Winston, Bunyan, debug)
- Structured vs unstructured ratio
- Common logging patterns

Output format:
{
  "currentLogger": "console|pino|winston|mixed",
  "statements": {
    "console": { "log": N, "warn": N, "error": N },
    "pino": { "info": N, "warn": N, "error": N }
  },
  "structuredPercent": N,
  "patterns": ["pattern descriptions"]
}
```

### Subagent 4: Business Domain

Identify business entities and transaction types.

```
Find:
- Database models/schemas (Prisma schema, Mongoose models)
- TypeScript interfaces for domain entities
- Transaction boundaries (checkout, signup, etc.)
- Feature flag implementations

Output format:
{
  "entities": ["User", "Order", "Payment"],
  "transactions": [{
    "name": "checkout",
    "services": ["cart", "payment", "inventory"],
    "criticalPath": true
  }],
  "featureFlags": "provider name or none"
}
```

### Context Summary Template

After discovery, maintain this in the main thread:

```markdown
## Discovery Summary

### Services (N found)
| Service | Type | Framework | Key Routes |
|---------|------|-----------|------------|
| ... | ... | ... | ... |

### Infrastructure
- Databases: [list]
- Caches: [list]
- Queues: [list]
- External APIs: [list]

### Current Logging State
- Primary logger: [X]
- Total statements: N (Y% structured)
- Key patterns: [list]

### Business Domain
- Core entities: [list]
- Transaction types: [list]
- Feature flags: [provider]

### Interview Questions Identified
[Questions that CANNOT be answered from code]
```

## Phase 2: Interview

Ask questions that cannot be answered by code analysis. See `references/interview-questions.md` for the full question bank.

### Question Selection Rules

**DO NOT ask about:**
- Framework/library choices (visible in package.json)
- Database schemas (visible in schema files)
- Route structures (visible in code)
- Current logging patterns (already audited)
- Environment variables (visible in code)

**DO ask about:**
- Debugging pain points and recent incidents
- Business priority of different user segments
- Compliance and data retention requirements
- Cost constraints and volume concerns
- Required query patterns ("what questions must logs answer?")
- Sampling preferences for different event types
- PII handling requirements

### Interview Protocol

1. Group questions by theme (3-5 per message maximum)
2. Acknowledge answers before asking follow-ups
3. Stop when sufficient context gathered for manifest
4. Save all answers to context summary

## Phase 3: Manifest Generation

Generate `telemetry-manifest.json` in the project root.

See `references/manifest-schema.md` for complete schema specification.

### Key Manifest Sections

1. **codebaseContext** - Discovery results
2. **interviewAnswers** - Captured responses
3. **telemetryStrategy** - The design decisions
   - globalFields: Fields on every event
   - serviceSchemas: Per-service wide event schemas
   - samplingRules: What to keep, what to sample
   - redactionRules: PII handling
4. **implementationTasks** - Generated tasks

### Wide Event Schema Design

For each service, define its canonical event schema:

```json
{
  "checkout-service": {
    "required": ["request_id", "trace_id", "timestamp", "service", "version"],
    "standard": ["method", "path", "status_code", "duration_ms"],
    "business": {
      "user": ["id", "subscription", "account_age_days"],
      "cart": ["id", "item_count", "total_cents", "coupon_applied"],
      "payment": ["method", "provider", "latency_ms", "attempt"]
    },
    "infrastructure": {
      "db": ["query_count", "duration_ms"],
      "cache": ["hit", "miss"],
      "external": ["service", "duration_ms"]
    },
    "error": ["type", "code", "message", "retriable"]
  }
}
```

## Phase 4: Task Generation

Generate `TELEMETRY_TASKS.md` with prioritized implementation tasks.

See `references/task-templates.md` for implementation patterns.

### Task Categories (in priority order)

1. **Foundation** - Logger setup, middleware, context propagation
2. **Migration** - Replace console.log, consolidate to Pino
3. **Enrichment** - Add business context to events
4. **Compliance** - Redaction, sampling, retention

### Task Prioritization Matrix

| Impact | Effort | Priority |
|--------|--------|----------|
| High (errors, critical paths) | Low | P0 - Do first |
| High | High | P1 - Plan carefully |
| Low | Low | P2 - Quick wins |
| Low | High | P3 - Defer |

## Pino Implementation Reference

See `references/pino-patterns.md` for:
- Wide event middleware patterns
- AsyncLocalStorage context propagation
- Child logger patterns
- Redaction configuration
- Transport setup

## Output Artifacts

1. **telemetry-manifest.json** - Complete strategy document
2. **TELEMETRY_TASKS.md** - Prioritized implementation checklist
3. **src/lib/telemetry/** - Scaffolded implementation (optional)

## Wide Event Field Reference

### Required (every event)
```
request_id, trace_id, span_id
timestamp, service, version, deployment_id
method, path, status_code, duration_ms, outcome
```

### Business Context (when available)
```
user.id, user.subscription, user.account_age_days, user.lifetime_value
[entity].id for relevant business entities
feature_flags object
```

### Error Context (on failures)
```
error.type, error.code, error.message
error.retriable, error.provider_code
```

### Performance Context
```
db.query_count, db.duration_ms
cache.hit, cache.miss, cache.key_pattern
external.[service].duration_ms
```
