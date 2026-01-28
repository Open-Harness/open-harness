/**
 * Tool call - renders tool invocation with args and result.
 *
 * Inline format, collapsible, no boxes.
 *
 * @module
 */

export interface ToolCallProps {
  tool: string
  args: unknown
  result: unknown
  collapsed?: boolean
}

function formatArgs(args: unknown): string {
  if (args === null || args === undefined) return ""
  if (typeof args === "object") {
    const entries = Object.entries(args as Record<string, unknown>)
    if (entries.length === 0) return ""
    if (entries.length === 1) {
      const [key, value] = entries[0]
      return `${key}: ${formatValue(value)}`
    }
    return entries
      .map(([k, v]) => `${k}: ${formatValue(v)}`)
      .join(", ")
  }
  return String(args)
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    if (value.length > 50) return `"${value.slice(0, 47)}..."`
    return `"${value}"`
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]"
    return `[...${value.length}]`
  }
  if (typeof value === "object" && value !== null) {
    const keys = Object.keys(value)
    if (keys.length === 0) return "{}"
    return `{...}`
  }
  return String(value)
}

function formatResult(result: unknown): string {
  if (result === null || result === undefined) return "void"
  if (typeof result === "string") {
    if (result.length > 60) return result.slice(0, 57) + "..."
    return result
  }
  if (typeof result === "boolean") return result ? "✓" : "✗"
  if (Array.isArray(result)) {
    if (result.length === 0) return "[]"
    if (result.length <= 3 && result.every((x) => typeof x === "string")) {
      return JSON.stringify(result)
    }
    return `[...${result.length} items]`
  }
  if (typeof result === "object") {
    const json = JSON.stringify(result)
    return json.slice(0, 60) + (json.length > 60 ? "..." : "")
  }
  return String(result)
}

export function ToolCall({ tool, args, result, collapsed = false }: ToolCallProps) {
  const argsStr = formatArgs(args)
  const resultStr = formatResult(result)

  if (collapsed) {
    const success = result !== null && result !== undefined
    return (
      <box flexDirection="row">
        <text fg="#ffffff">🔧 </text>
        <text fg="#ffff00">{tool}</text>
        <text fg="#666666"> → </text>
        <text fg={success ? "#00ff00" : "#ff0000"}>{success ? "✓" : "✗"}</text>
      </box>
    )
  }

  return (
    <box flexDirection="column">
      <box flexDirection="row">
        <text fg="#ffffff">🔧 </text>
        <text fg="#ffff00">{tool}</text>
        {argsStr && <text fg="#666666">({argsStr})</text>}
      </box>
      <box flexDirection="row" paddingLeft={3}>
        <text fg="#666666">→ </text>
        <text fg="#ffffff">{resultStr}</text>
      </box>
    </box>
  )
}
