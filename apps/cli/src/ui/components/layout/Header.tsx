/**
 * Header component showing workflow info.
 *
 * @module
 */

import { TextAttributes } from "@opentui/core"

export interface HeaderProps {
  workflowName: string
  phase: string
  status: string
  eventCount: number
}

export function Header({ workflowName, phase, status, eventCount }: HeaderProps) {
  const statusColor = status === "running"
    ? "#00ff00"
    : status === "complete"
    ? "#00aaff"
    : status === "error"
    ? "#ff0000"
    : "#ffff00"

  const statusSymbol = status === "running" ? "●" : status === "complete" ? "✓" : "○"

  return (
    <box
      height={3}
      paddingLeft={1}
      paddingRight={1}
      border={true}
      borderStyle="single"
      borderColor="#444444"
    >
      <box flexDirection="row" justifyContent="space-between" alignItems="center" flexGrow={1}>
        <box flexDirection="row" gap={1}>
          <text fg="#00ffff" attributes={TextAttributes.BOLD}>Open Scaffold</text>
          <text fg="#666666">│</text>
          <text fg="#ffffff">{workflowName}</text>
          {phase && (
            <>
              <text fg="#666666">│</text>
              <text fg="#ff00ff">{phase}</text>
            </>
          )}
        </box>

        <box flexDirection="row" gap={1}>
          <text fg={statusColor}>{statusSymbol} {status}</text>
          <text fg="#666666">│</text>
          <text fg="#666666">Events: {String(eventCount)}</text>
        </box>
      </box>
    </box>
  )
}
