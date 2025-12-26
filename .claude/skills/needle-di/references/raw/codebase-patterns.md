# NeedleDI Codebase Patterns & Architecture

## Core Architecture

NeedleDI implements a singleton-based dependency injection container with lazy instantiation and hierarchical container support. The architecture revolves around several key components:

### Container Class

The `Container` class is the central orchestrator, maintaining two internal maps:

```typescript
export class Container {
  private readonly providers: ProviderMap = new Map();
  private readonly singletons: SingletonMap = new Map();

  private readonly parent?: Container;
  private readonly factory: Factory;

  constructor(parent?: Container) {
    this.parent = parent;
    this.factory = new Factory(this);
    this.bind({
      provide: Container,
      useValue: this,
    });
  }
}
```

- **providers Map**: Stores provider configurations indexed by tokens
- **singletons Map**: Caches constructed instances (singleton pattern)
- **parent Container**: Enables hierarchical scoping with fallback resolution
- **Factory**: Delegates actual instance construction

The container automatically binds itself, making it injectable for advanced use cases.

### Injection Context Pattern

NeedleDI uses a global mutable context pattern to enable `inject()` calls without explicit container passing:

```typescript
let _currentContext: GlobalContext | InjectionContext = new GlobalContext();

export function injectionContext(container: Container): Context {
  return new InjectionContext(container);
}

class InjectionContext implements Context {
  run<T>(block: (container: Container) => T): T {
    const originalContext = _currentContext;
    try {
      _currentContext = this;
      return block(this.container);
    } finally {
      _currentContext = originalContext;
    }
  }
}
```

This pattern:
1. Swaps the global context before dependency resolution
2. Executes the construction/injection logic
3. Restores the original context (even on errors)
4. Throws `NeedsInjectionContextError` if used outside context

### Factory Pattern

The `Factory` class handles actual instance construction with circular dependency detection:

```typescript
export class Factory {
  private readonly underConstruction: Provider<unknown>[] = [];

  construct<T>(provider: Provider<T>, token: Token<T>): T[] {
    try {
      if (this.underConstruction.includes(provider)) {
        const dependencyGraph = [...this.underConstruction, provider]
          .map(getToken).map(toString);
        throw new CircularDependencyError(dependencyGraph);
      }

      this.underConstruction.push(provider);
      return this.doConstruct(provider);
    } finally {
      this.underConstruction.pop();
    }
  }
}
```

The factory maintains a stack of providers currently being constructed, enabling clear circular dependency error messages like: `"App -> Foo -> Bar -> Baz -> Foo"`.

## Key Patterns

### 1. Token-Based Identification

NeedleDI supports multiple token types for flexible service identification:

```typescript
export type Token<T> = Class<T> | AbstractClass<T> | string | symbol | InjectionToken<T>;

export class InjectionToken<T> {
  constructor(
    private description: string | symbol,
    public options?: InjectionTokenOptions<T>,
  ) {}
}

type InjectionTokenOptions<T> =
  | { async: true; factory: (container: Container) => Promise<T>; }
  | { async?: false; factory: (container: Container) => T; };
```

Key features:
- **Class tokens**: Direct class references (most common)
- **String/Symbol tokens**: Primitive values for interfaces/abstract types
- **InjectionToken**: Type-safe tokens with optional factory (tree-shakeable)

### 2. Provider Polymorphism

The provider system uses discriminated unions with type guards:

```typescript
export type Provider<T> = SyncProvider<T> | AsyncProvider<T>;

export type SyncProvider<T> =
  | ConstructorProvider<T>    // Direct class reference
  | ClassProvider<T>          // { provide: Token, useClass: Class }
  | ValueProvider<T>          // { provide: Token, useValue: T }
  | SyncFactoryProvider<T>    // { provide: Token, useFactory: () => T }
  | ExistingProvider<T>;      // { provide: Token, useExisting: Token }

// Type guards for runtime discrimination
export function isClassProvider<T>(provider: Provider<T>): provider is ClassProvider<T> {
  return "provide" in provider && "useClass" in provider;
}

export function isValueProvider<T>(provider: Provider<T>): provider is ValueProvider<T> {
  return "provide" in provider && "useValue" in provider;
}
```

This enables pattern matching in the factory:

```typescript
private doConstruct<T>(provider: SyncProvider<T>): T[] {
  if (Guards.isConstructorProvider(provider)) {
    return [new provider()];
  } else if (Guards.isClassProvider(provider)) {
    return [new provider.useClass()];
  } else if (Guards.isValueProvider(provider)) {
    return [provider.useValue];
  } else if (Guards.isFactoryProvider(provider)) {
    return [provider.useFactory(this.container)];
  } else if (Guards.isExistingProvider(provider)) {
    return this.container.get(provider.useExisting, { multi: true });
  }

  return assertNever(provider);
}
```

### 3. Auto-Binding with Decorators

The `@injectable()` decorator enables automatic registration via metadata:

```typescript
export function injectable<C extends Class<unknown>>(): ClassDecorator<C> {
  return (target) => {
    // Register on parent classes for inheritance support
    getParentClasses(target).forEach((parentClass) => {
      if (!Object.getOwnPropertyDescriptor(parentClass, injectableSymbol)) {
        Object.defineProperty(parentClass, injectableSymbol, {
          value: [target],
          writable: true,
          enumerable: false,
        });
      } else {
        const injectableParentClass = parentClass as InjectableClass;
        injectableParentClass[injectableSymbol] = [
          ...injectableParentClass[injectableSymbol],
          target
        ];
      }
    });

    // Mark the class itself as injectable
    Object.defineProperty(target, injectableSymbol, {
      value: [target],
      writable: true,
    });
  };
}
```

The container checks for this symbol and auto-binds on first access:

```typescript
private autoBindIfNeeded<T>(token: Token<T>) {
  if (this.singletons.has(token)) {
    return;
  }

  if (isClassToken(token) && isInjectable(token)) {
    const targetClasses = getInjectableTargets(token);

    targetClasses
      .filter((targetClass) => !this.providers.has(targetClass))
      .forEach((targetClass) => {
        this.bind({
          provide: targetClass,
          useClass: targetClass,
          multi: true,
        });
      });
  }
}
```

### 4. Multi-Provider Pattern

NeedleDI supports multi-providers for plugin architectures:

```typescript
container.bindAll(
  { provide: AbstractService, multi: true, useClass: FooService },
  { provide: AbstractService, multi: true, useClass: BarService }
);

const services = container.get(AbstractService, { multi: true }); // [FooService, BarService]
```

Multi-provider validation ensures consistency:

```typescript
const multi = Guards.isMultiProvider(provider);

if (multi && providers.some((it) => !Guards.isMultiProvider(it))) {
  throw Error(
    `Cannot bind ${toString(token)} as multi-provider, since there is already a provider which is not a multi-provider.`
  );
} else if (!multi && providers.some((it) => Guards.isMultiProvider(it))) {
  throw Error(
    `Cannot bind ${toString(token)} as provider, since there are already provider(s) that are multi-providers.`
  );
}
```

### 5. Lazy Injection

Lazy injection breaks circular dependencies:

```typescript
@injectable()
class Baz {
  private foo = inject(Foo, { lazy: true });

  public lorem() {
    return this.foo().lorem();  // Function call defers resolution
  }
}
```

Implementation returns a closure:

```typescript
public get<T>(token: Token<T>, options?: { lazy?: boolean }): T | (() => T) {
  const lazy = options?.lazy ?? false;

  if (lazy) {
    return () => this.get(token, { ...options, lazy: false });
  }

  // ... normal resolution
}
```

## Type Safety Approach

### 1. Generic Preservation Across API Surface

NeedleDI maintains type information through all operations using TypeScript generics:

```typescript
// Bind preserves generic type
public bind<T>(provider: Provider<T>): this

// Get returns correctly typed instances
public get<T>(token: Token<T>): T;
public get<T>(token: Token<T>, options: { multi: true }): T[];
public get<T>(token: Token<T>, options: { optional: true }): T | undefined;
public get<T>(token: Token<T>, options: { lazy: true }): () => T;
```

Overloads provide precise return types based on options:

```typescript
const service = container.get(MyService);           // MyService
const services = container.get(MyService, { multi: true });  // MyService[]
const maybe = container.get(MyService, { optional: true });  // MyService | undefined
const lazy = container.get(MyService, { lazy: true });       // () => MyService
```

### 2. NoInfer for Provider Variance

Providers use `NoInfer<T>` to prevent unwanted type widening:

```typescript
export interface ClassProvider<T> {
  provide: Token<T>;
  useClass: Class<NoInfer<T>>;  // Prevents T from being inferred from useClass
  multi?: true;
}

export interface SyncFactoryProvider<T> {
  provide: Token<T>;
  useFactory: (container: Container) => NoInfer<T>;
  multi?: true;
}
```

This ensures the token's type takes precedence:

```typescript
// Without NoInfer, T could be inferred as `BaseClass` from useClass
// With NoInfer, T is inferred from `provide` token
container.bind({
  provide: AbstractService,  // T = AbstractService
  useClass: ConcreteService  // Must be assignable to AbstractService
});
```

### 3. Type Guards with Predicate Types

Runtime type discrimination uses TypeScript type predicates:

```typescript
export function isClassProvider<T>(provider: Provider<T>): provider is ClassProvider<T> {
  return "provide" in provider && "useClass" in provider;
}

export function isValueProvider<T>(provider: Provider<T>): provider is ValueProvider<T> {
  return "provide" in provider && "useValue" in provider;
}
```

This enables exhaustive pattern matching:

```typescript
if (Guards.isClassProvider(provider)) {
  // TypeScript knows provider is ClassProvider<T>
  return [new provider.useClass()];
} else if (Guards.isValueProvider(provider)) {
  // TypeScript knows provider is ValueProvider<T>
  return [provider.useValue];
}
```

### 4. Typed Maps with Interface Extension

Internal maps use interface extension for type-safe generic operations:

```typescript
interface ProviderMap extends Map<Token<unknown>, Provider<unknown>[]> {
  get<T>(key: Token<T>): Provider<T>[] | undefined;
  set<T>(key: Token<T>, value: Provider<T>[]): this;
}

interface SingletonMap extends Map<Token<unknown>, unknown[]> {
  get<T>(token: Token<T>): T[] | undefined;
  set<T>(token: Token<T>, value: T[]): this;
}
```

Despite storing `unknown` types, the interface provides type-safe access.

### 5. Context-Aware Type Inference

The `inject()` function infers types from tokens:

```typescript
export function inject<T>(token: Token<T>): T;
export function inject<T>(token: Token<T>, options: { multi: true }): T[];
export function inject<T>(token: Token<T>, options: { optional: true }): T | undefined;

@injectable()
class BarService {
  constructor(private fooService = inject(FooService)) {}
  //                                     ^? Type inferred as FooService
}
```

No explicit type annotations needed thanks to default parameter inference.

## Extension Points

### 1. Custom Providers

Create custom provider types by extending the provider union:

```typescript
// Custom provider for conditional instantiation
interface ConditionalProvider<T> {
  provide: Token<T>;
  useConditional: {
    condition: (container: Container) => boolean;
    whenTrue: Provider<T>;
    whenFalse: Provider<T>;
  };
}

// Add type guard
function isConditionalProvider<T>(
  provider: Provider<T> | ConditionalProvider<T>
): provider is ConditionalProvider<T> {
  return "provide" in provider && "useConditional" in provider;
}

// Extend Factory.doConstruct to handle it
private doConstruct<T>(provider: SyncProvider<T> | ConditionalProvider<T>): T[] {
  if (isConditionalProvider(provider)) {
    const { condition, whenTrue, whenFalse } = provider.useConditional;
    const selectedProvider = condition(this.container) ? whenTrue : whenFalse;
    return this.factory.construct(selectedProvider, getToken(provider));
  }
  // ... existing logic
}
```

### 2. Child Containers for Scoping

Create hierarchical scopes with child containers:

```typescript
public createChild(): Container {
  return new Container(this);
}

// Usage: Request-scoped services
const appContainer = new Container();
appContainer.bind({ provide: Logger, useClass: ConsoleLogger });

function handleRequest() {
  const requestContainer = appContainer.createChild();
  requestContainer.bind({
    provide: RequestContext,
    useValue: { requestId: uuid() }
  });

  // Logger available from parent, RequestContext from child
  const service = requestContainer.get(MyService);
}
```

Resolution falls back to parent:

```typescript
public get<T>(token: Token<T>, options?: { optional?: boolean }): T | undefined {
  if (!this.providers.has(token)) {
    if (this.parent) {
      return this.parent.get(token, options);
    }
    if (options?.optional) {
      return undefined;
    }
    throw Error(`No provider(s) found for ${toString(token)}`);
  }
  // ... construct from own providers
}
```

### 3. InjectionToken Factories for Tree-Shaking

Define providers within tokens for automatic registration:

```typescript
const CONFIG_TOKEN = new InjectionToken<Config>("config", {
  factory: (container) => ({
    apiUrl: process.env.API_URL,
    timeout: 5000
  })
});

// Auto-binds on first access, no explicit container.bind() needed
const config = container.get(CONFIG_TOKEN);
```

Async factories supported:

```typescript
const DB_TOKEN = new InjectionToken<Database>("database", {
  async: true,
  factory: async (container) => {
    const config = container.get(CONFIG_TOKEN);
    return await connectToDatabase(config.dbUrl);
  }
});

const db = await container.getAsync(DB_TOKEN);
```

Auto-binding logic:

```typescript
else if (!this.providers.has(token) && isInjectionToken(token) && token.options?.factory) {
  const async = token.options.async;
  if (!async) {
    this.bind({
      provide: token,
      async: false,
      useFactory: token.options.factory,
    });
  } else if (async) {
    this.bind({
      provide: token,
      async: true,
      useFactory: token.options.factory,
    });
  }
}
```

### 4. Async Injection with Retry Pattern

Async providers integrate seamlessly with sync construction via retry mechanism:

```typescript
async constructAsync<T>(provider: Provider<T>): Promise<T[]> {
  // For class providers, retry on async dependency errors
  if (Guards.isClassProvider(provider) || Guards.isConstructorProvider(provider)) {
    const create = Guards.isConstructorProvider(provider)
      ? () => [new provider()]
      : () => [new provider.useClass()];

    return retryOn(
      AsyncProvidersInSyncInjectionContextError,
      async () => create(),
      async (error) => {
        // Pre-fetch async dependencies before retry
        await this.container.getAsync(error.token, { multi: true, optional: true });
      },
    );
  }
  // ... other provider types
}
```

This allows mixing sync and async injection in constructors:

```typescript
@injectable()
class MyService {
  constructor(
    private foo = inject(FOO_TOKEN),        // Async token
    private bar = inject(BAR_TOKEN_ALIAS)   // Async token via alias
  ) {}
}

const service = await container.getAsync(MyService);  // Works!
```

### 5. Custom Decorators

Build decorators on top of `@injectable()`:

```typescript
function singleton<T>() {
  return function(target: Class<T>) {
    injectable()(target);

    // Additional singleton enforcement logic
    const originalGet = Container.prototype.get;
    Container.prototype.get = function<T>(token: Token<T>) {
      if (token === target && this.singletons.has(token)) {
        return this.singletons.get(token)[0];
      }
      return originalGet.call(this, token);
    };

    return target;
  };
}

@singleton()
class ConfigService {}
```

Or create property decorators:

```typescript
function Inject<T>(token: Token<T>) {
  return function(target: any, propertyKey: string) {
    Object.defineProperty(target, propertyKey, {
      get() {
        return inject(token);
      },
      enumerable: true,
      configurable: true
    });
  };
}

class MyService {
  @Inject(FooService)
  private foo!: FooService;
}
```

## Code Organization

### File Structure

The codebase follows a flat, modular structure:

```
src/
├── index.ts              # Public API exports
├── container.ts          # Container class & bootstrap functions
├── context.ts            # Injection context management
├── decorators.ts         # @injectable() decorator
├── factory.ts            # Instance construction logic
├── providers.ts          # Provider types & guards
├── tokens.ts             # Token types & utilities
├── utils.ts              # Helper functions
├── container.test.ts     # Container API tests
├── decorators.test.ts    # Decorator tests
├── examples.test.ts      # Usage examples as tests
├── providers.test.ts     # Provider tests
└── autobinding.test.ts   # Auto-binding tests
```

### Module Boundaries

Each file has a clear responsibility:

- **tokens.ts**: Token type definitions, no dependencies on other modules
- **providers.ts**: Provider type definitions, depends only on tokens & utils
- **factory.ts**: Construction logic, depends on providers & container
- **context.ts**: Global state management, depends on container
- **decorators.ts**: Decorator implementation, depends only on utils
- **container.ts**: Orchestration, depends on all modules

### Public API Surface

The `index.ts` file carefully exposes only public APIs:

```typescript
export { Container, bootstrap, bootstrapAsync } from "./container.ts";
export { inject, injectAsync } from "./context.ts";
export { injectable } from "./decorators.ts";
export type {
  Provider,
  SyncProvider,
  AsyncProvider,
  ExistingProvider,
  ConstructorProvider,
  ClassProvider,
  ValueProvider,
  FactoryProvider,
  AsyncFactoryProvider,
  SyncFactoryProvider,
} from "./providers.ts";
export { InjectionToken } from "./tokens.ts";
export type { Token } from "./tokens.ts";
```

Note:
- Functions exported as values (runtime)
- Types exported as types only (compile-time)
- Internal helpers not exported (e.g., guards, factory)

### Utility Functions

Common helpers isolated in `utils.ts`:

```typescript
// Type definitions
export type Class<T> = new (...args: any[]) => T;
export interface AbstractClass<T> { prototype: T; name: string; }

// Reflection utilities
export function isClassLike(target: unknown): target is Class<unknown> | AbstractClass<unknown>
export function getParentClasses(target: Class<unknown>): Class<unknown>[]

// Array utilities
export function assertPresent<T>(value: T | null | undefined): T
export function assertSingle<T>(array: T[], errorProvider: () => unknown): T
export function windowedSlice<T>(array: T[], step = 2): T[][]

// Async utilities
export async function retryOn<TError, TReturn>(
  errorClass: Class<TError>,
  block: () => Promise<TReturn>,
  onError: (error: TError) => Promise<void>,
): Promise<TReturn>
export async function promiseTry<T>(block: () => T | PromiseLike<T>): Promise<Awaited<T>>
```

### Testing Strategy

Tests serve as both verification and documentation:

- **examples.test.ts**: Real-world usage patterns
- **container.test.ts**: Core container functionality
- **decorators.test.ts**: Decorator behavior
- **autobinding.test.ts**: Inheritance and auto-binding
- **providers.test.ts**: Provider type handling

Example-driven tests demonstrate actual usage:

```typescript
it("should support all kinds of providers", async () => {
  const container = new Container();
  container
    .bind({ provide: "by-value", useValue: { foo: "foo1" } })
    .bind({ provide: fooToken, useFactory: () => ({ foo: "foo2" }) })
    .bind({ provide: asyncToken, async: true, useFactory: () => Promise.resolve({ foo: "async" }) });

  const service = container.get(MyService);
  expect(service.providedByValue.foo).toBe("foo1");
  expect(service.providedAsync).toBeInstanceOf(Promise);
});
```

### Design Principles Evident in Code

1. **Single Responsibility**: Each class has one job (Container orchestrates, Factory constructs, Context manages state)
2. **Dependency Inversion**: Core depends on abstractions (Token<T>, Provider<T>)
3. **Open/Closed**: Extensible via new provider types without modifying core
4. **Fail Fast**: Validations at bind time, not get time where possible
5. **Minimal API Surface**: Small public API, large internal implementation
6. **Type Safety First**: Generics preserve types through all operations
7. **No Magic**: Explicit decorator, no reflection or metadata emission needed
