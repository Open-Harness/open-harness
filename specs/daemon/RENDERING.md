# Rendering Spec (v1)

This document defines rendering behavior for console output.
Two renderers are supported: grouped text and JSON lines.

## Renderer Selection

- Default: grouped text renderer.
- `--print-json` switches to JSON lines renderer.

## Verbosity Levels

```
quiet   -> flow:complete, node:error, agent:error
normal  -> flow start/complete + agent text output
verbose -> node, edge, loop events
debug   -> everything (including command:received, agent deltas)
```

## Stream Mode

- `--stream` (default): print `agent:text:delta` and `agent:thinking:delta`
  as they arrive.
- `--no-stream`: suppress deltas, print only final agent output.

## Grouped Text Renderer

### Grouping Rules

Group events by `runId` and `nodeId`:

- `node:*` events → bucket `node:<nodeId>/<runId>`
- `agent:*` events → bucket `agent:<nodeId>/<runId>`
- `flow:*`, `edge:*`, `loop:*` → flow/global bucket
- `state:patch` → global bucket (verbose/debug only)

### Render State

```ts
type RenderBucket = {
  label: string;      // "[node:id run=...]" or "[agent:id run=...]"
  isStreaming: boolean;
  buffer: string;     // streaming text buffer
};

type RenderState = Map<string, RenderBucket>; // key by runId + bucket id
```

### Example Output

```
▶ flow:start greeting-flow
  [node:a run=aa12] start
  [node:a run=aa12] output value="Hello"
  [node:b run=bb34] start
  [agent:b run=bb34] text: "Hi there, ..."
  [agent:b run=bb34] complete (tokens=123, cost=$0.02)
✓ flow:complete greeting-flow
```

### Color Policy

Apply ANSI colors when stdout is a TTY:

```
flow events:     cyan
node start/end:  green
edge/loop:       magenta
agent text:      white
agent thinking:  dim gray
agent tool:      yellow
errors:          red
```

If stdout is not a TTY, output is plain text without ANSI codes.

### Streaming Behavior

- When streaming, `agent:text:delta` appends to the current agent bucket line.
- On `agent:complete` or `agent:error`, flush the line and reset buffer.
- If `--no-stream`, buffer deltas and emit only on complete.

## JSON Lines Renderer

- Writes `JSON.stringify(event)` per event with `\n` separator.
- No grouping or color.
- Verbosity filter still applies (unless `--verbosity debug`).

