/**
 * Text block - renders agent text output.
 *
 * Simple inline text, no boxes.
 *
 * @module
 */

export interface TextBlockProps {
  text: string
  agent?: string
  streaming?: boolean
}

export function TextBlock({ text, agent, streaming = false }: TextBlockProps) {
  // Split into lines for proper wrapping
  const lines = text.split("\n")

  return (
    <box flexDirection="column">
      {lines.map((line, i) => (
        <box key={i} flexDirection="row">
          {i === 0 && agent && (
            <text fg="#666666">{agent}: </text>
          )}
          <text fg="#ffffff">{line}</text>
          {streaming && i === lines.length - 1 ? <text fg="#00ffff">{"█"}</text> : null}
        </box>
      ))}
    </box>
  )
}
