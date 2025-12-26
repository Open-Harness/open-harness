# Anti-Patterns to Avoid

## Why This Matters

Knowing what NOT to do is as important as knowing what to do. These anti-patterns will make your code:
- Hard to test
- Tightly coupled
- Difficult to change
- Prone to hidden bugs

**When you see these patterns, refactor immediately.**

---

## Anti-Pattern 1: Service Locator

### The Problem

Using `container.get()` inside services instead of constructor injection.

```typescript
// ❌ SERVICE LOCATOR - NEVER DO THIS
@injectable()
class UserService {
  private db: IDatabase;
  private logger: ILogger;

  constructor() {
    // Pulling dependencies from global container
    this.db = container.get(IDatabaseToken);
    this.logger = container.get(ILoggerToken);
  }
}
```

### Why It's Bad

1. **Hidden dependencies**: Can't see what the service needs from its signature
2. **Untestable**: Can't pass mocks without manipulating global container
3. **Runtime surprises**: Fails at runtime if dependency not bound, not at construction

### The Fix

```typescript
// ✅ CONSTRUCTOR INJECTION
@injectable()
class UserService {
  constructor(
    private db = inject(IDatabaseToken),
    private logger = inject(ILoggerToken),
  ) {}
}

// Test is trivial
const service = new UserService(mockDb, mockLogger);
```

---

## Anti-Pattern 2: New in Service

### The Problem

Creating dependencies inside the service with `new`.

```typescript
// ❌ INTERNAL CONSTRUCTION
@injectable()
class OrderService {
  async processOrder(order: Order) {
    const validator = new OrderValidator();  // Hidden dependency!
    const calculator = new PriceCalculator(); // Another one!

    if (!validator.validate(order)) throw new Error("Invalid");
    const total = calculator.calculate(order);

    const emailer = new SendGridClient(process.env.SENDGRID_KEY); // Yikes!
    await emailer.send(order.email, `Total: ${total}`);
  }
}
```

### Why It's Bad

1. **Hidden dependencies**: Three dependencies not visible in constructor
2. **Untestable**: Can't mock OrderValidator, PriceCalculator, or SendGridClient
3. **Tight coupling**: Hardcoded to specific implementations
4. **Environment coupling**: Reading env vars directly

### The Fix

```typescript
// ✅ INJECT EVERYTHING
@injectable()
class OrderService {
  constructor(
    private validator = inject(IOrderValidatorToken),
    private calculator = inject(IPriceCalculatorToken),
    private emailer = inject(IEmailerToken),
  ) {}

  async processOrder(order: Order) {
    if (!this.validator.validate(order)) throw new Error("Invalid");
    const total = this.calculator.calculate(order);
    await this.emailer.send(order.email, `Total: ${total}`);
  }
}
```

---

## Anti-Pattern 3: God Service

### The Problem

A service that does everything.

```typescript
// ❌ GOD SERVICE
@injectable()
class UserService {
  constructor(
    private db = inject(IDatabaseToken),
    private emailer = inject(IEmailerToken),
    private sms = inject(ISmsToken),
    private analytics = inject(IAnalyticsToken),
    private cache = inject(ICacheToken),
    private validator = inject(IValidatorToken),
    private encryptor = inject(IEncryptorToken),
    private imageProcessor = inject(IImageProcessorToken),
    // ... 10 more dependencies
  ) {}

  createUser() { /* ... */ }
  updateUser() { /* ... */ }
  deleteUser() { /* ... */ }
  sendVerificationEmail() { /* ... */ }
  sendPasswordReset() { /* ... */ }
  uploadAvatar() { /* ... */ }
  processAvatar() { /* ... */ }
  updatePreferences() { /* ... */ }
  exportUserData() { /* ... */ }
  importUserData() { /* ... */ }
  // ... 30 more methods
}
```

### Why It's Bad

1. **Violates SRP**: Has 15+ reasons to change
2. **Hard to test**: Need to mock 10+ dependencies for any test
3. **Hard to understand**: What does this service actually do?
4. **Change risk**: Touching any method risks breaking others

### The Fix

Split into focused services:

```typescript
// ✅ SINGLE RESPONSIBILITY
@injectable()
class UserRepository {
  constructor(private db = inject(IDatabaseToken)) {}

  create(data: UserData): Promise<User> { /* ... */ }
  update(id: string, data: Partial<User>): Promise<User> { /* ... */ }
  delete(id: string): Promise<void> { /* ... */ }
}

@injectable()
class UserNotificationService {
  constructor(
    private emailer = inject(IEmailerToken),
    private sms = inject(ISmsToken),
  ) {}

  sendVerification(user: User): Promise<void> { /* ... */ }
  sendPasswordReset(user: User): Promise<void> { /* ... */ }
}

@injectable()
class UserAvatarService {
  constructor(
    private storage = inject(IStorageToken),
    private imageProcessor = inject(IImageProcessorToken),
  ) {}

  upload(userId: string, file: File): Promise<string> { /* ... */ }
  process(imageUrl: string): Promise<string> { /* ... */ }
}
```

---

## Anti-Pattern 4: Concrete Dependencies

### The Problem

Depending on concrete implementations instead of abstractions.

```typescript
// ❌ CONCRETE DEPENDENCY
@injectable()
class ReportService {
  constructor(
    private db = inject(PostgresDatabase), // Concrete class!
    private cache = inject(RedisCache),     // Another concrete!
  ) {}
}
```

### Why It's Bad

1. **Can't swap implementations**: Locked to Postgres and Redis
2. **Testing requires real infra**: Can't easily mock
3. **Violates DIP**: High-level depends on low-level

### The Fix

```typescript
// ✅ ABSTRACT DEPENDENCIES
@injectable()
class ReportService {
  constructor(
    private db = inject(IDatabaseToken),  // Interface token
    private cache = inject(ICacheToken),   // Interface token
  ) {}
}

// In container, bind concrete implementations
container.bind({ provide: IDatabaseToken, useClass: PostgresDatabase });
container.bind({ provide: ICacheToken, useClass: RedisCache });

// In tests, bind fakes
testContainer.bind({ provide: IDatabaseToken, useClass: InMemoryDatabase });
testContainer.bind({ provide: ICacheToken, useClass: InMemoryCache });
```

---

## Anti-Pattern 5: Ambient Context

### The Problem

Using global/static state instead of injected dependencies.

```typescript
// ❌ AMBIENT CONTEXT
class UserService {
  async createUser(data: UserData) {
    const user = await Database.getInstance().save(data); // Global singleton
    Logger.info(`Created user: ${user.id}`);              // Static logger
    Config.get("FEATURE_FLAG") && Analytics.track(user);  // More globals
    return user;
  }
}
```

### Why It's Bad

1. **Hidden dependencies**: None visible in class signature
2. **Global state**: Can't isolate for testing
3. **Order-dependent**: Globals must be initialized before use
4. **Race conditions**: Shared mutable state across tests

### The Fix

```typescript
// ✅ EXPLICIT INJECTION
@injectable()
class UserService {
  constructor(
    private db = inject(IDatabaseToken),
    private logger = inject(ILoggerToken),
    private config = inject(IConfigToken),
    private analytics = inject(IAnalyticsToken, { optional: true }),
  ) {}

  async createUser(data: UserData) {
    const user = await this.db.save(data);
    this.logger.info(`Created user: ${user.id}`);
    this.config.featureEnabled("analytics") && this.analytics?.track(user);
    return user;
  }
}
```

---

## Anti-Pattern 6: Scattered Composition

### The Problem

Creating objects with `new` or `container.get()` throughout the codebase.

```typescript
// ❌ SCATTERED COMPOSITION

// In userController.ts
const userService = new UserService(
  container.get(IDatabaseToken),
  container.get(ILoggerToken),
);

// In orderController.ts
const orderService = container.get(OrderService);

// In reportJob.ts
const reportService = new ReportService(
  new PostgresDatabase(),
  new ConsoleLogger(),
);

// In main.ts
const app = container.get(Application);
```

### Why It's Bad

1. **No single source of truth**: Dependencies wired in multiple places
2. **Inconsistent patterns**: Some use container, some use `new`
3. **Hard to change**: Must update multiple files to change binding
4. **Hard to audit**: Where are objects created? Who knows!

### The Fix

```typescript
// ✅ SINGLE COMPOSITION ROOT

// di/container.ts - THE ONLY PLACE objects are composed
export function createContainer(): Container {
  const container = new Container();

  // Infrastructure
  container.bind({ provide: IDatabaseToken, useClass: PostgresDatabase });
  container.bind({ provide: ILoggerToken, useClass: ConsoleLogger });

  // Services (auto-bind via @injectable)
  container.bind(UserService);
  container.bind(OrderService);
  container.bind(ReportService);

  // Controllers
  container.bind(UserController);
  container.bind(OrderController);

  // Application
  container.bind(Application);

  return container;
}

// main.ts - Only gets root object
const container = createContainer();
const app = container.get(Application);
app.start();
```

---

## Anti-Pattern 7: Interface-as-Token

### The Problem

Trying to use TypeScript interfaces as injection tokens.

```typescript
// ❌ INTERFACE AS TOKEN - WON'T WORK
interface ILogger {
  log(msg: string): void;
}

// This compiles but fails at runtime!
container.bind({ provide: ILogger, useClass: ConsoleLogger });
// ILogger doesn't exist at runtime - interfaces are erased
```

### Why It's Bad

1. **Interfaces don't exist at runtime**: TypeScript erases them
2. **Silent failures**: May appear to work until it doesn't
3. **No type safety**: Container can't verify types

### The Fix

```typescript
// ✅ INJECTION TOKEN
interface ILogger {
  log(msg: string): void;
}

const ILoggerToken = new InjectionToken<ILogger>("ILogger");

container.bind({ provide: ILoggerToken, useClass: ConsoleLogger });

@injectable()
class MyService {
  constructor(private logger = inject(ILoggerToken)) {}
}
```

---

## Anti-Pattern 8: Circular Dependencies

### The Problem

Services that depend on each other directly.

```typescript
// ❌ CIRCULAR DEPENDENCY
@injectable()
class ServiceA {
  constructor(private b = inject(ServiceB)) {} // A needs B
}

@injectable()
class ServiceB {
  constructor(private a = inject(ServiceA)) {} // B needs A
}

// This will throw: "Detected circular dependency: ServiceA -> ServiceB -> ServiceA"
```

### Why It's Bad

1. **Can't construct**: Neither can be created first
2. **Design smell**: Usually indicates unclear responsibilities
3. **Runtime error**: NeedleDI throws at resolution time

### The Fix

Option 1: **Lazy injection** (quick fix)

```typescript
@injectable()
class ServiceB {
  constructor(private a = inject(ServiceA, { lazy: true })) {}
  // Type: () => ServiceA

  methodThatNeedsA() {
    return this.a().doSomething(); // Resolved on first call
  }
}
```

Option 2: **Extract shared dependency** (better fix)

```typescript
// Extract the shared logic into a third service
@injectable()
class SharedLogic {
  doSharedThing() { /* ... */ }
}

@injectable()
class ServiceA {
  constructor(private shared = inject(SharedLogic)) {}
}

@injectable()
class ServiceB {
  constructor(private shared = inject(SharedLogic)) {}
}
```

Option 3: **Event-based decoupling** (best fix for some cases)

```typescript
@injectable()
class ServiceA {
  constructor(private events = inject(IEventBusToken)) {}

  doSomething() {
    this.events.emit("something-happened", { data: "..." });
  }
}

@injectable()
class ServiceB {
  constructor(private events = inject(IEventBusToken)) {}

  onInit() {
    this.events.on("something-happened", this.handleEvent);
  }
}
```

---

## Anti-Pattern 9: Over-Injection

### The Problem

Injecting things that don't need to be injected.

```typescript
// ❌ OVER-INJECTION
@injectable()
class PriceCalculator {
  constructor(
    private mathUtils = inject(MathUtilsToken),  // Just Math.round()?
    private arrayUtils = inject(ArrayUtilsToken), // Just .reduce()?
  ) {}

  calculate(items: Item[]): number {
    return this.mathUtils.round(
      this.arrayUtils.sum(items.map(i => i.price))
    );
  }
}
```

### Why It's Bad

1. **Unnecessary complexity**: MathUtils is just Math.round
2. **Testing overhead**: Need to mock trivial utilities
3. **Obscures real dependencies**: Can't tell what actually matters

### When to Inject

| Inject | Don't Inject |
|--------|--------------|
| External services (DB, API, Email) | Utility functions (Math, Array helpers) |
| Configuration | Constants |
| Things you need to mock | Pure functions with no side effects |
| Stateful dependencies | Stateless transformations |

### The Fix

```typescript
// ✅ ONLY INJECT WHAT MATTERS
@injectable()
class PriceCalculator {
  constructor(
    private taxService = inject(ITaxServiceToken), // Real external dependency
  ) {}

  calculate(items: Item[]): number {
    const subtotal = items.reduce((sum, i) => sum + i.price, 0);
    const tax = this.taxService.calculateTax(subtotal);
    return Math.round(subtotal + tax);
  }
}
```

---

## Quick Reference: Smell → Fix

| Smell | Anti-Pattern | Fix |
|-------|--------------|-----|
| `container.get()` in service | Service Locator | Constructor injection |
| `new ConcreteClass()` in service | New in Service | Inject dependency |
| 8+ dependencies | God Service | Split into focused services |
| `inject(ConcreteClass)` | Concrete Dependencies | Use InjectionToken |
| `Database.getInstance()` | Ambient Context | Inject dependency |
| `new` scattered in codebase | Scattered Composition | Single Composition Root |
| `provide: IMyInterface` | Interface-as-Token | Use InjectionToken |
| A → B → A | Circular Dependency | Lazy injection or redesign |
| Injecting `MathUtils` | Over-Injection | Use directly, don't inject |

---

## The Sniff Test

When reviewing code, ask:

1. **Can I test this class with zero infrastructure?** If no, something's wrong.
2. **Can I see all dependencies in the constructor?** If no, there are hidden deps.
3. **Is composition happening in one place?** If no, it's scattered.
4. **Does this service do ONE thing?** If no, it's a god service.
5. **Are we depending on abstractions?** If no, we're tightly coupled.

**One "no" answer = refactor before commit.**
