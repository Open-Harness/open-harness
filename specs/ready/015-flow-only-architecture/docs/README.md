# Flow-Only Docs (Draft)

This folder contains draft docs aligned to the kernel docs format, updated for Flow-only execution. These drafts are **not** applied to `packages/kernel/docs` yet.

## Canonical naming (Flow-only)

- **Hub**: bidirectional bus (events out, commands in)
- **FlowRuntime**: orchestration runtime (replaces Harness)
- **Agent**: executable unit that emits `agent:*` events
- **Channel**: bidirectional interface attached to the runtime

## Draft docs

### Spec
- [Flow Runtime](spec/flow-runtime.md)
- [Agent](updates/spec/agent.md)
- [Channel](updates/spec/channel.md)
- [Hub](updates/spec/hub.md)

### Flow
- [FlowSpec](updates/flow/flow-spec.md)
- [Execution](updates/flow/execution.md)
- [When](updates/flow/when.md)
- [Registry](updates/flow/registry.md)
- [Edge Routing](flow/edge-routing.md)
- [Node Catalog](flow/node-catalog.md)

### Reference
- [Protocol Types](updates/reference/protocol-types.md)

### Updates index

These are draft rewrites of canonical kernel docs for Flow-only alignment:
- [Kernel README (draft)](updates/README.md)
- [FlowSpec (draft)](updates/flow/flow-spec.md)
- [Execution (draft)](updates/flow/execution.md)
- [When (draft)](updates/flow/when.md)
- [Registry (draft)](updates/flow/registry.md)
- [Protocol Types (draft)](updates/reference/protocol-types.md)

### Meta
- [Docs Impact](../docs-impact.md)
- [Main Spec](../spec.md)
