/**
 * Thinking block - renders agent thinking/reasoning.
 *
 * Inline with emoji prefix, collapsible, no boxes.
 *
 * @module
 */

export interface ThinkingBlockProps {
  text: string
  collapsed?: boolean
}

export function ThinkingBlock({ text, collapsed = false }: ThinkingBlockProps) {
  if (collapsed) {
    const lineCount = text.split("\n").length
    return (
      <box>
        <text fg="#666666">{"💭 (" + String(lineCount) + " lines hidden)"}</text>
      </box>
    )
  }

  const lines = text.split("\n")

  return (
    <box flexDirection="column">
      {lines.map((line, i) => (
        <box key={i} flexDirection="row">
          <text fg="#666666">{i === 0 ? "💭 " : "   "}</text>
          <text fg="#666666">{line}</text>
        </box>
      ))}
    </box>
  )
}
