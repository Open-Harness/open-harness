/**
 * Agent lifecycle - dim inline markers for agent start/complete.
 *
 * @module
 */

export interface AgentLifecycleProps {
  agent: string
  type: "started" | "completed"
  duration?: number
}

export function AgentLifecycle({ agent, type, duration }: AgentLifecycleProps) {
  const symbol = type === "started" ? "▸" : "◂"
  const durationStr = duration !== undefined ? ` (${(duration / 1000).toFixed(1)}s)` : ""

  return (
    <box>
      <text fg="#666666">  {symbol} {agent} {type}{durationStr}</text>
    </box>
  )
}
