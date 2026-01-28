/**
 * Workflow banner - shows start/complete markers.
 *
 * @module
 */

import { TextAttributes } from "@opentui/core"

export interface WorkflowBannerProps {
  type: "start" | "complete"
  name: string
}

export function WorkflowBanner({ type, name }: WorkflowBannerProps) {
  const label = type === "start" ? `${name} Started` : "Complete"
  const color = type === "start" ? "#00ffff" : "#00ff00"

  return (
    <box paddingTop={1} paddingBottom={1}>
      <text fg={color} attributes={TextAttributes.BOLD}>{"═".repeat(20)} {label} {"═".repeat(20)}</text>
    </box>
  )
}
