/**
 * Main TUI application component.
 *
 * Handles workflow connection, event rendering, and screen switching.
 * All rendering is generic - the CLI doesn't know about workflow-specific events.
 *
 * @module
 */

import { useState, useEffect, useCallback } from "react"
import { useKeyboard } from "@opentui/react"
import type { KeyEvent } from "@opentui/core"

import { Header } from "./components/layout/Header.js"
import { Footer } from "./components/layout/Footer.js"
import { EventFeed } from "./screens/EventFeed.js"
import { StateView } from "./screens/StateView.js"
import { HitlModal } from "./components/events/HitlModal.js"
import { useEventStream } from "./hooks/useEventStream.js"
import { useVisibility } from "./hooks/useVisibility.js"

export type Screen = "events" | "state"

export interface AppProps {
  serverUrl: string
  sessionId: string
  workflowName: string
  isReplay?: boolean
  onComplete?: () => void
}

export function App({
  serverUrl,
  sessionId,
  workflowName,
  isReplay = false,
  onComplete,
}: AppProps) {
  const [screen, setScreen] = useState<Screen>("events")
  const [hitlPrompt, setHitlPrompt] = useState<string | null>(null)

  // Event stream from server
  const {
    events,
    state,
    phase,
    status,
    isComplete,
    streamingText,
    respond,
  } = useEventStream(serverUrl, sessionId, { includeHistory: true })

  // Visibility toggles for thinking/tools
  const visibility = useVisibility()

  // Handle HITL events
  useEffect(() => {
    const lastEvent = events[events.length - 1]
    if (lastEvent?.name === "input:requested") {
      setHitlPrompt((lastEvent.payload as { prompt?: string })?.prompt ?? "Input required")
    }
  }, [events])

  const handleHitlSubmit = useCallback((value: string) => {
    respond(value)
    setHitlPrompt(null)
  }, [respond])

  // Keyboard handling
  useKeyboard((key: KeyEvent) => {
    // Tab switches screens
    if (key.name === "Tab") {
      setScreen((s) => (s === "events" ? "state" : "events"))
    }

    // Toggle visibility
    if (key.raw === "t") {
      visibility.cycleThinking()
    }
    if (key.raw === "o") {
      visibility.cycleTools()
    }

    // Quit
    if (key.name === "Escape" || key.raw === "q") {
      onComplete?.()
      process.exit(0)
    }
  })

  const statusText = isReplay
    ? "replay"
    : status === "running" && isComplete
    ? "complete"
    : status

  return (
    <box flexDirection="column" height="100%">
      <Header
        workflowName={workflowName}
        phase={phase}
        status={statusText}
        eventCount={events.length}
      />

      <box flexGrow={1} flexDirection="column">
        {screen === "events" ? (
          <EventFeed
            events={events}
            streamingText={streamingText}
            visibility={visibility.state}
          />
        ) : (
          <StateView state={state} />
        )}
      </box>

      <Footer
        screen={screen}
        visibility={visibility.state}
      />

      {hitlPrompt && (
        <HitlModal
          prompt={hitlPrompt}
          onSubmit={handleHitlSubmit}
          onCancel={() => setHitlPrompt(null)}
        />
      )}
    </box>
  )
}
