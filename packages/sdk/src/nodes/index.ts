/**
 * Built-in node definitions.
 */

// Re-export basic nodes from @open-harness/nodes-basic
export { constantNode, echoNode } from "@open-harness/nodes-basic";
export {
  type ClaudeAgentExtendedOptions,
  type ClaudeAgentInput,
  type ClaudeAgentOutput,
  type ClaudeMessageInput,
  type ClaudeNodeOptions,
  claudeNode,
  createClaudeNode,
  resolveOutputSchema,
} from "./claude.agent.js";
