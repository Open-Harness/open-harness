# Docs V3 Migration Tracker

## Completed ✅
- **quickstart.mdx** - Updated to V3 API (committed)

## Remaining Work

### High Priority (Tutorial/Guide Content)

1. **`apps/docs/content/docs/learn/persistence.mdx`**
   - Line 22: Update imports - remove `executeFlow`
   - Line 32: Replace `executeFlow()` with `createRuntime()` + `runtime.run()`

2. **`apps/docs/content/docs/learn/multi-agent-flow.mdx`**
   - Line 89: Replace `executeFlow()` with `createRuntime()` + `runtime.run()`

3. **`apps/docs/content/docs/guides/agents/custom-agents.mdx`**
   - Line 82: Replace `new NodeRegistry()` with `new DefaultNodeRegistry()`
   - Line 83: Verify `registry.register()` pattern still correct

### Medium Priority (API Reference)

4. **`apps/docs/content/docs/reference/api/node-registry.mdx`**
   - **Decision needed**: Is NodeRegistry still a public API?
   - If yes: Update all examples to `DefaultNodeRegistry`
   - If no: Remove this page entirely

5. **`apps/docs/content/docs/reference/api/hub.mdx`**
   - Lines 55-60: Verify `hub.subscribe()` signature is still correct
   - May need to clarify relationship between Hub and Runtime

### Low Priority (Verification Needed)

6. **Files with `hub.subscribe()` patterns** - Verify event structure:
   - `apps/docs/content/docs/concepts/event-system.mdx` (Lines 72, 77, 82, 120, 139)
   - `apps/docs/content/docs/reference/api/events.mdx` (Lines 141, 144, 147)
   - `apps/docs/content/docs/guides/agents/claude-agent.mdx` (Lines 60, 68)
   - `apps/docs/content/docs/guides/deployment/production.mdx` (Lines 23, 46)
   - `apps/docs/content/docs/reference/types/runtime-event.mdx` (Line 161)

## V3 API Patterns Reference

### Replace executeFlow
```typescript
// OLD (V2)
const result = await executeFlow(flow, registry, ctx, input);

// NEW (V3)
const runtime = createRuntime({ flow, registry });
const snapshot = await runtime.run(input);
```

### Replace Hub Subscribe
```typescript
// OLD (V2)
hub.subscribe("agent:*", (event) => {
  if (event.event.type === "agent:text") {
    process.stdout.write(event.event.content);
  }
});

// NEW (V3)
runtime.onEvent((event) => {
  if (event.type === "agent:text:delta") {
    process.stdout.write(event.delta);
  }
});
```

### Replace NodeRegistry
```typescript
// OLD (V2)
const registry = new NodeRegistry();

// NEW (V3)
const registry = new DefaultNodeRegistry();
```

### Use Built-in Nodes
```typescript
// OLD (V2)
const claudeAgent = createClaudeAgent();
registry.register({
  type: "agent",
  run: async (ctx, input) => {
    return await claudeAgent.execute(input, ctx);
  }
});

// NEW (V3)
import { claudeNode } from "@open-harness/kernel";
registry.register(claudeNode);
// Use type: "claude.agent" in flow YAML
```

## Notes
- `parseFlowYaml()` is STILL VALID in V3 - keep it
- Event type changed from `agent:text` to `agent:text:delta`
- Event structure changed from `event.event.content` to `event.delta`
- Runtime returns `RunSnapshot` with `snapshot.outputs` instead of direct outputs
