# Task Templates

Implementation task patterns for bringing a codebase into wide event compliance.

## Task Categories

### Category 1: Foundation

Tasks that establish the logging infrastructure. Must be completed first.

#### TELE-F01: Configure Pino Logger

```json
{
  "id": "TELE-F01",
  "category": "foundation",
  "priority": "P0",
  "title": "Configure Pino logger with wide event defaults",
  "description": "Set up the base Pino logger with proper formatting, redaction, and transport configuration.",
  "files": ["src/lib/logger.ts"],
  "estimatedEffort": "small",
  "dependencies": [],
  "acceptanceCriteria": [
    "Pino logger configured with JSON output",
    "Base fields (service, version, deployment_id) included",
    "Redaction paths configured",
    "Development vs production transports configured"
  ]
}
```

Implementation pattern:

```typescript
// src/lib/logger.ts
import pino from 'pino';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.token',
  '*.apiKey',
  // Add from manifest redactionRules
];

export const logger = pino({
  name: process.env.SERVICE_NAME || 'unknown-service',
  level: process.env.LOG_LEVEL || 'info',
  
  redact: {
    paths: redactPaths,
    remove: true,
  },
  
  base: {
    service: process.env.SERVICE_NAME,
    version: process.env.SERVICE_VERSION,
    deployment_id: process.env.DEPLOYMENT_ID,
    region: process.env.REGION,
  },
  
  formatters: {
    level: (label) => ({ level: label }),
  },
  
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
```

#### TELE-F02: Request Context with AsyncLocalStorage

```json
{
  "id": "TELE-F02",
  "category": "foundation",
  "priority": "P0",
  "title": "Set up AsyncLocalStorage for request context",
  "description": "Create context propagation system using AsyncLocalStorage to carry request context through async operations.",
  "files": ["src/lib/context.ts"],
  "estimatedEffort": "small",
  "dependencies": ["TELE-F01"],
  "acceptanceCriteria": [
    "AsyncLocalStorage configured",
    "Context includes request_id and trace_id",
    "Helper functions for getting/setting context",
    "Works across async boundaries"
  ]
}
```

Implementation pattern:

```typescript
// src/lib/context.ts
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export interface RequestContext {
  requestId: string;
  traceId: string;
  spanId: string;
  startTime: number;
  userId?: string;
  userSubscription?: string;
  // Add business context fields from manifest
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getContext(): RequestContext | undefined {
  return requestContext.getStore();
}

export function getContextOrThrow(): RequestContext {
  const ctx = requestContext.getStore();
  if (!ctx) throw new Error('Request context not initialized');
  return ctx;
}

export function createContext(traceId?: string): RequestContext {
  return {
    requestId: randomUUID(),
    traceId: traceId || randomUUID(),
    spanId: randomUUID(),
    startTime: Date.now(),
  };
}

export function enrichContext(updates: Partial<RequestContext>): void {
  const ctx = requestContext.getStore();
  if (ctx) {
    Object.assign(ctx, updates);
  }
}
```

#### TELE-F03: Wide Event Middleware

```json
{
  "id": "TELE-F03",
  "category": "foundation",
  "priority": "P0",
  "title": "Create wide event middleware",
  "description": "Implement middleware that initializes context at request start, accumulates fields during processing, and emits single wide event at request completion.",
  "files": ["src/middleware/wideEvent.ts"],
  "estimatedEffort": "medium",
  "dependencies": ["TELE-F01", "TELE-F02"],
  "acceptanceCriteria": [
    "Context initialized on request entry",
    "Wide event object built throughout request",
    "Single event emitted on request completion",
    "Error events captured correctly",
    "Duration calculated accurately"
  ]
}
```

Implementation pattern (Fastify):

```typescript
// src/middleware/wideEvent.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../lib/logger';
import { requestContext, createContext, getContext } from '../lib/context';

export interface WideEvent {
  // Required
  request_id: string;
  trace_id: string;
  timestamp: string;
  service: string;
  version: string;
  
  // Request
  method: string;
  path: string;
  status_code?: number;
  duration_ms?: number;
  outcome?: 'success' | 'error';
  
  // Business (populated during request)
  user?: {
    id?: string;
    subscription?: string;
    account_age_days?: number;
  };
  
  // Infrastructure
  db?: {
    query_count?: number;
    duration_ms?: number;
  };
  cache?: {
    hit?: boolean;
  };
  
  // Error
  error?: {
    type?: string;
    code?: string;
    message?: string;
    retriable?: boolean;
  };
  
  // Extensible
  [key: string]: unknown;
}

declare module 'fastify' {
  interface FastifyRequest {
    wideEvent: WideEvent;
  }
}

export async function wideEventMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const ctx = createContext(request.headers['x-trace-id'] as string);
  
  const wideEvent: WideEvent = {
    request_id: ctx.requestId,
    trace_id: ctx.traceId,
    timestamp: new Date().toISOString(),
    service: process.env.SERVICE_NAME || 'unknown',
    version: process.env.SERVICE_VERSION || 'unknown',
    method: request.method,
    path: request.url,
  };
  
  request.wideEvent = wideEvent;
  
  // Run request in context
  await requestContext.run(ctx, async () => {
    // onResponse hook will emit the event
  });
}

export function emitWideEvent(
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const ctx = getContext();
  const event = request.wideEvent;
  
  if (event && ctx) {
    event.status_code = reply.statusCode;
    event.duration_ms = Date.now() - ctx.startTime;
    event.outcome = reply.statusCode < 400 ? 'success' : 'error';
    
    // Emit the single wide event
    if (reply.statusCode >= 500) {
      logger.error(event);
    } else if (reply.statusCode >= 400) {
      logger.warn(event);
    } else {
      logger.info(event);
    }
  }
}
```

### Category 2: Migration

Tasks that replace existing logging with wide events.

#### TELE-M01: Replace console.log in Service X

```json
{
  "id": "TELE-M01",
  "category": "migration",
  "priority": "P1",
  "title": "Replace console.log statements in [service]",
  "description": "Remove console.log/warn/error statements and add context to wide event instead.",
  "files": ["List of files with console statements"],
  "estimatedEffort": "medium",
  "dependencies": ["TELE-F03"],
  "acceptanceCriteria": [
    "All console.log statements removed",
    "Relevant context added to wide event",
    "No change in business logic",
    "Tests pass"
  ]
}
```

Migration patterns:

```typescript
// BEFORE: Scattered console.log
async function processCheckout(userId: string, cartId: string) {
  console.log('Starting checkout for user:', userId);
  
  const cart = await getCart(cartId);
  console.log('Cart loaded:', cart.items.length, 'items');
  
  try {
    const payment = await processPayment(cart);
    console.log('Payment successful:', payment.id);
  } catch (error) {
    console.error('Payment failed:', error);
    throw error;
  }
}

// AFTER: Wide event enrichment
async function processCheckout(userId: string, cartId: string) {
  const { wideEvent } = getRequest(); // or from context
  
  wideEvent.user = { id: userId };
  
  const cart = await getCart(cartId);
  wideEvent.cart = {
    id: cart.id,
    item_count: cart.items.length,
    total_cents: cart.total,
  };
  
  const paymentStart = Date.now();
  try {
    const payment = await processPayment(cart);
    wideEvent.payment = {
      id: payment.id,
      provider: payment.provider,
      duration_ms: Date.now() - paymentStart,
    };
  } catch (error) {
    wideEvent.error = {
      type: error.name,
      code: error.code,
      message: error.message,
      retriable: error.retriable ?? false,
    };
    throw error;
  }
}
```

### Category 3: Enrichment

Tasks that add business context to wide events.

#### TELE-E01: Add User Context Enrichment

```json
{
  "id": "TELE-E01",
  "category": "enrichment",
  "priority": "P1",
  "title": "Add user context to wide events",
  "description": "After authentication, enrich wide event with user details for debugging and analytics.",
  "files": ["src/middleware/auth.ts"],
  "estimatedEffort": "small",
  "dependencies": ["TELE-F03"],
  "acceptanceCriteria": [
    "User ID added after auth",
    "Subscription tier included",
    "Account age calculated",
    "Works for all authenticated routes"
  ]
}
```

Implementation pattern:

```typescript
// In auth middleware, after successful auth
export async function authMiddleware(request: FastifyRequest) {
  const user = await validateToken(request.headers.authorization);
  
  request.wideEvent.user = {
    id: user.id,
    subscription: user.plan,
    account_age_days: daysSince(user.createdAt),
    lifetime_value_cents: user.ltv,
  };
  
  // Also update context for child operations
  enrichContext({ userId: user.id, userSubscription: user.plan });
}
```

### Category 4: Compliance

Tasks for redaction, sampling, and retention.

#### TELE-C01: Configure PII Redaction

```json
{
  "id": "TELE-C01",
  "category": "compliance",
  "priority": "P0",
  "title": "Configure PII redaction rules",
  "description": "Ensure all PII fields identified in manifest are properly redacted before logging.",
  "files": ["src/lib/logger.ts"],
  "estimatedEffort": "small",
  "dependencies": ["TELE-F01"],
  "acceptanceCriteria": [
    "All PII paths configured for redaction",
    "Redaction verified in test logs",
    "No PII visible in log output"
  ]
}
```

#### TELE-C02: Implement Tail Sampling

```json
{
  "id": "TELE-C02",
  "category": "compliance",
  "priority": "P2",
  "title": "Implement tail-based sampling",
  "description": "Keep all errors and slow requests, sample successful requests to manage volume.",
  "files": ["src/middleware/sampling.ts"],
  "estimatedEffort": "medium",
  "dependencies": ["TELE-F03"],
  "acceptanceCriteria": [
    "100% of errors retained",
    "100% of slow requests retained",
    "Configured sample rate for success",
    "VIP users exempt from sampling"
  ]
}
```

Implementation pattern:

```typescript
// src/middleware/sampling.ts
export function shouldSample(event: WideEvent): boolean {
  // Always keep errors
  if (event.status_code && event.status_code >= 500) return true;
  if (event.error) return true;
  
  // Always keep slow requests
  if (event.duration_ms && event.duration_ms > 2000) return true;
  
  // Always keep VIP users
  if (event.user?.subscription === 'enterprise') return true;
  
  // Sample the rest
  const sampleRate = parseFloat(process.env.LOG_SAMPLE_RATE || '0.1');
  return Math.random() < sampleRate;
}
```

## Task ID Format

- `TELE-F##`: Foundation tasks
- `TELE-M##`: Migration tasks  
- `TELE-E##`: Enrichment tasks
- `TELE-C##`: Compliance tasks

## TELEMETRY_TASKS.md Output Format

```markdown
# Telemetry Implementation Tasks

Generated: [timestamp]
Manifest: telemetry-manifest.json

## Summary

- Total tasks: N
- Foundation: N (P0)
- Migration: N (P1)
- Enrichment: N (P1-P2)
- Compliance: N (P0-P2)

## P0 - Critical Path

### TELE-F01: Configure Pino logger
**Effort:** Small | **Files:** src/lib/logger.ts

[Description]

**Acceptance Criteria:**
- [ ] Criteria 1
- [ ] Criteria 2

---

## P1 - High Priority

[Tasks...]

## P2 - Medium Priority

[Tasks...]

## P3 - Low Priority

[Tasks...]

## Dependency Graph

```
TELE-F01 (logger)
    └── TELE-F02 (context)
            └── TELE-F03 (middleware)
                    ├── TELE-M01 (migrate service A)
                    ├── TELE-M02 (migrate service B)
                    └── TELE-E01 (user context)
```
```
