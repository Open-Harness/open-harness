# NeedleDI Examples Catalog

## Basic Patterns

### 1. Simple Service Injection

**Use case**: Basic dependency injection between services

```typescript
import { injectable, inject } from "@needle-di/core";

@injectable()
class FooService {
  getMessage(): string {
    return "Hello from Foo";
  }
}

@injectable()
class BarService {
  constructor(private fooService = inject(FooService)) {}

  greet(): string {
    return this.fooService.getMessage();
  }
}

const container = new Container();
const barService = container.get(BarService);
```

**Key patterns**:
- `@injectable()` decorator enables auto-binding
- `inject()` in constructor default parameters
- Singletons by default (same instance reused)

**Also supports initializer injection**:
```typescript
@injectable()
class MyService {
  private otherService = inject(OtherService); // class property initializer

  constructor(
    private anotherService = inject(AnotherService) // constructor parameter
  ) {}
}
```

---

### 2. Factory Provider with Dependencies

**Use case**: Complex object creation logic, lazy instantiation

```typescript
const container = new Container();

container.bind({
  provide: MyService,
  useFactory: () => new MyService(inject(FooService), inject(BarService))
});

// Alternative: access container directly
container.bind({
  provide: MyService,
  useFactory: (container) =>
    new MyService(container.get(FooService), container.get(BarService))
});
```

**Key patterns**:
- Factory only invoked on first injection (lazy)
- Can use `inject()` inside factory
- Container passed as parameter to factory
- Return value becomes singleton

---

### 3. Value Provider for Configuration

**Use case**: Static configuration, primitive values, pre-instantiated objects

```typescript
const MY_CONFIG = new InjectionToken<MyConfig>("MY_CONFIG");

container.bind({
  provide: MY_CONFIG,
  useValue: { apiUrl: "https://api.example.com", timeout: 5000 }
});

@injectable()
class ApiService {
  constructor(private config = inject(MY_CONFIG)) {}
}
```

**Key patterns**:
- InjectionToken for type-safe non-class tokens
- Value is already created (not lazy)
- Use for config objects, constants, primitives

---

### 4. Existing Provider (Aliasing)

**Use case**: Multiple tokens pointing to same instance, interface-to-implementation binding

```typescript
const VALIDATOR = new InjectionToken<Validator>("VALIDATOR");

container.bind({
  provide: MyValidator,
  useClass: MyValidator
});

container.bind({
  provide: VALIDATOR,
  useExisting: MyValidator  // alias
});

// Both inject the same instance
const v1 = container.get(MyValidator);
const v2 = container.get(VALIDATOR);
// v1 === v2
```

**Key patterns**:
- Creates alias to existing provider
- Same singleton instance shared
- Useful for abstract/interface patterns

---

## Advanced Patterns

### 5. Hierarchical Containers (Request Scoping)

**Use case**: HTTP request scoping, tenant isolation, feature-specific overrides

```typescript
const parentContainer = new Container();
const requestContainer = parentContainer.createChild();

const LOGGER = new InjectionToken<Logger>("LOGGER");

// Parent has default logger
parentContainer.bind({
  provide: LOGGER,
  useClass: ConsoleLogger
});

// Child overrides with request-specific logger
requestContainer.bind({
  provide: LOGGER,
  useClass: RequestLogger
});

const parentLogger = parentContainer.get(LOGGER);  // ConsoleLogger
const requestLogger = requestContainer.get(LOGGER); // RequestLogger
```

**Real-world example**:
```typescript
// Application setup
const appContainer = new Container();
appContainer.bind({ provide: Database, useClass: PostgresDatabase });

// Per-request
app.use((req, res, next) => {
  const requestContainer = appContainer.createChild();

  // Override with request-specific services
  requestContainer.bind({
    provide: RequestContext,
    useValue: { userId: req.user.id, traceId: generateId() }
  });

  req.container = requestContainer;
  next();
});
```

**Key patterns**:
- Child inherits all parent providers
- Child can override specific providers
- Singletons created in container where first bound
- Singletons shared unless overridden

**Limitation**: Multi-providers in child containers don't merge with parent

---

### 6. Multi-Provider Plugin System

**Use case**: Plugin architectures, middleware chains, strategy collections

```typescript
abstract class ValidationPlugin {
  abstract validate(data: unknown): boolean;
}

@injectable()
class EmailValidator extends ValidationPlugin {
  validate(data: unknown): boolean { /* ... */ }
}

@injectable()
class LengthValidator extends ValidationPlugin {
  validate(data: unknown): boolean { /* ... */ }
}

// Manual binding (without auto-binding)
container
  .bind({ provide: ValidationPlugin, multi: true, useClass: EmailValidator })
  .bind({ provide: ValidationPlugin, multi: true, useClass: LengthValidator });

// OR with auto-binding (@injectable decorator)
// Just get with multi: true, automatically finds all subclasses

@injectable()
class ValidatorService {
  constructor(
    private validators = inject(ValidationPlugin, { multi: true })
    // Type: ValidationPlugin[]
  ) {}

  validateAll(data: unknown): boolean {
    return this.validators.every(v => v.validate(data));
  }
}
```

**With inheritance hierarchy**:
```typescript
abstract class AbstractService {}

@injectable()
class FooService extends AbstractService {}

@injectable()
class BarService extends AbstractService {}

@injectable()
class SpecialBarService extends BarService {}

const container = new Container();

// Get all AbstractService implementations (auto-binding magic)
const allServices = container.get(AbstractService, { multi: true });
// Returns: [FooService, BarService, SpecialBarService]

// Get all BarService implementations
const barServices = container.get(BarService, { multi: true });
// Returns: [BarService, SpecialBarService]
```

**Flattening with useExisting**:
```typescript
container.bindAll(
  { provide: "myNumbers", useValue: 1, multi: true },
  { provide: "myNumbers", useValue: 2, multi: true },
  { provide: "otherNumber", useValue: 3 },

  // Flatten multiple multi-providers into one
  { provide: "allNumbers", useExisting: "myNumbers", multi: true },
  { provide: "allNumbers", useExisting: "otherNumber", multi: true }
);

container.get("allNumbers", { multi: true }); // [1, 2, 3]
```

**Key patterns**:
- `multi: true` in provider definition
- `inject(Token, { multi: true })` returns array
- Cannot mix `multi: true` and `multi: false` for same token
- Single multi-provider can still be injected as single value
- Multiple multi-providers throw error when injected as single value
- With `@injectable()`, auto-binding finds all subclasses

---

### 7. Lazy Injection for Circular Dependencies

**Use case**: Breaking circular dependencies, deferred instantiation

```typescript
@injectable()
class Foo {
  constructor(private bar = inject(Bar)) {}

  lorem() { return this.bar.lorem(); }
  ipsum() { return this.bar.ipsum(); }
}

@injectable()
class Bar {
  constructor(private baz = inject(Baz)) {}

  lorem() { return "lorem"; }
  ipsum() { return this.baz.ipsum(); }
}

@injectable()
class Baz {
  // Lazy injection breaks the cycle
  constructor(private foo = inject(Foo, { lazy: true })) {}
  // Type: () => Foo

  lorem() { return this.foo().lorem(); } // invoke function to get instance
  ipsum() { return "ipsum"; }
}

const foo = bootstrap(Foo); // No circular dependency error
```

**Without lazy injection (error)**:
```typescript
// This would throw: "Detected circular dependency: App -> Foo -> Bar -> Baz -> Foo"
@injectable()
class Baz {
  constructor(private foo = inject(Foo)) {} // immediate resolution
}
```

**Key patterns**:
- `inject(Token, { lazy: true })` returns `() => Token`
- Invoke function to trigger creation
- Breaks circular dependency chains
- Combinable with optional: `() => Token | undefined`
- Combinable with async: `() => Promise<Token>`

---

### 8. Async Factory with External Resources

**Use case**: Database connections, API clients, async initialization

```typescript
const DB_CONNECTION = new InjectionToken<Database>("DB_CONNECTION", {
  async: true,
  factory: async () => {
    const db = new Database();
    await db.connect();
    return db;
  }
});

@injectable()
class UserRepository {
  constructor(
    // In async context, can inject async providers synchronously
    private db = inject(DB_CONNECTION)
  ) {}

  async getUser(id: string) {
    return this.db.query("SELECT * FROM users WHERE id = ?", [id]);
  }
}

// Must use getAsync for async providers
const repo = await container.getAsync(UserRepository);
```

**Async provider with sequential resolution**:
```typescript
const FOO_TOKEN = new InjectionToken<string>("FOO_TOKEN", {
  async: true,
  factory: () => new Promise(resolve =>
    setTimeout(() => resolve("Foo"), 100)
  )
});

const BAR_TOKEN = new InjectionToken<string>("BAR_TOKEN", {
  async: true,
  factory: () => new Promise(resolve =>
    setTimeout(() => resolve("Bar"), 100)
  )
});

@injectable()
class MyService {
  constructor(
    private foo = inject(FOO_TOKEN),  // Synchronous in async context!
    private bar = inject(BAR_TOKEN)
  ) {}

  printTokens(): string {
    return `${this.foo} and ${this.bar}`;
  }
}

const myService = await bootstrapAsync(MyService);
myService.printTokens(); // "Foo and Bar"
```

**Key patterns**:
- `async: true` in provider definition
- Factory must return `Promise`
- Use `container.getAsync()` or `injectAsync()` to obtain
- In async context, can use `inject()` synchronously in constructors
- Cannot use `inject()` for async providers in factory functions
- Async dependencies resolved sequentially (current limitation)

---

### 9. Tree-Shakeable InjectionToken

**Use case**: Library code, code splitting, lazy-loaded modules

**Without tree-shaking (dead code included)**:
```typescript
import { InjectionToken, Container } from "@needle-di/core";
import { SomeHeavyClass } from "./some-heavy-library";

const MY_TOKEN = new InjectionToken<SomeHeavyClass>("MY_TOKEN");

const container = new Container();
container.bind({
  provide: MY_TOKEN,
  useFactory: () => new SomeHeavyClass()
});

// Even if MY_TOKEN is never used, SomeHeavyClass is in bundle
```

**With tree-shaking (dead code removed)**:
```typescript
import { InjectionToken } from "@needle-di/core";

const MY_TOKEN = new InjectionToken<SomeHeavyClass>("MY_TOKEN", {
  factory: () => new SomeHeavyClass()  // Auto-binding via token
});

// No need to bind to container
const value = container.get(MY_TOKEN);

// If MY_TOKEN is never imported/used, SomeHeavyClass is tree-shaken
```

**Key patterns**:
- Define `factory` in InjectionToken constructor
- Enables auto-binding (no manual `container.bind()`)
- Bundlers (Webpack/Rollup/esbuild) can remove unused code
- Useful for multiple entry points or code splitting

---

## Anti-Patterns to Avoid

### 1. Self-Referencing Existing Provider
```typescript
// ❌ THROWS ERROR
container.bind({
  provide: "key",
  useExisting: "key"  // Cannot refer to itself
});
```

### 2. Mixing Multi and Non-Multi Providers
```typescript
// ❌ THROWS ERROR
container.bindAll(
  { provide: "key", useValue: 1 },
  { provide: "key", multi: true, useValue: 2 }
);
```

### 3. Injection Outside Injection Context
```typescript
@injectable()
class MyService {
  triggerLater() {
    inject(OtherService); // ❌ THROWS: only in constructor/initializers
  }
}
```

### 4. Using Sync Methods for Async Providers
```typescript
const ASYNC_TOKEN = new InjectionToken<string>("ASYNC", {
  async: true,
  factory: async () => "value"
});

container.get(ASYNC_TOKEN); // ❌ THROWS: use getAsync() instead
```

### 5. Async Injection in Non-Constructor Contexts
```typescript
container.bind({
  provide: MyService,
  useFactory: () => {
    const foo = inject(ASYNC_TOKEN); // ❌ THROWS
    return new MyService(foo);
  }
});
// Must use injectAsync() or be in constructor
```

### 6. TypeScript Interfaces as Tokens
```typescript
interface Logger {
  log(message: string): void;
}

// ❌ Won't work - interfaces don't exist at runtime
container.bind({ provide: Logger, useClass: ConsoleLogger });

// ✅ Use InjectionToken instead
const LOGGER = new InjectionToken<Logger>("LOGGER");
container.bind({ provide: LOGGER, useClass: ConsoleLogger });
```

---

## Patterns Applicable to Claude Skills

### Pattern: Request-Scoped Skill Context

Similar to HTTP request scoping, create child containers for each skill execution:

```typescript
// Global container with shared services
const globalContainer = new Container();
globalContainer.bind({ provide: FileSystem, useClass: NodeFileSystem });
globalContainer.bind({ provide: LLMClient, useClass: ClaudeClient });

// Per-skill execution
function executeSkill(skillName: string, args: unknown) {
  const skillContainer = globalContainer.createChild();

  // Skill-specific overrides
  skillContainer.bind({
    provide: SkillContext,
    useValue: { skillName, startTime: Date.now(), args }
  });

  const skill = skillContainer.get(skillRegistry[skillName]);
  return skill.execute();
}
```

### Pattern: Plugin System for Skill Steps

Use multi-providers for composable skill steps:

```typescript
abstract class SkillStep {
  abstract execute(context: SkillContext): Promise<void>;
}

@injectable()
class FileReadStep extends SkillStep {
  async execute(ctx: SkillContext) { /* ... */ }
}

@injectable()
class AnalysisStep extends SkillStep {
  async execute(ctx: SkillContext) { /* ... */ }
}

@injectable()
class SkillOrchestrator {
  constructor(
    private steps = inject(SkillStep, { multi: true })
  ) {}

  async executeAll(context: SkillContext) {
    for (const step of this.steps) {
      await step.execute(context);
    }
  }
}
```

### Pattern: Tree-Shakeable Tool Definitions

For modular tool registration:

```typescript
const FILE_READER_TOOL = new InjectionToken<Tool>("FILE_READER", {
  factory: () => new FileReaderTool()
});

const CODE_ANALYZER_TOOL = new InjectionToken<Tool>("CODE_ANALYZER", {
  factory: () => new CodeAnalyzerTool()
});

// Only tools actually imported are included in bundle
```

### Pattern: Async Resource Initialization

For skills with async setup:

```typescript
const VECTOR_DB = new InjectionToken<VectorDatabase>("VECTOR_DB", {
  async: true,
  factory: async () => {
    const db = new ChromaDB();
    await db.connect();
    await db.loadEmbeddings();
    return db;
  }
});

@injectable()
class SearchSkill {
  constructor(private db = inject(VECTOR_DB)) {}

  async search(query: string) {
    return this.db.similaritySearch(query);
  }
}

// Bootstrap skill with async dependencies
const skill = await bootstrapAsync(SearchSkill);
```

### Pattern: Breaking Circular Dependencies in Skill Graph

When skills reference each other:

```typescript
@injectable()
class ResearchSkill {
  constructor(
    // Lazy injection prevents circular dependency
    private analyzeSkill = inject(AnalyzeSkill, { lazy: true })
  ) {}

  async research(topic: string) {
    const data = await this.gatherData(topic);
    // Only instantiate when needed
    return this.analyzeSkill().analyze(data);
  }
}

@injectable()
class AnalyzeSkill {
  constructor(private researchSkill = inject(ResearchSkill)) {}

  async analyze(data: unknown) {
    // Can call research skill without circular dep error
  }
}
```

### Pattern: Configuration Injection

Type-safe configuration for skills:

```typescript
interface SkillConfig {
  maxRetries: number;
  timeout: number;
  cacheEnabled: boolean;
}

const SKILL_CONFIG = new InjectionToken<SkillConfig>("SKILL_CONFIG");

container.bind({
  provide: SKILL_CONFIG,
  useValue: {
    maxRetries: 3,
    timeout: 30000,
    cacheEnabled: true
  }
});

@injectable()
class AnySkill {
  constructor(private config = inject(SKILL_CONFIG)) {}

  async execute() {
    // Use this.config.maxRetries, etc.
  }
}
```
