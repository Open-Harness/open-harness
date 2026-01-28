/**
 * HITL Modal - overlay for human input requests.
 *
 * This is the ONE component that uses a box - it's a modal overlay
 * that needs visual emphasis.
 *
 * @module
 */

import { useState, useCallback } from "react"
import { useKeyboard } from "@opentui/react"
import type { KeyEvent } from "@opentui/core"
import { TextAttributes } from "@opentui/core"

export interface HitlModalProps {
  prompt: string
  onSubmit: (value: string) => void
  onCancel: () => void
}

export function HitlModal({ prompt, onSubmit, onCancel }: HitlModalProps) {
  const [value, setValue] = useState("")

  useKeyboard((key: KeyEvent) => {
    if (key.name === "Escape") {
      onCancel()
    }
    if (key.name === "Return" || key.name === "Enter") {
      onSubmit(value)
    }
    // Handle backspace
    if (key.name === "Backspace") {
      setValue((v) => v.slice(0, -1))
    }
    // Handle printable characters
    if (key.raw && key.raw.length === 1 && key.raw.charCodeAt(0) >= 32) {
      setValue((v) => v + key.raw)
    }
  })

  return (
    <box
      position="absolute"
      top={5}
      left={5}
      right={5}
      flexDirection="column"
      border={true}
      borderStyle="double"
      borderColor="#ffff00"
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
    >
      <box marginBottom={1}>
        <text fg="#ffff00" attributes={TextAttributes.BOLD}>⚠️  Human Input Required</text>
      </box>

      <box marginBottom={1}>
        <text fg="#ffffff">{prompt}</text>
      </box>

      <box marginBottom={1}>
        <text fg="#666666">&gt; </text>
        <text fg="#ffffff">{value}</text>
        <text fg="#00ffff">█</text>
      </box>

      <box flexDirection="row" gap={2}>
        <text fg="#666666">Enter: Submit</text>
        <text fg="#666666">│</text>
        <text fg="#666666">Esc: Cancel</text>
      </box>
    </box>
  )
}
