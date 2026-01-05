# Telemetry Manifest Schema

The `telemetry-manifest.json` file captures the complete telemetry strategy.

## Complete Schema

```typescript
interface TelemetryManifest {
  version: "1.0.0";
  generatedAt: string; // ISO 8601
  projectName: string;
  
  // Phase 1 outputs
  codebaseContext: {
    services: ServiceInfo[];
    infrastructure: InfrastructureInfo[];
    loggingAudit: LoggingAudit;
    businessDomain: BusinessDomain;
  };
  
  // Phase 2 outputs  
  interviewAnswers: {
    debuggingPainPoints: string[];
    priorityUserSegments: string[];
    criticalTransactions: string[];
    complianceRequirements: ComplianceRequirements;
    queryPatterns: string[];
    constraints: Constraints;
  };
  
  // Phase 3 outputs
  telemetryStrategy: {
    globalFields: FieldDefinition[];
    serviceSchemas: Record<string, ServiceSchema>;
    samplingRules: SamplingRule[];
    redactionRules: RedactionRule[];
    transportConfig: TransportConfig;
  };
  
  // Phase 4 outputs
  implementationTasks: Task[];
}
```

## Section Details

### ServiceInfo

```typescript
interface ServiceInfo {
  name: string;
  type: "http" | "graphql" | "worker" | "cron" | "websocket";
  framework: string;
  entryPoints: string[];
  routes?: string[]; // For HTTP services
  consumers?: string[]; // For workers
  dependencies: string[]; // Other services called
}
```

### InfrastructureInfo

```typescript
interface InfrastructureInfo {
  type: "database" | "cache" | "queue" | "http" | "storage";
  client: string; // npm package name
  configFile: string;
  connectionDetails?: {
    envVar?: string;
    poolSize?: number;
  };
}
```

### LoggingAudit

```typescript
interface LoggingAudit {
  currentLogger: "console" | "pino" | "winston" | "bunyan" | "mixed";
  statements: {
    console: { log: number; warn: number; error: number; info: number; debug: number };
    structured: { info: number; warn: number; error: number; debug: number };
  };
  structuredPercent: number;
  patterns: string[]; // Common patterns found
  configLocation?: string; // Existing logger config
}
```

### BusinessDomain

```typescript
interface BusinessDomain {
  entities: EntityInfo[];
  transactions: TransactionInfo[];
  featureFlags: {
    provider: string | null;
    configLocation?: string;
  };
}

interface EntityInfo {
  name: string;
  idField: string;
  modelLocation: string;
  highCardinality: boolean;
}

interface TransactionInfo {
  name: string;
  services: string[];
  criticalPath: boolean;
  typicalDuration: string; // "fast" | "medium" | "slow"
}
```

### ComplianceRequirements

```typescript
interface ComplianceRequirements {
  piiFields: string[];
  retentionDays: number;
  auditRequired: boolean;
  gdprCompliant: boolean;
  additionalRegulations?: string[];
}
```

### Constraints

```typescript
interface Constraints {
  budgetLimited: boolean;
  maxEventsPerSecond?: number;
  storageSystem: string;
  retentionPolicy: string;
}
```

### FieldDefinition

```typescript
interface FieldDefinition {
  name: string;
  path: string; // Dot notation path in event
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  source: "request" | "context" | "computed" | "config";
  description: string;
}
```

### ServiceSchema

```typescript
interface ServiceSchema {
  serviceName: string;
  eventType: "request" | "job" | "message";
  fields: {
    required: string[];
    standard: string[];
    business: Record<string, string[]>;
    infrastructure: Record<string, string[]>;
    error: string[];
  };
  example: object; // Complete example event
}
```

### SamplingRule

```typescript
interface SamplingRule {
  name: string;
  condition: string; // Expression
  action: "keep" | "sample";
  rate?: number; // For "sample" action, 0.0-1.0
  priority: number; // Lower = higher priority
  reason: string;
}
```

Example rules:

```json
[
  {
    "name": "keep-all-errors",
    "condition": "status_code >= 500 || error != null",
    "action": "keep",
    "priority": 1,
    "reason": "Never drop error events"
  },
  {
    "name": "keep-slow-requests",
    "condition": "duration_ms > 2000",
    "action": "keep",
    "priority": 2,
    "reason": "Keep outliers for performance analysis"
  },
  {
    "name": "keep-enterprise-users",
    "condition": "user.subscription == 'enterprise'",
    "action": "keep",
    "priority": 3,
    "reason": "VIP users get full logging"
  },
  {
    "name": "sample-success",
    "condition": "status_code < 400",
    "action": "sample",
    "rate": 0.1,
    "priority": 100,
    "reason": "Sample successful requests at 10%"
  }
]
```

### RedactionRule

```typescript
interface RedactionRule {
  name: string;
  paths: string[]; // Paths to redact
  strategy: "remove" | "mask" | "hash";
  maskPattern?: string; // For "mask" strategy
  reason: string;
}
```

Example rules:

```json
[
  {
    "name": "credit-card",
    "paths": ["payment.card_number", "*.card_number"],
    "strategy": "remove",
    "reason": "PCI compliance"
  },
  {
    "name": "email-partial",
    "paths": ["user.email", "*.email"],
    "strategy": "mask",
    "maskPattern": "***@***.***",
    "reason": "Privacy while debugging"
  },
  {
    "name": "auth-tokens",
    "paths": ["headers.authorization", "*.token", "*.apiKey"],
    "strategy": "remove",
    "reason": "Security"
  }
]
```

### TransportConfig

```typescript
interface TransportConfig {
  development: {
    target: string;
    options: object;
  };
  production: {
    target: string;
    options: object;
  };
}
```

### Task

```typescript
interface Task {
  id: string; // TELE-001 format
  category: "foundation" | "migration" | "enrichment" | "compliance";
  priority: "P0" | "P1" | "P2" | "P3";
  title: string;
  description: string;
  files: string[];
  estimatedEffort: "small" | "medium" | "large";
  dependencies: string[]; // Task IDs
  acceptanceCriteria: string[];
  codeSnippet?: string;
}
```

## Example Manifest

```json
{
  "version": "1.0.0",
  "generatedAt": "2025-01-05T12:00:00Z",
  "projectName": "acme-checkout",
  
  "codebaseContext": {
    "services": [
      {
        "name": "api-gateway",
        "type": "http",
        "framework": "fastify",
        "entryPoints": ["src/server.ts"],
        "routes": ["POST /checkout", "GET /cart", "POST /payment"],
        "dependencies": ["payment-service", "inventory-service"]
      }
    ],
    "infrastructure": [
      { "type": "database", "client": "prisma", "configFile": "prisma/schema.prisma" },
      { "type": "cache", "client": "ioredis", "configFile": "src/lib/redis.ts" }
    ],
    "loggingAudit": {
      "currentLogger": "mixed",
      "statements": {
        "console": { "log": 45, "warn": 12, "error": 8, "info": 0, "debug": 0 },
        "structured": { "info": 23, "warn": 5, "error": 3, "debug": 15 }
      },
      "structuredPercent": 41,
      "patterns": ["console.log for debugging", "Pino in some services"]
    },
    "businessDomain": {
      "entities": [
        { "name": "User", "idField": "id", "modelLocation": "prisma/schema.prisma", "highCardinality": true },
        { "name": "Order", "idField": "id", "modelLocation": "prisma/schema.prisma", "highCardinality": true }
      ],
      "transactions": [
        { "name": "checkout", "services": ["api-gateway", "payment-service"], "criticalPath": true, "typicalDuration": "slow" }
      ],
      "featureFlags": { "provider": "launchdarkly", "configLocation": "src/lib/flags.ts" }
    }
  },
  
  "interviewAnswers": {
    "debuggingPainPoints": [
      "Can't trace failed checkouts to root cause",
      "No visibility into payment gateway responses"
    ],
    "priorityUserSegments": ["enterprise", "premium"],
    "criticalTransactions": ["checkout", "refund"],
    "complianceRequirements": {
      "piiFields": ["email", "card_number", "ssn"],
      "retentionDays": 90,
      "auditRequired": true,
      "gdprCompliant": true
    },
    "queryPatterns": [
      "All failures for user X",
      "Error rate by subscription tier",
      "p99 latency by endpoint"
    ],
    "constraints": {
      "budgetLimited": true,
      "storageSystem": "datadog",
      "retentionPolicy": "90 days"
    }
  },
  
  "telemetryStrategy": {
    "globalFields": [
      { "name": "request_id", "path": "request_id", "type": "string", "required": true, "source": "request", "description": "Unique request identifier" },
      { "name": "trace_id", "path": "trace_id", "type": "string", "required": true, "source": "context", "description": "Distributed trace ID" }
    ],
    "serviceSchemas": {
      "api-gateway": {
        "serviceName": "api-gateway",
        "eventType": "request",
        "fields": {
          "required": ["request_id", "trace_id", "timestamp", "service", "version"],
          "standard": ["method", "path", "status_code", "duration_ms"],
          "business": {
            "user": ["id", "subscription"],
            "cart": ["id", "item_count", "total_cents"]
          },
          "infrastructure": {
            "db": ["query_count", "duration_ms"],
            "cache": ["hit"]
          },
          "error": ["type", "code", "message"]
        },
        "example": {}
      }
    },
    "samplingRules": [],
    "redactionRules": [],
    "transportConfig": {
      "development": { "target": "pino-pretty", "options": {} },
      "production": { "target": "pino/file", "options": { "destination": 1 } }
    }
  },
  
  "implementationTasks": []
}
```
