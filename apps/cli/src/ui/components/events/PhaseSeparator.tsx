/**
 * Phase separator - renders a horizontal line with phase name.
 *
 * @module
 */

export interface PhaseSeparatorProps {
  phase: string
}

export function PhaseSeparator({ phase }: PhaseSeparatorProps) {
  const dashCount = 20

  return (
    <box paddingTop={1} paddingBottom={1}>
      <text fg="#666666">{"─".repeat(dashCount)} </text>
      <text fg="#ff00ff">{phase}</text>
      <text fg="#666666"> {"─".repeat(dashCount)}</text>
    </box>
  )
}
