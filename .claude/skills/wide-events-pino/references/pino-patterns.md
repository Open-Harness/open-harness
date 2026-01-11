# Pino Implementation Patterns

Patterns for implementing wide events with Pino in Node.js applications.

## Base Logger Configuration

```typescript
// src/lib/logger.ts
import pino, { Logger, LoggerOptions } from 'pino';

const isDev = process.env.NODE_ENV === 'development';

const baseConfig: LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  
  // Base fields on every log
  base: {
    service: process.env.SERVICE_NAME,
    version: process.env.SERVICE_VERSION,
    deployment_id: process.env.DEPLOYMENT_ID,
    region: process.env.REGION || 'unknown',
    env: process.env.NODE_ENV,
  },
  
  // Redact sensitive fields
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.apiKey',
      '*.secret',
      '*.creditCard',
      '*.ssn',
    ],
    remove: true,
  },
  
  // Format level as string
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
    }),
  },
  
  // Timestamp format
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
};

// Development: pretty print
// Production: JSON to stdout
const transport = isDev
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    }
  : undefined;

export const logger: Logger = pino({
  ...baseConfig,
  transport,
});
```

## AsyncLocalStorage Context

```typescript
// src/lib/context.ts
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { Logger } from 'pino';
import { logger as baseLogger } from './logger';

export interface RequestContext {
  // Identifiers
  requestId: string;
  traceId: string;
  spanId: string;
  
  // Timing
  startTime: number;
  
  // User (populated after auth)
  userId?: string;
  userSubscription?: string;
  
  // Business context (populated during request)
  [key: string]: unknown;
  
  // Child logger with context
  logger: Logger;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function createRequestContext(
  traceId?: string,
  parentSpanId?: string
): RequestContext {
  const requestId = randomUUID();
  const spanId = randomUUID();
  
  // Create child logger with request context
  const logger = baseLogger.child({
    request_id: requestId,
    trace_id: traceId || randomUUID(),
    span_id: spanId,
  });
  
  return {
    requestId,
    traceId: traceId || requestId,
    spanId,
    startTime: Date.now(),
    logger,
  };
}

export function runWithContext<T>(
  ctx: RequestContext,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return asyncLocalStorage.run(ctx, fn);
}

export function getContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function getLogger(): Logger {
  const ctx = getContext();
  return ctx?.logger ?? baseLogger;
}

export function enrichContext(data: Record<string, unknown>): void {
  const ctx = getContext();
  if (ctx) {
    Object.assign(ctx, data);
  }
}
```

## Fastify Integration

```typescript
// src/plugins/telemetry.ts
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import {
  createRequestContext,
  runWithContext,
  getContext,
  RequestContext,
} from '../lib/context';
import { logger } from '../lib/logger';

export interface WideEvent {
  // Required fields
  request_id: string;
  trace_id: string;
  span_id: string;
  timestamp: string;
  service: string;
  version: string;
  
  // Request fields
  method: string;
  path: string;
  route?: string;
  query?: Record<string, unknown>;
  status_code?: number;
  duration_ms?: number;
  outcome?: 'success' | 'error' | 'client_error';
  
  // Size
  request_size_bytes?: number;
  response_size_bytes?: number;
  
  // User context
  user?: {
    id?: string;
    subscription?: string;
    account_age_days?: number;
  };
  
  // Business context (extensible)
  [key: string]: unknown;
  
  // Infrastructure
  db?: {
    query_count?: number;
    duration_ms?: number;
  };
  cache?: {
    hit?: boolean;
    key?: string;
  };
  external?: Record<string, { duration_ms: number; status?: number }>;
  
  // Error context
  error?: {
    type?: string;
    code?: string;
    message?: string;
    stack?: string;
    retriable?: boolean;
  };
}

declare module 'fastify' {
  interface FastifyRequest {
    ctx: RequestContext;
    wideEvent: WideEvent;
  }
}

const telemetryPlugin: FastifyPluginAsync = async (fastify) => {
  // Initialize context and wide event on each request
  fastify.addHook('onRequest', async (request, reply) => {
    const traceId = request.headers['x-trace-id'] as string;
    const ctx = createRequestContext(traceId);
    
    request.ctx = ctx;
    request.wideEvent = {
      request_id: ctx.requestId,
      trace_id: ctx.traceId,
      span_id: ctx.spanId,
      timestamp: new Date().toISOString(),
      service: process.env.SERVICE_NAME || 'unknown',
      version: process.env.SERVICE_VERSION || 'unknown',
      method: request.method,
      path: request.url,
      route: request.routeOptions?.url,
      request_size_bytes: request.headers['content-length']
        ? parseInt(request.headers['content-length'])
        : undefined,
    };
  });
  
  // Emit wide event on response
  fastify.addHook('onResponse', async (request, reply) => {
    const event = request.wideEvent;
    const ctx = request.ctx;
    
    if (!event || !ctx) return;
    
    event.status_code = reply.statusCode;
    event.duration_ms = Date.now() - ctx.startTime;
    event.response_size_bytes = reply.getHeader('content-length') as number;
    
    if (reply.statusCode >= 500) {
      event.outcome = 'error';
      logger.error(event);
    } else if (reply.statusCode >= 400) {
      event.outcome = 'client_error';
      logger.warn(event);
    } else {
      event.outcome = 'success';
      logger.info(event);
    }
  });
  
  // Capture errors
  fastify.addHook('onError', async (request, reply, error) => {
    if (request.wideEvent) {
      request.wideEvent.error = {
        type: error.name,
        code: (error as any).code,
        message: error.message,
        retriable: (error as any).retriable ?? false,
      };
      
      // Only include stack in development
      if (process.env.NODE_ENV === 'development') {
        request.wideEvent.error.stack = error.stack;
      }
    }
  });
};

export default fp(telemetryPlugin, {
  name: 'telemetry',
});
```

## Express Integration

```typescript
// src/middleware/telemetry.ts
import { Request, Response, NextFunction } from 'express';
import { createRequestContext, runWithContext } from '../lib/context';
import { logger } from '../lib/logger';

export interface WideEvent {
  request_id: string;
  trace_id: string;
  timestamp: string;
  service: string;
  version: string;
  method: string;
  path: string;
  status_code?: number;
  duration_ms?: number;
  outcome?: string;
  user?: Record<string, unknown>;
  error?: Record<string, unknown>;
  [key: string]: unknown;
}

declare global {
  namespace Express {
    interface Request {
      wideEvent: WideEvent;
    }
  }
}

export function telemetryMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const ctx = createRequestContext(req.headers['x-trace-id'] as string);
    
    req.wideEvent = {
      request_id: ctx.requestId,
      trace_id: ctx.traceId,
      timestamp: new Date().toISOString(),
      service: process.env.SERVICE_NAME || 'unknown',
      version: process.env.SERVICE_VERSION || 'unknown',
      method: req.method,
      path: req.path,
    };
    
    // Capture response
    const originalEnd = res.end;
    res.end = function (chunk?: any, encoding?: any, callback?: any) {
      const event = req.wideEvent;
      event.status_code = res.statusCode;
      event.duration_ms = Date.now() - ctx.startTime;
      event.outcome = res.statusCode < 400 ? 'success' : 'error';
      
      if (res.statusCode >= 500) {
        logger.error(event);
      } else if (res.statusCode >= 400) {
        logger.warn(event);
      } else {
        logger.info(event);
      }
      
      return originalEnd.call(this, chunk, encoding, callback);
    };
    
    runWithContext(ctx, () => next());
  };
}
```

## Hono Integration

```typescript
// src/middleware/telemetry.ts
import { MiddlewareHandler } from 'hono';
import { createRequestContext } from '../lib/context';
import { logger } from '../lib/logger';

export interface WideEvent {
  request_id: string;
  trace_id: string;
  timestamp: string;
  service: string;
  version: string;
  method: string;
  path: string;
  status_code?: number;
  duration_ms?: number;
  outcome?: string;
  [key: string]: unknown;
}

declare module 'hono' {
  interface ContextVariableMap {
    wideEvent: WideEvent;
    requestContext: ReturnType<typeof createRequestContext>;
  }
}

export const telemetry: MiddlewareHandler = async (c, next) => {
  const traceId = c.req.header('x-trace-id');
  const ctx = createRequestContext(traceId);
  
  const event: WideEvent = {
    request_id: ctx.requestId,
    trace_id: ctx.traceId,
    timestamp: new Date().toISOString(),
    service: process.env.SERVICE_NAME || 'unknown',
    version: process.env.SERVICE_VERSION || 'unknown',
    method: c.req.method,
    path: c.req.path,
  };
  
  c.set('wideEvent', event);
  c.set('requestContext', ctx);
  
  try {
    await next();
  } catch (error) {
    event.error = {
      type: error instanceof Error ? error.name : 'Error',
      message: error instanceof Error ? error.message : String(error),
    };
    throw error;
  } finally {
    event.status_code = c.res.status;
    event.duration_ms = Date.now() - ctx.startTime;
    event.outcome = c.res.status < 400 ? 'success' : 'error';
    
    if (c.res.status >= 500) {
      logger.error(event);
    } else if (c.res.status >= 400) {
      logger.warn(event);
    } else {
      logger.info(event);
    }
  }
};
```

## Child Loggers for Operations

```typescript
// For operations that need their own timing
export function createOperationLogger(name: string) {
  const ctx = getContext();
  const baseLog = ctx?.logger ?? logger;
  
  const start = Date.now();
  const opLogger = baseLog.child({ operation: name });
  
  return {
    logger: opLogger,
    complete: (data?: Record<string, unknown>) => {
      opLogger.info({
        ...data,
        operation_duration_ms: Date.now() - start,
      });
    },
    error: (error: Error, data?: Record<string, unknown>) => {
      opLogger.error({
        ...data,
        error: {
          type: error.name,
          message: error.message,
        },
        operation_duration_ms: Date.now() - start,
      });
    },
  };
}

// Usage
async function queryDatabase() {
  const op = createOperationLogger('database_query');
  try {
    const results = await db.query('SELECT * FROM users');
    op.complete({ rows: results.length });
    return results;
  } catch (error) {
    op.error(error as Error);
    throw error;
  }
}
```

## Sampling Implementation

```typescript
// src/lib/sampling.ts
import { WideEvent } from '../middleware/telemetry';

interface SamplingConfig {
  defaultRate: number;
  rules: SamplingRule[];
}

interface SamplingRule {
  name: string;
  condition: (event: WideEvent) => boolean;
  action: 'keep' | 'drop' | 'sample';
  rate?: number;
  priority: number;
}

const config: SamplingConfig = {
  defaultRate: 0.1,
  rules: [
    {
      name: 'keep-errors',
      condition: (e) => (e.status_code ?? 0) >= 500 || !!e.error,
      action: 'keep',
      priority: 1,
    },
    {
      name: 'keep-slow',
      condition: (e) => (e.duration_ms ?? 0) > 2000,
      action: 'keep',
      priority: 2,
    },
    {
      name: 'keep-enterprise',
      condition: (e) => e.user?.subscription === 'enterprise',
      action: 'keep',
      priority: 3,
    },
    {
      name: 'sample-success',
      condition: (e) => (e.status_code ?? 0) < 400,
      action: 'sample',
      rate: 0.05,
      priority: 100,
    },
  ],
};

export function shouldLog(event: WideEvent): boolean {
  const sortedRules = [...config.rules].sort((a, b) => a.priority - b.priority);
  
  for (const rule of sortedRules) {
    if (rule.condition(event)) {
      switch (rule.action) {
        case 'keep':
          return true;
        case 'drop':
          return false;
        case 'sample':
          return Math.random() < (rule.rate ?? config.defaultRate);
      }
    }
  }
  
  return Math.random() < config.defaultRate;
}
```

## Database Query Tracking

```typescript
// src/lib/db-tracking.ts
import { getContext } from './context';

export function trackQuery(queryName: string) {
  const ctx = getContext();
  if (!ctx) return { end: () => {} };
  
  if (!ctx.dbQueries) {
    ctx.dbQueries = [];
  }
  
  const start = Date.now();
  
  return {
    end: (rowCount?: number) => {
      const duration = Date.now() - start;
      ctx.dbQueries.push({
        name: queryName,
        duration_ms: duration,
        rows: rowCount,
      });
    },
  };
}

// Usage with Prisma middleware
prisma.$use(async (params, next) => {
  const tracker = trackQuery(`${params.model}.${params.action}`);
  try {
    const result = await next(params);
    tracker.end(Array.isArray(result) ? result.length : 1);
    return result;
  } catch (error) {
    tracker.end();
    throw error;
  }
});
```

## Transport Configuration

```typescript
// Production: multiple transports
import pino from 'pino';

const transports = pino.transport({
  targets: [
    // Stdout for container logs
    {
      target: 'pino/file',
      options: { destination: 1 },
      level: 'info',
    },
    // File for backup
    {
      target: 'pino/file',
      options: { destination: './logs/app.log' },
      level: 'debug',
    },
    // Custom transport for log aggregator
    {
      target: './transports/datadog',
      options: { apiKey: process.env.DD_API_KEY },
      level: 'info',
    },
  ],
});

export const logger = pino(transports);
```
