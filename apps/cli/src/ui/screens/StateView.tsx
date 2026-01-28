/**
 * State view screen - renders workflow state as a JSON tree.
 *
 * This is where users can see workflow-specific data like tasks,
 * verdicts, etc. The CLI doesn't need to know about these concepts -
 * it just renders the state tree generically.
 *
 * @module
 */

import { TextAttributes } from "@opentui/core"
import { StateTree } from "../components/state/StateTree.js"

export interface StateViewProps {
  state: unknown
}

export function StateView({ state }: StateViewProps) {
  if (state === null || state === undefined) {
    return (
      <box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        flexGrow={1}
      >
        <text fg="#666666">No state available</text>
        <text fg="#666666">Waiting for workflow to update state...</text>
      </box>
    )
  }

  return (
    <box flexDirection="column" flexGrow={1}>
      <box border={true} borderStyle="single" borderColor="#444444" paddingLeft={1}>
        <text fg="#ffffff" attributes={TextAttributes.BOLD}>State</text>
      </box>
      <scrollbox flexGrow={1}>
        <box paddingLeft={1}>
          <StateTree value={state} />
        </box>
      </scrollbox>
    </box>
  )
}
