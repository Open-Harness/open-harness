# NeedleDI Implementation Patterns

## Overview

These patterns show **how** to implement dependency-driven development with NeedleDI. For the **why**, see `principles.md`.

---

## Pattern 1: Basic Injectable Service

**When**: Every service you create.

```typescript
import { injectable, inject } from "@needle-di/core";

@injectable()
class UserService {
  constructor(
    private db = inject(IDatabaseToken),
    private logger = inject(ILoggerToken),
  ) {}

  async getUser(id: string): Promise<User | null> {
    this.logger.log(`Fetching user: ${id}`);
    return this.db.query<User>("SELECT * FROM users WHERE id = ?", [id]);
  }
}
```

**Key Points**:
- `@injectable()` enables auto-binding as singleton
- `inject()` in default parameters (constructor injection)
- Dependencies are abstractions (tokens), not concrete classes

---

## Pattern 2: InjectionToken for Interfaces

**When**: Binding non-class dependencies (interfaces, configs, primitives).

```typescript
import { InjectionToken } from "@needle-di/core";

// Define the interface
interface ILogger {
  log(message: string): void;
  error(message: string): void;
  warn(message: string): void;
}

// Create typed token
export const ILoggerToken = new InjectionToken<ILogger>("ILogger");

// Bind in container
container.bind({
  provide: ILoggerToken,
  useClass: ConsoleLogger, // ConsoleLogger implements ILogger
});

// Inject by token
@injectable()
class SomeService {
  constructor(private logger = inject(ILoggerToken)) {}
}
```

**Why InjectionToken over string/symbol**:
- Full type inference (`container.get(ILoggerToken)` returns `ILogger`)
- Refactoring safe
- Enables tree-shaking

---

## Pattern 3: Tree-Shakeable Token with Factory

**When**: Optional features that shouldn't bloat the bundle if unused.

```typescript
// The factory is only called if the token is actually requested
export const IAnalyticsToken = new InjectionToken<IAnalytics>("IAnalytics", {
  factory: () => new PostHogAnalytics(),
});

// No manual binding needed!
// If IAnalyticsToken is never injected, PostHogAnalytics is tree-shaken

// Usage
@injectable()
class UserService {
  constructor(
    private analytics = inject(IAnalyticsToken), // Factory called here
  ) {}
}
```

**When NOT to use**:
- When you need different implementations per environment
- When the factory needs other dependencies (use `useFactory` provider instead)

---

## Pattern 4: Value Provider for Configuration

**When**: Static config, primitives, pre-instantiated objects.

```typescript
interface IConfig {
  apiUrl: string;
  timeout: number;
  retries: number;
}

export const IConfigToken = new InjectionToken<IConfig>("IConfig");

// In container setup
container.bind({
  provide: IConfigToken,
  useValue: {
    apiUrl: process.env.API_URL ?? "https://api.example.com",
    timeout: 5000,
    retries: 3,
  },
});
```

**Note**: Value is created immediately (not lazy). For lazy config, use `useFactory`.

---

## Pattern 5: Factory Provider with Dependencies

**When**: Complex construction logic, or factory needs other services.

```typescript
container.bind({
  provide: IHttpClientToken,
  useFactory: (c) => {
    const config = c.get(IConfigToken);
    const logger = c.get(ILoggerToken);

    return new HttpClient({
      baseUrl: config.apiUrl,
      timeout: config.timeout,
      onError: (err) => logger.error(`HTTP Error: ${err.message}`),
    });
  },
});
```

**Alternative with `inject()`**:
```typescript
container.bind({
  provide: IHttpClientToken,
  useFactory: () => new HttpClient({
    baseUrl: inject(IConfigToken).apiUrl,
    timeout: inject(IConfigToken).timeout,
  }),
});
```

---

## Pattern 6: Existing Provider (Aliasing)

**When**: Multiple tokens should resolve to same instance.

```typescript
// Concrete implementation
@injectable()
class PostgresDatabase implements IReadableDatabase, IWritableDatabase {
  // ...
}

// Create aliases
container.bind({
  provide: IReadableDatabaseToken,
  useExisting: PostgresDatabase,
});

container.bind({
  provide: IWritableDatabaseToken,
  useExisting: PostgresDatabase,
});

// Both resolve to the SAME PostgresDatabase singleton
const readable = container.get(IReadableDatabaseToken);
const writable = container.get(IWritableDatabaseToken);
// readable === writable (same instance)
```

**Use Case**: Interface segregation where one class implements multiple interfaces.

---

## Pattern 7: Multi-Provider (Plugin System)

**When**: Multiple implementations of same interface.

```typescript
// Base abstraction
abstract class ValidationRule {
  abstract validate(value: unknown): ValidationResult;
}

// Multiple implementations
@injectable()
class EmailRule extends ValidationRule {
  validate(value: unknown): ValidationResult { /* ... */ }
}

@injectable()
class LengthRule extends ValidationRule {
  validate(value: unknown): ValidationResult { /* ... */ }
}

@injectable()
class RequiredRule extends ValidationRule {
  validate(value: unknown): ValidationResult { /* ... */ }
}

// Register as multi-providers
container.bind({ provide: ValidationRule, multi: true, useClass: EmailRule });
container.bind({ provide: ValidationRule, multi: true, useClass: LengthRule });
container.bind({ provide: ValidationRule, multi: true, useClass: RequiredRule });

// Inject as array
@injectable()
class Validator {
  constructor(
    private rules = inject(ValidationRule, { multi: true }), // ValidationRule[]
  ) {}

  validate(value: unknown): ValidationResult[] {
    return this.rules.map(rule => rule.validate(value));
  }
}
```

**Rules**:
- All providers for a token must have `multi: true` or none
- Can't mix `multi: true` and `multi: false` for same token

---

## Pattern 8: Child Containers (Request Scoping)

**When**: Per-request/per-operation state that shouldn't leak.

```typescript
// Root container with shared singletons
const rootContainer = new Container();
rootContainer.bind({ provide: ILoggerToken, useClass: ConsoleLogger });
rootContainer.bind({ provide: IDatabaseToken, useClass: PostgresDatabase });

// Per-request handling
function handleRequest(req: Request): Response {
  // Create child container for this request
  const requestContainer = rootContainer.createChild();

  // Bind request-specific context
  requestContainer.bind({
    provide: IRequestContextToken,
    useValue: {
      requestId: generateId(),
      userId: req.user?.id,
      timestamp: new Date(),
    },
  });

  // Services in child container see request context
  // but share DB/Logger singletons from parent
  const handler = requestContainer.get(RequestHandler);
  return handler.handle(req);
}
```

**Key Points**:
- Child inherits all parent bindings
- Child can override specific bindings
- Singletons are shared unless overridden

---

## Pattern 9: Lazy Injection (Circular Dependencies)

**When**: Breaking circular dependency chains.

```typescript
// Problem: ServiceA → ServiceB → ServiceA (circular!)

@injectable()
class ServiceA {
  constructor(private b = inject(ServiceB)) {}

  methodA() {
    return this.b.methodB();
  }
}

@injectable()
class ServiceB {
  // LAZY: Defers resolution until first call
  constructor(private a = inject(ServiceA, { lazy: true })) {}
  // Type: () => ServiceA

  methodB() {
    return "B";
  }

  methodThatNeedsA() {
    return this.a().methodA(); // Invoked as function
  }
}
```

**When to use**:
- Circular dependencies that can't be refactored away
- Expensive services that might not be needed

**Best practice**: Put `lazy` on the less critical side of the cycle.

---

## Pattern 10: Optional Injection (Graceful Degradation)

**When**: Feature that may not be configured.

```typescript
@injectable()
class UserService {
  constructor(
    private db = inject(IDatabaseToken),
    private logger = inject(ILoggerToken),
    // Optional: returns undefined if not bound
    private analytics = inject(IAnalyticsToken, { optional: true }),
    private cache = inject(ICacheToken, { optional: true }),
  ) {}

  async createUser(data: UserData): Promise<User> {
    const user = await this.db.save(data);

    // Safe navigation - no crash if analytics not configured
    this.analytics?.trackUserCreated(user.id);

    // Caching is optional enhancement
    await this.cache?.set(`user:${user.id}`, user);

    return user;
  }
}
```

**Use Cases**:
- Feature flags
- Premium features
- Dev-only tooling (logging, profiling)

---

## Pattern 11: Async Factory Provider

**When**: Dependency requires async initialization.

```typescript
container.bind({
  provide: IDatabaseToken,
  async: true,
  useFactory: async () => {
    const db = new PostgresDatabase();
    await db.connect();
    await db.runMigrations();
    return db;
  },
});

// Must use getAsync or bootstrapAsync
const db = await container.getAsync(IDatabaseToken);

// Or in a service (still uses sync inject, but service must be gotten async)
@injectable()
class UserService {
  constructor(private db = inject(IDatabaseToken)) {}
}

const service = await container.getAsync(UserService);
```

**Note**: Cannot use `inject()` inside async factory. Use `container.get()`:

```typescript
// ❌ Wrong
useFactory: async () => {
  const config = inject(IConfigToken); // Throws!
  return new Database(config);
},

// ✅ Correct
useFactory: async (container) => {
  const config = container.get(IConfigToken);
  return new Database(config);
},
```

---

## Pattern 12: Composition Root Structure

**When**: Setting up the application container.

```typescript
// src/di/container.ts

import { Container } from "@needle-di/core";
import { ILoggerToken, IConfigToken, IDatabaseToken } from "./tokens";
import { ConsoleLogger, PostgresDatabase } from "./implementations";

export function createContainer(env: "production" | "development" | "test"): Container {
  const container = new Container();

  // Infrastructure layer
  container.bind({
    provide: ILoggerToken,
    useClass: env === "production" ? JsonLogger : ConsoleLogger,
  });

  container.bind({
    provide: IConfigToken,
    useValue: loadConfig(env),
  });

  container.bind({
    provide: IDatabaseToken,
    useClass: env === "test" ? InMemoryDatabase : PostgresDatabase,
  });

  // Domain services (auto-bind via @injectable)
  container.bind(UserService);
  container.bind(OrderService);

  // Application services
  container.bind(UserController);
  container.bind(OrderController);

  return container;
}

// src/main.ts
const container = createContainer(process.env.NODE_ENV as any);
const app = container.get(Application);
app.start();
```

**Key Points**:
- ALL bindings in ONE file
- Environment-specific implementations
- Layered binding (infrastructure → domain → application)

---

## Pattern Summary

| Pattern | Use When |
|---------|----------|
| Basic Injectable | Every service |
| InjectionToken | Non-class dependencies |
| Tree-Shakeable Token | Optional features |
| Value Provider | Static config |
| Factory Provider | Complex construction |
| Existing Provider | Aliasing/interface segregation |
| Multi-Provider | Plugin systems |
| Child Containers | Request scoping |
| Lazy Injection | Circular dependencies |
| Optional Injection | Graceful degradation |
| Async Factory | Async initialization |
| Composition Root | App bootstrap |

---

## Quick Reference

```typescript
// Basic service
@injectable()
class MyService {
  constructor(private dep = inject(Token)) {}
}

// Token for interface
const Token = new InjectionToken<IInterface>("Token");

// Tree-shakeable token
const Token = new InjectionToken<T>("Token", { factory: () => new Impl() });

// Provider types
container.bind(MyClass);                                    // Class shorthand
container.bind({ provide: Token, useClass: Impl });         // Class provider
container.bind({ provide: Token, useValue: value });        // Value provider
container.bind({ provide: Token, useFactory: () => ... });  // Factory provider
container.bind({ provide: Token, useExisting: Other });     // Alias provider
container.bind({ provide: Token, multi: true, ... });       // Multi-provider

// Injection options
inject(Token)                          // Required
inject(Token, { optional: true })      // Optional (may be undefined)
inject(Token, { lazy: true })          // Lazy (() => T)
inject(Token, { multi: true })         // Multi (T[])

// Container operations
container.get(Token)                   // Sync retrieval
container.getAsync(Token)              // Async retrieval
container.createChild()                // Child container
```
