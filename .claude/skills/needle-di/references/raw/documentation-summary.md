# NeedleDI Documentation Summary

## Overview

NeedleDI is a small, lightweight JavaScript library for dependency injection designed with three core principles:
- **Lightweight**: Minimizes bundle size through tree-shaking and no reflection metadata
- **Type-safe**: Written in TypeScript with full type definitions
- **Modern**: ESM-only package using stage 3 ECMAScript decorators

**Bundle Size**: ~40 kB unpacked with no peer dependencies

**Target Use Cases**:
- Projects where frameworks don't offer built-in DI solutions
- Applications deeply concerned with type-safety (TypeScript)
- Bundle-size sensitive applications (serverless functions, AWS Lambdas)
- Projects wanting fewer dependencies

## Core Concepts

### 1. Containers

The DI container tracks all bindings and holds service instances.

```typescript
import { Container } from "@needle-di/core";

const container = new Container();
```

**Key Methods**:
- `container.bind()` / `container.bindAll()` - Register services
- `container.get(token)` - Retrieve a service synchronously
- `container.getAsync(token)` - Retrieve an async service
- `container.unbind()` / `container.unbindAll()` - Clear bindings
- `container.createChild()` - Create child container with inherited bindings

**Shorthand Functions**:
- `bootstrap(token)` - Create container and return service (one-time use)
- `bootstrapAsync(token)` - Async version of bootstrap

**Warning**: Calling `bootstrap()` creates a new container each time, leading to new singleton instances. Use once per application lifecycle.

### 2. Providers

Providers define HOW services should be created. There are four types:

#### Class Provider
```typescript
container.bind({
  provide: Logger,
  useClass: Logger, // or child class: FileLogger
});

// Shorthand:
container.bind(Logger);
```

#### Value Provider
```typescript
container.bind({
  provide: MyService,
  useValue: new MyService(), // Static value, created immediately
});
```

#### Factory Provider
```typescript
container.bind({
  provide: MyService,
  useFactory: () => new MyService(), // Lazy evaluation
});

// Can use inject() inside factory:
container.bind({
  provide: MyService,
  useFactory: () => new MyService(inject(FooService)),
});

// Or access container:
container.bind({
  provide: MyService,
  useFactory: (container) => new MyService(container.get(FooService)),
});
```

#### Existing Provider (Alias)
```typescript
container.bind({
  provide: VALIDATOR,
  useExisting: MyValidator, // Alias to another token
});
```

### 3. Injection Tokens

Tokens are unique references to services in the DI container. Multiple types supported:

#### Class Constructor Reference
```typescript
container.bind({
  provide: FooService,
  useValue: new FooService(),
});
```

#### String or Symbol
```typescript
const MY_CONFIG = "my-config";
const MY_NUMBER = Symbol("my-magic-number");

container.bind({
  provide: MY_CONFIG,
  useValue: { foo: "bar" },
});

// Retrieve with type annotation:
const myConfig = container.get<MyConfig>(MY_CONFIG);
```

**Warning**: String/symbol tokens don't support type inference - must provide generic type manually.

#### InjectionToken<T> (Recommended)
```typescript
import { InjectionToken } from "@needle-di/core";

const MY_NUMBER = new InjectionToken<number>("MY_NUMBER");
const MY_CONFIG = new InjectionToken<MyConfig>("MY_CONFIG");

container.bind({
  provide: MY_NUMBER,
  useValue: 42,
});

// Type automatically inferred:
const myNumber = container.get(MY_NUMBER); // Type: number
```

**Benefits**: Maximizes type-safety, enables tree-shakeable tokens.

**Note**: TypeScript interfaces only exist at compile-time and CANNOT be used as injection tokens.

### 4. Binding

Binding is the registration of services into the DI container.

#### Auto-binding
```typescript
import { injectable } from "@needle-di/core";

@injectable()
class FooService {
  // ...
}
```

**Characteristics**:
- Automatically binds as singleton
- Lazy construction (only created when requested)
- Requires transpilation for ECMAScript decorators

#### Manual Binding
```typescript
container.bind(FooService);
// or
container.bind({
  provide: FooService,
  useClass: FooService,
});
```

Useful when:
- Not using decorators
- Binding classes from external libraries
- Avoiding transpilation

### 5. Injection

#### Constructor Injection (Recommended)
```typescript
import { inject, injectable } from "@needle-di/core";

@injectable()
class MyService {
  constructor(
    private fooService = inject(FooService),
    private barService = inject(BarService),
  ) {}
}
```

**Why Recommended**:
- Makes dependencies explicit
- More type-safe
- Easier unit testing (can pass dependencies manually)

Uses **default parameter values** to avoid parameter decorators (not yet standardized).

#### Initializer Injection
```typescript
@injectable()
class MyService {
  private fooService = inject(FooService);
  private barService = inject(BarService);
}
```

Less verbose but doesn't allow passing dependencies in unit tests.

#### Injection Context

`inject()` and `injectAsync()` only work in "injection context":
- During class construction by DI container
- In field initializers of such classes
- In synchronous factory functions (`useFactory`)
- In factory functions of `InjectionToken`

**Important**: Cannot use `inject()` in async factory providers - use `container.get()` instead:

```typescript
// ❌ Wrong:
{
  provide: LOGGER,
  useFactory: async () => MyLogger(inject(OTHER_DEP)),
  async: true
}

// ✅ Correct:
{
  provide: LOGGER,
  useFactory: async (container) => MyLogger(container.get(OTHER_DEP)),
  async: true
}
```

## Getting Started Flow

### 1. Installation
```bash
npm install @needle-di/core
# or
yarn add @needle-di/core
# or
pnpm install @needle-di/core
# or (Deno)
deno add jsr:@needle-di/core
```

### 2. Configure Transpiler
Set target to ES2022 or lower for decorator support:

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022"
  }
}
```

### 3. Define Services
```typescript
import { injectable, inject } from "@needle-di/core";

@injectable()
class FooService {
  // ...
}

@injectable()
class BarService {
  constructor(private fooService = inject(FooService)) {}
}
```

### 4. Bootstrap Container
```typescript
import { Container } from "@needle-di/core";

const container = new Container();
const barService = container.get(BarService);
```

## Advanced Features

### 1. Async Injection

For async factory providers:

```typescript
container.bind({
  provide: FooService,
  async: true,
  useFactory: async () => {
    // return Promise<FooService>
  },
});

// Retrieve with getAsync() or injectAsync():
const fooService = await container.getAsync(FooService);
```

**Synchronous Constructor with Async Dependencies**:
```typescript
@injectable()
class MyService {
  constructor(
    private foo = inject(FOO_TOKEN), // async token
    private bar = inject(BAR_TOKEN), // async token
  ) {}
}

// Must use getAsync() for service with async dependencies:
const myService = await container.getAsync(MyService);
```

**Note**: Async dependencies are resolved sequentially (may change in future).

### 2. Child Containers (Hierarchical Containers)

Child containers inherit providers and singletons from parent but can override:

```typescript
const parent = new Container();
const child1 = parent.createChild();
const child2 = parent.createChild();

parent.bind({ provide: LOGGER, useClass: MyLogger });
child2.bind({ provide: LOGGER, useClass: OtherLogger });

const loggerA = parent.get(LOGGER); // MyLogger
const loggerB = child1.get(LOGGER); // MyLogger (same instance as parent)
const loggerC = child2.get(LOGGER); // OtherLogger
```

**Rules**:
- Singletons are shared with descendants unless overridden
- Singletons created in container where first bound
- Multi-providers in child containers NOT merged with parent (current limitation)

### 3. Multi-Providers (Multiple Instances)

Register multiple values for same token:

```typescript
container.bind({
  provide: FooService,
  multi: true,
  useFactory: () => new FooService(),
});

container.bind({
  provide: FooService,
  multi: true,
  useFactory: () => new FooService(),
});

// Inject as array:
class MyService {
  constructor(
    private fooServices = inject(FooService, { multi: true }), // Type: FooService[]
  ) {}
}
```

**Rules**:
- Cannot mix `multi: true` and `multi: false` for same token
- Single multi-provider can still be injected as single instance
- Multiple multi-providers require `multi: true` injection
- Optional multi-injection returns `undefined` (not empty array) when no providers

### 4. Optional Injection

Gracefully handle missing dependencies:

```typescript
class MyService {
  constructor(
    private fooService = inject(FooService),
    private barService = inject(BarService, { optional: true }), // Type: BarService | undefined
  ) {}
}
```

Outside injection context, optional `inject()` returns `undefined` instead of throwing:

```typescript
const myService = new MyService(); // barService will be undefined
```

### 5. Lazy Injection

Defer service creation until needed:

```typescript
class MyService {
  constructor(
    private fooService = inject(FooService, { lazy: true }), // Type: () => FooService
  ) {}

  public doSomething() {
    this.fooService().someMethod(); // Invokes to create FooService
  }
}
```

**Combinations**:
- Lazy + Optional: `() => FooService | undefined`
- Lazy + Async: `() => Promise<FooService>`

Can help solve circular dependency issues.

### 6. Inheritance Support

#### Auto-binding with Inheritance
```typescript
abstract class ExampleService {}

@injectable()
class FooService extends ExampleService {}

@injectable()
class BarService extends ExampleService {}

// Automatically creates multi-providers for parent:
const myServices = container.get(ExampleService, { multi: true }); // [FooService, BarService]
```

**Important Warning**: Subclasses must be referenced somewhere or they'll be tree-shaken. Prevent with manual binding:
```typescript
container.bindAll(FooService, BarService);
```

#### Manual Binding with Inheritance
```typescript
container.bindAll(FooService, BarService);

// Automatically registers:
// { provide: ExampleService, useExisting: FooService, multi: true }
// { provide: ExampleService, useExisting: BarService, multi: true }
```

Works with multiple inheritance levels.

#### Interfaces
For TypeScript interfaces, use `InjectionToken`:

```typescript
interface Logger {
  info(): void;
}

const LOGGER = new InjectionToken<Logger>('LOGGER');

container.bindAll(
  { provide: LOGGER, multi: true, useClass: FileLogger },
  { provide: LOGGER, multi: true, useClass: ConsoleLogger },
);
```

### 7. Tree-Shaking

Tree-shaking removes unused code from bundles to reduce size.

#### Tree-shakeable Injection Tokens

**Without tree-shaking** (not recommended):
```typescript
const MY_TOKEN = new InjectionToken<SomeHeavyClass>("MY_TOKEN");

container.bind({
  provide: MY_TOKEN,
  useFactory: () => new SomeHeavyClass()
});
```
Even if unused, `SomeHeavyClass` stays in bundle because container references it.

**With tree-shaking** (recommended):
```typescript
const MY_TOKEN = new InjectionToken<SomeHeavyClass>(
  "MY_TOKEN",
  {
    factory: () => new SomeHeavyClass(),
  }
);
// No manual binding needed - auto-binds when requested
```

When `MY_TOKEN` has no references, everything associated is removed from bundle.

**When to use**:
- Multiple entry points with separate bundles
- Code splitting / lazy loaded modules
- Dynamic imports
- Organizing code in modular way

## API Reference Summary

### Core Classes

#### Container
```typescript
class Container {
  constructor();

  // Binding
  bind(provider: Provider): this;
  bindAll(...providers: Provider[]): this;
  unbind(token: Token): this;
  unbindAll(): this;

  // Retrieval
  get<T>(token: Token<T>, options?: { multi?: boolean; optional?: boolean }): T;
  getAsync<T>(token: Token<T>, options?: { multi?: boolean; optional?: boolean }): Promise<T>;

  // Hierarchy
  createChild(): Container;
}
```

#### InjectionToken
```typescript
class InjectionToken<T> {
  constructor(
    description: string,
    options?: {
      factory?: () => T;
    }
  );
}
```

### Core Functions

#### inject()
```typescript
function inject<T>(
  token: Token<T>,
  options?: {
    optional?: boolean;
    multi?: boolean;
    lazy?: boolean;
  }
): T;
```

#### injectAsync()
```typescript
function injectAsync<T>(
  token: Token<T>,
  options?: {
    optional?: boolean;
    multi?: boolean;
    lazy?: boolean;
  }
): Promise<T>;
```

#### bootstrap()
```typescript
function bootstrap<T>(token: Token<T>): T;
function bootstrapAsync<T>(token: Token<T>): Promise<T>;
```

### Decorators

#### @injectable()
```typescript
function injectable(): ClassDecorator;
```

### Provider Types

```typescript
type Provider<T> =
  | ClassProvider<T>
  | ValueProvider<T>
  | FactoryProvider<T>
  | ExistingProvider<T>;

interface ClassProvider<T> {
  provide: Token<T>;
  useClass: Constructor<T>;
  multi?: boolean;
}

interface ValueProvider<T> {
  provide: Token<T>;
  useValue: T;
  multi?: boolean;
}

interface FactoryProvider<T> {
  provide: Token<T>;
  useFactory: (container?: Container) => T;
  multi?: boolean;
  async?: boolean;
}

interface ExistingProvider<T> {
  provide: Token<T>;
  useExisting: Token<T>;
  multi?: boolean;
}
```

## Best Practices from Docs

### 1. Prefer Constructor Injection
Constructor injection over initializer injection for:
- Explicit dependencies
- Better type-safety
- Easier unit testing

### 2. Use @injectable() for Auto-binding
Simplest way to register services as singletons with lazy construction.

### 3. Manual Binding for Third-party Classes
Use `container.bind()` when you can't decorate classes from external libraries.

### 4. Use InjectionToken<T> for Type-safety
Prefer `InjectionToken<T>` over string/symbol tokens:
- Better type inference
- Prevents inconsistencies
- Enables tree-shaking

### 5. Never Use Interfaces as Tokens
TypeScript interfaces don't exist at runtime - use `InjectionToken<T>` instead.

### 6. Call bootstrap() Once
Calling `bootstrap()` multiple times creates multiple containers with separate singleton instances. Call once per application lifecycle.

### 7. Reference Subclasses for Auto-binding
When using inheritance with `@injectable()`, ensure subclasses are referenced or manually bound to prevent tree-shaking.

### 8. Use Factory Functions in InjectionToken for Tree-shaking
Enable tree-shaking by providing factory functions directly in `InjectionToken` constructor rather than binding separately.

### 9. Async Factory Providers Must Use Container
Cannot use `inject()` in async factory functions - use `container.get()` parameter instead.

### 10. Set Target to ES2022
Configure transpiler with `target: "ES2022"` or lower for ECMAScript decorator support.

### 11. Child Containers for Overrides
Use child containers to override specific providers without affecting parent container.

### 12. Multi-providers for Plugin Architecture
Use multi-providers when implementing plugin systems or collecting multiple implementations of same interface.

### 13. Optional Injection for Graceful Degradation
Use optional injection for non-critical dependencies that may not be available in all contexts.

### 14. Lazy Injection for Circular Dependencies
Use lazy injection to break circular dependency chains by deferring service creation.

## Key Design Decisions

### Why Default Parameters for Injection?
- Maximizes type-safety
- Removes need for parameter decorators (not yet ECMAScript standard)
- Reduces complexity and bundle size

### Why ESM-only?
- Suitable for modern Node.js and web projects
- Pushes ECMAScript standards forward

### Why No Reflection Metadata?
- Reduces bundle size
- Eliminates dependencies
- Improves tree-shaking effectiveness

### Why Stage 3 Decorators?
- Follows ECMAScript standards
- Future-proof as decorators advance to stage 4
- Supported by all modern transpilers

## Comparison with Other DI Frameworks

**Inspiration from**: Angular DI and NestJS DI systems

**Key Differences**:
- No reflection or metadata
- Lightweight focus (~40kB)
- ESM-only
- Stage 3 decorators instead of experimental
- Tree-shaking as first-class concern
- No peer dependencies

## Platform Support

- **NPM**: `@needle-di/core`
- **JSR**: `@needle-di/core`
- **Deno**: Native support via JSR
- **Node.js**: Requires transpilation for decorators
- **Browser**: Requires transpilation for decorators

## Current Limitations

1. Async dependencies resolved sequentially (may change)
2. Multi-providers in child containers not merged with parent
3. No roadmap - features added by request
4. Requires transpilation for most environments (except Deno)

## Feature Request Process

No official roadmap - submit feature requests via GitHub issues for discussion.

## Additional Resources

- [GitHub Repository](https://github.com/needle-di/needle-di)
- [NPM Package](https://www.npmjs.com/package/@needle-di/core)
- [JSR Package](https://jsr.io/@needle-di/core)
- ECMAScript Decorators: [TC39 Proposal](https://github.com/tc39/proposal-decorators)
