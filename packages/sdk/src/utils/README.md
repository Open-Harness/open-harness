# utils/ - Generic Utilities

Provider-agnostic utility functions.

## Files

| File | Purpose |
|------|---------|
| `backoff.ts` | Exponential backoff calculator for rate limiting |
| `async-queue.ts` | `AsyncQueue` - Ordered async processing with concurrency control |
| `dependency-resolver.ts` | DAG-based task dependency resolution |

## Key Abstractions

- **backoff(attempt, opts)**: Returns delay in ms. Options: `initialDelay`, `maxDelay`, `factor`.
- **AsyncQueue<T>**: Process items in order with concurrency limit. Methods: `enqueue()`, `drain()`.
- **DependencyResolver**: Resolves task execution order from dependency graph. Detects cycles.

## Usage

These are internal utilities used by `harness/control-flow.ts` for `retry()` and `parallel()`.
