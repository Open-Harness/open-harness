# CLI Spec (v1)

## Command

`open-harness-daemon`

## Required

- `--flow <path>`: path to flow YAML (root-level FlowDefinition).

## Optional

- `--input <json>`: flow input as JSON string.
- `--input-file <path>`: flow input as JSON file.
- `--stream` / `--no-stream`: streaming agent deltas (default: `--stream`).
- `--verbosity <quiet|normal|verbose|debug>` (default: `normal`).
- `--ws-port <number>` (default: `7777`).
- `--ws-path <string>` (default: `/ws`).
- `--no-ws`: disable WebSocket server (logs only).
- `--print-json`: render events as JSON lines (overrides text renderer).
- `--help`: print usage.

## Examples

Start daemon with streaming text:
```
open-harness-daemon --flow flow.yaml --input '{"name":"World"}'
```

Start daemon with JSON output and custom WS port:
```
open-harness-daemon --flow flow.yaml --print-json --ws-port 9000
```

Start daemon without WS:
```
open-harness-daemon --flow flow.yaml --no-ws
```

## Input Precedence

If both `--input` and `--input-file` are provided, `--input` wins.

## YAML Format

Flow YAML must match the runtime FlowDefinition schema at the root:

```yaml
name: greeting-flow
nodes:
  - id: greet
    type: claude.agent
    input:
      prompt: "Say hello"
edges: []
```

No `flow:` wrapper is supported in v1.

