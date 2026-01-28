/**
 * State tree - renders workflow state as an expandable JSON tree.
 *
 * @module
 */

import { useState } from "react"

export interface StateTreeProps {
  value: unknown
  depth?: number
  keyName?: string
}

export function StateTree({ value, depth = 0, keyName }: StateTreeProps) {
  const [expanded, setExpanded] = useState(depth < 2)

  const indent = "  ".repeat(depth)

  // Primitive values
  if (value === null) {
    return (
      <box>
        <text fg="#666666">{indent}</text>
        {keyName && <text fg="#00ffff">{keyName}: </text>}
        <text fg="#888888">null</text>
      </box>
    )
  }

  if (value === undefined) {
    return (
      <box>
        <text fg="#666666">{indent}</text>
        {keyName && <text fg="#00ffff">{keyName}: </text>}
        <text fg="#888888">undefined</text>
      </box>
    )
  }

  if (typeof value === "boolean") {
    return (
      <box>
        <text fg="#666666">{indent}</text>
        {keyName && <text fg="#00ffff">{keyName}: </text>}
        <text fg="#ffff00">{value ? "true" : "false"}</text>
      </box>
    )
  }

  if (typeof value === "number") {
    return (
      <box>
        <text fg="#666666">{indent}</text>
        {keyName && <text fg="#00ffff">{keyName}: </text>}
        <text fg="#ffff00">{String(value)}</text>
      </box>
    )
  }

  if (typeof value === "string") {
    const displayValue = value.length > 60 ? value.slice(0, 57) + "..." : value
    return (
      <box>
        <text fg="#666666">{indent}</text>
        {keyName && <text fg="#00ffff">{keyName}: </text>}
        <text fg="#00ff00">"{displayValue}"</text>
      </box>
    )
  }

  // Arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <box>
          <text fg="#666666">{indent}</text>
          {keyName && <text fg="#00ffff">{keyName}: </text>}
          <text fg="#ffffff">[]</text>
        </box>
      )
    }

    const symbol = expanded ? "▼" : "▶"

    return (
      <box flexDirection="column">
        <box>
          <text fg="#666666">{indent}</text>
          <text fg="#666666">{symbol} </text>
          {keyName && <text fg="#00ffff">{keyName}: </text>}
          <text fg="#ffffff">[{String(value.length)} items]</text>
        </box>
        {expanded && value.map((item, i) => (
          <StateTree key={i} value={item} depth={depth + 1} keyName={String(i)} />
        ))}
      </box>
    )
  }

  // Objects
  if (typeof value === "object") {
    const entries = Object.entries(value)

    if (entries.length === 0) {
      return (
        <box>
          <text fg="#666666">{indent}</text>
          {keyName && <text fg="#00ffff">{keyName}: </text>}
          <text fg="#ffffff">{"{}"}</text>
        </box>
      )
    }

    const symbol = expanded ? "▼" : "▶"

    return (
      <box flexDirection="column">
        <box>
          <text fg="#666666">{indent}</text>
          <text fg="#666666">{symbol} </text>
          {keyName && <text fg="#00ffff">{keyName}: </text>}
          <text fg="#ffffff">{"{...}"}</text>
        </box>
        {expanded && entries.map(([k, v]) => (
          <StateTree key={k} value={v} depth={depth + 1} keyName={k} />
        ))}
      </box>
    )
  }

  // Fallback
  return (
    <box>
      <text fg="#666666">{indent}</text>
      {keyName && <text fg="#00ffff">{keyName}: </text>}
      <text fg="#ffffff">{String(value)}</text>
    </box>
  )
}
