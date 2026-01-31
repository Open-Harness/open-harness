# open-harness

## 0.1.1

### Patch Changes

- [`c5c1866`](https://github.com/Open-Harness/open-harness/commit/c5c186607d01e010c1cbfd53a412950ab620a0f4) Thanks [@AaronAbuUsama](https://github.com/AaronAbuUsama)! - Renamed package from `open-harness` to `@open-harness/sdk` since `open-harness` was already taken on npm.

  Usage:

  ```typescript
  import { run, workflow, agent } from "@open-harness/sdk";
  import { EventStore } from "@open-harness/sdk/core";
  import { createServer } from "@open-harness/sdk/server";
  import { useWorkflow } from "@open-harness/sdk/client";
  ```

## 0.1.0

### Minor Changes

- [#162](https://github.com/Open-Harness/open-harness/pull/162) [`43f0348`](https://github.com/Open-Harness/open-harness/commit/43f034892ed9ea0dbf87efc5459ce09a135cd968) Thanks [@AaronAbuUsama](https://github.com/AaronAbuUsama)! - Initial public release of Open Harness

  - `open-harness`: Unified SDK package with subpath exports for core, server, client, and testing modules
  - `@open-harness/ralph`: CLI tool for executing Claude Code task lists using the Open Harness workflow engine
