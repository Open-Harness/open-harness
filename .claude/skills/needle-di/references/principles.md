# Core Principles of Dependency-Driven Development

## The Foundation: Why This Matters

Dependency-driven development isn't about using a library. It's about building software that:

1. **Can be tested without real infrastructure**
2. **Can be changed without cascading failures**
3. **Makes dependencies explicit and visible**
4. **Separates "what" from "how"**

These principles have been refined over decades. NeedleDI is just the tool we use to implement them.

---

## Principle 1: Dependency Inversion (DIP)

**The "D" in SOLID. The most important principle.**

### The Rule

> High-level modules should not depend on low-level modules. Both should depend on abstractions.

### What This Means

```typescript
// ❌ VIOLATION: High-level depends on low-level concrete
class UserService {
  private db = new PostgresDatabase(); // Direct dependency on concrete

  async getUser(id: string) {
    return this.db.query("SELECT * FROM users WHERE id = ?", [id]);
  }
}

// ✅ CORRECT: Both depend on abstraction
interface IDatabase {
  query<T>(sql: string, params: unknown[]): Promise<T>;
}

@injectable()
class UserService {
  constructor(private db = inject(IDatabaseToken)) {} // Depends on abstraction

  async getUser(id: string) {
    return this.db.query("SELECT * FROM users WHERE id = ?", [id]);
  }
}
```

### Why It Matters

- **Testability**: Swap PostgresDatabase for InMemoryDatabase in tests
- **Flexibility**: Change database without touching UserService
- **Clarity**: Dependencies are explicit, not hidden

### The Litmus Test

> "Can I replace this dependency with a fake/mock without changing the service code?"

If no, you've violated DIP.

---

## Principle 2: Inversion of Control (IoC)

### The Rule

> Don't call us, we'll call you.

Your code doesn't create its dependencies—they're provided from outside.

### What This Means

```typescript
// ❌ VIOLATION: Service controls its dependencies
class OrderService {
  private emailer = new EmailService();      // You're calling new
  private db = DatabaseConnection.getInstance(); // You're calling getInstance

  async createOrder(order: Order) {
    await this.db.save(order);
    await this.emailer.send(order.customerEmail, "Order confirmed");
  }
}

// ✅ CORRECT: Control is inverted—dependencies come from outside
@injectable()
class OrderService {
  constructor(
    private emailer = inject(IEmailerToken),
    private db = inject(IDatabaseToken),
  ) {}

  async createOrder(order: Order) {
    await this.db.save(order);
    await this.emailer.send(order.customerEmail, "Order confirmed");
  }
}
```

### The Container's Role

The DI container (NeedleDI) is the "outside" that provides dependencies:

```typescript
const container = new Container();
container.bind({ provide: IEmailerToken, useClass: SendGridEmailer });
container.bind({ provide: IDatabaseToken, useClass: PostgresDatabase });

// Container controls what gets injected
const orderService = container.get(OrderService);
```

### Why It Matters

- **Single source of truth** for object wiring
- **Easy to swap implementations** (dev vs prod vs test)
- **No hidden dependencies** scattered throughout code

---

## Principle 3: Composition Root

### The Rule

> Compose object graphs in ONE place, as close to the application entry point as possible.

### What This Means

```typescript
// ❌ VIOLATION: Composition scattered throughout codebase
// In userController.ts
const userService = new UserService(new PostgresDatabase());

// In orderController.ts
const orderService = new OrderService(new EmailService(), new PostgresDatabase());

// In reportController.ts
const reportService = new ReportService(new PostgresDatabase());

// ✅ CORRECT: Single Composition Root
// In container.ts (or main.ts)
const container = new Container();

// ALL bindings in one place
container.bind({ provide: IDatabaseToken, useClass: PostgresDatabase });
container.bind({ provide: IEmailerToken, useClass: SendGridEmailer });
container.bind(UserService);
container.bind(OrderService);
container.bind(ReportService);

export { container };

// Controllers just get from container
// In userController.ts
const userService = container.get(UserService);
```

### Why It Matters

- **One place to see all dependencies**
- **One place to change for different environments**
- **Easy to understand the full object graph**

### The Rule of Thumb

> If you see `new SomeService()` or `container.get()` outside your composition root, something is wrong.

---

## Principle 4: Constructor Injection (Preferred)

### The Rule

> Inject dependencies through the constructor, not through properties or methods.

### What This Means

```typescript
// ❌ PROPERTY INJECTION: Dependencies not visible in signature
@injectable()
class UserService {
  @Inject(IDatabaseToken)
  private db!: IDatabase;  // Hidden in class body
}

// ❌ METHOD INJECTION: Dependencies arrive late
@injectable()
class UserService {
  private db!: IDatabase;

  setDatabase(db: IDatabase) {  // Can be called anytime, or never
    this.db = db;
  }
}

// ✅ CONSTRUCTOR INJECTION: All dependencies explicit and required
@injectable()
class UserService {
  constructor(
    private db = inject(IDatabaseToken),      // Visible
    private logger = inject(ILoggerToken),    // Required
    private cache = inject(ICacheToken),      // At construction time
  ) {}
}
```

### Why Constructor Injection Wins

1. **Explicit**: All dependencies visible in one place
2. **Required**: Can't create instance without providing dependencies
3. **Immutable**: Dependencies can't change after construction
4. **Testable**: Easy to pass mocks in tests

```typescript
// Test is trivial
const service = new UserService(mockDb, mockLogger, mockCache);
```

---

## Principle 5: Interface Segregation (ISP)

### The Rule

> Depend on interfaces specific to your needs, not bloated general-purpose ones.

### What This Means

```typescript
// ❌ VIOLATION: Depending on fat interface
interface IDatabase {
  query<T>(sql: string): Promise<T>;
  save(entity: unknown): Promise<void>;
  delete(id: string): Promise<void>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  createBackup(): Promise<void>;
  restoreBackup(path: string): Promise<void>;
  // ... 20 more methods
}

// UserService only needs query, but depends on everything
class UserService {
  constructor(private db = inject(IDatabaseToken)) {}

  getUser(id: string) {
    return this.db.query("SELECT * FROM users WHERE id = ?", [id]);
  }
}

// ✅ CORRECT: Segregated interfaces
interface IReadableDatabase {
  query<T>(sql: string, params: unknown[]): Promise<T>;
}

interface IWritableDatabase extends IReadableDatabase {
  save(entity: unknown): Promise<void>;
  delete(id: string): Promise<void>;
}

interface ITransactionalDatabase extends IWritableDatabase {
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

// UserService depends only on what it needs
class UserService {
  constructor(private db = inject(IReadableDatabaseToken)) {}
}
```

### Why It Matters

- **Smaller mock surfaces** in tests
- **Clearer contracts** about what's actually used
- **Easier to implement** fake/mock versions

---

## Principle 6: Single Responsibility (SRP)

### The Rule

> A class should have one, and only one, reason to change.

### Applied to Services

```typescript
// ❌ VIOLATION: Multiple responsibilities
@injectable()
class UserService {
  constructor(
    private db = inject(IDatabaseToken),
    private emailer = inject(IEmailerToken),
    private logger = inject(ILoggerToken),
  ) {}

  async createUser(data: UserData) {
    // Responsibility 1: Validation
    if (!data.email.includes("@")) throw new Error("Invalid email");

    // Responsibility 2: Persistence
    const user = await this.db.save(data);

    // Responsibility 3: Notification
    await this.emailer.send(data.email, "Welcome!");

    // Responsibility 4: Logging
    this.logger.log(`User created: ${user.id}`);

    return user;
  }
}

// ✅ CORRECT: Single responsibility per service
@injectable()
class UserRepository {
  constructor(private db = inject(IDatabaseToken)) {}

  save(data: UserData): Promise<User> {
    return this.db.save(data);
  }
}

@injectable()
class UserValidator {
  validate(data: UserData): ValidationResult {
    const errors = [];
    if (!data.email.includes("@")) errors.push("Invalid email");
    return { valid: errors.length === 0, errors };
  }
}

@injectable()
class UserNotifier {
  constructor(private emailer = inject(IEmailerToken)) {}

  sendWelcome(email: string): Promise<void> {
    return this.emailer.send(email, "Welcome!");
  }
}

@injectable()
class UserService {
  constructor(
    private repository = inject(UserRepository),
    private validator = inject(UserValidator),
    private notifier = inject(UserNotifier),
  ) {}

  async createUser(data: UserData): Promise<User> {
    const validation = this.validator.validate(data);
    if (!validation.valid) throw new ValidationError(validation.errors);

    const user = await this.repository.save(data);
    await this.notifier.sendWelcome(data.email);

    return user;
  }
}
```

### Why It Matters

- **Each service is easy to test in isolation**
- **Changes are localized** (change validation? Only touch UserValidator)
- **Dependencies are minimal per service**

---

## Putting It All Together

When you write a service, run through this checklist:

| Principle | Check |
|-----------|-------|
| **DIP** | Am I depending on abstractions (tokens/interfaces)? |
| **IoC** | Are dependencies injected, not created internally? |
| **Composition Root** | Is wiring done in container.ts, not scattered? |
| **Constructor Injection** | Are all deps in constructor, not properties? |
| **ISP** | Am I depending only on what I need? |
| **SRP** | Does this service have ONE reason to change? |

If any answer is "no", refactor before committing.

---

## Further Reading

- [Clean Architecture by Robert Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Dependency Injection Principles, Practices, and Patterns](https://www.manning.com/books/dependency-injection-principles-practices-patterns) by Steven van Deursen & Mark Seemann
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
