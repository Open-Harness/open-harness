# @open-harness/sdk

## 0.1.0

### Minor Changes

- 30c0662: Initial alpha release of Open Harness SDK

  - Event-driven workflow orchestration for multi-agent AI systems
  - JSONata expressions for data bindings and conditionals
  - Full observability through event streaming
  - Replay testing support
  - Claude agent integration
  - Complete documentation site

- 30c0662: Add unified flow execution API with smart defaults for reduced boilerplate.

  - Add `createHarness()` API for full control with automatic Runtime, Registry, Transport wiring
  - Add `runFlow()` convenience function for one-shot flow execution with auto-cleanup
  - Add `createDefaultRegistry()` helper that registers all standard nodes
  - Add plain object registry support - pass `Record<string, NodeTypeDefinition>` directly to registry option
  - Fix memory leak: event listeners from `runtime.onEvent()` now properly cleaned up
  - Update SDK exports to include `createHarness`, `runFlow`, `createDefaultRegistry`

### Patch Changes

- 30c0662: Initial developer infrastructure setup including git hooks, CI/CD, and package configuration.

  - Add lefthook for pre-commit (lint-staged, beads) and pre-push (lint, typecheck, test) hooks
  - Configure package.json exports and TypeScript build process
  - Set up GitHub Actions CI workflow for quality checks
  - Add lint-staged for fast incremental linting
  - Exclude .beads/issues.jsonl from git hooks to prevent sync conflicts
