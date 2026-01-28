/**
 * Event feed screen - renders workflow events as minimal inline items.
 *
 * This is the main view. All rendering is based on framework event types,
 * not workflow-specific concepts.
 *
 * @module
 */

import type { StreamEvent } from "../hooks/useEventStream.js"
import type { VisibilityState } from "../hooks/useVisibility.js"

import { TextBlock } from "../components/events/TextBlock.js"
import { ThinkingBlock } from "../components/events/ThinkingBlock.js"
import { ToolCall } from "../components/events/ToolCall.js"
import { PhaseSeparator } from "../components/events/PhaseSeparator.js"
import { WorkflowBanner } from "../components/events/WorkflowBanner.js"
import { AgentLifecycle } from "../components/events/AgentLifecycle.js"

export interface EventFeedProps {
  events: StreamEvent[]
  streamingText: string
  visibility: VisibilityState
}

export function EventFeed({ events, streamingText, visibility }: EventFeedProps) {
  // Transform events into renderable items
  const items = renderEvents(events, visibility)

  return (
    <scrollbox flexGrow={1}>
      <box flexDirection="column" paddingLeft={1}>
        {items}

        {/* Streaming text cursor */}
        {streamingText && (
          <TextBlock text={streamingText} streaming />
        )}
      </box>
    </scrollbox>
  )
}

function renderEvents(
  events: StreamEvent[],
  visibility: VisibilityState
): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let currentAgentText = ""
  let currentThinkingText = ""
  let pendingToolCall: { name: string; args: unknown } | null = null

  for (const event of events) {
    switch (event.name) {
      case "workflow:started": {
        const payload = event.payload as { workflowName?: string }
        nodes.push(
          <WorkflowBanner
            key={event.id}
            type="start"
            name={payload.workflowName ?? "workflow"}
          />
        )
        break
      }

      case "workflow:completed": {
        nodes.push(
          <WorkflowBanner
            key={event.id}
            type="complete"
            name=""
          />
        )
        break
      }

      case "phase:entered": {
        const payload = event.payload as { phase: string }
        nodes.push(
          <PhaseSeparator key={event.id} phase={payload.phase} />
        )
        break
      }

      case "agent:started": {
        const payload = event.payload as { agentName: string }
        // Flush any accumulated text
        if (currentAgentText) {
          nodes.push(
            <TextBlock key={`text-${event.id}`} text={currentAgentText} />
          )
          currentAgentText = ""
        }
        if (currentThinkingText && visibility.thinking !== "hidden") {
          nodes.push(
            <ThinkingBlock
              key={`thinking-${event.id}`}
              text={currentThinkingText}
              collapsed={visibility.thinking === "collapsed"}
            />
          )
          currentThinkingText = ""
        }
        nodes.push(
          <AgentLifecycle key={event.id} agent={payload.agentName} type="started" />
        )
        break
      }

      case "agent:completed": {
        const payload = event.payload as { agentName: string; duration?: number }
        // Flush accumulated text
        if (currentAgentText) {
          nodes.push(
            <TextBlock key={`text-${event.id}`} text={currentAgentText} />
          )
          currentAgentText = ""
        }
        if (currentThinkingText && visibility.thinking !== "hidden") {
          nodes.push(
            <ThinkingBlock
              key={`thinking-${event.id}`}
              text={currentThinkingText}
              collapsed={visibility.thinking === "collapsed"}
            />
          )
          currentThinkingText = ""
        }
        nodes.push(
          <AgentLifecycle
            key={event.id}
            agent={payload.agentName}
            type="completed"
            duration={payload.duration}
          />
        )
        break
      }

      case "text:delta": {
        const payload = event.payload as { delta?: string; text?: string }
        currentAgentText += payload.delta ?? payload.text ?? ""
        break
      }

      case "thinking:delta": {
        const payload = event.payload as { delta?: string; text?: string }
        currentThinkingText += payload.delta ?? payload.text ?? ""
        break
      }

      case "tool:called": {
        if (visibility.tools === "hidden") break
        const payload = event.payload as { toolName?: string; tool?: string; input?: unknown; args?: unknown }
        pendingToolCall = { name: payload.toolName ?? payload.tool ?? "tool", args: payload.input ?? payload.args }
        break
      }

      case "tool:result": {
        if (visibility.tools === "hidden") {
          pendingToolCall = null
          break
        }
        const payload = event.payload as { output?: unknown; result?: unknown }
        if (pendingToolCall) {
          nodes.push(
            <ToolCall
              key={event.id}
              tool={pendingToolCall.name}
              args={pendingToolCall.args}
              result={payload.output ?? payload.result}
              collapsed={visibility.tools === "collapsed"}
            />
          )
          pendingToolCall = null
        }
        break
      }

      default:
        // Unknown events are silently ignored
        // Workflow-specific data should be in state, not events
        break
    }
  }

  // Flush any remaining accumulated text
  if (currentAgentText) {
    nodes.push(
      <TextBlock key="text-final" text={currentAgentText} />
    )
  }
  if (currentThinkingText && visibility.thinking !== "hidden") {
    nodes.push(
      <ThinkingBlock
        key="thinking-final"
        text={currentThinkingText}
        collapsed={visibility.thinking === "collapsed"}
      />
    )
  }

  return nodes
}
