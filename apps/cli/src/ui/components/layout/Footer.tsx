/**
 * Footer component showing keybind hints.
 *
 * @module
 */

import type { VisibilityState } from "../../hooks/useVisibility.js"
import type { Screen } from "../../App.js"

export interface FooterProps {
  screen: Screen
  visibility: VisibilityState
}

function modeLabel(mode: string): string {
  return mode === "visible" ? "on" : mode === "collapsed" ? "min" : "off"
}

export function Footer({ screen, visibility }: FooterProps) {
  return (
    <box paddingLeft={1} flexDirection="row" gap={2}>
      <text fg="#666666">↑↓ scroll</text>
      <text fg="#666666">│</text>
      <text fg="#666666">Tab: {screen === "events" ? "state" : "events"}</text>
      <text fg="#666666">│</text>
      <text fg="#666666">t: thinking ({modeLabel(visibility.thinking)})</text>
      <text fg="#666666">│</text>
      <text fg="#666666">o: tools ({modeLabel(visibility.tools)})</text>
      <text fg="#666666">│</text>
      <text fg="#666666">q: quit</text>
    </box>
  )
}
