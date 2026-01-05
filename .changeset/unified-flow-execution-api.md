---
"@open-harness/sdk": minor
---

Add unified flow execution API with smart defaults for reduced boilerplate.

- Add `createHarness()` API for full control with automatic Runtime, Registry, Transport wiring
- Add `runFlow()` convenience function for one-shot flow execution with auto-cleanup
- Add `createDefaultRegistry()` helper that registers all standard nodes
- Add plain object registry support - pass `Record<string, NodeTypeDefinition>` directly to registry option
- Fix memory leak: event listeners from `runtime.onEvent()` now properly cleaned up
- Update SDK exports to include `createHarness`, `runFlow`, `createDefaultRegistry`
