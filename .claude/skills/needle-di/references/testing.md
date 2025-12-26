# Strategic Testing Philosophy

## The Core Truth

> **We don't want 500 tests. We want the tests we have to be great tests.**

Coverage is not a goal. Confidence is. A codebase with 60% coverage and excellent tests beats 100% coverage with garbage tests every time.

---

## Why DI Enables Great Testing

Without DI:
```typescript
class UserService {
  private db = new PostgresDatabase();  // Can't test without real DB
  private emailer = new SendGridClient(); // Can't test without SendGrid API

  async createUser(data: UserData): Promise<User> {
    const user = await this.db.save(data);
    await this.emailer.send(data.email, "Welcome!");
    return user;
  }
}

// To test this, you need:
// - A running PostgreSQL database
// - Valid SendGrid credentials
// - Network access
// - Test data cleanup
// - 10+ seconds per test
```

With DI:
```typescript
@injectable()
class UserService {
  constructor(
    private db = inject(IDatabaseToken),
    private emailer = inject(IEmailerToken),
  ) {}

  async createUser(data: UserData): Promise<User> {
    const user = await this.db.save(data);
    await this.emailer.send(data.email, "Welcome!");
    return user;
  }
}

// To test this, you need:
// - Nothing external
// - Milliseconds per test
test("createUser saves and sends welcome email", async () => {
  const mockDb = { save: vi.fn().mockResolvedValue({ id: "1", ...testData }) };
  const mockEmailer = { send: vi.fn().mockResolvedValue(undefined) };

  const service = new UserService(mockDb, mockEmailer);
  const user = await service.createUser(testData);

  expect(mockDb.save).toHaveBeenCalledWith(testData);
  expect(mockEmailer.send).toHaveBeenCalledWith(testData.email, "Welcome!");
  expect(user.id).toBe("1");
});
```

**DI exists to make testing trivial.** That's the primary benefit.

---

## The Testing Hierarchy

### Prefer Integration Tests

Integration tests verify that components work together. They catch the bugs that matter.

```typescript
// GOOD: Integration test of real workflow
test("user registration flow", async () => {
  const container = createTestContainer();
  const registration = container.get(RegistrationService);

  const result = await registration.register({
    email: "test@example.com",
    password: "secure123",
  });

  expect(result.success).toBe(true);
  expect(result.user.email).toBe("test@example.com");

  // Verify side effects
  const userRepo = container.get(UserRepository);
  const saved = await userRepo.findByEmail("test@example.com");
  expect(saved).toBeDefined();
});
```

### Unit Tests for Complex Logic

Unit tests for algorithmic or complex business logic:

```typescript
// GOOD: Unit test for complex calculation
test("calculateDiscount applies tiered pricing correctly", () => {
  const calculator = new PriceCalculator();

  expect(calculator.calculateDiscount(100, "bronze")).toBe(5);   // 5%
  expect(calculator.calculateDiscount(100, "silver")).toBe(10);  // 10%
  expect(calculator.calculateDiscount(100, "gold")).toBe(20);    // 20%
  expect(calculator.calculateDiscount(100, "platinum")).toBe(30); // 30%
});
```

### Skip Tests for Simple Code

Don't test getters, setters, or trivial code:

```typescript
// BAD: Testing obvious code
test("getName returns name", () => {
  const user = new User("John");
  expect(user.getName()).toBe("John"); // Waste of time
});

// BAD: Testing framework behavior
test("logger calls console.log", () => {
  const logger = new ConsoleLogger();
  const spy = vi.spyOn(console, "log");
  logger.log("test");
  expect(spy).toHaveBeenCalledWith("test"); // Testing console.log works?
});
```

---

## What Makes a Great Test

### 1. Tests Behavior, Not Implementation

```typescript
// BAD: Tests implementation
test("createUser calls db.insert then emailer.send", async () => {
  const service = new UserService(mockDb, mockEmailer);
  await service.createUser(data);

  // If we refactor to batch inserts, this breaks
  expect(mockDb.insert).toHaveBeenCalledBefore(mockEmailer.send);
});

// GOOD: Tests behavior
test("createUser saves user and sends welcome email", async () => {
  const service = new UserService(mockDb, mockEmailer);
  const user = await service.createUser(data);

  // What matters: user is saved, email is sent
  expect(user).toBeDefined();
  expect(mockDb.save).toHaveBeenCalled();
  expect(mockEmailer.send).toHaveBeenCalledWith(data.email, expect.any(String));
});
```

### 2. Self-Contained and Independent

```typescript
// BAD: Tests depend on each other
let sharedUser: User;

test("create user", async () => {
  sharedUser = await service.createUser(data); // Other tests need this
});

test("update user", async () => {
  await service.updateUser(sharedUser.id, newData); // Depends on previous test
});

// GOOD: Each test stands alone
test("create user", async () => {
  const user = await service.createUser(data);
  expect(user.id).toBeDefined();
});

test("update user", async () => {
  const user = await service.createUser(data); // Creates its own data
  const updated = await service.updateUser(user.id, newData);
  expect(updated.name).toBe(newData.name);
});
```

### 3. Descriptive Names

```typescript
// BAD: Vague names
test("test user service");
test("should work");
test("error case");

// GOOD: Describes scenario and expectation
test("createUser_withValidData_returnsUserWithId");
test("createUser_withDuplicateEmail_throwsConflictError");
test("getUser_withNonExistentId_returnsNull");
```

### 4. Minimal Mocking

Only mock what crosses a boundary:

```typescript
// BAD: Over-mocking
test("processOrder", async () => {
  const mockValidator = { validate: vi.fn().mockReturnValue(true) };
  const mockCalculator = { calculate: vi.fn().mockReturnValue(100) };
  const mockFormatter = { format: vi.fn().mockReturnValue("$100") };
  const mockDb = { save: vi.fn() };
  const mockEmailer = { send: vi.fn() };
  const mockLogger = { log: vi.fn() };

  // 6 mocks for one test? Something is wrong.
});

// GOOD: Mock at boundaries
test("processOrder saves and notifies", async () => {
  // Only mock external dependencies
  const mockDb = { save: vi.fn().mockResolvedValue(order) };
  const mockEmailer = { send: vi.fn() };

  // Internal services (validator, calculator) are real
  const service = new OrderService(mockDb, mockEmailer);
  await service.processOrder(orderData);

  expect(mockDb.save).toHaveBeenCalled();
  expect(mockEmailer.send).toHaveBeenCalled();
});
```

### 5. Clear Arrange-Act-Assert

```typescript
test("applyDiscount reduces price correctly", () => {
  // Arrange
  const order = new Order({ items: [{ price: 100 }] });
  const discountCode = "SAVE20";

  // Act
  const discounted = order.applyDiscount(discountCode);

  // Assert
  expect(discounted.total).toBe(80);
  expect(discounted.discountApplied).toBe(20);
});
```

---

## Test Container Pattern

Create a dedicated test container:

```typescript
// test/helpers/container.ts
export function createTestContainer(): Container {
  const container = new Container();

  // Use in-memory implementations
  container.bind({ provide: IDatabaseToken, useClass: InMemoryDatabase });
  container.bind({ provide: IEmailerToken, useClass: FakeEmailer });
  container.bind({ provide: ILoggerToken, useClass: NullLogger });

  // Real business services
  container.bind(UserService);
  container.bind(OrderService);

  return container;
}

// In tests
test("integration test", async () => {
  const container = createTestContainer();
  const service = container.get(UserService);

  const result = await service.createUser(testData);
  expect(result.id).toBeDefined();
});
```

---

## Fake vs Mock vs Stub

### Fake

Full alternative implementation. Preferred for integration tests.

```typescript
class InMemoryDatabase implements IDatabase {
  private data = new Map<string, unknown>();

  async save<T extends { id: string }>(entity: T): Promise<T> {
    this.data.set(entity.id, entity);
    return entity;
  }

  async findById<T>(id: string): Promise<T | null> {
    return (this.data.get(id) as T) ?? null;
  }

  // Useful for test assertions
  getAll(): unknown[] {
    return Array.from(this.data.values());
  }

  clear(): void {
    this.data.clear();
  }
}
```

### Mock

Verifies interactions. Use sparingly.

```typescript
const mockEmailer = {
  send: vi.fn().mockResolvedValue(undefined),
};

// After test
expect(mockEmailer.send).toHaveBeenCalledWith("user@example.com", "Welcome!");
expect(mockEmailer.send).toHaveBeenCalledTimes(1);
```

### Stub

Returns canned responses. No verification.

```typescript
const stubConfig = {
  apiUrl: "https://test.example.com",
  timeout: 1000,
};

const service = new ApiClient(stubConfig);
```

### When to Use Each

| Type | Use When |
|------|----------|
| **Fake** | Testing flows that need working dependencies |
| **Mock** | Verifying specific interactions occurred |
| **Stub** | Providing static data, no verification needed |

---

## What NOT to Test

### 1. Third-Party Libraries

```typescript
// BAD: Testing that axios works
test("axios makes HTTP request", async () => {
  const response = await axios.get("https://api.example.com");
  expect(response.status).toBe(200);
});
```

### 2. Framework Behavior

```typescript
// BAD: Testing that NeedleDI injects
test("container injects dependencies", () => {
  const container = new Container();
  container.bind(MyService);
  const service = container.get(MyService);
  expect(service).toBeInstanceOf(MyService); // Testing the framework?
});
```

### 3. Simple Delegation

```typescript
// BAD: Testing pure delegation
test("userController.getUser calls userService.getUser", async () => {
  const controller = new UserController(mockUserService);
  await controller.getUser("1");
  expect(mockUserService.getUser).toHaveBeenCalledWith("1");
  // This test adds no value
});
```

### 4. Implementation Details

```typescript
// BAD: Testing internal state
test("service sets internal flag after init", () => {
  const service = new MyService();
  service.init();
  expect(service["_initialized"]).toBe(true); // Accessing private state
});
```

---

## The Strategic Testing Checklist

Before writing a test, ask:

1. **Does this test catch real bugs?** Or just achieve coverage?
2. **Will this test break on refactoring?** If yes, it's testing implementation.
3. **Does this test require external resources?** If yes, can we use fakes?
4. **Is this behavior already tested elsewhere?** Avoid duplication.
5. **Would I trust this test to catch regressions?** If not, don't write it.

Before committing tests, verify:

```markdown
- [ ] Tests are independent (can run in any order)
- [ ] Tests don't require external services
- [ ] Test names describe scenario and expectation
- [ ] No over-mocking (only mock boundaries)
- [ ] Tests verify behavior, not implementation
- [ ] Each test has single, clear purpose
```

---

## Summary

| Do | Don't |
|----|-------|
| Test user-facing behavior | Test implementation details |
| Use fakes for integration tests | Mock everything |
| Write fewer, better tests | Chase 100% coverage |
| Test at boundary (input → output) | Test internal state |
| Name tests descriptively | Name tests `test1`, `testService` |
| Make tests independent | Share state between tests |

**Remember**: The goal is confidence in your code, not a coverage number.
