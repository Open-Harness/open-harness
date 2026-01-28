/**
 * Hook for managing visibility states of thinking blocks and tool calls.
 *
 * @module
 */

import { useCallback, useState } from "react"

export type VisibilityMode = "visible" | "collapsed" | "hidden"

export interface VisibilityState {
  thinking: VisibilityMode
  tools: VisibilityMode
}

export interface UseVisibilityResult {
  state: VisibilityState
  cycleThinking: () => void
  cycleTools: () => void
  setThinking: (mode: VisibilityMode) => void
  setTools: (mode: VisibilityMode) => void
}

const CYCLE: Array<VisibilityMode> = ["visible", "collapsed", "hidden"]

function cycleMode(current: VisibilityMode): VisibilityMode {
  const idx = CYCLE.indexOf(current)
  return CYCLE[(idx + 1) % CYCLE.length]
}

export function useVisibility(): UseVisibilityResult {
  const [state, setState] = useState<VisibilityState>({
    thinking: "visible",
    tools: "visible"
  })

  const cycleThinking = useCallback(() => {
    setState((s) => ({ ...s, thinking: cycleMode(s.thinking) }))
  }, [])

  const cycleTools = useCallback(() => {
    setState((s) => ({ ...s, tools: cycleMode(s.tools) }))
  }, [])

  const setThinking = useCallback((mode: VisibilityMode) => {
    setState((s) => ({ ...s, thinking: mode }))
  }, [])

  const setTools = useCallback((mode: VisibilityMode) => {
    setState((s) => ({ ...s, tools: mode }))
  }, [])

  return {
    state,
    cycleThinking,
    cycleTools,
    setThinking,
    setTools
  }
}
