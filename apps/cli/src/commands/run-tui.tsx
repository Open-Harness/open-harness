/**
 * TUI runner - OpenTUI-based terminal interface
 *
 * Separated from run.tsx to enable tree-shaking in headless mode.
 *
 * @module
 */

import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"

import { App } from "../ui/App.js"

export async function runTui(
  port: number,
  sessionId: string,
  workflow: { name: string },
  options?: { isReplay?: boolean }
): Promise<void> {
  const serverUrl = `http://127.0.0.1:${port}`

  // Create terminal renderer
  const renderer = await createCliRenderer()

  // Mount React app
  const root = createRoot(renderer)

  // Create a promise that resolves when the workflow completes
  const done = new Promise<void>((resolve) => {
    root.render(
      <App
        serverUrl={serverUrl}
        sessionId={sessionId}
        workflowName={workflow.name}
        isReplay={options?.isReplay}
        onComplete={() => {
          root.unmount()
          resolve()
        }}
      />
    )
  })

  await done
}
