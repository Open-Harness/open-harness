---
name: needle-di
description: |
  Dependency-driven development using NeedleDI for TypeScript. Covers SOLID
  principles (especially Dependency Inversion), Inversion of Control, constructor
  injection, InjectionToken patterns, testable architecture, and strategic testing.
  USE WHEN user says 'dependency injection', 'DI', '@injectable', 'NeedleDI',
  'inject services', 'IoC', 'testable services', 'mock dependencies', 'inversion
  of control', or builds/refactors services in this monorepo.
---

# Dependency-Driven Development with NeedleDI

## Philosophy

DI is not a library feature—it's an architectural discipline. Every service you write should be:

1. **Explicitly dependent** - All dependencies declared in constructor
2. **Abstraction-bound** - Depend on tokens/interfaces, not concrete classes
3. **Testable by design** - No real infrastructure needed to test
4. **Single-purpose** - One reason to change

**NeedleDI is how we implement this in the codebase. The principles are universal.**

## Before Writing Any Code

Ask yourself:

| Question | If No, Stop |
|----------|-------------|
| Can I test this without real DB/API/filesystem? | Redesign dependencies |
| Are all dependencies in the constructor? | No hidden `new` or imports |
| Does this service do ONE thing? | Split it |
| Am I depending on abstractions? | Use InjectionToken |

## Quick Patterns

### 1. Basic Injectable Service
```typescript
import { injectable, inject } from "@needle-di/core";

@injectable()
class UserService {
  constructor(
    private db = inject(IDatabaseToken),
    private logger = inject(ILoggerToken),
  ) {}
}
```

### 2. InjectionToken for Interfaces
```typescript
import { InjectionToken } from "@needle-di/core";

interface ILogger {
  log(msg: string): void;
  error(msg: string): void;
}

export const ILoggerToken = new InjectionToken<ILogger>("ILogger");
```

### 3. Container Setup (Composition Root)
```typescript
import { Container } from "@needle-di/core";

const container = new Container();
container.bind({ provide: ILoggerToken, useClass: ConsoleLogger });
container.bind({ provide: IDatabaseToken, useClass: PostgresDatabase });

export const userService = container.get(UserService);
```

### 4. Testing with Mocks
```typescript
// The payoff: trivial mocking
const mockLogger: ILogger = { log: vi.fn(), error: vi.fn() };
const mockDb: IDatabase = { query: vi.fn() };

const service = new UserService(mockDb, mockLogger);
// Test without ANY real infrastructure
```

## Self-Assessment Rubric

Before committing, grade your code:

| Criterion | Pass? |
|-----------|-------|
| All dependencies via constructor injection | |
| No `new ConcreteClass()` inside services | |
| Uses InjectionToken for non-class dependencies | |
| Can instantiate in test with zero infrastructure | |
| Service has single, clear responsibility | |
| No service locator pattern (container.get inside services) | |

**If any fail, refactor before committing.**

## Reference Documentation

| Topic | Command |
|-------|---------|
| Core principles (DIP, IoC, SOLID) | `read ./references/principles.md` |
| NeedleDI patterns catalog | `read ./references/patterns.md` |
| Strategic testing philosophy | `read ./references/testing.md` |
| Detailed rubrics & grading | `read ./references/rubrics.md` |
| Anti-patterns to avoid | `read ./references/anti-patterns.md` |

## Deep Research (Raw)

| Topic | Command |
|-------|---------|
| NeedleDI documentation summary | `read ./references/raw/documentation-summary.md` |
| Codebase architecture patterns | `read ./references/raw/codebase-patterns.md` |
| Examples catalog | `read ./references/raw/examples-catalog.md` |

## When to Use Each Pattern

| Scenario | Pattern | Reference |
|----------|---------|-----------|
| Basic service with dependencies | Constructor injection | Quick Patterns #1 |
| Config or interface binding | InjectionToken | Quick Patterns #2 |
| App bootstrap | Composition Root | Quick Patterns #3 |
| Multiple implementations | Multi-provider | `read ./references/patterns.md` |
| Request-scoped data | Child containers | `read ./references/patterns.md` |
| Circular dependencies | Lazy injection | `read ./references/patterns.md` |
| Optional features | Optional injection | `read ./references/patterns.md` |

## Critical Mindset

When reviewing your own code or others':

1. **Challenge**: "Could this be tested without mocks for infrastructure?"
2. **Question**: "Is this service doing too much?"
3. **Verify**: "Are dependencies explicit or hidden?"
4. **Grade**: Run through the rubric above

The goal is not 100% test coverage. The goal is **confidence that changes won't break things**.
