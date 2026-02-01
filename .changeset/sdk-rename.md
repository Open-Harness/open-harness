---
"@open-harness/sdk": patch
---

Renamed package from `open-harness` to `@open-harness/sdk` since `open-harness` was already taken on npm.

Usage:
```typescript
import { run, workflow, agent } from "@open-harness/sdk"
import { EventStore } from "@open-harness/sdk/core"
import { createServer } from "@open-harness/sdk/server"
import { useWorkflow } from "@open-harness/sdk/client"
```
